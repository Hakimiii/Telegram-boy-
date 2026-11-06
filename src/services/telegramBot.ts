import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { extractUrl, identifyPlatform, getStandardQualityOptions, evaluateWebhookCheckStatus, type IdentifiedSong } from './mediaParser.ts';
import { extractMediaInfo, downloadMedia, getDirectStreamUrl, identifySongFromMedia, downloadInstagramPost } from './mediaDownloader.ts';
import { loadBotConfig, isUserAdmin, registerUserId, type RequiredChannel } from './configManager.ts';
import { extractSpotifyInfo, downloadSpotifyTrack } from './spotifyResolver.ts';
import { sendAdminDashboard, handleAdminCallbackQuery, handleAdminMessageStep } from './adminPanel.ts';

export interface BotActivityLog {
  id: string;
  timestamp: string;
  userId?: number | string;
  userName?: string;
  action: string;
  platform?: string;
  details: string;
  status: 'pending' | 'success' | 'error';
}

export interface BotState {
  isActive: boolean;
  botInfo: {
    id?: number;
    username?: string;
    first_name?: string;
  } | null;
  startTime: number;
  totalRequests: number;
  totalDownloads: number;
  uniqueUsers: Set<number | string>;
  lastError: string | null;
  logs: BotActivityLog[];
  isWebhookMode: boolean;
  webhookUrl: string | null;
}

const state: BotState = {
  isActive: false,
  botInfo: null,
  startTime: Date.now(),
  totalRequests: 0,
  totalDownloads: 0,
  uniqueUsers: new Set(),
  lastError: null,
  logs: [],
  isWebhookMode: false,
  webhookUrl: null,
};

export function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Persistent pending requests storage: reqKey -> { url, title, uploader, duration, platform }
interface PendingRequestItem {
  url: string;
  title: string;
  uploader: string;
  duration: string;
  platform: string;
  createdAt: number;
}

const PENDING_FILE_PROJECT = path.resolve(process.cwd(), 'bot_pending_requests.json');
const PENDING_FILE_TMP = path.resolve('/tmp/bot_pending_requests.json');
const pendingRequests = new Map<string, PendingRequestItem>();

function loadPendingRequests() {
  try {
    let raw = '';
    if (fs.existsSync(PENDING_FILE_PROJECT)) {
      raw = fs.readFileSync(PENDING_FILE_PROJECT, 'utf-8');
    } else if (fs.existsSync(PENDING_FILE_TMP)) {
      raw = fs.readFileSync(PENDING_FILE_TMP, 'utf-8');
    }
    if (raw) {
      const data = JSON.parse(raw);
      const now = Date.now();
      for (const [k, v] of Object.entries(data)) {
        const item = v as PendingRequestItem;
        if (now - (item.createdAt || 0) < 48 * 3600 * 1000) {
          pendingRequests.set(k, item);
        }
      }
    }
  } catch (err) {
    console.warn('Could not load pending requests cache:', err);
  }
}

function savePendingRequests() {
  try {
    const obj = Object.fromEntries(pendingRequests.entries());
    const jsonStr = JSON.stringify(obj);
    fs.writeFileSync(PENDING_FILE_PROJECT, jsonStr, 'utf-8');
    try {
      fs.writeFileSync(PENDING_FILE_TMP, jsonStr, 'utf-8');
    } catch {}
  } catch (err) {
    console.warn('Could not save pending requests cache:', err);
  }
}

loadPendingRequests();

export function addLog(
  action: string,
  details: string,
  status: 'pending' | 'success' | 'error' = 'success',
  userId?: number | string,
  userName?: string,
  platform?: string
) {
  const log: BotActivityLog = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toLocaleTimeString('fa-IR'),
    userId,
    userName,
    action,
    platform,
    details,
    status,
  };
  state.logs.unshift(log);
  if (state.logs.length > 60) {
    state.logs.pop();
  }
}

let pollingAbortController: AbortController | null = null;
let currentToken = process.env.TELEGRAM_BOT_TOKEN || '8903893701:AAECN-VTNYymvXWUGEHNdvYb66HUFWl16zI';
let activeClient: TelegramClient | null = null;

export function getBotState() {
  return {
    isActive: state.isActive,
    botInfo: state.botInfo,
    startTime: state.startTime,
    uptimeSeconds: Math.floor((Date.now() - state.startTime) / 1000),
    totalRequests: state.totalRequests,
    totalDownloads: state.totalDownloads,
    uniqueUsersCount: state.uniqueUsers.size,
    lastError: state.lastError,
    logs: state.logs,
    tokenMasked: currentToken ? `${currentToken.slice(0, 10)}...${currentToken.slice(-5)}` : 'None',
    isWebhookMode: state.isWebhookMode,
    webhookUrl: state.webhookUrl,
  };
}

/**
 * Native Telegram API Client with resilient HTML parse_mode
 */
export class TelegramClient {
  private token: string;
  private baseUrl: string;

