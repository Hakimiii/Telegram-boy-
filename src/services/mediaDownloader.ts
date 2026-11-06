import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import {
  identifyPlatform,
  getStandardQualityOptions,
  type VideoFormatOption,
  formatDuration,
  formatFileSize,
  parseSongInfoFromText,
  type IdentifiedSong
} from './mediaParser.ts';
import { extractSpotifyInfo, downloadSpotifyTrack } from './spotifyResolver.ts';

const execAsync = promisify(exec);
const YT_DLP_PATH = path.resolve(process.cwd(), 'bin/yt-dlp');
const DOWNLOAD_DIR = path.resolve('/tmp/downloads');
const PRIMARY_COOKIES_PATH = path.resolve(process.cwd(), 'instagram_cookies.txt');
const BACKUP_COOKIES_PATH = path.resolve('/tmp/instagram_cookies.txt');

export function ensureYtDlpExecutable() {
  if (fs.existsSync(YT_DLP_PATH)) {
    try {
      fs.chmodSync(YT_DLP_PATH, 0o755);
    } catch {}
  }
}
ensureYtDlpExecutable();

// Ensure download directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// Initialize session cookies from env if present
if (process.env.INSTAGRAM_SESSION_ID && !hasInstagramCookies()) {
  saveInstagramSession(process.env.INSTAGRAM_SESSION_ID);
}

export function clearInstagramCookies() {
  try {
    if (fs.existsSync(PRIMARY_COOKIES_PATH)) fs.unlinkSync(PRIMARY_COOKIES_PATH);
    if (fs.existsSync(BACKUP_COOKIES_PATH)) fs.unlinkSync(BACKUP_COOKIES_PATH);
    console.log('[Instagram] Cookies cleared.');
  } catch (err) {
    console.warn('[Instagram] Error clearing cookies:', err);
  }
}

