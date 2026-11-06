import React from 'react';
import {
  Share2,
  CheckCircle2,
  Copy,
  ExternalLink,
  Film,
  Music,
  Sparkles,
  Smartphone,
  Send
} from 'lucide-react';

export const PlatformsGuide: React.FC = () => {
  const platforms = [
    {
      name: 'اینستاگرام (Instagram)',
      types: 'ریلز (Reels)، پست‌های ویدیویی، IGTV',
      features: ['کیفیت اصلی و بدون افت', 'پشتیبانی از موزیک ریلز', 'دانلود سریع با لینک Share'],
      color: 'from-pink-500 to-rose-600',
      sampleUrl: 'https://www.instagram.com/reel/C8XYZ123/',
      instructions: 'روی دکمه Share (آیکون موشک کاغذی) زیر ریلز بزنید و گزینه Copy Link را انتخاب کنید.',
    },
    {
      name: 'تیک‌تاک (TikTok)',
      types: 'تمامی ویدیوها و کلیپ‌های تیک‌تاک',
      features: ['بدون واترمارک (No Watermark)', 'کیفیت HD اصلی', 'امکان دانلود صدای خام (MP3)'],
      color: 'from-cyan-400 to-teal-500',
      sampleUrl: 'https://www.tiktok.com/@creator/video/123456789',
      instructions: 'روی فلش Share در کنار ویدیو بزنید و Copy link را لمس کنید.',
    },
    {
      name: 'یوتیوب و شورتز (YouTube & Shorts)',
      types: 'ویدیوهای معمولی، موزیک‌ویدیوها، Shorts',
      features: ['کیفیت‌های ۱۰۸۰p، ۷۲۰p و ۴۸۰p', 'استخراج فایل صوتی MP3', 'پشتیبانی از لینک‌های youtu.be'],
      color: 'from-red-500 to-rose-700',
      sampleUrl: 'https://youtu.be/dQw4w9WgXcQ',
      instructions: 'دکمه Share زیر ویدیو را بزنید و سپس Copy link را برگزینید.',
    },
    {
      name: 'توییتر / ایکس (Twitter / X)',
      types: 'کلیپ‌ها و ویدیوهای توییت‌ها',
      features: ['بالاترین رزولوشن منتشر شده', 'پشتیبانی از دامنه‌های x.com و twitter.com', 'سرعت دریافت بسیار بالا'],
      color: 'from-sky-400 to-blue-600',
      sampleUrl: 'https://x.com/user/status/123456789',
      instructions: 'روی آیکون اشتراک‌گذاری پست کلیک کرده و Copy link to post را انتخاب کنید.',
    },
    {
      name: 'پینترست (Pinterest)',
      types: 'ویدیوهای پین، ایده‌ها و ریپورتاژها',
      features: ['دانلود ویدیو پین‌ها با کیفیت اورجینال', 'پشتیبانی از لینک‌های کوتاه pin.it', 'بدون نیاز به لاگین'],
      color: 'from-rose-600 to-red-600',
      sampleUrl: 'https://pin.it/7XYZ123',
      instructions: 'روی منوی ۳ نقطه یا دکمه ارسال پین بزنید و لینک را کپی کنید.',
    },
    {
      name: 'ساندکلود (SoundCloud)',
      types: 'آهنگ‌ها، پادکست‌ها، ریمیکس‌ها و پلی‌لیست‌ها',
      features: ['دانلود کیفیت عالی ۳۲۰kbps MP3', 'کاور اورجینال با رزولوشن بالا', 'تگ‌گذاری خودکار نام خواننده و آلبوم'],
      color: 'from-orange-500 to-amber-600',
      sampleUrl: 'https://soundcloud.com/artist/track-name',
      instructions: 'روی آیکون Share زیر آهنگ در برنامه یا وب‌سایت ساندکلود بزنید و Copy link را انتخاب کنید.',
    },
    {
      name: 'فیس‌بوک و ردیت (Facebook & Reddit)',
      types: 'ویدیوهای عمومی فیس‌بوک و ویدیوهای ردیت',
      features: ['صدای هماهنگ با تصویر', 'دانلود با کیفیت‌های چندگانه', 'پشتیبانی از fb.watch'],
      color: 'from-blue-600 to-indigo-700',
      sampleUrl: 'https://fb.watch/xyz123/',
      instructions: 'گزینه Share را زده و لینک پست یا ریلز را کپی نمایید.',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      
      {/* Intro */}
      <div className="text-center space-y-3">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
          سرویس‌ها و شبکه‌های اجتماعی پشتیبانی‌شده
        </h2>
        <p className="text-slate-400 text-sm max-w-2xl mx-auto leading-relaxed">
          ربات هوشمند ما لینک تمامی پلتفرم‌های محبوب را به صورت خودکار شناسایی کرده و بالاترین کیفیت‌های موجود را به همراه فایل صوتی به شما ارائه می‌دهد.
        </p>
      </div>

      {/* Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {platforms.map((p, idx) => (
          <div
            key={idx}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col justify-between hover:border-slate-700 transition"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={`w-3 h-3 rounded-full bg-gradient-to-r ${p.color}`}></span>
                <span className="text-[11px] text-slate-400 font-medium">سرویس فعال</span>
              </div>
              
              <div>
                <h3 className="text-base font-bold text-white">{p.name}</h3>
                <p className="text-xs text-indigo-400 mt-0.5">{p.types}</p>
              </div>

              <div className="space-y-1.5 pt-2">
                {p.features.map((feat, fIdx) => (
                  <div key={fIdx} className="flex items-center gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <span className="text-slate-300 font-semibold block">راهنمای کپی لینک:</span>
                <p>{p.instructions}</p>
              </div>
            </div>

            <div className="pt-4 mt-2 border-t border-slate-800">
              <a
                href="https://t.me/Downloder_socialbot"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5 text-sky-400" />
                <span>ارسال لینک به ربات تلگرام</span>
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Helpful Tips Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-950/60 to-slate-900 border border-indigo-900/40 space-y-3">
        <h4 className="text-base font-bold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>نکات مهم در استفاده از ربات دانلودر:</span>
        </h4>
        <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
          <li>
            ویدیوهایی که پیج آن‌ها در اینستاگرام <span className="text-indigo-300 font-semibold">خصوصی (Private)</span> است، به دلایل امنیتی اینستاگرام ممکن است قابل دریافت نباشند. برای این ویدیوها پیج باید عمومی (Public) باشد.
          </li>
          <li>
            طبق قوانین رسمی تلگرام، حجم فایل ارسالی مستقیم توسط ربات‌ها حداکثر <span className="text-sky-300 font-semibold">۵۰ مگابایت</span> است. در صورتی که ویدیوی انتخابی شما حجیم‌تر باشد، ربات بلافاصله لینک دانلود مستقیم پرسرعت را در اختیار شما قرار می‌دهد تا بدون محدودیت دانلود نمایید.
          </li>
          <li>
            با انتخاب گزینه <span className="text-amber-300 font-semibold">MP3 Audio</span> می‌توانید فقط آهنگ یا صدای ویدیوی مورد نظر را استخراج کنید.
          </li>
        </ul>
      </div>

    </div>
  );
};