  constructor(token: string) {
    this.token = token;
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async callApi(endpoint: string, payload: any, isFormData: boolean = false): Promise<any> {
    const url = `${this.baseUrl}/${endpoint}`;
    const options: RequestInit = {
      method: 'POST',
    };

    if (isFormData) {
      options.body = payload;
    } else {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(payload);
    }

    const response = await fetch(url, options);
    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.description || `Telegram API Error: ${response.statusText}`);
    }
    return data.result;
  }

  async getMe() {
    return this.callApi('getMe', {});
  }

  async getChat(chatId: number | string) {
    return this.callApi('getChat', { chat_id: chatId });
  }

  async sendMessage(chatId: number | string, text: string, extra: any = {}) {
    return this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...extra,
    });
  }

  async copyMessage(chatId: number | string, fromChatId: number | string, messageId: number, extra: any = {}) {
    return this.callApi('copyMessage', {
      chat_id: chatId,
      from_chat_id: fromChatId,
      message_id: messageId,
      ...extra,
    });
  }

  async forwardMessage(chatId: number | string, fromChatId: number | string, messageId: number) {
    return this.callApi('forwardMessage', {
      chat_id: chatId,
      from_chat_id: fromChatId,
      message_id: messageId,
    });
  }

  async deleteMessage(chatId: number | string, messageId: number) {
    try {
      return await this.callApi('deleteMessage', {
        chat_id: chatId,
        message_id: messageId,
      });
    } catch {
      return null;
    }
  }

  async editMessageText(chatId: number | string, messageId: number, text: string, extra: any = {}) {
    return this.callApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      ...extra,
    });
  }

  async sendPhoto(chatId: number | string, photoUrl: string, extra: any = {}) {
    return this.callApi('sendPhoto', {
      chat_id: chatId,
      photo: photoUrl,
      parse_mode: 'HTML',
      ...extra,
    });
  }

  async sendPhotoFile(chatId: number | string, filePath: string, caption: string, replyMarkup?: any) {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    if (replyMarkup) formData.append('reply_markup', JSON.stringify(replyMarkup));

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    const blob = new Blob([fileBuffer], { type: mime });
    formData.append('photo', blob, fileName);

    return this.callApi('sendPhoto', formData, true);
  }

  async sendMediaGroup(chatId: number | string, items: { filePath: string; type: 'video' | 'photo' }[], caption?: string) {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));

    const mediaList = items.slice(0, 10).map((item, idx) => {
      const attachKey = `file${idx}`;
      const fileBuffer = fs.readFileSync(item.filePath);
      const fileName = path.basename(item.filePath);
      const ext = path.extname(item.filePath).toLowerCase();
      const mime = item.type === 'video' ? 'video/mp4' : ext === '.png' ? 'image/png' : 'image/jpeg';
      const blob = new Blob([fileBuffer], { type: mime });
      formData.append(attachKey, blob, fileName);

      return {
        type: item.type,
        media: `attach://${attachKey}`,
        caption: idx === 0 && caption ? caption : undefined,
        parse_mode: idx === 0 && caption ? 'HTML' : undefined,
      };
    });

    formData.append('media', JSON.stringify(mediaList));
    return this.callApi('sendMediaGroup', formData, true);
  }

  async answerCallbackQuery(callbackQueryId: string, extra: any = {}) {
    try {
      return await this.callApi('answerCallbackQuery', {
        callback_query_id: callbackQueryId,
        ...extra,
      });
    } catch (e) {
      return null;
    }
  }

  async sendVideoFile(chatId: number | string, filePath: string, caption: string, replyMarkup?: any) {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    formData.append('supports_streaming', 'true');
    if (replyMarkup) formData.append('reply_markup', JSON.stringify(replyMarkup));

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const blob = new Blob([fileBuffer], { type: 'video/mp4' });
    formData.append('video', blob, fileName);

    return this.callApi('sendVideo', formData, true);
  }

  async sendAudioFile(chatId: number | string, filePath: string, caption: string, title?: string, performer?: string, replyMarkup?: any) {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    if (title) formData.append('title', title.slice(0, 64));
    if (performer) formData.append('performer', performer.slice(0, 64));
    if (replyMarkup) formData.append('reply_markup', JSON.stringify(replyMarkup));

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const blob = new Blob([fileBuffer], { type: 'audio/mpeg' });
    formData.append('audio', blob, fileName);

    return this.callApi('sendAudio', formData, true);
  }

  async getChatMember(chatId: number | string, userId: number | string) {
    return this.callApi('getChatMember', {
      chat_id: chatId,
      user_id: userId,
    });
  }

  async getUpdates(offset: number, timeout: number = 25, signal?: AbortSignal) {
    const url = `${this.baseUrl}/getUpdates`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offset,
        timeout,
        allowed_updates: ['message', 'callback_query'],
      }),
      signal,
    });
    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.description || 'Failed to fetch updates');
    }
    return data.result;
  }

  async setWebhook(url: string) {
    return this.callApi('setWebhook', {
      url,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    });
  }

  async deleteWebhook(dropPendingUpdates: boolean = false) {
    return this.callApi('deleteWebhook', {
      drop_pending_updates: dropPendingUpdates,
    });
  }

  async getWebhookInfo() {
    return this.callApi('getWebhookInfo', {});
  }
}

/**
 * Standard persistent Reply Keyboard
 */
function getPersistentReplyKeyboard(userId?: number | string) {
  const keyboard: any[] = [
    [{ text: '☕️ قهوه مهمونم کن' }, { text: '📖 آموزش استفاده' }],
    [{ text: '💡 ارسال پیشنهادات' }],
    [{ text: '📊 آمار من' }, { text: '🎫 پشتیبانی' }],
    [{ text: '🌐 زبان / Language' }],
  ];

  if (userId && isUserAdmin(userId)) {
    keyboard.unshift([{ text: '👑 پنل مدیریت ربات (ادمین)' }]);
  }

  return {
    keyboard,
    resize_keyboard: true,
    is_persistent: true,
  };
}

/**
 * Standard action buttons under messages
 */
function getMessageActionButtons() {
  const config = loadBotConfig();
  const botUsername = state.botInfo?.username || 'Downloder_socialbot';
  return [
    [
      { text: '➕ افزودن ربات به گروه', url: `https://t.me/${botUsername}?startgroup=true` },
      { text: '📢 چنل اصلی ↗️', url: config.mainChannelUrl || 'https://t.me/Downloder_socialbot' }
    ]
  ];
}

/**
 * Test if the bot can access a channel (used in admin web dashboard)
 */
export async function testChannelAccess(channelId: string): Promise<{ success: boolean; message: string; chatTitle?: string }> {
  try {
    const client = new TelegramClient(currentToken);
    const cleanId = channelId.trim();
    const chat = await client.getChat(cleanId);
    return {
      success: true,
      message: `ارتباط با کانال «${chat.title || cleanId}» برقرار است.`,
      chatTitle: chat.title,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `خطا در دسترسی به کانال: ${err?.message || 'ربات را در کانال ادمین کنید.'}`,
    };
  }
}

/**
 * Verify if user is member of all mandatory channels (Force Subscribe / اد اجباری)
 */
async function checkUserMembership(client: TelegramClient, userId: number | string): Promise<{ isMember: boolean; pendingChannels: RequiredChannel[] }> {
  if (isUserAdmin(userId)) {
    return { isMember: true, pendingChannels: [] };
  }

  const config = loadBotConfig();
  if (!config.forceJoinEnabled || !config.channels || config.channels.length === 0) {
    return { isMember: true, pendingChannels: [] };
  }

  const pending: RequiredChannel[] = [];
  for (const channel of config.channels) {
    try {
      const member = await client.getChatMember(channel.id, userId);
      const status = member?.status;
      if (status === 'left' || status === 'kicked') {
        pending.push(channel);
      }
    } catch (err) {
      pending.push(channel);
    }
  }

  return {
    isMember: pending.length === 0,
    pendingChannels: pending,
  };
}

/**
 * Send Force Subscribe message if membership check fails
 */
async function sendForceJoinNotice(client: TelegramClient, chatId: number | string, pendingChannels: RequiredChannel[]) {
  const buttons: any[] = [];
  for (const ch of pendingChannels) {
    const url = ch.url || (ch.username ? `https://t.me/${ch.username.replace('@', '')}` : undefined);
    if (url) {
      buttons.push([{ text: `📢 عضویت در ${ch.title || ch.username}`, url }]);
    }
  }
  buttons.push([{ text: '✅ تایید و بررسی مجدد عضویت', callback_data: 'verify_sub' }]);

  const text = 
`🔒 <b>برای استفاده از ربات، عضویت در کانال‌های زیر الزامی است!</b>
━━━━━━━━━━━━━━━━━━━━
برای فعال‌سازی و دانلود نامحدود، لطفاً ابتدا در کانال‌های اسپانسر زیر عضو شده و سپس دکمه <b>«تایید و بررسی مجدد عضویت ✅»</b> را لمس کنید:`;

  await client.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons },
  });
}

/**
 * Send /start message matching user's screenshots
 */
