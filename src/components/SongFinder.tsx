import React, { useState } from 'react';
import {
  Music,
  Sparkles,
  Search,
  Radio,
  ExternalLink,
  Download,
  Loader2,
  CheckCircle2,
  Disc,
  User,
  Headphones,
  Volume2,
  Play
} from 'lucide-react';
import { IdentifiedSong, MediaInfo } from '../types.ts';

export const SongFinder: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [song, setSong] = useState<IdentifiedSong | null>(null);
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const sampleLinks = [
    { name: 'ریلز اینستاگرام (موزیک)', url: 'https://www.instagram.com/reel/C8XYZ123' },
    { name: 'آهنگ ساندکلود', url: 'https://soundcloud.com/octobersveryown/drake-gods-plan' },
    { name: 'یوتیوب شورتز', url: 'https://www.youtube.com/shorts/sample' },
  ];

  const handleIdentify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setSong(null);
    setMediaInfo(null);
    setDownloadSuccess(null);

    try {
      const res = await fetch('/api/media/identify-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'خطا در تشخیص موزیک ریلز');
      }

      setSong(data.song);
      setMediaInfo(data.mediaInfo);
    } catch (err: any) {
      setError(err?.message || 'خطا در ارتباط با سرور موزیک‌یاب');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSong = async () => {
    if (!mediaInfo) return;
    setDownloading(true);
    setDownloadSuccess(null);

    try {
      const res = await fetch('/api/media/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: mediaInfo.url,
          qualityId: 'best_audio',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'خطا در دانلود فایل صوتی');
      }

      setDownloadSuccess(data.fileSize);

      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = `${song?.artist || 'Music'} - ${song?.title || 'Song'}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      setError(err?.message || 'خطا در دانلود موزیک');
    } finally {
      setDownloading(false);
    }
  };

  const searchEncoded = encodeURIComponent(song?.searchQuery || `${song?.artist || ''} ${song?.title || ''}`);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
      
      {/* Hero */}
      <div className="text-center space-y-4 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-pink-400" />
          <span>تشخیص هوشمند قطعه موسیقی و دانلود با کیفیت اورجینال ۳۲۰k</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          پیدا کردن و دانلود آهنگ از روی ریلز و کلیپ
        </h2>
        <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
          لینک ریلز اینستاگرام، ویدیو تیک‌تاک یا ساندکلود را وارد کنید تا نام آهنگ، خواننده و فایل صوتی MP3 با بالاترین کیفیت برای شما استخراج شود!
        </p>
      </div>

      {/* Input Box */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
        <form onSubmit={handleIdentify} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-pink-400">
                <Music className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="لینک ریلز اینستاگرام، تیک‌تاک یا ساندکلود را وارد کنید..."
                className="w-full pr-11 pl-4 py-3.5 sm:py-4 rounded-2xl bg-slate-950/80 border border-slate-700/80 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 text-white placeholder-slate-500 text-xs sm:text-sm outline-none transition"
                dir="ltr"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-6 py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-md shadow-pink-600/30 shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال تشخیص...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>تشخیص آهنگ ریلز</span>
                </>
              )}
            </button>
          </div>

          {/* Quick samples */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400">
            <span className="text-slate-500 text-[11px]">لینک‌های نمونه:</span>
            {sampleLinks.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setUrl(sample.url);
                  setError(null);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700/50 text-[11px]"
              >
                {sample.name}
              </button>
            ))}
          </div>
        </form>

        {error && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}
      </div>

      {/* Identified Song Card */}
      {song && mediaInfo && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
          
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            
            {/* Artwork / Vinyl visual */}
            <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-2xl overflow-hidden bg-slate-950 shrink-0 border border-slate-800 shadow-xl group">
              {mediaInfo.thumbnail ? (
                <img
                  src={mediaInfo.thumbnail}
                  alt={song.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-pink-900/40 to-slate-900">
                  <Disc className="w-16 h-16 text-pink-400 animate-spin" style={{ animationDuration: '6s' }} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3">
                <span className="text-[11px] font-mono text-pink-300 px-2 py-0.5 rounded-full bg-pink-500/20 border border-pink-500/30">
                  {mediaInfo.platformNameFa}
                </span>
              </div>
            </div>

            {/* Song Meta */}
            <div className="flex-1 text-center sm:text-right space-y-3 w-full">
              
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>موزیک با موفقیت شناسایی شد</span>
              </div>

              <h3 className="text-2xl font-black text-white tracking-wide">
                {song.title}
              </h3>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-300">
                <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
                  <User className="w-3.5 h-3.5 text-pink-400" />
                  <span>خواننده: <strong className="text-white">{song.artist}</strong></span>
                </div>

                {song.album && (
                  <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
                    <Disc className="w-3.5 h-3.5 text-indigo-400" />
                    <span>آلبوم: <strong className="text-white">{song.album}</strong></span>
                  </div>
                )}

                {song.genre && (
                  <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
                    <Radio className="w-3.5 h-3.5 text-amber-400" />
                    <span>سبک: <strong className="text-white">{song.genre}</strong></span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="pt-3 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <button
                  type="button"
                  onClick={handleDownloadSong}
                  disabled={downloading}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg shadow-emerald-500/25 cursor-pointer disabled:opacity-60"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>در حال استخراج MP3 320k...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>دانلود فایل صوتی اورجینال (MP3)</span>
                    </>
                  )}
                </button>

                {/* Spotify search link */}
                <a
                  href={`https://open.spotify.com/search/${searchEncoded}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center gap-1.5 border border-slate-700"
                >
                  <Headphones className="w-4 h-4 text-emerald-400" />
                  <span>اسپاتیفای (Spotify)</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>

                {/* YouTube Music link */}
                <a
                  href={`https://music.youtube.com/search?q=${searchEncoded}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center gap-1.5 border border-slate-700"
                >
                  <Volume2 className="w-4 h-4 text-red-400" />
                  <span>یوتیوب موزیک</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              </div>

              {downloadSuccess && (
                <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                  ✓ فایل صوتی با حجم {downloadSuccess} با موفقیت دانلود شد!
                </div>
              )}

            </div>
          </div>

        </div>
      )}

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center shrink-0">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">تشخیص هوشمند نام قطعه</h4>
            <p className="text-xs text-slate-400 mt-1">
              استخراج دقیق نام آهنگ و خواننده از ریلزهای ترند اینستاگرام و تیک‌تاک
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">ساندکلود با بالاترین بیت‌ریت</h4>
            <p className="text-xs text-slate-400 mt-1">
              پشتیبانی کامل از ساندکلود و دانلود صوت با کیفیت ۳۲۰kbps به همراه کاور
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">دکمه در ربات تلگرام</h4>
            <p className="text-xs text-slate-400 mt-1">
              در ربات تلگرام نیز با زدن دکمه «تشخیص نام موزیک ریلز» آهنگ مستقیماً فرستاده می‌شود.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
