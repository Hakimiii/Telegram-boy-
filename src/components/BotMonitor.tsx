import React, { useState, useEffect } from 'react';
import {
  Activity,
  Bot,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Download,
  Users,
  Server,
  Key,
  ShieldAlert,
  Radio,
  FileVideo,
  Lock,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Megaphone,
  HelpCircle,
  Zap,
  Globe,
  Copy,
  Terminal,
  Cpu,
  Info,
  Check
} from 'lucide-react';
import { BotStateResponse, BotAdminConfig, RequiredChannel } from '../types.ts';

interface BotMonitorProps {
  botState: BotStateResponse | null;
  onRefresh: () => void;
}

export const BotMonitor: React.FC<BotMonitorProps> = ({ botState, onRefresh }) => {
  const [customToken, setCustomToken] = useState('8903893701:AAECN-VTNYymvXWUGEHNdvYb66HUFWl16zI');
  const [restarting, setRestarting] = useState(false);
  const [restartMessage, setRestartMessage] = useState<{ text: string; success: boolean } | null>(null);

  // Instagram Session State
  const [instagramSessionInput, setInstagramSessionInput] = useState('');
  const [sessionSaveMsg, setSessionSaveMsg] = useState<{ text: string; success: boolean } | null>(null);

  // 24/7 Always-On & Webhook State
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [loadingWebhook, setLoadingWebhook] = useState(false);
  const [webhookMsg, setWebhookMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [pingTesting, setPingTesting] = useState(false);
  const [pingResult, setPingResult] = useState<{ success: boolean; latencyMs?: number; text: string } | null>(null);
  const [copiedPing, setCopiedPing] = useState(false);
  const [activeFaqTab, setActiveFaqTab] = useState<'why_stops' | 'why_vercel' | 'solution_webhook' | 'solution_uptime' | 'solution_vps' | 'solution_cloudflare_vercel'>('solution_cloudflare_vercel');

  // Force Join & Admin Channels State
  const [config, setConfig] = useState<BotAdminConfig>({
    forceJoinEnabled: false,
    channels: [],
    mainChannelUrl: 'https://t.me/Downloder_socialbot',
    supportUsername: 'admin',
  });
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [configSaveMsg, setConfigSaveMsg] = useState<{ text: string; success: boolean } | null>(null);

  // New Channel Input Form
  const [newChannelId, setNewChannelId] = useState('');
  const [newChannelTitle, setNewChannelTitle] = useState('');
  const [newChannelUrl, setNewChannelUrl] = useState('');
  const [testingChannel, setTestingChannel] = useState(false);
  const [channelTestResult, setChannelTestResult] = useState<{ text: string; success: boolean } | null>(null);

  // Fetch Bot Config from backend
  const fetchConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (e) {
      console.warn('Failed to fetch bot config:', e);
    } finally {
      setLoadingConfig(false);
    }
  };

  // Fetch Webhook info from backend
  const fetchWebhookInfo = async () => {
    try {
      const res = await fetch('/api/bot/webhook');
      if (res.ok) {
        const data = await res.json();
        setWebhookInfo(data);
      }
    } catch (e) {
      console.warn('Failed to fetch webhook info:', e);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchWebhookInfo();
    if (typeof window !== 'undefined') {
      setWebhookUrlInput(`${window.location.origin}/api/telegram/webhook`);
    }
  }, []);

  const handleSetWebhook = async (overrideUrl?: string) => {
    setLoadingWebhook(true);
    setWebhookMsg(null);
    try {
      const targetUrl = (overrideUrl || webhookUrlInput).trim();
      const res = await fetch('/api/bot/webhook/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: targetUrl }),
      });
      const data = await res.json();
      setWebhookMsg({ text: data.message, success: data.success });
      await fetchWebhookInfo();
      onRefresh();
    } catch (err: any) {
      setWebhookMsg({ text: err?.message || 'خطا در تنظیم وب‌هوک', success: false });
    } finally {
      setLoadingWebhook(false);
    }
  };

  const handleDeleteWebhook = async () => {
    setLoadingWebhook(true);
    setWebhookMsg(null);
    try {
      const res = await fetch('/api/bot/webhook/delete', {
        method: 'POST',
      });
      const data = await res.json();
      setWebhookMsg({ text: data.message, success: data.success });
      await fetchWebhookInfo();
      onRefresh();
    } catch (err: any) {
      setWebhookMsg({ text: err?.message || 'خطا در حذف وب‌هوک', success: false });
    } finally {
      setLoadingWebhook(false);
    }
  };

  const handleTestPing = async () => {
    setPingTesting(true);
    setPingResult(null);
    const start = performance.now();
    try {
      const res = await fetch('/api/ping');
      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        const data = await res.json();
        setPingResult({
          success: true,
          latencyMs: latency,
          text: `سرور آنلاین و فعال است (زمان پاسخ: ${latency} میلی‌ثانیه | آپ‌تایم: ${Math.round(data.uptime)} ثانیه)`,
        });
      } else {
        setPingResult({
          success: false,
          text: `خطای سرور: ${res.statusText}`,
        });
      }
    } catch (err: any) {
      setPingResult({
        success: false,
        text: err?.message || 'خطا در پینگ سرور',
      });
    } finally {
      setPingTesting(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours} ساعت و ${minutes} دقیقه و ${secs} ثانیه`;
  };

  const handleRestartBot = async () => {
    setRestarting(true);
    setRestartMessage(null);
    try {
      const res = await fetch('/api/bot/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: customToken.trim() || undefined }),
      });
      const data = await res.json();
      setRestartMessage({
        text: data.message,
        success: data.success,
      });
      onRefresh();
    } catch (err: any) {
      setRestartMessage({
        text: err?.message || 'خطا در برقراری ارتباط با سرور',
        success: false,
      });
    } finally {
      setRestarting(false);
    }
  };

  const handleSaveInstagramSession = async (val: string) => {
    setSessionSaveMsg(null);
    try {
      const res = await fetch('/api/settings/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: val.trim() }),
      });
      const data = await res.json();
      setSessionSaveMsg({
        text: data.message,
        success: data.success,
      });
      if (!val) setInstagramSessionInput('');
      onRefresh();
    } catch (err: any) {
      setSessionSaveMsg({
        text: err?.message || 'خطا در ذخیره سشن اینستاگرام',
        success: false,
      });
    }
  };

  const handleSaveConfig = async (newCfg: BotAdminConfig) => {
    setConfigSaveMsg(null);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCfg),
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        setConfigSaveMsg({ text: 'تنظیمات با موفقیت ذخیره شد.', success: true });
      } else {
        setConfigSaveMsg({ text: data.error || 'خطا در ذخیره تنظیمات', success: false });
      }
    } catch (e: any) {
      setConfigSaveMsg({ text: e?.message || 'خطا در برقراری ارتباط با سرور', success: false });
    }
  };

  const handleTestChannel = async () => {
    if (!newChannelId.trim()) {
      setChannelTestResult({ text: 'لطفاً ابتدا آیدی یا شناسه کانال را وارد کنید.', success: false });
      return;
    }
    setTestingChannel(true);
    setChannelTestResult(null);
    try {
      const res = await fetch('/api/admin/channels/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: newChannelId.trim() }),
      });
      const data = await res.json();
      setChannelTestResult({
        text: data.message,
        success: data.success,
      });
      if (data.chatTitle && !newChannelTitle) {
        setNewChannelTitle(data.chatTitle);
      }
    } catch (e: any) {
      setChannelTestResult({ text: e?.message || 'خطا در تست دسترسی کانال', success: false });
    } finally {
      setTestingChannel(false);
    }
  };

  const handleAddChannel = () => {
    const cleanId = newChannelId.trim();
    if (!cleanId) return;

    let username = cleanId.replace('@', '').replace('https://t.me/', '');
    let url = newChannelUrl.trim() || `https://t.me/${username}`;
    let title = newChannelTitle.trim() || cleanId;

    const newChannel: RequiredChannel = {
      id: cleanId,
      title,
      username,
      url,
    };

    const updatedChannels = [...config.channels.filter(c => c.id !== cleanId), newChannel];
    const updatedConfig = { ...config, channels: updatedChannels };
    setConfig(updatedConfig);
    handleSaveConfig(updatedConfig);

    setNewChannelId('');
    setNewChannelTitle('');
    setNewChannelUrl('');
    setChannelTestResult(null);
  };

  const handleRemoveChannel = (id: string) => {
    const updatedChannels = config.channels.filter(c => c.id !== id);
    const updatedConfig = { ...config, channels: updatedChannels };
    setConfig(updatedConfig);
    handleSaveConfig(updatedConfig);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Title & Refresh Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <span>داشبورد وضعیت، تنظیمات و اد اجباری کانال‌ها</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            مدیریت قفل جوین اجباری، سشن اینستاگرام، بررسی سلامت Polling و لاگ‌های زنده
          </p>
        </div>

        <button
          onClick={() => { onRefresh(); fetchConfig(); }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer border border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>بروزرسانی وضعیت</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Connection Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>وضعیت اتصال ربات</span>
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          </div>
          <div className="text-xl font-bold text-white flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${botState?.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            <span>
              {botState?.isActive
                ? botState?.isWebhookMode
                  ? 'آنلاین (Webhook)'
                  : 'آنلاین (Polling)'
                : 'آفلاین'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            @{botState?.botInfo?.username || 'Downloder_socialbot'}
          </div>
        </div>

        {/* Total Downloads */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>تعداد دانلودهای موفق</span>
            <Download className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-400 font-mono">
            {botState?.totalDownloads || 0}
          </div>
          <div className="text-[11px] text-slate-400">
            ارسال مستقیم در تلگرام و وب
          </div>
        </div>

        {/* Total Users */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>کاربران فعال ربات</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-400 font-mono">
            {botState?.uniqueUsersCount || 0}
          </div>
          <div className="text-[11px] text-slate-400">
            شناسه‌های تلگرام یکتا
          </div>
        </div>

        {/* Server Uptime */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>مدت فعالیت بدون وقفه</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-slate-100">
            {botState ? formatUptime(botState.uptimeSeconds) : '...'}
          </div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>سرویس‌دهی مداوم</span>
          </div>
        </div>

      </div>

      {/* SECTION: MANDATORY CHANNELS (اد اجباری) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-400" />
              <span>مدیریت عضویت اجباری کانال‌ها (Force Subscribe / اد اجباری)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              کاربران قبل از دانلود هرگونه ویدیو، موزیک اسپاتیفای یا ساندکلود، موظف به عضویت در کانال‌های زیر خواهند بود.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-300 font-medium">
              وضعیت قفل عضویت:
            </span>
            <button
              onClick={() => {
                const updated = { ...config, forceJoinEnabled: !config.forceJoinEnabled };
                setConfig(updated);
                handleSaveConfig(updated);
              }}
              className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                config.forceJoinEnabled ? 'bg-indigo-600' : 'bg-slate-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  config.forceJoinEnabled ? 'translate-x-0' : '-translate-x-6'
                }`}
              />
            </button>
            <span className={`text-xs font-bold ${config.forceJoinEnabled ? 'text-indigo-400' : 'text-slate-500'}`}>
              {config.forceJoinEnabled ? 'فعال' : 'غیرفعال'}
            </span>
          </div>
        </div>

        {/* Channel Addition Form */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>افزودن کانال جدید به لیست اد اجباری:</span>
            </span>
            <span className="text-[11px] text-amber-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>نکته: ربات باید در کانال ادمین باشد</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                آیدی یا شناسه کانال (اجباری):
              </label>
              <input
                type="text"
                value={newChannelId}
                onChange={(e) => setNewChannelId(e.target.value)}
                placeholder="@mychannel یا -100..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                عنوان یا نام نمایشی کانال:
              </label>
              <input
                type="text"
                value={newChannelTitle}
                onChange={(e) => setNewChannelTitle(e.target.value)}
                placeholder="مثلاً: کانال رسمی موزیک و فیلم"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                لینک عضویت کانال (اختیاری):
              </label>
              <input
                type="text"
                value={newChannelUrl}
                onChange={(e) => setNewChannelUrl(e.target.value)}
                placeholder="https://t.me/mychannel"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                dir="ltr"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={handleTestChannel}
              disabled={testingChannel || !newChannelId.trim()}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-medium transition cursor-pointer flex items-center gap-1.5 border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingChannel ? 'animate-spin' : ''}`} />
              <span>{testingChannel ? 'در حال استعلام از تلگرام...' : 'تست دسترسی ادمین ربات'}</span>
            </button>

            <button
              onClick={handleAddChannel}
              disabled={!newChannelId.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>افزودن این کانال به ربات</span>
            </button>
          </div>

          {channelTestResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                channelTestResult.success
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
              }`}
            >
              {channelTestResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{channelTestResult.text}</span>
            </div>
          )}
        </div>

        {/* Configured Channels List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
            <span>کانال‌های اد اجباری ثبت شده ({config.channels.length} کانال):</span>
            {config.channels.length === 0 && (
              <span className="text-amber-400 text-[11px]">هنوز کانالی ثبت نشده (ربات بدون قفل کار می‌کند)</span>
            )}
          </div>

          {config.channels.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {config.channels.map((ch, idx) => (
                <div
                  key={ch.id || idx}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                      <span className="text-xs font-bold text-white truncate">{ch.title || ch.id}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                      <span>{ch.id}</span>
                      {ch.url && (
                        <a
                          href={ch.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-400 hover:underline flex items-center gap-0.5 text-[10px]"
                        >
                          <span>مشاهده</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveChannel(ch.id)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-400 transition cursor-pointer shrink-0"
                    title="حذف کانال"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center text-xs text-slate-500">
              هیچ کانالی در سیستم اد اجباری وجود ندارد. با استفاده از فرم بالا کانال‌های اسپانسر خود را اضافه کنید.
            </div>
          )}
        </div>

        {/* Global Bot Button Settings: Main Channel & Support */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Megaphone className="w-3.5 h-3.5 text-sky-400" />
              <span>لینک چنل اصلی (دکمه شیشه‌ای «📢 چنل اصلی ↗️»):</span>
            </label>
            <input
              type="text"
              value={config.mainChannelUrl}
              onChange={(e) => setConfig({ ...config, mainChannelUrl: e.target.value })}
              onBlur={() => handleSaveConfig(config)}
              placeholder="https://t.me/mychannel"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>آیدی کاربری پشتیبانی (دکمه «🎫 پشتیبانی»):</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={config.supportUsername}
                onChange={(e) => setConfig({ ...config, supportUsername: e.target.value.replace('@', '') })}
                onBlur={() => handleSaveConfig(config)}
                placeholder="admin"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                dir="ltr"
              />
              <button
                onClick={() => handleSaveConfig(config)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition cursor-pointer whitespace-nowrap"
              >
                ذخیره
              </button>
            </div>
          </div>
        </div>

        {configSaveMsg && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              configSaveMsg.success
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
            }`}
          >
            {configSaveMsg.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{configSaveMsg.text}</span>
          </div>
        )}

      </div>

      {/* 24/7 ALWAYS-ON & TELEGRAM WEBHOOK MANAGER */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <span>فعال‌سازی ۲۴ ساعته و تنظیم وب‌هوک تلگرام (Always-On Engine)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              حل مشکل از کار افتادن ربات هنگام بسته بودن تب مرورگر + راهنمای دیپلوی دائمی
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                botState?.isActive
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${botState?.isActive ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`}></span>
              <span>
                {botState?.isActive
                  ? botState?.isWebhookMode
                    ? 'حالت وب‌هوک فعال'
                    : 'متصل و فعال (Polling زنده و خودترمیم)'
                  : 'آفلاین'}
              </span>
            </span>
          </div>
        </div>

        {/* Webhook Status & Actions */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-emerald-400 font-semibold block">
                {botState?.isWebhookMode
                  ? '✓ وب‌هوک رسمی تلگرام فعال است'
                  : '✓ ربات هم‌اکنون در حالت Polling زنده متصل است و به پیام‌های تلگرام پاسخ می‌دهد'}
              </span>
              <p className="text-slate-400 text-[11px] mt-0.5">
                سیستم محافظ خودکار فعال است: اگر وب‌هوک معیوبی (مانند خطای 405 یا 401 ورسل) روی ربات ثبت شود، سرور به صورت خودکار آن را پاک کرده و دریافت پیام‌ها (Polling) را بدون توقف ادامه می‌دهد.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleDeleteWebhook}
                disabled={loadingWebhook}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-medium transition cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{loadingWebhook ? 'در حال بررسی...' : 'پاکسازی وب‌هوک معیوب و تضمین اتصال Polling'}</span>
              </button>
            </div>
          </div>

          {/* Webhook URL Input & Test */}
          <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1">
              <label className="text-[11px] text-slate-400">آدرس وب‌هوک فعال یا سفارشی:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={webhookUrlInput}
                  onChange={(e) => setWebhookUrlInput(e.target.value)}
                  placeholder="https://your-domain.com/api/telegram/webhook"
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => handleSetWebhook()}
                  disabled={loadingWebhook || !webhookUrlInput}
                  className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition shrink-0 cursor-pointer"
                >
                  ثبت آدرس
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">تست سلامت سرور (Keep-Alive):</label>
              <button
                onClick={handleTestPing}
                disabled={pingTesting}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${pingTesting ? 'animate-spin' : ''}`} />
                <span>{pingTesting ? 'در حال تست...' : 'تست پینگ سرور (/api/ping)'}</span>
              </button>
            </div>
          </div>

          {/* Webhook Message */}
          {webhookMsg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                webhookMsg.success
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
              }`}
            >
              {webhookMsg.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />}
              <span>{webhookMsg.text}</span>
            </div>
          )}

          {/* Ping Test Result */}
          {pingResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                pingResult.success
                  ? 'bg-sky-500/10 border border-sky-500/20 text-sky-300'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
              }`}
            >
              {pingResult.success ? <Radio className="w-4 h-4 shrink-0 text-sky-400 animate-pulse" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />}
              <span>{pingResult.text}</span>
            </div>
          )}
        </div>

        {/* Keep-Alive Ping URL Box */}
        <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" />
              <span>آدرس اختصاصی پینگ جهت فعال ماندن در خواب (Uptime Keep-Alive)</span>
            </span>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  navigator.clipboard.writeText(`${window.location.origin}/api/ping`);
                  setCopiedPing(true);
                  setTimeout(() => setCopiedPing(false), 2000);
                }
              }}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
            >
              {copiedPing ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedPing ? 'کپی شد!' : 'کپی آدرس پینگ'}</span>
            </button>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 text-sky-300 font-mono text-xs select-all overflow-x-auto" dir="ltr">
            {typeof window !== 'undefined' ? `${window.location.origin}/api/ping` : 'https://.../api/ping'}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            💡 <b>توصیه:</b> این آدرس را در سرویس‌های رایگان مانند <b>UptimeRobot.com</b> یا <b>cron-job.org</b> ثبت کنید تا هر ۵ دقیقه یک بار این آدرس را پینگ کند. با این کار سرور در حالت رایگان هرگز به خواب نمی‌رود!
          </p>
        </div>

        {/* Architectural Explanation & Deployment FAQs */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-sky-400" />
            <span>پاسخ به سوالات مهم: چرا ربات متوقف می‌شد و چرا در ورسل دیپلوی نمی‌شود؟</span>
          </h4>

          {/* FAQ Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
            <button
              onClick={() => setActiveFaqTab('solution_webhook')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                activeFaqTab === 'solution_webhook' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ۱. راه حل ۲۴ ساعته (وب‌هوک)
            </button>
            <button
              onClick={() => setActiveFaqTab('why_stops')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                activeFaqTab === 'why_stops' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ۲. چرا با بستن پنل خاموش می‌شد؟
            </button>
            <button
              onClick={() => setActiveFaqTab('why_vercel')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                activeFaqTab === 'why_vercel' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ۳. چرا در Vercel / Netlify کار نمی‌کند؟
            </button>
            <button
              onClick={() => setActiveFaqTab('solution_vps')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                activeFaqTab === 'solution_vps' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ۴. بهترین هاست‌های رایگان و VPS
            </button>
            <button
              onClick={() => setActiveFaqTab('solution_cloudflare_vercel')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                activeFaqTab === 'solution_cloudflare_vercel' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ★ راهنمای رایگان Vercel و Cloudflare
            </button>
          </div>

          {/* FAQ Content Box */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 leading-relaxed space-y-2">
            {activeFaqTab === 'solution_cloudflare_vercel' && (
              <div className="space-y-3">
                <span className="font-bold text-amber-400 block text-sm">
                  ⚡ راهنمای گام‌به‌گام استقرار ۱۰۰٪ رایگان روی Cloudflare و Vercel
                </span>
                
                <div className="space-y-2">
                  <h5 className="font-semibold text-sky-300">گزینه ۱: استقرار رایگان روی Cloudflare Workers (بدون نیاز به سرور و ۲۴ ساعته)</h5>
                  <p className="text-slate-300">
                    کلادفلر ورکرز دارای ۱۰۰,۰۰۰ درخواست رایگان روزانه است و سرور آن هرگز به خواب نمی‌رود. فایل اختصاصی <code className="text-emerald-400 font-mono">cloudflare/worker.js</code> و <code className="text-emerald-400 font-mono">cloudflare/wrangler.toml</code> در پروژه قرار گرفته است.
                  </p>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-400 space-y-1" dir="ltr">
                    <p className="text-slate-500"># ۱. ورود به پوشه کلادفلر و استقرار فوری:</p>
                    <p>cd cloudflare</p>
                    <p>npx wrangler deploy</p>
                    <p className="text-slate-500 mt-2"># ۲. سپس در مرورگر آدرس را باز کنید تا وب‌هوک به طور خودکار ست شود:</p>
                    <p>https://&lt;your-worker-name&gt;.workers.dev/set-webhook</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <h5 className="font-semibold text-indigo-300">گزینه ۲: استقرار روی Vercel (داشبورد وب + وب‌هوک)</h5>
                  <p className="text-slate-300">
                    فایل <code className="text-emerald-400 font-mono">vercel.json</code> به پروژه اضافه شده است. در صورت تمایل به اجرای روی ورسل:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-400 pr-1 text-[11px]">
                    <li>ریپازیتوری را در <b className="text-slate-200">Vercel</b> ایمپورت کنید.</li>
                    <li>در بخش <b className="text-slate-200">Environment Variables</b> متغیرهای <code className="text-sky-300">TELEGRAM_BOT_TOKEN</code> و <code className="text-sky-300">INSTAGRAM_SESSION_ID</code> را وارد کنید.</li>
                    <li>پس از دیپلوی، آدرس دامنه ورسل خود را در کادر بالای همین صفحه وارد کنید و دکمه <b>«ثبت آدرس وب‌هوک»</b> را بزنید.</li>
                  </ol>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <h5 className="font-semibold text-emerald-300">گزینه ۳ (پیشنهاد طلایی - داکر رایگان ۲۴ ساعته بدون قطعی): Hugging Face Spaces</h5>
                  <p className="text-slate-300">
                    اگر می‌خواهید کیفیت‌های 1080p و باینری کامل yt-dlp و ffmpeg به صورت ۱۰۰٪ رایگان و ۲۴ ساعته کار کند، یک Space داکر در <a href="https://huggingface.co/spaces" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline">Hugging Face Spaces</a> بسازید. این سرویس ۲ پردازنده CPU و ۱۶ گیگ رم رایگان همیشگی بدون محدودیت زمانی در اختیارتان می‌گذارد!
                  </p>
                </div>
              </div>
            )}
            {activeFaqTab === 'solution_webhook' && (
              <div className="space-y-2">
                <span className="font-bold text-emerald-400 block">✓ راهکار اصلی: وب‌هوک مستقیم تلگرام (Telegram Webhook)</span>
                <p>
                  در حالت پیش‌فرض (Polling)، برنامه باید در یک حلقه بی‌پایان به سرور تلگرام پیام بزند. اما در حالت <b>Webhook</b>، تلگرام به محض اینکه کاربری در ربات دکمه‌ای لمس کند یا لینکی بفرستد، یک سیگنال به آدرس <code className="text-sky-300 font-mono">/api/telegram/webhook</code> برنامه ارسال می‌کند.
                </p>
                <p className="text-slate-400">
                  حتی اگر سرور به حالت Standby رفته باشد، درخواست ورودی تلگرام فوراً سرور را از خواب بیدار می‌کند، فایل را دانلود و ارسال می‌کند و هیچ پیامی جا نمی‌ماند. با لمس دکمه «فعال‌سازی آنی وب‌هوک» در بالا، این حالت بلافاصله فعال می‌شود.
                </p>
              </div>
            )}

            {activeFaqTab === 'why_stops' && (
              <div className="space-y-2">
                <span className="font-bold text-amber-400 block">🛑 علت توقف هنگام بسته شدن پنل کاربری وب:</span>
                <p>
                  سرورهای ابری مدرن (نظیر Google Cloud Run، Render و داکر‌های اشتراکی) از قابلیتی به نام <b>Scale-to-Zero</b> استفاده می‌کنند. وقتی هیچ بازدیدکننده‌ای صفحه وب را باز نگه نداشته باشد و ترافیک شبکه به صفر برسد، برای کاهش هزینه و مصرف منابع، پردازنده CPU به حالت فریز یا Idle می‌رود.
                </p>
                <p className="text-slate-400">
                  در نتیجه حلقه Polling تلگرام فرصت اجرا پیدا نمی‌کرد. اما اکنون با ایجاد اندپوینت <code className="text-sky-300 font-mono">/api/ping</code> و وب‌هوک تلگرام، این مشکل به طور کامل برطرف شده است.
                </p>
              </div>
            )}

            {activeFaqTab === 'why_vercel' && (
              <div className="space-y-2">
                <span className="font-bold text-rose-400 block">❌ ۳ دلیل فنی که چرا Vercel و Netlify برای این ربات مناسب نیستند:</span>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-400 pr-2">
                  <li>
                    <b className="text-slate-200">فلسفه Serverless در ورسل:</b> در ورسل هیچ سرور پس‌زمینه‌ای روشن نمی‌ماند. توابع سرورلس ورسل تنها برای چند ثانیه (حداکثر ۱۰ تا ۱۵ ثانیه) بیدار شده و سپس فریز می‌شوند.
                  </li>
                  <li>
                    <b className="text-slate-200">باینری yt-dlp و کتابخانه FFmpeg:</b> این ربات برای استخراج کیفیت‌های Full HD، پست‌های اسلایدی و فایل صوتی ۳۲۰k از باینری‌های لینوکسی قدرتمند yt-dlp و ffmpeg استفاده می‌کند که نیازمند سیستم‌عامل کامل لینوکس هستند و روی محیط محدود ورسل قابل اجرا نیستند.
                  </li>
                  <li>
                    <b className="text-slate-200">محدودیت حجم دانلود و دیسک:</b> در ورسل دیسک Read-Only است و امکان دانلود و تبدیل ویدیوهای ۵۰ تا ۱۰۰ مگابایتی اینستاگرام و یوتیوب وجود ندارد.
                  </li>
                </ol>
              </div>
            )}

            {activeFaqTab === 'solution_vps' && (
              <div className="space-y-2">
                <span className="font-bold text-sky-400 block">🚀 هاست‌های پیشنهادی ۲۴ ساعته برای استقرار دائمی:</span>
                <ul className="space-y-1.5 text-slate-400 list-disc list-inside pr-2">
                  <li>
                    <b className="text-slate-200">Render.com یا Railway.app:</b> یک حساب رایگان بسازید، ریپازیتوری را وصل کرده و نوع آن را <span className="text-sky-300">Web Service</span> انتخاب کنید. فایل Dockerfile آماده نیز در پروژه قرار داده شده است.
                  </li>
                  <li>
                    <b className="text-slate-200">Koyeb.com:</b> هاست رایگان مبتنی بر کانتینر با پشتیبانی عالی از داکر و منابع کافی.
                  </li>
                  <li>
                    <b className="text-slate-200">سرور مجازی لینوکس (VPS ارزان اوبونتو):</b> پایدارترین روش! فقط با ۲ دستور در ترمینال سرور:
                    <div className="mt-1 p-2 rounded-lg bg-slate-950 font-mono text-[11px] text-emerald-400 overflow-x-auto select-all" dir="ltr">
                      docker compose up -d
                    </div>
                    یا با استفاده از PM2:
                    <div className="mt-1 p-2 rounded-lg bg-slate-950 font-mono text-[11px] text-emerald-400 overflow-x-auto select-all" dir="ltr">
                      npm install -g pm2 && pm2 start npm --name "social-bot" -- start
                    </div>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bot Info & Token Manager */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Key className="w-4 h-4 text-amber-400" />
          <span>اطلاعات احراز هویت و توکن تلگرام</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">نام ربات:</span>
                <span className="text-white font-medium">{botState?.botInfo?.first_name || 'Downloader'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">آیدی کاربری ربات:</span>
                <span className="text-sky-400 font-mono font-medium">@{botState?.botInfo?.username || 'Downloder_socialbot'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">شناسه عددی ربات:</span>
                <span className="text-slate-300 font-mono">{botState?.botInfo?.id || '8903893701'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">توکن فعال:</span>
                <span className="text-slate-400 font-mono">{botState?.tokenMasked || '8903893701:...'}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              * این ربات از هر دو پروتکل Webhook و Polling تلگرام برای دریافت آنی پیام‌ها، دکمه‌های شیشه‌ای و ارسال بدون افت کیفیت پشتیبانی می‌کند.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-300">
              تغییر یا بارگذاری مجدد توکن ربات:
            </label>
            <div className="space-y-2">
              <input
                type="text"
                value={customToken}
                onChange={(e) => setCustomToken(e.target.value)}
                placeholder="توکن جدید ربات را وارد کنید..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                dir="ltr"
              />
              <button
                onClick={handleRestartBot}
                disabled={restarting}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-medium text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${restarting ? 'animate-spin' : ''}`} />
                <span>{restarting ? 'در حال اتصال به تلگرام...' : 'راه‌اندازی مجدد Polling ربات'}</span>
              </button>
            </div>

            {restartMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  restartMessage.success
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                }`}
              >
                {restartMessage.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span>{restartMessage.text}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instagram Session & Cookie Manager */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-pink-400" />
            <span>تنظیمات سشن و کوکی اینستاگرام (پشتیبانی از ریلزهای دارای محدودیت مخاطب)</span>
          </h3>
          <span
            className={`px-3 py-1 rounded-full text-[11px] font-medium border ${
              botState?.hasInstagramCookies
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}
          >
            {botState?.hasInstagramCookies ? '✓ سشن اینستاگرام فعال و ذخیره است' : 'سشن اینستاگرام تنظیم نشده'}
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          برای ریلزهای اینستاگرام که با پیام <code className="text-rose-400 bg-slate-950 px-1 py-0.5 rounded">This content isn't available to everyone</code> مواجه می‌شوند، مقدار کوکی <span className="font-mono text-pink-300">sessionid</span> را ذخیره کنید تا تمام ویدیوها بدون محدودیت دانلود شوند.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="md:col-span-2 space-y-2">
            <input
              type="text"
              value={instagramSessionInput}
              onChange={(e) => setInstagramSessionInput(e.target.value)}
              placeholder="مقدار sessionid اکانت اینستاگرام خود را اینجا وارد کنید..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-pink-500"
              dir="ltr"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSaveInstagramSession(instagramSessionInput)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-medium text-xs transition cursor-pointer"
              >
                ذخیره سشن اینستاگرام
              </button>

              {botState?.hasInstagramCookies && (
                <button
                  onClick={() => handleSaveInstagramSession('')}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition cursor-pointer"
                >
                  حذف کوکی فعلی
                </button>
              )}
            </div>

            {sessionSaveMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  sessionSaveMsg.success
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                }`}
              >
                {sessionSaveMsg.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span>{sessionSaveMsg.text}</span>
              </div>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <span className="text-slate-300 font-semibold block">راهنمای دریافت sessionid:</span>
            <p>۱. در کامپیوتر وارد instagram.com شوید.</p>
            <p>۲. کلید F12 را بزنید و به تب Application &gt; Cookies بروید.</p>
            <p>۳. مقدار کوکی sessionid را کپی کرده و اینجا ذخیره کنید.</p>
          </div>
        </div>
      </div>

      {/* Live Activity Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileVideo className="w-4 h-4 text-sky-400" />
            <span>آخرین رویدادها و لاگ‌های زنده تلگرام</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {botState?.logs.length || 0} رویداد اخیر
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="pb-3 pr-2">زمان</th>
                <th className="pb-3">رویداد</th>
                <th className="pb-3">کاربر / چت</th>
                <th className="pb-3">پلتفرم</th>
                <th className="pb-3">توضیحات</th>
                <th className="pb-3 pl-2">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {botState && botState.logs.length > 0 ? (
                botState.logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 pr-2 font-mono text-slate-400">{log.timestamp}</td>
                    <td className="py-3 font-semibold text-white">{log.action}</td>
                    <td className="py-3 text-slate-300">{log.userName || log.userId || '-'}</td>
                    <td className="py-3">
                      {log.platform ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          {log.platform}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 text-slate-400 max-w-xs truncate">{log.details}</td>
                    <td className="py-3 pl-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          log.status === 'success'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : log.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {log.status === 'success' && 'موفق'}
                        {log.status === 'pending' && 'در حال پردازش'}
                        {log.status === 'error' && 'خطا'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    هنوز درخواستی ثبت نشده است. لینکی ارسال کنید یا در تلگرام ربات را تست کنید!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
