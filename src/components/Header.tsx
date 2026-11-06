import React from 'react';
import { Bot, Send, Radio, Download, Sparkles, ExternalLink, Activity, Music } from 'lucide-react';
import { BotStateResponse } from '../types.ts';

interface HeaderProps {
  botState: BotStateResponse | null;
  activeTab: 'downloader' | 'songfinder' | 'simulator' | 'monitor' | 'guide';
  setActiveTab: (tab: 'downloader' | 'songfinder' | 'simulator' | 'monitor' | 'guide') => void;
}

export const Header: React.FC<HeaderProps> = ({ botState, activeTab, setActiveTab }) => {
  const botUsername = botState?.botInfo?.username || 'Downloder_socialbot';
  const telegramUrl = `https://t.me/${botUsername}`;

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        
        {/* Top bar */}
        <div className="flex items-center justify-between py-3 sm:py-4 gap-2">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-pink-500 to-sky-400 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-sky-400" />
                </div>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${botState?.isActive ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 border-2 border-slate-950 ${botState?.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm sm:text-lg font-bold text-white truncate">
                  دانلودر سوشیال مدیا و موزیک‌یاب
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  ربات تلگرام
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate hidden sm:block">
                دانلود ویدیو، ریلز، ساندکلود و تشخیص هوشمند موزیک
              </p>
            </div>
          </div>

          {/* Action buttons & Telegram link */}
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-medium text-xs sm:text-sm hover:from-sky-400 hover:to-blue-500 transition shadow-md shadow-sky-500/25 active:scale-95"
            >
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden xs:inline">ورود به تلگرام</span>
              <span className="xs:hidden">تلگرام</span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </a>

            {/* Status indicator on desktop */}
            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
              <span className={`w-2 h-2 rounded-full ${botState?.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span className="text-slate-300">
                {botState?.isActive ? 'ربات فعال' : 'در انتظار'}
              </span>
            </div>
          </div>

        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 space-x-reverse -mb-px overflow-x-auto pb-1 scrollbar-none border-t border-slate-800/60 pt-1">
          <button
            onClick={() => setActiveTab('downloader')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'downloader'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>دانلود ویدیو و مدیا</span>
          </button>

          <button
            onClick={() => setActiveTab('songfinder')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'songfinder'
                ? 'border-pink-500 text-pink-400 bg-pink-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-pink-400" />
            <span>تشخیص موزیک ریلز (AI)</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-pink-500/20 text-pink-400 font-normal">
              جدید
            </span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'simulator'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>شبیه‌ساز تلگرام</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-400">
              تست
            </span>
          </button>

          <button
            onClick={() => setActiveTab('monitor')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'monitor'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>وضعیت و لاگ‌ها</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'guide'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>راهنمای برنامه‌ها</span>
          </button>
        </nav>

      </div>
    </header>
  );
};