async function sendStartMessage(client: TelegramClient, chatId: number | string, userName: string) {
  const botUsername = state.botInfo?.username || 'Downloder_socialbot';
  const startMsg = 
`✨ <b>به ربات دانلودر چندمنظوره و موزیک‌یاب خوش آمدید</b> ✨
━━━━━━━━━━━━━━━━━━━━

سلام <b>${escapeHtml(userName)}</b> عزیز ✋
اینجا می‌توانید ویدیو و موزیک موردعلاقه‌تان را سریع، ساده و با بالاترین کیفیت دانلود کنید 🚀

📥 <b>امکانات پیشرفته ربات:</b>

📷 <b>اینستاگرام (Instagram)</b>
└ ریلز، پست‌ها، اسلایدی + همراه با کپشن کامل بدون نیاز به انتخاب کیفیت ⚡

🟢 <b>اسپاتیفای (Spotify)</b>
└ دانلود مستقیم آهنگ با کیفیت اورجینال MP3 320k 🎵

📻 <b>ساندکلاد (SoundCloud)</b>
└ استخراج و دریافت فایل صوتی با کیفیت استودیویی

▶️ <b>یوتیوب (YouTube & Shorts)</b>
└ کیفیت‌های 360p تا 1080p FHD و صوت MP3

🎵 <b>تیک‌تاک (TikTok)</b>
└ دانلود ویدیوها بدون واترمارک + صوت اورجینال

✖️ <b>توییتر / X و پینترست</b>
└ ویدیوها و تصاویر با بالاترین رزولوشن

🌐 <b>دانلودر همه‌سایت‌ها</b>
└ پشتیبانی از بیش از ۱۰۰۰ سایت ویدیویی و پلتفرم آنلاین 🔥

━━━━━━━━━━━━━━━━━━━━
🐸 <b>همین حالا شروع کنید! کافیست لینک ویدیو یا موزیک را ارسال کنید 👇</b>`;

  await client.sendMessage(chatId, startMsg, {
    parse_mode: 'HTML',
    reply_markup: getPersistentReplyKeyboard(chatId),
  });
}

/**
 * Handle incoming user message
 */