export function saveInstagramSession(sessionIdOrNetscape: string): { success: boolean; message: string } {
  try {
    const val = sessionIdOrNetscape.trim();
    if (!val) {
      clearInstagramCookies();
      return { success: true, message: 'سشن اینستاگرام با موفقیت حذف شد.' };
    }

    let cookieContent = '';
    if (val.includes('\t') || val.includes('# Netscape')) {
      cookieContent = val.endsWith('\n') ? val : val + '\n';
    } else {
      cookieContent = `# Netscape HTTP Cookie File\n.instagram.com\tTRUE\t/\tTRUE\t2147483647\tsessionid\t${val}\n`;
    }

    fs.writeFileSync(PRIMARY_COOKIES_PATH, cookieContent, 'utf-8');
    try {
      fs.writeFileSync(BACKUP_COOKIES_PATH, cookieContent, 'utf-8');
    } catch {}

    return { success: true, message: 'کوکی و سشن اینستاگرام با موفقیت ذخیره شد.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'خطا در ذخیره سشن' };
  }
}

export function hasInstagramCookies(): boolean {
  return fs.existsSync(PRIMARY_COOKIES_PATH) || fs.existsSync(BACKUP_COOKIES_PATH);
}

function getActiveCookiesPath(): string | null {
  if (fs.existsSync(PRIMARY_COOKIES_PATH)) return PRIMARY_COOKIES_PATH;
  if (fs.existsSync(BACKUP_COOKIES_PATH)) return BACKUP_COOKIES_PATH;
  return null;
}

function getCookieArg(url: string): string {
  if (url.includes('instagram.com')) {
    const cookiesPath = getActiveCookiesPath();
    if (cookiesPath) {
      return `--cookies "${cookiesPath}"`;
    }
  }
  return '';
}

export interface ExtractedMediaInfo {
  url: string;
  title: string;
  thumbnail: string;
  duration: number;
  durationFormatted: string;
  uploader: string;
  platform: string;
  platformNameFa: string;
  platformNameEn: string;
  viewCount?: number;
  availableFormats: VideoFormatOption[];
  track?: string;
  artist?: string;
  album?: string;
  genre?: string;
}

export interface DownloadResult {
  id: string;
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  mimeType: string;
  title: string;
  duration: number;
  ext: string;
  songInfo?: IdentifiedSong;
}

/**
 * Clean up old downloads
 */
export function cleanOldDownloads() {
  try {
    if (!fs.existsSync(DOWNLOAD_DIR)) return;
    const files = fs.readdirSync(DOWNLOAD_DIR);
    const now = Date.now();
    for (const file of files) {
      const fullPath = path.join(DOWNLOAD_DIR, file);
      const stat = fs.statSync(fullPath);
      if (now - stat.mtimeMs > 30 * 60 * 1000) {
        fs.unlinkSync(fullPath);
      }
    }
  } catch (err) {
    console.error('Error cleaning old downloads:', err);
  }
}

const cleanupInterval = setInterval(cleanOldDownloads, 15 * 60 * 1000);
if (cleanupInterval.unref) cleanupInterval.unref();

/**
 * Extract video information & formats using yt-dlp
 */
export async function extractMediaInfo(url: string): Promise<ExtractedMediaInfo> {
  const platform = identifyPlatform(url);
  const cleanUrl = platform.cleanUrl;

  if (platform.platform === 'spotify') {
    const sp = await extractSpotifyInfo(cleanUrl);
    return {
      url: cleanUrl,
      title: sp.title,
      thumbnail: sp.thumbnail,
      duration: 180,
      durationFormatted: '3:00',
      uploader: sp.artist,
      platform: 'spotify',
      platformNameFa: 'اسپاتیفای',
      platformNameEn: 'Spotify',
      availableFormats: [
        {
          id: 'best_audio',
          label: '🎵 320kbps MP3 (Original)',
          labelFa: '🎵 دانلود فایل صوتی اورجینال (320k)',
          resolution: '320kbps',
          ext: 'mp3',
          isAudioOnly: true,
          qualityRank: 1,
        }
      ],
      track: sp.title,
      artist: sp.artist,
      album: sp.album,
    };
  }

  const cookieArg = getCookieArg(cleanUrl);

  try {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    const cmd = `"${YT_DLP_PATH}" --dump-json --js-runtimes node --no-warnings --no-playlist --skip-download ${cookieArg} --user-agent "${userAgent}" "${cleanUrl}"`;
    let stdoutData = '';
    try {
      const res = await execAsync(cmd, { timeout: 25000 });
      stdoutData = res.stdout;
    } catch (cmdErr: any) {
      if (cookieArg) {
        console.warn(`yt-dlp extraction with cookies failed (${cmdErr?.message?.slice(0, 100)}...), retrying without cookies...`);
        const noCookieCmd = `"${YT_DLP_PATH}" --dump-json --js-runtimes node --no-warnings --no-playlist --skip-download --user-agent "${userAgent}" "${cleanUrl}"`;
        const res = await execAsync(noCookieCmd, { timeout: 25000 });
        stdoutData = res.stdout;
        if (cmdErr?.message?.includes('JSONDecodeError') || cmdErr?.message?.includes('Failed to parse JSON')) {
          console.warn('[Instagram] Stored session cookie is expired/invalid. Automatically cleared.');
          clearInstagramCookies();
        }
      } else {
        throw cmdErr;
      }
    }
    const info = JSON.parse(stdoutData);

    const title = info.title || `${platform.platformNameFa} - ویدیو`;
    const thumbnail = info.thumbnail || info.thumbnails?.[0]?.url || '';
    const duration = info.duration || 0;
    const uploader = info.uploader || info.channel || info.uploader_id || platform.platformNameEn;
    const viewCount = info.view_count || undefined;

    const track = info.track || undefined;
    const artist = info.artist || (info.artists && info.artists[0]) || undefined;
    const album = info.album || undefined;
    const genre = info.genre || (info.genres && info.genres[0]) || undefined;

    const formats = getStandardQualityOptions(platform.platform);

    return {
      url: cleanUrl,
      title,
      thumbnail,
      duration,
      durationFormatted: formatDuration(duration),
      uploader,
      platform: platform.platform,
      platformNameFa: platform.platformNameFa,
      platformNameEn: platform.platformNameEn,
      viewCount,
      availableFormats: formats,
      track,
      artist,
      album,
      genre,
    };
  } catch (err: any) {
    console.warn(`yt-dlp extract warning for ${cleanUrl}:`, err?.message || err);

    const formats = getStandardQualityOptions(platform.platform);
    return {
      url: cleanUrl,
      title: `${platform.platformNameFa} - رسانه آماده دانلود`,
      thumbnail: '',
      duration: 0,
      durationFormatted: 'نامشخص',
      uploader: platform.platformNameFa,
      platform: platform.platform,
      platformNameFa: platform.platformNameFa,
      platformNameEn: platform.platformNameEn,
      availableFormats: formats,
    };
  }
}

/**
 * AI & Heuristic Song Recognition for Reels and Videos
 */
export async function identifySongFromMedia(url: string, existingInfo?: ExtractedMediaInfo): Promise<IdentifiedSong> {
  const info = existingInfo || await extractMediaInfo(url);

  // If yt-dlp extracted embedded track and artist
  if (info.track && info.artist) {
    return {
      title: info.track,
      artist: info.artist,
      album: info.album || 'Single',
      genre: info.genre,
      confidence: 'high',
      searchQuery: `${info.artist} - ${info.track}`,
    };
  }

  // Parse title heuristics
  const heuristic = parseSongInfoFromText(info.title, info.uploader);

  // If Gemini API key is present, use AI for smart identification
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI();
      const prompt = `Identify the exact music track, song name, and artist used in this social media post/reel.
Post Title: "${info.title}"
Platform: "${info.platformNameEn}"
Uploader/Creator: "${info.uploader}"
URL: "${info.url}"

Respond in JSON format only:
{
  "title": "Exact Song Name",
  "artist": "Artist or Band Name",
  "album": "Album Name (or Single)",
  "genre": "Genre",
  "confidence": "high" or "medium"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      if (parsed.title && parsed.artist) {
        return {
          title: parsed.title,
          artist: parsed.artist,
          album: parsed.album || 'Single',
          genre: parsed.genre,
          confidence: 'high',
          searchQuery: `${parsed.artist} - ${parsed.title}`,
        };
      }
    } catch (e) {
      console.warn('Gemini song recognition fallback:', e);
    }
  }

  return heuristic;
}

/**
 * Downloads a video or audio file with the specified quality
 */
export async function downloadMedia(url: string, qualityId: string = 'best_720'): Promise<DownloadResult> {
  const platform = identifyPlatform(url);
  const cleanUrl = platform.cleanUrl;

  if (platform.platform === 'spotify') {
    const sp = await extractSpotifyInfo(cleanUrl);
    const result = await downloadSpotifyTrack(sp);
    return {
      id: result.id,
      filePath: result.filePath,
      fileName: result.fileName,
      fileSizeBytes: result.fileSizeBytes,
      fileSizeFormatted: result.fileSizeFormatted,
      mimeType: 'audio/mpeg',
      title: `${result.artist} - ${result.title}`,
      duration: 180,
      ext: 'mp3',
      songInfo: {
        title: result.title,
        artist: result.artist,
        album: result.album,
        confidence: 'high',
        searchQuery: `${result.artist} ${result.title}`,
      },
    };
  }

  const cookieArg = getCookieArg(cleanUrl);

  const fileId = crypto.randomUUID();
  const isAudio = qualityId === 'best_audio' || qualityId === 'standard_audio' || qualityId === 'find_song';
  const ext = isAudio ? 'mp3' : 'mp4';
  const outputTemplate = path.join(DOWNLOAD_DIR, `${fileId}.%(ext)s`);

  let formatArg = '';
  const browserUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const extraArgs = `${cookieArg} --js-runtimes node --user-agent "${browserUserAgent}" --no-check-certificates --geo-bypass`;

  switch (qualityId) {
    case 'best_1080':
      formatArg = '-f "bv*[height<=1080]+ba/b[height<=1080]/bv*+ba/b" --merge-output-format mp4';
      break;
    case 'best_720':
      formatArg = '-f "bv*[height<=720]+ba/b[height<=720]/bv*+ba/b" --merge-output-format mp4';
      break;
    case 'best_480':
      formatArg = '-f "bv*[height<=480]+ba/b[height<=480]/bv*+ba/b" --merge-output-format mp4';
      break;
    case 'best_360':
      formatArg = '-f "bv*[height<=360]+ba/b[height<=360]/bv*+ba/b" --merge-output-format mp4';
      break;
    case 'best_audio':
    case 'find_song':
      formatArg = '-x --audio-format mp3 --audio-quality 0';
      break;
    case 'standard_audio':
      formatArg = '-x --audio-format mp3 --audio-quality 5';
      break;
    default:
      formatArg = '-f "b/bv*+ba/best" --merge-output-format mp4';
      break;
  }

  ensureYtDlpExecutable();
  const cmd = `"${YT_DLP_PATH}" ${formatArg} ${extraArgs} --no-playlist -o "${outputTemplate}" "${cleanUrl}"`;
  
  try {
    await execAsync(cmd, { timeout: 120000 });
  } catch (err: any) {
    console.warn(`Format download ${qualityId} failed, trying fallback:`, err?.message);
    ensureYtDlpExecutable();
    const fallbackArgs = cookieArg
      ? `--js-runtimes node --user-agent "${browserUserAgent}" --no-check-certificates --geo-bypass`
      : extraArgs;
    const fallbackCmd = `"${YT_DLP_PATH}" -f "b/bv*+ba/best" ${fallbackArgs} --no-playlist -o "${outputTemplate}" "${cleanUrl}"`;
    await execAsync(fallbackCmd, { timeout: 120000 });
  }

  const matchingFiles = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.startsWith(fileId));
  if (matchingFiles.length === 0) {
    throw new Error('فایل دانلود شده یافت نشد.');
  }

  const actualFileName = matchingFiles[0];
  const finalFilePath = path.join(DOWNLOAD_DIR, actualFileName);
  const stats = fs.statSync(finalFilePath);
  const actualExt = path.extname(actualFileName).replace('.', '') || ext;

  const mimeType = isAudio || actualExt === 'mp3' ? 'audio/mpeg' : 'video/mp4';

  let songInfo: IdentifiedSong | undefined = undefined;
  if (qualityId === 'find_song' || platform.platform === 'soundcloud') {
    try {
      songInfo = await identifySongFromMedia(cleanUrl);
    } catch (e) {
      // fallback
    }
  }

  return {
    id: fileId,
    filePath: finalFilePath,
    fileName: actualFileName,
    fileSizeBytes: stats.size,
    fileSizeFormatted: formatFileSize(stats.size),
    mimeType,
    title: 'Downloaded Media',
    duration: 0,
    ext: actualExt,
    songInfo,
  };
}

export interface InstagramMediaItem {
  filePath: string;
  fileName: string;
  type: 'video' | 'photo';
  sizeBytes: number;
  sizeFormatted: string;
}

export interface InstagramPostResult {
  id: string;
  caption: string;
  uploader: string;
  title: string;
  items: InstagramMediaItem[];
}

/**
 * Download Instagram Post / Reel / Carousel without quality selector, along with original caption
 */
export async function downloadInstagramPost(url: string): Promise<InstagramPostResult> {
  const platform = identifyPlatform(url);
  const cleanUrl = platform.cleanUrl;
  const cookieArg = getCookieArg(cleanUrl);
  ensureYtDlpExecutable();

  const fileId = crypto.randomUUID();
  const outputTemplate = path.join(DOWNLOAD_DIR, `${fileId}_%(autonumber)02d.%(ext)s`);

  let caption = '';
  let uploader = 'Instagram';
  let title = 'Instagram Post';

  // 1. Fetch metadata to extract caption description and uploader
  let activeCookie = cookieArg;
  try {
    const metaCmd = `"${YT_DLP_PATH}" --dump-json --skip-download ${activeCookie} --no-warnings "${cleanUrl}"`;
    let metaOut = '';
    try {
      const res = await execAsync(metaCmd, { timeout: 25000 });
      metaOut = res.stdout;
    } catch (metaErr: any) {
      if (activeCookie) {
        console.warn('Instagram metadata extract with cookie failed, retrying without cookies...');
        const noCookieMeta = `"${YT_DLP_PATH}" --dump-json --skip-download --no-warnings "${cleanUrl}"`;
        const res = await execAsync(noCookieMeta, { timeout: 25000 });
        metaOut = res.stdout;
        activeCookie = '';
        if (metaErr?.message?.includes('JSONDecodeError') || metaErr?.message?.includes('Failed to parse JSON')) {
          console.warn('[Instagram] Stored session cookie is invalid. Automatically cleared.');
          clearInstagramCookies();
        }
      } else {
        throw metaErr;
      }
    }
    const info = JSON.parse(metaOut);
    caption = info.description || info.title || '';
    uploader = info.uploader || info.channel || 'اینستاگرام';
    title = info.title || '';
  } catch (err) {
    console.warn('Instagram metadata extract warning:', err);
  }

  // 2. Download all slides/media in post (reels, single video, single photo, or carousel)
  const browserUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const downloadCmd = `"${YT_DLP_PATH}" ${activeCookie} --yes-playlist --no-check-certificates --geo-bypass --user-agent "${browserUserAgent}" -f "bv*+ba/b/best" -o "${outputTemplate}" "${cleanUrl}"`;

  try {
    await execAsync(downloadCmd, { timeout: 120000 });
  } catch (err: any) {
    console.warn('Initial Instagram download failed, trying fallback without cookies:', err?.message);
    ensureYtDlpExecutable();
    const fallbackCmd = `"${YT_DLP_PATH}" --yes-playlist --no-check-certificates --geo-bypass --user-agent "${browserUserAgent}" -o "${outputTemplate}" "${cleanUrl}"`;
    await execAsync(fallbackCmd, { timeout: 120000 });
  }

  const matchingFiles = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.startsWith(fileId)).sort();
  if (matchingFiles.length === 0) {
    throw new Error('فایلی برای این پست اینستاگرام یافت نشد.');
  }

  const items: InstagramMediaItem[] = matchingFiles.map(file => {
    const fullPath = path.join(DOWNLOAD_DIR, file);
    const stats = fs.statSync(fullPath);
    const ext = path.extname(file).toLowerCase();
    const isVideo = ext === '.mp4' || ext === '.mov' || ext === '.mkv' || ext === '.webm';
    return {
      filePath: fullPath,
      fileName: file,
      type: isVideo ? 'video' : 'photo',
      sizeBytes: stats.size,
      sizeFormatted: formatFileSize(stats.size),
    };
  });

  return {
    id: fileId,
    caption,
    uploader,
    title,
    items,
  };
}

/**
 * Get direct streaming URL without local disk download
 */
export async function getDirectStreamUrl(url: string, qualityId: string = 'best_720'): Promise<string | null> {
  try {
    const platform = identifyPlatform(url);
    const cleanUrl = platform.cleanUrl;
    const cookieArg = getCookieArg(cleanUrl);

    let formatArg = 'b';
    if (qualityId === 'best_audio' || qualityId === 'find_song') {
      formatArg = 'bestaudio';
    } else if (qualityId === 'best_720') {
      formatArg = 'best[height<=720]/b';
    } else if (qualityId === 'best_1080') {
      formatArg = 'best[height<=1080]/b';
    }

    const cmd = `"${YT_DLP_PATH}" -g -f "${formatArg}" ${cookieArg} --js-runtimes node "${cleanUrl}"`;
    const { stdout } = await execAsync(cmd, { timeout: 20000 });
    const directUrl = stdout.trim().split('\n')[0];
    return directUrl || null;
  } catch (err) {
    return null;
  }
}

