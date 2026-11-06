import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { WebDownloader } from './components/WebDownloader.tsx';
import { SongFinder } from './components/SongFinder.tsx';
import { BotSimulator } from './components/BotSimulator.tsx';
import { BotMonitor } from './components/BotMonitor.tsx';
import { PlatformsGuide } from './components/PlatformsGuide.tsx';
import { BotStateResponse } from './types.ts';
import { Send } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'downloader' | 'songfinder' | 'simulator' | 'monitor' | 'guide'>('downloader');
  const [botState, setBotState] = useState<BotStateResponse | null>(null);

  const fetchBotStatus = async () => {
    try {
      const res = await fetch('/api/bot/status');
      if (res.ok) {
        const data = await res.json();
        setBotState(data);
      }
    } catch (err) {
      console.warn('Could not fetch bot status:', err);
    }
  };

  useEffect(() => {
    fetchBotStatus();
    const interval = setInterval(fetchBotStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-pink-500 selection:text-white">
      {/* Top App Header */}
      <Header botState={botState} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'downloader' && <WebDownloader />}
        {activeTab === 'songfinder' && <SongFinder />}
        {activeTab === 'simulator' && <BotSimulator />}
        {activeTab === 'monitor' && <BotMonitor botState={botState} onRefresh={fetchBotStatus} />}
        {activeTab === 'guide' && <PlatformsGuide />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-8 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200">سوشیال مدیا دانلودر بات</span>
            <span>•</span>
            <span className="text-slate-400">متصل به توکن رسمی تلگرام</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 font-mono text-[10px]">
              @{botState?.botInfo?.username || 'Downloder_socialbot'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <a
              href={`https://t.me/${botState?.botInfo?.username || 'Downloder_socialbot'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sky-400 transition flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
              <span>شروع چت با ربات</span>
            </a>
            <span>•</span>
            <span>پشتیبانی از ساندکلود، Full HD و موزیک‌یاب هوشمند ریلز</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
