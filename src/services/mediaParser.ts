/**
 * Media link parser, platform identification, and format classification utilities
 */

export interface MediaPlatformInfo {
  platform: 'instagram' | 'youtube' | 'tiktok' | 'twitter' | 'facebook' | 'pinterest' | 'reddit' | 'soundcloud' | 'spotify' | 'other';
  platformNameFa: string;
  platformNameEn: string;
  icon: string;
  color: string;
  isValid: boolean;
  cleanUrl: string;
}

export interface VideoFormatOption {
  id: string;
  label: string;
  labelFa: string;
  resolution: string;
  ext: string;
  isAudioOnly?: boolean;
  approxSize?: string;
  qualityRank: number;
}

export interface IdentifiedSong {
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  confidence?: 'high' | 'medium' | 'estimated';
  searchQuery?: string;
}

/**
 * Extracts URL from message text
 */
export function extractUrl(text: string): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0].trim() : null;
}

/**
 * Identifies the social media platform from any URL and cleans tracking tokens
 */
export function identifyPlatform(rawUrl: string): MediaPlatformInfo {
  const url = rawUrl.trim();
  
  if (/instagram\.com\/(reel|p|tv|stories|share)\//i.test(url) || /instagram\.com/i.test(url)) {
    let clean = url;
    const instaMatch = url.match(/(?:instagram\.com\/(reel|p|tv|share)\/)([A-Za-z0-9_-]+)/i);
    if (instaMatch) {
      const type = instaMatch[1].toLowerCase() === 'p' ? 'p' : 'reel';
      clean = `https://www.instagram.com/${type}/${instaMatch[2]}/`;
    }

    return {
      platform: 'instagram',
      platformNameFa: 'اینستاگرام',
      platformNameEn: 'Instagram',
      icon: 'Instagram',
      color: '#E1306C',
      isValid: true,
      cleanUrl: clean,
    };
  }

  if (/open\.spotify\.com\/(?:intl-[^/]+\/)?(?:track|album|playlist)\/|spotify\.link\/|spoti\.fi\//i.test(url)) {
    return {
      platform: 'spotify',
      platformNameFa: 'اسپاتیفای',
      platformNameEn: 'Spotify',
      icon: 'Music',
      color: '#1DB954',
      isValid: true,
      cleanUrl: url.split('?')[0],
    };
  }

  if (/soundcloud\.com\/|on\.soundcloud\.com\//i.test(url)) {
    return {
      platform: 'soundcloud',
      platformNameFa: 'ساندکلود',
      platformNameEn: 'SoundCloud',
      icon: 'Radio',
      color: '#FF5500',
      isValid: true,
      cleanUrl: url.split('?')[0],
    };
  }

  if (/(?:youtube\.com\/(?:watch\?v=|shorts\/|v\/)|youtu\.be\/)/i.test(url)) {
    let clean = url;
    const ytShortsMatch = url.match(/(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]+)/i);
    if (ytShortsMatch) {
      clean = `https://www.youtube.com/shorts/${ytShortsMatch[1]}`;
    } else {
      const ytWatchMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/i);
      if (ytWatchMatch) {
        clean = `https://www.youtube.com/watch?v=${ytWatchMatch[1]}`;
      }
    }

    return {
      platform: 'youtube',
      platformNameFa: 'یوتیوب',
      platformNameEn: 'YouTube',
      icon: 'Youtube',
      color: '#FF0000',
      isValid: true,
      cleanUrl: clean,
    };
  }

  if (/tiktok\.com\//i.test(url) || /douyin\.com\//i.test(url)) {
    const clean = url.split('?')[0];
    return {
      platform: 'tiktok',
      platformNameFa: 'تیک‌تاک',
      platformNameEn: 'TikTok',
      icon: 'Share2',
      color: '#00F2FE',
      isValid: true,
      cleanUrl: clean,
    };
  }

  if (/twitter\.com\/.*\/status\//i.test(url) || /x\.com\/.*\/status\//i.test(url)) {
    const clean = url.split('?')[0];
    return {
      platform: 'twitter',
      platformNameFa: 'توییتر / ایکس',
      platformNameEn: 'Twitter (X)',
      icon: 'Twitter',
      color: '#1DA1F2',
      isValid: true,
      cleanUrl: clean,
    };
  }

  if (/facebook\.com|fb\.watch/i.test(url)) {
    return {
      platform: 'facebook',
      platformNameFa: 'فیس‌بوک',
      platformNameEn: 'Facebook',
      icon: 'Facebook',
      color: '#1877F2',
      isValid: true,
      cleanUrl: url,
    };
  }

  if (/pinterest\.com|pin\.it/i.test(url)) {
    return {
      platform: 'pinterest',
      platformNameFa: 'پینترست',
      platformNameEn: 'Pinterest',
      icon: 'Pin',
      color: '#E60023',
      isValid: true,
      cleanUrl: url,
    };
  }

  if (/reddit\.com\/r\/.*\/comments\//i.test(url) || /v\.redd\.it\//i.test(url)) {
    return {
      platform: 'reddit',
      platformNameFa: 'ردیت',
      platformNameEn: 'Reddit',
      icon: 'MessageSquare',
      color: '#FF4500',
      isValid: true,
      cleanUrl: url.split('?')[0],
    };
  }

  const isHttp = /^https?:\/\/.+/i.test(url);
  return {
    platform: 'other',
    platformNameFa: 'سایر سرویس‌ها',
    platformNameEn: 'Other Service',
    icon: 'Globe',
    color: '#6366F1',
    isValid: isHttp,
    cleanUrl: url,
  };
}

