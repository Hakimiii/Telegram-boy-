import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Film,
  Music,
  CheckCircle2,
  Clock,
  Share2,
  Loader2,
  Trash2,
  CornerDownLeft
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  timestamp: string;
  text?: string;
  videoCard?: {
    title: string;
    uploader: string;
    duration: string;
    platform: string;
    thumbnail: string;
    url: string;
    keyboard: { id: string; label: string; resolution: string }[];
  };
  fileDelivered?: {
    title: string;
    quality: string;
    size: string;
    isAudio?: boolean;
  };
}

export const BotSimulator: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'bot',
      timestamp: '12:00',
      text: `👋 سلام! به شبیه‌ساز زنده ربات تلگرام خوش آمدید.
من ربات دانلودر شبکه‌های اجتماعی (@Downloder_socialbot) هستم.

می‌توانید دستورات زیر را ارسال کنید یا لینک هر ویدیویی را بفرستید:
• /start
• /help
• یا لینک یک ریلز اینستاگرام، تیک‌تاک یا یوتیوب!`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: 'user',
      timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      text: text.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/bot/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim() }),
      });
      const data = await res.json();

      const botMsg: ChatMessage = {
        id: Math.random().toString(),
        sender: 'bot',
        timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      };

      if (data.type === 'video_card' || data.type === 'spotify_card') {
        botMsg.videoCard = data;
      } else {
        botMsg.text = data.text;
      }

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'bot',
          timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
          text: '❌ خطایی در ارتباط با سرور ربات رخ داد.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQualitySelect = (qualityId: string, label: string, title: string) => {
    const isSongFinder = qualityId === 'find_song';
    const isAudio = qualityId === 'best_audio' || qualityId === 'standard_audio' || isSongFinder;
    
    // Add temporary loading indicator
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'bot',
          timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
          fileDelivered: {
            title: isSongFinder ? `${title} (موزیک ریلز)` : title,
            quality: isSongFinder ? 'تشخیص هوشمند قطعه (320k)' : label,
            size: isAudio ? '6.2 MB' : '18.4 MB',
            isAudio,
          },
        },
      ]);
    }, 1200);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: '1',
        sender: 'bot',
        timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
        text: 'گفتگو پاکسازی شد. لطفاً لینک ویدیوی مورد نظر خود را ارسال نمایید.',
      },
    ]);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      
      {/* Description header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-sky-400" />
            <span>شبیه‌ساز و تست زنده ربات تلگرام</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            تجربه کامل منوی انتخاب کیفیت و رفتار ربات دقیقاً مشابه اپلیکیشن تلگرام
          </p>
        </div>

        <button
          onClick={handleClearChat}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>پاکسازی گفتگو</span>
        </button>
      </div>

      {/* Simulated Telegram Client Shell */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[600px]">
        
        {/* Telegram Chat Header */}
        <div className="bg-slate-850 px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md">
                <Bot className="w-5 h-5" />
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900"></span>
            </div>
            <div>
              <div className="font-bold text-sm text-white">دانلودر سوشیال مدیا و موزیک‌یاب</div>
              <div className="text-[11px] text-sky-400 font-mono">@Downloder_socialbot • bot</div>
            </div>
          </div>

          <a
            href="https://t.me/Downloder_socialbot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 px-3 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20"
          >
            <span>ورود به تلگرام واقعی</span>
          </a>
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-radial from-slate-900 to-slate-950">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 shadow-md ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/60'
                }`}
              >
                {/* Regular text */}
                {msg.text && (
                  <p className="text-xs sm:text-sm whitespace-pre-line leading-relaxed">
                    {msg.text}
                  </p>
                )}

                {/* Video Card with Quality Buttons (Telegram Inline Keyboard) */}
                {msg.videoCard && (
                  <div className="space-y-3">
                    {msg.videoCard.thumbnail && (
                      <div className="relative w-full h-36 rounded-xl overflow-hidden bg-slate-950">
                        <img
                          src={msg.videoCard.thumbnail}
                          alt={msg.videoCard.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/80 text-[10px] text-white">
                          {msg.videoCard.duration}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <p className="font-bold text-xs sm:text-sm text-white">
                        {msg.videoCard.title}
                      </p>
                      <p className="text-[11px] text-slate-300">
                        👤 سازنده: {msg.videoCard.uploader} | سرویس: {msg.videoCard.platform}
                      </p>
                      <p className="text-[11px] text-sky-300 font-semibold pt-1">
                        👇 کیفیت مورد نظر جهت دانلود را انتخاب کنید:
                      </p>
                    </div>

                    {/* Telegram-style Inline Keyboard Grid */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      {msg.videoCard.keyboard.map((btn) => (
                        <button
                          key={btn.id}
                          onClick={() => handleQualitySelect(btn.id, btn.label, msg.videoCard!.title)}
                          className="px-3 py-2 rounded-xl bg-slate-700/80 hover:bg-sky-600 active:bg-sky-700 text-white text-xs font-medium transition cursor-pointer text-center border border-slate-600/60 flex items-center justify-center gap-1.5 shadow"
                        >
                          {btn.id === 'best_audio' ? (
                            <Music className="w-3.5 h-3.5 text-amber-300" />
                          ) : (
                            <Film className="w-3.5 h-3.5 text-sky-300" />
                          )}
                          <span>{btn.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Delivered File Bubble */}
                {msg.fileDelivered && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>فایل ویدیو با کیفیت {msg.fileDelivered.quality} ارسال شد!</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {msg.fileDelivered.isAudio ? (
                          <Music className="w-5 h-5 text-amber-400" />
                        ) : (
                          <Film className="w-5 h-5 text-sky-400" />
                        )}
                        <div>
                          <div className="text-xs font-semibold text-white max-w-[200px] truncate">
                            {msg.fileDelivered.title}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            حجم فایل: {msg.fileDelivered.size}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                        آماده پخش
                      </span>
                    </div>
                  </div>
                )}

                <div
                  className={`text-[10px] mt-2 text-left font-mono ${
                    msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-400'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/60 px-4 py-2 rounded-2xl w-fit">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
              <span>ربات در حال پردازش و استخراج ویدیو است...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompt buttons */}
        <div className="px-4 py-2 bg-slate-850/80 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="text-[11px] text-slate-500 shrink-0">ارسال سریع:</span>
          <button
            onClick={() => handleSendMessage('/start')}
            className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 cursor-pointer"
          >
            /start
          </button>
          <button
            onClick={() => handleSendMessage('/help')}
            className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 cursor-pointer"
          >
            /help
          </button>
          <button
            onClick={() => handleSendMessage('/music')}
            className="text-xs px-2.5 py-1 rounded-lg bg-pink-950/60 hover:bg-pink-900 border border-pink-700/50 text-pink-300 shrink-0 cursor-pointer"
          >
            🎵 موزیک‌یاب
          </button>
          <button
            onClick={() => handleSendMessage('https://soundcloud.com/octobersveryown/drake-gods-plan')}
            className="text-xs px-2.5 py-1 rounded-lg bg-orange-950/60 hover:bg-orange-900 border border-orange-700/50 text-orange-300 shrink-0 cursor-pointer"
          >
            ساندکلود
          </button>
          <button
            onClick={() => handleSendMessage('https://youtu.be/dQw4w9WgXcQ')}
            className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 cursor-pointer"
          >
            یوتیوب
          </button>
          <button
            onClick={() => handleSendMessage('https://www.instagram.com/reel/C3bV89')}
            className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 cursor-pointer"
          >
            لینک اینستاگرام
          </button>
        </div>

        {/* Telegram Persistent Reply Keyboard Grid */}
        <div className="bg-slate-950 border-t border-slate-800 px-3 py-2 space-y-1">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => handleSendMessage('☕️ قهوه مهمونم کن')}
              className="py-1.5 px-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer text-center border border-slate-700/60"
            >
              ☕️ قهوه مهمونم کن
            </button>
            <button
              onClick={() => handleSendMessage('📖 آموزش استفاده')}
              className="py-1.5 px-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer text-center border border-slate-700/60"
            >
              📖 آموزش استفاده
            </button>
          </div>
          <div className="grid grid-cols-1">
            <button
              onClick={() => handleSendMessage('💡 ارسال پیشنهادات')}
              className="py-1.5 px-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer text-center border border-slate-700/60"
            >
              💡 ارسال پیشنهادات
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => handleSendMessage('📊 آمار من')}
              className="py-1.5 px-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer text-center border border-slate-700/60"
            >
              📊 آمار من
            </button>
            <button
              onClick={() => handleSendMessage('🎫 پشتیبانی')}
              className="py-1.5 px-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer text-center border border-slate-700/60"
            >
              🎫 پشتیبانی
            </button>
          </div>
        </div>

        {/* Telegram Input Bar */}
        <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="ارسال پیام یا لینک به ربات..."
              className="flex-1 bg-slate-950 px-4 py-3 rounded-2xl border border-slate-700/80 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-sky-500 transition"
              dir="auto"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-11 h-11 rounded-2xl bg-sky-500 hover:bg-sky-400 active:bg-sky-600 disabled:bg-slate-800 disabled:text-slate-600 text-white flex items-center justify-center shrink-0 transition cursor-pointer shadow-lg shadow-sky-500/20"
            >
              <Send className="w-5 h-5 -ml-0.5" />
            </button>
          </form>
        </div>

      </div>

    </div>
  );
};
