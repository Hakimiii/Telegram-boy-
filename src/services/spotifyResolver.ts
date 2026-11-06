import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { formatFileSize } from './mediaParser.ts';

const execAsync = promisify(exec);
const YT_DLP_PATH = path.resolve(process.cwd(), 'bin/yt-dlp');
const DOWNLOAD_DIR = path.resolve('/tmp/downloads');

function ensureDirectories() {
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    try {
      fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    } catch {}
  }
  if (fs.existsSync(YT_DLP_PATH)) {
    try {
      fs.chmodSync(YT_DLP_PATH, 0o755);
    } catch {}
  }
}
ensureDirectories();

export interface SpotifyTrackInfo {
  url: string;
  id?: string;
  title: string;
  artist: string;
  album: string;
  year?: string;
  thumbnail: string;
  previewUrl?: string;
}

export interface SpotifyDownloadResult {
  id: string;
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  title: string;
  artist: string;
  album: string;
  thumbnail: string;
  isAudioPreviewOnly?: boolean;
}

/**
 * Check if a URL is a Spotify track, album or share link
 */
export function isSpotifyUrl(url: string): boolean {
  return /open\.spotify\.com\/(?:intl-[^/]+\/)?(?:track|album|playlist)\/|spotify\.link\/|spoti\.fi\//i.test(url.trim());
}

/**
 * Extract Spotify Track ID from URL
 */
function extractSpotifyTrackId(url: string): string | null {
  const match = url.match(/(?:track)[/:]([a-zA-Z0-9]{15,30})/i);
  return match ? match[1] : null;
}

/**
 * Resolve Spotify short URLs (like spotify.link or spoti.fi)
 */
async function resolveRedirectUrl(url: string): Promise<string> {
  if (url.includes('spotify.link') || url.includes('spoti.fi')) {
    try {
      const resp = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      return resp.url || url;
    } catch (e) {
      console.warn('Failed to resolve Spotify short url:', e);
    }
  }
  return url;
}

/**
 * Extract Spotify metadata using official Spotify embed JSON, oEmbed, and OpenGraph
 */