async function handleIncomingMessage(client: TelegramClient, msg: any) {
  const chatId = msg.chat?.id;
  const text = (msg.text || '').trim();
  const userName = msg.from?.first_name || 'کاربر';
  const userId = msg.from?.id || chatId;

  if (!chatId) return;

  state.totalRequests++;
  state.uniqueUsers.add(userId);
  registerUserId(userId);

  // 1. If admin is currently in an interactive input step (broadcast, adding channel, etc.)
  if (isUserAdmin(userId)) {
    const handledStep = await handleAdminMessageStep(client, msg);
    if (handledStep) return;
  }

  // 2. Admin Panel Command / Button Check
  const cleanCmd = text.toLowerCase().trim();
  const isAdminCommand = 
    cleanCmd === '/admin' || 
    cleanCmd === 'admin' || 
    cleanCmd.startsWith('/admin@') || 
    cleanCmd === '/panel' || 
    cleanCmd === 'panel' || 
    cleanCmd.startsWith('/panel@') || 
    text === '👑 پنل مدیریت ربات (ادمین)' || 
    text === 'پنل مدیریت' ||
    text === 'پنل ادمین';

  if (isAdminCommand) {
    if (isUserAdmin(userId)) {
      await sendAdminDashboard(client, chatId);
      return;
    } else {
      await client.sendMessage(
        chatId,
        `⛔️ <b>دسترسی غیرمجاز!</b>\nاین بخش اختصاصی است و فقط توسط مدیر ربات با شناسه عددی <code>567645818</code> قابل دسترسی و کنترل می‌باشد.\n\n🆔 شناسه کاربری شما: <code>${userId}</code>`,
        { parse_mode: 'HTML', reply_markup: getPersistentReplyKeyboard(userId) }
      );
      return;
    }
  }

  // Check persistent reply buttons
  if (text === '📖 آموزش استفاده') {
    const helpText = 
`📖 <b>آموزش استفاده سریع از ربات:</b>
━━━━━━━━━━━━━━━━━━━━
1️⃣ لینک هر ویدیو یا آهنگ از <b>اینستاگرام، اسپاتیفای، یوتیوب، ساندکلود یا تیک‌تاک</b> را کپی کنید.
2️⃣ لینک را به همین صفحه بفرستید.
3️⃣ برای اینستاگرام و اسپاتیفای فایل فوراً همراه با کپشن ارسال می‌شود. برای یوتیوب کیفیت دلخواه را انتخاب کنید!

⚡ بدون افت کیفیت و بدون نیاز به فیلترشکن برای دانلود فایل‌ها!`;
    await client.sendMessage(chatId, helpText, { parse_mode: 'HTML', reply_markup: getPersistentReplyKeyboard(userId) });
    return;
  }

  if (text === '☕️ قهوه مهمونم کن') {
    await client.sendMessage(chatId, '❤️ <b>از محبت و حمایت شما سپاسگزاریم!</b>\nبرای حمایت از توسعه ربات، آن را به دوستان و گروه‌های خود معرفی کنید.', { parse_mode: 'HTML', reply_markup: getPersistentReplyKeyboard(userId) });
    return;
  }

  if (text === '💡 ارسال پیشنهادات') {
    await client.sendMessage(chatId, '💡 <b>ارسال پیشنهادات:</b>\nهر ایده یا قابلیتی که مایلید به ربات اضافه شود را برای ما بنویسید تا بررسی گردد.', { parse_mode: 'HTML', reply_markup: getPersistentReplyKeyboard(userId) });
    return;
  }

  if (text === '📊 آمار من') {
    await client.sendMessage(chatId, `📊 <b>مشخصات حساب کاربری:</b>\n🆔 شناسه کاربری: <code>${userId}</code>\n👤 نام: ${escapeHtml(userName)}\n📥 دانلودهای موفق سرور: ${state.totalDownloads}`, { parse_mode: 'HTML', reply_markup: getPersistentReplyKeyboard(userId) });
    return;
  }

  if (text === '🎫 پشتیبانی') {
    const config = loadBotConfig();
    await client.sendMessage(chatId, `🎫 <b>ارتباط با پشتیبانی:</b>\nدر صورت بروز هرگونه مشکل یا سوال، با آیدی پشتیبانی در ارتباط باشید:\n@${escapeHtml(config.supportUsername || 'admin')}`, { parse_mode: 'HTML', reply_markup: getPersistentReplyKeyboard(userId) });
    return;
  }

  if (text === '🌐 زبان / Language') {
    await client.sendMessage(chatId, '🌐 زبان فعال ربات: <b>فارسی (Persian) 🇮🇷</b>', { parse_mode: 'HTML', reply_markup: getPersistentReplyKeyboard(userId) });
    return;
  }

  // Mandatory Channel Join Check (Force Subscribe)
  const membership = await checkUserMembership(client, userId);
  if (!membership.isMember) {
    addLog('قفل جوین اجباری', `کاربر ${userName} هنوز در کانال‌ها عضو نشده است`, 'pending', userId, userName);
    await sendForceJoinNotice(client, chatId, membership.pendingChannels);
    return;
  }

  // Command: /start
  if (text.startsWith('/start')) {
    addLog('دستور /start', `کاربر ${userName} ربات را استارت کرد`, 'success', userId, userName);
    await sendStartMessage(client, chatId, userName);
    return;
  }

  // Command: /help
  if (text.startsWith('/help')) {
    await sendStartMessage(client, chatId, userName);
    return;
  }

  // URL Extraction
  const extractedUrl = extractUrl(text);
  if (!extractedUrl) {
    await client.sendMessage(chatId, 
`⚠️ <b>لطفاً یک لینک معتبر از شبکه‌های اجتماعی یا موزیک ارسال کنید.</b>
━━━━━━━━━━━━━━━━━━━━
نمونه‌های پشتیبانی شده:
• <b>اینستاگرام:</b> https://www.instagram.com/reel/... یا /p/...
• <b>یوتیوب:</b> https://youtu.be/... یا /watch?v=...
• <b>اسپاتیفای:</b> https://open.spotify.com/track/...
• <b>ساندکلود:</b> https://soundcloud.com/...
• <b>تیک‌تاک:</b> https://vm.tiktok.com/...`, { parse_mode: 'HTML', reply_markup: getPersistentReplyKeyboard(userId) });
    return;
  }

  const platformInfo = identifyPlatform(extractedUrl);
  addLog('دریافت لینک', `دریافت لینک از ${platformInfo.platformNameFa}`, 'pending', userId, userName, platformInfo.platform);

  // 1. INSTAGRAM FLOW (Direct download without quality selection + real caption + multi-slide support)
  if (platformInfo.platform === 'instagram') {
    const progressMsg = await client.sendMessage(chatId, 
`📥 <b>در حال دریافت و آماده‌سازی پست اینستاگرام...</b>
━━━━━━━━━━━━━━━━━━━━
■■■■■■■□□□□□ ۶۵%`, { parse_mode: 'HTML' });

    try {
      const igResult = await downloadInstagramPost(extractedUrl);
      state.totalDownloads++;

      await client.editMessageText(chatId, progressMsg.message_id, 
`📥 <b>در حال ارسال فایل‌ها به تلگرام...</b>
━━━━━━━━━━━━━━━━━━━━
■■■■■■■■■■■■ ۱۰۰%`, { parse_mode: 'HTML' });

      const botUsername = state.botInfo?.username || 'Downloader';
      const cleanCaption = igResult.caption.trim();
      const truncatedCaption = cleanCaption.length > 700 ? cleanCaption.slice(0, 700) + '...' : cleanCaption;

      const fullCaption = 
`📷 <b>پست اینستاگرام</b>
━━━━━━━━━━━━━━━━━━━━
${escapeHtml(truncatedCaption || igResult.title || 'رسانه اینستاگرام')}

👤 <b>صفحه / سازنده:</b> ${escapeHtml(igResult.uploader)}
🔗 @${botUsername}`;

      const actionButtons = { inline_keyboard: getMessageActionButtons() };

      if (igResult.items.length === 1) {
        const singleItem = igResult.items[0];
        if (singleItem.type === 'video') {
          await client.sendVideoFile(chatId, singleItem.filePath, fullCaption, actionButtons);
        } else {
          await client.sendPhotoFile(chatId, singleItem.filePath, fullCaption, actionButtons);
        }
      } else if (igResult.items.length > 1) {
        // Carousel / Slides (عکس یا ویدیوی اسلایدی)
        await client.sendMediaGroup(chatId, igResult.items, fullCaption);
        await client.sendMessage(chatId, '👆 <b>تمام اسلایدهای این پست با موفقیت ارسال شد.</b>', {
          parse_mode: 'HTML',
          reply_markup: actionButtons,
        });
      }

      await client.deleteMessage(chatId, progressMsg.message_id);
      addLog('دانلود اینستاگرام موفق', `${igResult.uploader} (${igResult.items.length} فایل)`, 'success', userId, userName, 'instagram');
    } catch (err: any) {
      console.error('Instagram auto-download error:', err);
      const errMsg = err?.message || '';
      const isAudienceRestricted = errMsg.includes('not available to everyone') || errMsg.includes('certain audiences');
      const isLoginRequired = isAudienceRestricted || errMsg.includes('login page') || errMsg.includes('cookies');

      addLog('خطا در دانلود اینستاگرام', isAudienceRestricted ? 'محدودیت اینستاگرام' : isLoginRequired ? 'نیاز به سشن' : errMsg, 'error', userId, userName, 'instagram');

      if (isAudienceRestricted || isLoginRequired) {
        await client.editMessageText(
          chatId,
          progressMsg.message_id,
          `⚠️ <b>محدودیت دسترسی اینستاگرام (Audience Restricted)</b>\n\nاین پست دارای محدودیت سنی یا منطقه‌ای اینستاگرام است.\n\n🔑 <b>راه حل:</b> در پنل وب برنامه (بخش «وضعیت و لاگ‌ها» -> تنظیم سشن اینستاگرام)، مقدار sessionid خود را وارد کنید تا تمامی پست‌های محدود باز شوند.`,
          { parse_mode: 'HTML' }
        );
      } else {
        await client.editMessageText(chatId, progressMsg.message_id, '❌ <b>متاسفانه در استخراج فایل‌های این پست اینستاگرام خطایی رخ داد.</b>\nلطفاً لینک را بررسی کرده یا مجدد تلاش فرمایید.', { parse_mode: 'HTML' });
      }
    }
    return;
  }

  // 2. SPOTIFY TRACK FLOW
  if (platformInfo.platform === 'spotify') {
    const queueMsgText = 
`درخواست شما در صف قرار گرفت 🟢
━━━━━━━━━━━━━━━━━━━━
📍 <b>موقعیت در صف: 1</b>
🔄 به زودی آهنگ شما آماده می‌شود...`;

    const queueMsg = await client.sendMessage(chatId, queueMsgText, { parse_mode: 'HTML' });

    try {
      const spotifyInfo = await extractSpotifyInfo(extractedUrl);

      await new Promise(r => setTimeout(r, 400));
      await client.editMessageText(chatId, queueMsg.message_id, 
`📥 <b>در حال استخراج و دانلود فایل MP3...</b>
━━━━━━━━━━━━━━━━━━━━
■■■■■■■□□□□□ ۶۵%`, { parse_mode: 'HTML' });

      const result = await downloadSpotifyTrack(spotifyInfo);
      state.totalDownloads++;

      await client.editMessageText(chatId, queueMsg.message_id, 
`📥 <b>در حال ارسال فایل به تلگرام...</b>
━━━━━━━━━━━━━━━━━━━━
■■■■■■■■■■■■ ۱۰۰%`, { parse_mode: 'HTML' });

      const audioCaption = 
`🎵 <b>${escapeHtml(spotifyInfo.title)}</b>
👤 <b>هنرمند:</b> ${escapeHtml(spotifyInfo.artist)}
${spotifyInfo.album ? `💿 <b>آلبوم:</b> ${escapeHtml(spotifyInfo.album)}\n` : ''}📦 <b>حجم:</b> ${result.fileSizeFormatted}
⚡ <b>کیفیت:</b> 320kbps اورجینال
🔗 @${state.botInfo?.username || 'Downloader'}`;

      const actionButtons = { inline_keyboard: getMessageActionButtons() };

      await client.sendAudioFile(
        chatId,
        result.filePath,
        audioCaption,
        spotifyInfo.title,
        spotifyInfo.artist,
        actionButtons
      );

      await client.deleteMessage(chatId, queueMsg.message_id);
      addLog('دانلود اسپاتیفای موفق', `${spotifyInfo.artist} - ${spotifyInfo.title}`, 'success', userId, userName, 'spotify');
    } catch (err: any) {
      console.error('Spotify download error:', err);
      addLog('خطا در دانلود اسپاتیفای', err?.message || 'خطا', 'error', userId, userName, 'spotify');
      await client.editMessageText(chatId, queueMsg.message_id, '❌ <b>متاسفانه در دریافت این قطعه اسپاتیفای خطایی رخ داد.</b>\nلطفاً لینک را بررسی کرده و مجدد تلاش کنید.', { parse_mode: 'HTML' });
    }
    return;
  }

  // 3. YOUTUBE / SOUNDCLOUD / TIKTOK / OTHER FLOW (Quality selector)
  const statusMsg = await client.sendMessage(chatId, `🔍 <b>در حال آنالیز و دریافت لینک از ${escapeHtml(platformInfo.platformNameFa)}...</b> لطفاً کمی صبر کنید.`, { parse_mode: 'HTML' });

  try {
    const info = await extractMediaInfo(extractedUrl);
    const shortHash = crypto.createHash('md5').update(extractedUrl).digest('hex').slice(0, 10);
    const reqKey = `${chatId}_${shortHash}`;

    pendingRequests.set(reqKey, {
      url: extractedUrl,
      title: info.title,
      uploader: info.uploader,
      duration: info.durationFormatted,
      platform: platformInfo.platform,
      createdAt: Date.now(),
    });
    savePendingRequests();

    let caption = '';
    let keyboard: any[] = [];

    if (platformInfo.platform === 'soundcloud') {
      caption = 
`🎵 <b>${escapeHtml(info.title.slice(0, 100))}</b>

👤 <b>هنرمند:</b> ${escapeHtml(info.artist || info.uploader)}
${info.album ? `💿 <b>آلبوم:</b> ${escapeHtml(info.album)}\n` : ''}${info.genre ? `🎚 <b>سبک موزیک:</b> ${escapeHtml(info.genre)}\n` : ''}⏱ <b>مدت زمان:</b> ${escapeHtml(info.durationFormatted)}
🌐 <b>سرویس:</b> ساندکلود (SoundCloud)

👇 <b>کیفیت مورد نظر جهت دانلود را انتخاب کنید:</b>`;

      keyboard = [
        [{ text: '🎵 دانلود کیفیت عالی (320kbps MP3)', callback_data: `dl:${reqKey}:best_audio` }],
        [{ text: '🎧 دانلود کیفیت سبک (128kbps)', callback_data: `dl:${reqKey}:standard_audio` }],
      ];
    } else {
      caption = 
`▶️ <b>ویدیو ${escapeHtml(platformInfo.platformNameFa)}</b>
━━━━━━━━━━━━━━━━━━━━
<b>${escapeHtml(info.title.slice(0, 120))}</b>

👤 <b>صفحه / کانال:</b> ${escapeHtml(info.uploader)}
⏱ <b>مدت زمان:</b> ${escapeHtml(info.durationFormatted)}
🔗 @${state.botInfo?.username || 'Downloader'}

👇 <b>کیفیت مورد نظر خود را جهت دانلود انتخاب کنید:</b>`;

      keyboard = [
        [
          { text: '🎬 1080p FHD (فول اچ‌دی)', callback_data: `dl:${reqKey}:best_1080` },
          { text: '🎥 720p HD (اچ‌دی عالی)', callback_data: `dl:${reqKey}:best_720` },
        ],
        [
          { text: '📱 480p SD (کیفیت متوسط)', callback_data: `dl:${reqKey}:best_480` },
          { text: '⚡ 360p (کم‌حجم و سریع)', callback_data: `dl:${reqKey}:best_360` },
        ],
        [
          { text: '🎧 دانلود فایل صوتی MP3', callback_data: `dl:${reqKey}:best_audio` },
        ],
        [
          { text: '🎵 استخراج صدای موزیک (MP3)', callback_data: `dl:${reqKey}:find_song` },
        ]
      ];
    }

    // Append action buttons under choices
    keyboard.push(...getMessageActionButtons());

    await client.deleteMessage(chatId, statusMsg.message_id);

    if (info.thumbnail && info.thumbnail.startsWith('http')) {
      await client.sendPhoto(chatId, info.thumbnail, {
        caption,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard },
      });
    } else {
      await client.sendMessage(chatId, caption, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard },
      });
    }

    addLog('آماده‌سازی گزینه‌ها', `کیفیت‌ها ارسال شد`, 'success', userId, userName);
  } catch (err: any) {
    console.error('Error analyzing URL:', err);
    addLog('خطا در آنالیز لینک', err?.message || 'خطا', 'error', userId, userName);
    await client.editMessageText(chatId, statusMsg.message_id, '❌ <b>متاسفانه در استخراج اطلاعات این لینک مشکلی پیش آمد.</b>\nلطفاً لینک را بررسی کرده و مجدد تلاش فرمایید.', { parse_mode: 'HTML' });
  }
}

