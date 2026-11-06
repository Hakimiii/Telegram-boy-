import React, { useState } from 'react';
import {
  Download,
  Link as LinkIcon,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Film,
  Music,
  ExternalLink,
  Play,
  Share2,
  Clock,
  User,
  ShieldCheck
} from 'lucide-react';
import { MediaInfo, QualityOption } from '../types.ts';

export const WebDownloader: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<string>('best_720');
  const [error, setError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<{ fileName: string; fileSize: string; url: string } | null>(null);

  const sampleLinks = [
    { name: 'یوتیوب (Sample)', url: 'https://youtu.be/dQw4w9WgXcQ' },
    { name: 'اینستاگرام ریلز', url: 'https://www.instagram.com/reel/C3bV89' },
    { name: 'تیک‌تاک ویدیو', url: 'https://www.tiktok.com/@tiktok/video/7106594312292453678' },
    { name: 'ساندکلود (موزیک)', url: 'https://soundcloud.com/octobersveryown/drake-gods-plan' },
  ];

  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setMediaInfo(null);
    setDownloadSuccess(null);

    try {
      const res = await fetch('/api/media/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'خطا در دریافت اطلاعات ویدیو');
      }

      setMediaInfo(data);
      if (data.availableFormats && data.availableFormats.length > 0) {
        setSelectedQuality(data.availableFormats[1]?.id || data.availableFormats[0]?.id);
      }
    } catch (err: any) {
      setError(err.message || 'خطا در برقراری ارتباط با سرور');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!mediaInfo) return;
    setDownloading(true);
    setError(null);
    setDownloadSuccess(null);

    try {
      const res = await fetch('/api/media/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: mediaInfo.url,
          qualityId: selectedQuality,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'خطا در دانلود ویدیو');
      }

      setDownloadSuccess({
        fileName: data.fileName,
        fileSize: data.fileSize,
        url: data.downloadUrl,
      });

      // Automatically trigger download
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = data.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      setError(err.message || 'خطا در دانلود ویدیو');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      {/* Hero section */}
      <div className="text-center space-y-4 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>پشتیبانی از کیفیت ۱۰۸۰p، ۷۲۰p و صوت MP3 بدون محدودیت</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          دانلود آسان ویدیو از تمامی شبکه‌های اجتماعی
        </h2>
        <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base">
          لینک ویدیوی خود از اینستاگرام، تیک‌تاک، یوتیوب، توییتر یا سایر برنامه‌ها را اینجا قرار دهید یا مستقیماً به ربات تلگرام ارسال کنید!
        </p>
      </div>

      {/* URL Input Form */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl">
        <form onSubmit={handleAnalyze} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-500">
                <LinkIcon className="w-5 h-5 text-indigo-400" />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="لینک ویدیو را پیست کنید (https://...)"
                className="w-full pr-11 pl-4 py-3.5 sm:py-4 rounded-2xl bg-slate-950/80 border border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white placeholder-slate-500 text-xs sm:text-sm outline-none transition"
                dir="ltr"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-6 py-3.5 sm:py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-md shadow-indigo-600/30 shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>آنالیز ویدیو...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>دریافت اطلاعات ویدیو</span>
                </>
              )}
            </button>
          </div>

          {/* Quick sample link pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400">
            <span className="text-slate-500 text-[11px]">نمونه لینک‌های آماده:</span>
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

        {/* Error notification */}
        {error && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-medium">خطا در پردازش</p>
              <p className="text-xs text-rose-300/80 mt-1">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Media Details Card & Quality Selector */}
      {mediaInfo && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row gap-6">
            
            {/* Thumbnail */}
            <div className="relative w-full sm:w-64 h-44 rounded-2xl overflow-hidden bg-slate-950 shrink-0 border border-slate-800 flex items-center justify-center group">
              {mediaInfo.thumbnail ? (
                <img
                  src={mediaInfo.thumbnail}
                  alt={mediaInfo.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
              ) : (
                <Film className="w-12 h-12 text-slate-600" />
              )}
              {mediaInfo.durationFormatted && (
                <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/80 backdrop-blur-sm text-[11px] font-mono text-white flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{mediaInfo.durationFormatted}</span>
                </div>
              )}
              <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-indigo-600/90 text-white text-[11px] font-medium shadow">
                {mediaInfo.platformNameFa}
              </span>
            </div>

            {/* Video Info */}
            <div className="flex-1 space-y-3">
              <h3 className="text-lg font-bold text-white line-clamp-2 leading-relaxed">
                {mediaInfo.title}
              </h3>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1 rounded-lg">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  <span>سازنده: {mediaInfo.uploader}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1 rounded-lg">
                  <Film className="w-3.5 h-3.5 text-indigo-400" />
                  <span>سرویس: {mediaInfo.platformNameEn}</span>
                </div>
              </div>

              {/* Quality Options Grid */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  انتخاب کیفیت و فرمت جهت دانلود:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {mediaInfo.availableFormats.map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setSelectedQuality(fmt.id)}
                      className={`p-3 rounded-xl border text-right transition flex flex-col justify-between cursor-pointer ${
                        selectedQuality === fmt.id
                          ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold text-white">{fmt.labelFa}</span>
                        {fmt.isAudioOnly ? (
                          <Music className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Film className="w-3.5 h-3.5 text-sky-400" />
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 mt-1 uppercase font-mono">
                        فرمت {fmt.ext}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Download Action Button */}
              <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-sm transition shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>در حال پردازش و استخراج ویدیو...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      <span>دانلود ویدیو با کیفیت انتخابی</span>
                    </>
                  )}
                </button>

                {/* Direct Telegram Forward Option */}
                <a
                  href={`https://t.me/Downloder_socialbot?start=dl`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition flex items-center justify-center gap-2 border border-slate-700"
                >
                  <Share2 className="w-4 h-4 text-sky-400" />
                  <span>دانلود مستقیم در تلگرام</span>
                </a>
              </div>

              {/* Download Success message */}
              {downloadSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>فایل با موفقیت آماده شد ({downloadSuccess.fileSize})</span>
                  </div>
                  <a
                    href={downloadSuccess.url}
                    download={downloadSuccess.fileName}
                    className="font-bold underline hover:text-white"
                  >
                    دانلود مجدد فایل
                  </a>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Feature highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">انتخاب کیفیت دلخواه</h4>
            <p className="text-xs text-slate-400 mt-1">
              امکان انتخاب کیفیت‌های ۱۰۸۰p Full HD، ۷۲۰p HD و تبدیل مستقیم به فایل صوتی MP3
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">تمام شبکه‌های اجتماعی</h4>
            <p className="text-xs text-slate-400 mt-1">
              پشتیبانی از اینستاگرام، تیک‌تاک بدون واترمارک، یوتیوب، توییتر، پینترست و فیس‌بوک
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">ربات تلگرام اختصاصی</h4>
            <p className="text-xs text-slate-400 mt-1">
              متصل به ربات رسمی تلگرام با ارسال مستقیم فایل و لینک پرسرعت بدون قطعی
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