export async function extractSpotifyInfo(rawUrl: string): Promise<SpotifyTrackInfo> {
  const resolvedUrl = await resolveRedirectUrl(rawUrl.trim());
  const cleanUrl = resolvedUrl.split('?')[0];
  const trackId = extractSpotifyTrackId(cleanUrl);

  let title = 'قطعه اسپاتیفای';
  let artist = '';
  let album = 'Single';
  let year = '';
  let thumbnail = '';
  let previewUrl = '';

  // Strategy 1: Fetch Spotify Embed page which contains complete __NEXT_DATA__
  if (trackId) {
    try {
      const embedUrl = `https://open.spotify.com/embed/track/${trackId}`;
      const res = await fetch(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (res.ok) {
        const html = await res.text();
        const scriptMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
        if (scriptMatch && scriptMatch[1]) {
          const json = JSON.parse(scriptMatch[1]);
          const entity = json?.props?.pageProps?.state?.data?.entity;
          if (entity) {
            if (entity.name) title = entity.name;
            if (Array.isArray(entity.artists) && entity.artists.length > 0) {
              artist = entity.artists.map((a: any) => a.name).filter(Boolean).join(', ');
            }
            if (entity.album?.name) album = entity.album.name;
            if (entity.album?.images?.[0]?.url) thumbnail = entity.album.images[0].url;
            if (entity.audioPreview?.url) previewUrl = entity.audioPreview.url;
            if (typeof entity.releaseDate === 'string') {
              year = entity.releaseDate.slice(0, 4);
            } else if (entity.releaseDate?.isoString) {
              year = String(entity.releaseDate.isoString).slice(0, 4);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Spotify embed extraction failed:', err);
    }
  }

  // Strategy 2: If artist or title is still missing, fetch oEmbed metadata
  if (!artist || !thumbnail || title === 'قطعه اسپاتیفای') {
    try {
      const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
      const oembedRes = await fetch(oembedUrl);
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        if (oembedData.title && title === 'قطعه اسپاتیفای') {
          title = oembedData.title;
        }
        if (!thumbnail && oembedData.thumbnail_url) {
          thumbnail = oembedData.thumbnail_url;
        }
      }
    } catch (err) {
      console.warn('Spotify oEmbed fetch failed:', err);
    }
  }

  // Strategy 3: Parse OpenGraph from track page
  if (!artist) {
    try {
      const pageRes = await fetch(cleanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
        if (descMatch) {
          const parts = descMatch[1].split('·').map(p => p.trim());
          if (parts.length >= 2) {
            artist = parts[0];
            if (title === 'قطعه اسپاتیفای') title = parts[1] || title;
            year = parts[3] || parts[2] || year;
          }
        }
        const imgMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
        if (imgMatch && imgMatch[1] && !thumbnail) {
          thumbnail = imgMatch[1];
        }
      }
    } catch (err) {
      console.warn('Spotify OpenGraph scrape failed:', err);
    }
  }

  if (!artist || artist === 'Spotify') {
    artist = 'Unknown Artist';
  }

  return {
    url: cleanUrl,
    id: trackId || undefined,
    title,
    artist,
    album: album || 'Single',
    year,
    thumbnail,
    previewUrl: previewUrl || undefined,
  };
}

/**
 * Resolves and downloads audio stream for Spotify track
 */
export async function downloadSpotifyTrack(spotifyInfo: SpotifyTrackInfo): Promise<SpotifyDownloadResult> {
  ensureDirectories();
  const fileId = crypto.randomUUID();
  const outputTemplate = path.join(DOWNLOAD_DIR, `${fileId}.%(ext)s`);

  // Clean strings for search queries
  const cleanTitle = spotifyInfo.title.replace(/[^\w\s\u0600-\u06FF-]/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanArtist = spotifyInfo.artist.split(',')[0].replace(/[^\w\s\u0600-\u06FF-]/g, ' ').replace(/\s+/g, ' ').trim();

  let downloadSucceeded = false;

  // Search queries in order of precision
  const searchQueries: string[] = [];
  if (cleanArtist && cleanArtist !== 'Unknown Artist' && cleanTitle) {
    searchQueries.push(`scsearch5:${cleanArtist} ${cleanTitle}`);
    searchQueries.push(`scsearch5:${cleanTitle} ${cleanArtist}`);
  }
  if (cleanTitle) {
    searchQueries.push(`scsearch5:${cleanTitle}`);
  }

  for (const query of searchQueries) {
    try {
      // Use --max-downloads 1 --ignore-errors so yt-dlp skips DRM preview tracks and downloads the first valid full audio!
      const cmd = `"${YT_DLP_PATH}" "${query}" --max-downloads 1 --ignore-errors -x --audio-format mp3 --audio-quality 0 -o "${outputTemplate}" --no-warnings`;
      try {
        await execAsync(cmd, { timeout: 90000 });
      } catch (execErr: any) {
        // Note: yt-dlp exits with code 101 when --max-downloads limit is successfully hit and remaining tracks are aborted.
        // We check below if the file was created and is non-empty.
      }

      const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.startsWith(fileId));
      if (files.length > 0) {
        const testFile = path.join(DOWNLOAD_DIR, files[0]);
        const stat = fs.statSync(testFile);
        if (stat.size > 20000) {
          downloadSucceeded = true;
          break;
        }
      }
    } catch (err) {
      console.warn(`Query failed (${query}):`, err);
    }
  }

  // Emergency Fallback: If SoundCloud searches failed, but we have official Spotify 30s preview URL
  if (!downloadSucceeded && spotifyInfo.previewUrl) {
    try {
      console.log('Using official Spotify preview audio fallback...');
      const mp3Path = path.join(DOWNLOAD_DIR, `${fileId}.mp3`);
      const resp = await fetch(spotifyInfo.previewUrl);
      if (resp.ok) {
        const buffer = Buffer.from(await resp.arrayBuffer());
        fs.writeFileSync(mp3Path, buffer);
        downloadSucceeded = true;
      }
    } catch (e) {
      console.warn('Spotify preview download fallback failed:', e);
    }
  }

  const matchingFiles = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.startsWith(fileId));
  if (!downloadSucceeded || matchingFiles.length === 0) {
    throw new Error('فایل صوتی این قطعه در پایگاه‌های آنلاین یافت نشد. لطفاً عنوان آهنگ یا لینک ساندکلود/یوتیوب آن را مستقیماً ارسال فرمایید.');
  }

  const actualFileName = matchingFiles[0];
  const finalFilePath = path.join(DOWNLOAD_DIR, actualFileName);
  const stats = fs.statSync(finalFilePath);

  return {
    id: fileId,
    filePath: finalFilePath,
    fileName: actualFileName,
    fileSizeBytes: stats.size,
    fileSizeFormatted: formatFileSize(stats.size),
    title: spotifyInfo.title,
    artist: spotifyInfo.artist,
    album: spotifyInfo.album,
    thumbnail: spotifyInfo.thumbnail,
  };
}