/**
 * Handle callback query
 */
async function handleCallbackQuery(client: TelegramClient, query: any) {
  const data = query.data || '';
  const chatId = query.message?.chat?.id;
  const userName = query.from?.first_name || 'کاربر';
  const userId = query.from?.id || chatId;

  if (!chatId) return;

  // Handle In-Bot Admin Panel Callbacks
  if (data.startsWith('adm:')) {
    const handledAdmin = await handleAdminCallbackQuery(client, query);
    if (handledAdmin) return;
  }

  // Handle Force Subscribe Verification Button
  if (data === 'verify_sub') {
    const membership = await checkUserMembership(client, userId);
    if (membership.isMember) {
      await client.answerCallbackQuery(query.id, {
        text: '✅ عضویت شما تایید شد! هم‌اکنون می‌توانید لینک دلخواه خود را ارسال کنید.',
        show_alert: true,
      });
      await sendStartMessage(client, chatId, userName);
    } else {
      await client.answerCallbackQuery(query.id, {
        text: '❌ شما هنوز در تمام کانال‌ها عضو نشده‌اید! لطفاً ابتدا عضو شوید.',
        show_alert: true,
      });
    }
    return;
  }

  if (data.startsWith('dl:')) {
    const parts = data.split(':');
    const reqKey = parts[1];
    const qualityId = parts[2] || 'best_720';

    let reqData = pendingRequests.get(reqKey);
    if (!reqData) {
      loadPendingRequests();
      reqData = pendingRequests.get(reqKey);
    }

    if (!reqData) {
      await client.answerCallbackQuery(query.id, {
        text: '⚠️ این دکمه منقضی شده است. لطفاً لینک را مجدد ارسال فرمایید.',
        show_alert: true,
      });
      return;
    }

    const isSongFinder = qualityId === 'find_song';

    await client.answerCallbackQuery(query.id, {
      text: isSongFinder
        ? '🔍 در حال استخراج و آماده‌سازی فایل صوتی MP3...'
        : '⏳ دانلود فایل آغاز شد...',
    });

    const initialText = 
`📥 <b>در حال دانلود و آماده‌سازی فایل...</b>
━━━━━━━━━━━━━━━━━━━━
■■■■■■■□□□□□ ۶۵%`;

    const progressMsg = await client.sendMessage(chatId, initialText, { parse_mode: 'HTML' });
    addLog(isSongFinder ? 'استخراج صوت' : 'شروع دانلود', `پردازش برای ${qualityId}`, 'pending', userId, userName);

    try {
      const result = await downloadMedia(reqData.url, qualityId);
      state.totalDownloads++;

      const MAX_TELEGRAM_BOT_SIZE = 49 * 1024 * 1024; // 49MB limit
      const actionButtons = { inline_keyboard: getMessageActionButtons() };
      const botUsername = state.botInfo?.username || 'Downloader';
      const appUrl = process.env.APP_URL || 'https://ais-dev-kkczn3du3ijigdvmf4bqap-733025758965.us-east1.run.app';
      const downloadUrl = `${appUrl}/api/media/file/${result.id}`;

      if (isSongFinder) {
        const song: IdentifiedSong = result.songInfo || await identifySongFromMedia(reqData.url);
        const searchEncoded = encodeURIComponent(song.searchQuery || `${song.artist} ${song.title}`);

        const songCaption = 
`🎶 <b>موزیک با موفقیت استخراج شد!</b>
━━━━━━━━━━━━━━━━━━━━
🏷 <b>عنوان قطعه:</b> ${escapeHtml(song.title)}
👤 <b>خواننده / سازنده:</b> ${escapeHtml(song.artist)}
${song.album ? `💿 <b>آلبوم:</b> ${escapeHtml(song.album)}\n` : ''}📦 <b>حجم:</b> ${result.fileSizeFormatted}
⚡ <b>کیفیت:</b> 320kbps اورجینال
🔗 @${botUsername}`;

        const songMarkup = {
          inline_keyboard: [
            [
              { text: '🔍 جستجو در اسپاتیفای', url: `https://open.spotify.com/search/${searchEncoded}` },
              { text: '▶️ یوتیوب موزیک', url: `https://music.youtube.com/search?q=${searchEncoded}` },
            ],
            ...getMessageActionButtons()
          ]
        };

        if (result.fileSizeBytes <= MAX_TELEGRAM_BOT_SIZE) {
          await client.sendAudioFile(
            chatId,
            result.filePath,
            songCaption,
            song.title,
            song.artist,
            songMarkup
          );
          await client.deleteMessage(chatId, progressMsg.message_id);
          addLog('موزیک استخراج شد', `${song.artist} - ${song.title}`, 'success', userId, userName);
        } else {
          await client.editMessageText(chatId, progressMsg.message_id, `${songCaption}\n\n📥 <a href="${downloadUrl}">دانلود مستقیم فایل صوتی</a>`, {
            parse_mode: 'HTML',
            reply_markup: songMarkup,
          });
        }
        return;
      }

      // Normal Download Flow (Video or Audio)
      if (result.fileSizeBytes <= MAX_TELEGRAM_BOT_SIZE) {
        if (qualityId === 'best_audio' || qualityId === 'standard_audio') {
          const audioCaption = 
`🎵 <b>${escapeHtml(reqData.title.slice(0, 100))}</b>
━━━━━━━━━━━━━━━━━━━━
📦 <b>حجم:</b> ${result.fileSizeFormatted}
👤 <b>هنرمند / سازنده:</b> ${escapeHtml(reqData.uploader)}
⚡ <b>کیفیت:</b> 320kbps اورجینال
🔗 @${botUsername}`;

          await client.sendAudioFile(
            chatId,
            result.filePath,
            audioCaption,
            reqData.title,
            reqData.uploader,
            actionButtons
          );
        } else {
          const mediaCaption = 
`🎬 <b>ویدیو دانلود شده</b>
━━━━━━━━━━━━━━━━━━━━
${escapeHtml(reqData.title.slice(0, 120))}

📦 <b>حجم:</b> ${result.fileSizeFormatted}
👤 <b>سازنده / کانال:</b> ${escapeHtml(reqData.uploader)}
🔗 @${botUsername}`;

          await client.sendVideoFile(
            chatId,
            result.filePath,
            mediaCaption,
            actionButtons
          );
        }

        await client.deleteMessage(chatId, progressMsg.message_id);
        addLog('دانلود موفق', `فایل ${result.fileSizeFormatted} با موفقیت به تلگرام ارسال شد`, 'success', userId, userName);
      } else {
        // File size exceeds 49MB (e.g. 1080p YouTube video).
        // Check if we can deliver a lighter 480p/360p version directly in Telegram!
        let sentLighter = false;
        if (qualityId === 'best_1080' || qualityId === 'best_720') {
          try {
            const lighter = await downloadMedia(reqData.url, 'best_360');
            if (lighter.fileSizeBytes <= MAX_TELEGRAM_BOT_SIZE) {
              const mediaCaption = 
`🎬 <b>ویدیو یوتیوب (بهینه‌شده برای پخش در تلگرام)</b>
━━━━━━━━━━━━━━━━━━━━
${escapeHtml(reqData.title.slice(0, 120))}

📦 <b>حجم:</b> ${lighter.fileSizeFormatted}
👤 <b>کانال:</b> ${escapeHtml(reqData.uploader)}
🔗 @${botUsername}

⚡ <i>نسخه کامل با کیفیت انتخابی (${result.fileSizeFormatted}) از لینک زیر قابل دریافت است:</i>`;

              await client.sendVideoFile(
                chatId,
                lighter.filePath,
                mediaCaption,
                {
                  inline_keyboard: [
                    [{ text: `📥 دریافت مستقیم کیفیت اصلی (${result.fileSizeFormatted})`, url: downloadUrl }],
                    ...getMessageActionButtons()
                  ]
                }
              );
              await client.deleteMessage(chatId, progressMsg.message_id);
              sentLighter = true;
              addLog('دانلود موفق', `فایل ویدیویی در تلگرام تحویل شد`, 'success', userId, userName);
            }
          } catch (e) {
            console.warn('Lighter version delivery fallback:', e);
          }
        }

        if (!sentLighter) {
          const bigFileText = 
`⚠️ <b>حجم این ویدیو بیش از سقف ارسال مستقیم ربات تلگرام است!</b>
حجم این فایل: <b>${result.fileSizeFormatted}</b> (حداکثر سقف ارسال تلگرام ۵۰ مگابایت است).

⚡ <b>می‌توانید مستقیماً از لینک پرسرعت زیر دانلود کنید:</b>
📥 <a href="${downloadUrl}">کلیک کنید جهت دریافت مستقیم ویدیو</a>`;

          await client.editMessageText(chatId, progressMsg.message_id, bigFileText, {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📥 دانلود با لینک مستقیم', url: downloadUrl }],
                ...getMessageActionButtons()
              ]
            }
          });

          addLog('لینک دانلود ارائه شد', `فایل بزرگ ${result.fileSizeFormatted}`, 'success', userId, userName);
        }
      }
    } catch (err: any) {
      console.error('Error downloading:', err);
      const errMsg = err?.message || '';

      addLog('خطا در دانلود', errMsg, 'error', chatId, userName);

      const streamUrl = await getDirectStreamUrl(reqData.url, qualityId);
      if (streamUrl) {
        await client.editMessageText(
          chatId,
          progressMsg.message_id,
          `⚠️ <b>لینک مستقیم سرور آماده است:</b>\n\nبرای مشاهده یا ذخیره فایل روی دکمه زیر کلیک فرمایید:`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🌐 دریافت مستقیم فایل', url: streamUrl }],
                ...getMessageActionButtons()
              ]
            }
          }
        );
      } else if (errMsg.includes("Sign in to confirm you're not a bot") || errMsg.includes("confirm you’re not a bot")) {
        await client.editMessageText(
          chatId,
          progressMsg.message_id,
          `⚠️ <b>یوتیوب به دلیل دانلود از دیتاسنتر ابری نیاز به کوکی ورود دارد.</b>\n\nمدیر ربات می‌تواند با رفتن به بخش <b>👑 پنل مدیریت (/admin) ➔ ▶️ کوکی یوتیوب</b>، کوکی‌های یوتیوب را ثبت کند یا سرویس <code>bgutil-pot-provider</code> را اجرا کند تا تمامی محدودیت‌های یوتیوب برطرف گردد.`,
          { parse_mode: 'HTML' }
        );
      } else {
        await client.editMessageText(chatId, progressMsg.message_id, '❌ <b>متاسفانه در دریافت فایل این ویدیو خطایی رخ داد.</b>\nلطفاً مجدد تلاش کنید یا لینک دیگری ارسال فرمایید.', { parse_mode: 'HTML' });
      }
    }
    return;
  }

  // Fallback: always answer unknown callback queries so Telegram stops the button spinner
  await client.answerCallbackQuery(query.id).catch(() => null);
}