/**
 * Standardize quality format options for any video or audio
 */
export function getStandardQualityOptions(platform: string = 'other'): VideoFormatOption[] {
  if (platform === 'soundcloud') {
    return [
      {
        id: 'best_audio',
        label: '🎵 320kbps MP3 (HQ)',
        labelFa: '🎵 کیفیت عالی اورجینال (320k)',
        resolution: '320kbps',
        ext: 'mp3',
        isAudioOnly: true,
        qualityRank: 1,
      },
      {
        id: 'standard_audio',
        label: '🎧 128kbps MP3 (Standard)',
        labelFa: '🎧 کیفیت استاندارد (128k)',
        resolution: '128kbps',
        ext: 'mp3',
        isAudioOnly: true,
        qualityRank: 2,
      },
      {
        id: 'find_song',
        label: '🔍 Song Info & Lyrics',
        labelFa: '🔍 اطلاعات کامل ترک و متن',
        resolution: 'Info',
        ext: 'txt',
        qualityRank: 3,
      }
    ];
  }

  return [
    {
      id: 'best_1080',
      label: '🎬 1080p Full HD',
      labelFa: '🎬 کیفیت 1080p (فول اچ‌دی)',
      resolution: '1080p',
      ext: 'mp4',
      qualityRank: 1,
    },
    {
      id: 'best_720',
      label: '🎥 720p HD',
      labelFa: '🎥 کیفیت 720p (اچ‌دی)',
      resolution: '720p',
      ext: 'mp4',
      qualityRank: 2,
    },
    {
      id: 'best_480',
      label: '📱 480p SD',
      labelFa: '📱 کیفیت 480p (استاندارد)',
      resolution: '480p',
      ext: 'mp4',
      qualityRank: 3,
    },
    {
      id: 'best_360',
      label: '⚡ 360p Low',
      labelFa: '⚡ کیفیت 360p (کم‌حجم)',
      resolution: '360p',
      ext: 'mp4',
      qualityRank: 4,
    },
    {
      id: 'best_audio',
      label: '🎧 MP3 Audio',
      labelFa: '🎧 دانلود صوت اورجینال (MP3)',
      resolution: 'Audio',
      ext: 'mp3',
      isAudioOnly: true,
      qualityRank: 5,
    },
    {
      id: 'find_song',
      label: '🎵 AI Song Finder',
      labelFa: '🎵 تشخیص نام موزیک ریلز (AI)',
      resolution: 'Song Finder',
      ext: 'mp3',
      qualityRank: 6,
    }
  ];
}

/**
 * Format duration seconds into mm:ss or hh:mm:ss
 */
export function formatDuration(seconds: number | undefined): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '0:00';
  const sec = Math.floor(seconds);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format bytes to human readable format (MB, GB)
 */
export function formatFileSize(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return 'نامشخص';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

/**
 * Heuristics to extract song and artist from raw title, description, or track tags
 */
export function parseSongInfoFromText(title: string, uploader: string = ''): IdentifiedSong {
  // Check common patterns like "Artist - Title" or "Title (feat. Artist)"
  const cleaned = title.replace(/\[official.*\]|\(official.*\)|#shorts|#reels|#tiktok/gi, '').trim();

  const dashMatch = cleaned.match(/^([^-–—]+)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    return {
      artist: dashMatch[1].trim(),
      title: dashMatch[2].trim(),
      confidence: 'medium',
      searchQuery: `${dashMatch[1].trim()} ${dashMatch[2].trim()}`,
    };
  }

  return {
    artist: uploader || 'نامشخص',
    title: cleaned || title,
    confidence: 'estimated',
    searchQuery: `${uploader} ${cleaned}`.trim(),
  };
}

/**
 * Evaluates HTTP status code from a webhook pre-flight POST test
 */
export function evaluateWebhookCheckStatus(statusCode: number): { valid: boolean; reasonFa?: string } {
  if (statusCode >= 200 && statusCode < 300) {
    return { valid: true };
  }
  if (statusCode === 301 || statusCode === 302 || statusCode === 307 || statusCode === 308) {
    return {
      valid: false,
      reasonFa: `آدرس وب‌هوک درخواست را ریدایرکت کرد (HTTP ${statusCode}). این آدرس نیاز به احراز هویت مرورگر دارد و سرور تلگرام نمی‌تواند به آن پیام بفرستد. ربات در حالت Polling فعال نگه داشته شد.`,
    };
  }
  if (statusCode === 401 || statusCode === 403) {
    return {
      valid: false,
      reasonFa: `آدرس وب‌هوک دارای قفل امنیتی است (HTTP ${statusCode} - مانند قفل Vercel Authentication). ابتدا قفل Deployment Protection را خاموش کنید. ربات در حالت Polling فعال نگه داشته شد.`,
    };
  }
  if (statusCode === 404 || statusCode === 405) {
    return {
      valid: false,
      reasonFa: `اندپوینت وب‌هوک روی این دامنه درخواست POST را پشتیبانی نمی‌کند (HTTP ${statusCode}). کدهای جدید هنوز روی آن هاست دیپلوی نشده‌اند. ربات در حالت Polling فعال نگه داشته شد.`,
    };
  }
  return {
    valid: false,
    reasonFa: `آدرس وب‌هوک پاسخ نامعتبر برگرداند (HTTP ${statusCode}). ربات در حالت Polling فعال نگه داشته شد.`,
  };
}