/**
 * Main polling loop
 */
async function startPollingLoop(client: TelegramClient) {
  let offset = 0;
  pollingAbortController = new AbortController();

  while (!pollingAbortController.signal.aborted) {
    try {
      const updates = await client.getUpdates(offset, 25, pollingAbortController.signal);
      state.lastError = null;
      for (const update of updates) {
        offset = update.update_id + 1;

        if (update.message) {
          handleIncomingMessage(client, update.message).catch(e => console.error('Handle message error:', e));
        } else if (update.callback_query) {
          handleCallbackQuery(client, update.callback_query).catch(e => console.error('Handle callback error:', e));
        }
      }
    } catch (err: any) {
      if (pollingAbortController?.signal.aborted) {
        break;
      }
      const errMsg = String(err?.message || err);
      // Self-heal if an external webhook was registered that blocks getUpdates
      const isWebhookConflict = errMsg.toLowerCase().includes('can\'t use getupdates method while webhook is active') || 
                                (errMsg.toLowerCase().includes('webhook') && !errMsg.toLowerCase().includes('terminated by other'));
      if (isWebhookConflict) {
        try {
          await client.deleteWebhook(false);
          state.isWebhookMode = false;
          state.webhookUrl = null;
          state.lastError = null;
          addLog('ترمیم خودکار اتصال', 'وب‌هوک مسدودکننده پاک شد و دریافت پیام‌ها (Polling) ادامه یافت.');
          await new Promise(r => setTimeout(r, 1000));
          continue;
        } catch {}
      }

      const isMultipleInstanceConflict = errMsg.toLowerCase().includes('terminated by other getupdates') || errMsg.toLowerCase().includes('conflict');
      if (isMultipleInstanceConflict) {
        console.warn('Telegram polling conflict: another instance (e.g. AWS production) is running. Backing off 45s...');
        state.lastError = 'ربات روی سرور اصلی شما فعال است (حالت استندبای)';
        await new Promise(r => setTimeout(r, 45000));
        continue;
      }

      console.warn('Telegram polling retry:', errMsg);
      state.lastError = errMsg || 'Polling error';
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

/**
 * Start Telegram Bot
 */
export async function startTelegramBot(token?: string): Promise<{ success: boolean; message: string; botInfo?: any }> {
  if (token) {
    currentToken = token;
  }

  if (!currentToken) {
    state.isActive = false;
    state.lastError = 'توکن تلگرام مشخص نشده است.';
    return { success: false, message: 'توکن ربات تلگرام تنظیم نشده است.' };
  }

  if (pollingAbortController) {
    pollingAbortController.abort();
    pollingAbortController = null;
  }

  try {
    const client = new TelegramClient(currentToken);
    activeClient = client;

    const me = await client.getMe();
    state.botInfo = {
      id: me.id,
      username: me.username,
      first_name: me.first_name,
    };
    state.isActive = true;
    state.lastError = null;

    // In persistent server mode (!process.env.VERCEL), always clear any stale/failing webhook
    // so Long Polling immediately processes all pending and incoming Telegram messages.
    const whInfo = await client.getWebhookInfo().catch(() => null);
    if (whInfo?.url && !process.env.VERCEL) {
      await client.deleteWebhook(false).catch(() => null);
      state.isWebhookMode = false;
      state.webhookUrl = null;
      addLog('اتصال ربات', `ربات @${me.username} متصل شد (وب‌هوک قبلی پاک شد و Polling زنده فعال گردید).`);
      startPollingLoop(client);
    } else if (whInfo?.url) {
      state.isWebhookMode = true;
      state.webhookUrl = whInfo.url;
      addLog('اتصال ربات', `ربات @${me.username} متصل شد (حالت وب‌هوک فعال: ${whInfo.url})`);
    } else {
      state.isWebhookMode = false;
      state.webhookUrl = null;
      addLog('اتصال ربات', `ربات @${me.username} با موفقیت به تلگرام متصل شد (حالت Polling).`);
      startPollingLoop(client);
    }

    return {
      success: true,
      message: `ربات @${me.username} با موفقیت فعال شد و آماده پاسخگویی است.`,
      botInfo: state.botInfo,
    };
  } catch (err: any) {
    state.isActive = false;
    state.lastError = err?.message || 'خطا در اتصال به تلگرام';
    console.error('Failed to start Telegram Bot:', err);
    return {
      success: false,
      message: `خطا در اتصال به تلگرام: ${err?.message || 'نامشخص'}`,
    };
  }
}

/**
 * Handle incoming Webhook update from Telegram
 */
export async function handleWebhookUpdate(update: any) {
  if (!activeClient) {
    if (currentToken) {
      activeClient = new TelegramClient(currentToken);
    } else {
      return;
    }
  }

  try {
    if (update.message) {
      await handleIncomingMessage(activeClient, update.message);
    } else if (update.callback_query) {
      await handleCallbackQuery(activeClient, update.callback_query);
    }
  } catch (err: any) {
    console.error('Webhook processing error:', err);
  }
}

/**
 * Configure Telegram Webhook (with pre-flight POST verification so broken URLs never break the bot)
 */
export async function setBotWebhook(webhookUrl: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!activeClient) {
      if (!currentToken) return { success: false, message: 'توکن ربات تنظیم نشده است.' };
      activeClient = new TelegramClient(currentToken);
    }

    // Pre-flight check: verify the target webhookUrl accepts unauthenticated POST requests
    try {
      const testRes = await fetch(webhookUrl, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ update_id: 0 }),
      });
      const check = evaluateWebhookCheckStatus(testRes.status);
      if (!check.valid) {
        addLog('رد وب‌هوک نامعتبر', check.reasonFa || `HTTP ${testRes.status}`, undefined, undefined, undefined, 'error');
        if (!pollingAbortController) {
          startPollingLoop(activeClient);
        }
        return {
          success: false,
          message: check.reasonFa || `آدرس وب‌هوک نامعتبر است (HTTP ${testRes.status}). ربات در حالت Polling فعال ماند.`,
        };
      }
    } catch (netErr: any) {
      return {
        success: false,
        message: `امکان برقراری ارتباط با آدرس وب‌هوک وجود ندارد (${netErr?.message || 'Network Error'}). ربات در حالت Polling فعال نگه داشته شد.`,
      };
    }

    if (pollingAbortController) {
      pollingAbortController.abort();
      pollingAbortController = null;
    }

    await activeClient.setWebhook(webhookUrl);
    state.isWebhookMode = true;
    state.webhookUrl = webhookUrl;
    addLog('تنظیم وب‌هوک', `وب‌هوک با آدرس ${webhookUrl} فعال شد.`);
    return {
      success: true,
      message: `وب‌هوک تلگرام با موفقیت بررسی و ثبت شد.`,
    };
  } catch (err: any) {
    console.error('Error setting webhook:', err);
    return { success: false, message: `خطا در ثبت وب‌هوک: ${err?.message || 'نامشخص'}` };
  }
}

/**
 * Remove Telegram Webhook and resume polling
 */
export async function removeBotWebhook(): Promise<{ success: boolean; message: string }> {
  try {
    if (!activeClient) {
      if (!currentToken) return { success: false, message: 'توکن ربات تنظیم نشده است.' };
      activeClient = new TelegramClient(currentToken);
    }

    await activeClient.deleteWebhook(false);
    state.isWebhookMode = false;
    state.webhookUrl = null;
    addLog('حذف وب‌هوک', 'وب‌هوک حذف شد و ربات به حالت Polling بازگشت.');

    startPollingLoop(activeClient);
    return {
      success: true,
      message: 'وب‌هوک حذف شد و ربات در حالت Polling شروع به کار کرد.',
    };
  } catch (err: any) {
    console.error('Error deleting webhook:', err);
    return { success: false, message: `خطا در حذف وب‌هوک: ${err?.message || 'نامشخص'}` };
  }
}

/**
 * Get Telegram Webhook info
 */
export async function getBotWebhookInfo() {
  if (!activeClient) {
    if (currentToken) {
      activeClient = new TelegramClient(currentToken);
    } else {
      return { url: '', has_custom_certificate: false, pending_update_count: 0 };
    }
  }
  return await activeClient.getWebhookInfo();
}

/**
 * Simulate bot response for Web UI interactive tester
 */
export async function simulateBotResponse(userMessage: string) {
  const url = extractUrl(userMessage);
  if (!url) {
    if (userMessage.includes('/start') || userMessage.includes('آموزش')) {
      return {
        type: 'text',
        text: `✨ به ربات دانلودر چندمنظوره خوش آمدید ✨\n━━━━━━━━━━━━━━━━━━━━\nسلام دوست عزیز ✋\nاینجا می‌توانید ویدیو و موزیک موردعلاقه‌تان را سریع و ساده دانلود کنید 🚀\n\n📥 امکانات ربات:\n▶️ یوتیوب (YouTube)\n📷 اینستاگرام (Instagram - دانلود فوری با کپشن)\n📻 ساندکلاد (SoundCloud)\n🟢 اسپاتیفای (Spotify)\n🎵 تیک‌تاک (TikTok)\n\n🐸 فقط لینک را ارسال کنید! 👇`,
        keyboard: [
          [{ label: '➕ افزودن ربات به گروه', data: 'add_group' }],
          [{ label: '📢 چنل اصلی ↗️', data: 'main_channel' }]
        ]
      };
    }
    if (userMessage.includes('/admin') || userMessage.includes('پنل')) {
      return {
        type: 'text',
        text: `👑 <b>پنل فوق‌پیشرفته مدیریت ربات</b>\n━━━━━━━━━━━━━━━━━━━━\n👤 این بخش فقط با آیدی عددی <code>567645818</code> در تلگرام فعال است.\n\n📊 <b>امکانات پنل درون ربات:</b>\n• 📊 آمار جامع سرور، دانلودها و کاربران\n• 📢 ارسال و فوروارد همگانی (Broadcast)\n• 🔒 روشن/خاموش کردن قفل جوین اجباری و افزودن کانال\n• 📷 مدیریت سشن اینستاگرام\n• 🌐 ثبت و حذف وب‌هوک و تست پینگ\n• 📜 مشاهده لاگ‌های زنده\n• ✉️ ارسال پیام خصوصی به کاربران\n• ⚙️ تنظیمات و مدیریت ادمین‌ها`,
        keyboard: [
          [{ label: '📊 آمار سرور', data: 'adm_stats' }, { label: '📢 ارسال همگانی', data: 'adm_bc' }],
          [{ label: '🔒 قفل کانال‌ها', data: 'adm_fj' }, { label: '📷 سشن اینستاگرام', data: 'adm_ig' }],
          [{ label: '🌐 مدیریت وب‌هوک', data: 'adm_wh' }, { label: '📜 لاگ‌های زنده', data: 'adm_logs' }]
        ]
      };
    }
    return {
      type: 'text',
      text: '⚠️ لطفاً یک لینک معتبر از اینستاگرام، یوتیوب، اسپاتیفای یا ساندکلود ارسال کنید.',
      keyboard: []
    };
  }

  const platform = identifyPlatform(url);

  if (platform.platform === 'instagram') {
    return {
      type: 'text',
      text: `📥 <b>پست اینستاگرام با موفقیت استخراج و ارسال شد!</b>\n━━━━━━━━━━━━━━━━━━━━\nکپشن پست: نمونه کپشن ارسالی پیج اینستاگرام\n\n👤 صفحه: اینستاگرام\n⚡ بدون نیاز به انتخاب کیفیت، ویدیو/عکس‌ها مستقیماً ارسال شدند.`,
      keyboard: [
        [{ label: '➕ افزودن ربات به گروه', data: 'add_group' }],
        [{ label: '📢 چنل اصلی ↗️', data: 'main_channel' }]
      ]
    };
  }

  if (platform.platform === 'spotify') {
    const sp = await extractSpotifyInfo(url);
    return {
      type: 'spotify_card',
      title: sp.title,
      uploader: sp.artist,
      duration: '3:20',
      platform: 'اسپاتیفای',
      thumbnail: sp.thumbnail,
      url: sp.url,
      keyboard: [
        { id: 'dl_spotify', label: '📥 دانلود فایل صوتی اورجینال (MP3 320k)', resolution: '320kbps' },
        { id: 'add_group', label: '➕ افزودن ربات به گروه', resolution: 'گروه' }
      ]
    };
  }

  const info = await extractMediaInfo(url);
  const standardQualities = getStandardQualityOptions(platform.platform);

  return {
    type: 'video_card',
    title: info.title,
    uploader: info.uploader,
    duration: info.durationFormatted,
    platform: platform.platformNameFa,
    thumbnail: info.thumbnail,
    url: info.url,
    keyboard: standardQualities.map(q => ({
      id: q.id,
      label: q.labelFa,
      resolution: q.resolution,
    }))
  };
}
