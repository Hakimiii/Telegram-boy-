import path from 'node:path';
import {
  SUPER_ADMIN_ID,
  isUserAdmin,
  loadBotConfig,
  saveBotConfig,
  addAdminId,
  removeAdminId,
  getRegisteredUsers,
  getRegisteredUsersCount,
  type RequiredChannel,
} from './configManager.ts';
import {
  type TelegramClient,
  getBotState,
  addLog,
  setBotWebhook,
  removeBotWebhook,
  getBotWebhookInfo,
  testChannelAccess,
} from './telegramBot.ts';
import {
  hasInstagramCookies,
  saveInstagramSession,
  clearInstagramCookies,
} from './mediaDownloader.ts';

interface AdminStepState {
  step: string;
  data?: any;
}

// In-memory state tracking for multi-step admin input
const adminSteps = new Map<number, AdminStepState>();

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d} روز و ${h} ساعت و ${m} دقیقه`;
  if (h > 0) return `${h} ساعت و ${m} دقیقه و ${s} ثانیه`;
  return `${m} دقیقه و ${s} ثانیه`;
}

/**
 * Send or edit main admin panel menu
 */
export async function sendAdminDashboard(
  client: TelegramClient,
  chatId: number,
  messageId?: number
) {
  adminSteps.delete(chatId);

  const state = getBotState();
  const config = loadBotConfig();
  const usersCount = getRegisteredUsersCount();
  const memoryMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);

  const connStatus = state.isActive ? '🟢 فعال و متصل' : '🔴 غیرفعال یا در حال اتصال';
  const connMode = state.isWebhookMode ? '🌐 وب‌هوک (Webhook)' : '⚡ پولینگ زنده (Long Polling)';
  const fjStatus = config.forceJoinEnabled
    ? `🟢 فعال (${config.channels.length} کانال)`
    : '🔴 غیرفعال';
  const igStatus = hasInstagramCookies() ? '🟢 فعال (دارای کوکی)' : '⚪ غیرفعال (دانلود عمومی)';

  const text =
`👑 <b>پنل مدیریت پیشرفته ربات</b>
━━━━━━━━━━━━━━━━━━━━
سلام مدیر گرامی! به پنل کامل کنترل ربات خوش آمدید.

📊 <b>وضعیت لحظه‌ای سرور و ربات:</b>
• <b>وضعیت اتصال:</b> ${connStatus}
• <b>نوع اتصال:</b> ${connMode}
• <b>مدت زمان روشن بودن:</b> ${formatUptime(state.uptimeSeconds)}
• <b>تعداد کل دانلودها:</b> ${state.totalDownloads.toLocaleString('fa-IR')} فایل
• <b>تعداد کل درخواست‌ها:</b> ${state.totalRequests.toLocaleString('fa-IR')}
• <b>کل کاربران ثبت‌شده:</b> ${usersCount.toLocaleString('fa-IR')} نفر
• <b>قفل جوین اجباری:</b> ${fjStatus}
• <b>سشن اینستاگرام:</b> ${igStatus}
• <b>مصرف حافظه RAM:</b> ${memoryMb} مگابایت
• <b>شناسه عددی شما:</b> <code>${chatId}</code> ${chatId === SUPER_ADMIN_ID ? '⭐️ (مالک اصلی)' : '(مدیر)'}

👇 <i>جهت مدیریت هر بخش، یکی از دکمه‌های زیر را انتخاب کنید:</i>`;

  const keyboard = [
    [
      { text: '📊 آمار و سرور', callback_data: 'adm:stats' },
      { text: '📢 ارسال همگانی (Broadcast)', callback_data: 'adm:broadcast' }
    ],
    [
      { text: '🔒 قفل کانال‌ها (جوین اجباری)', callback_data: 'adm:forcejoin' },
      { text: '📷 سشن اینستاگرام', callback_data: 'adm:instagram' }
    ],
    [
      { text: '🌐 مدیریت وب‌هوک', callback_data: 'adm:webhook' },
      { text: '📜 لاگ‌های زنده', callback_data: 'adm:logs' }
    ],
    [
      { text: '✉️ پیام به کاربر', callback_data: 'adm:dm' },
      { text: '⚙️ تنظیمات و ادمین‌ها', callback_data: 'adm:settings' }
    ],
    [
      { text: '🔄 بروزرسانی آمار', callback_data: 'adm:refresh' },
      { text: '❌ بستن پنل', callback_data: 'adm:close' }
    ]
  ];

  if (messageId) {
    try {
      await client.editMessageText(chatId, messageId, text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard },
      });
      return;
    } catch {}
  }

  await client.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard },
  });
}

/**
 * Handle admin button callbacks
 */
export async function handleAdminCallbackQuery(
  client: TelegramClient,
  query: any
): Promise<boolean> {
  const data = query.data || '';
  if (!data.startsWith('adm:')) return false;

  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const userId = query.from?.id || chatId;

  if (!isUserAdmin(userId)) {
    await client.answerCallbackQuery(query.id, {
      text: `⛔️ دسترسی غیرمجاز! این بخش فقط برای شناسه عددی ${SUPER_ADMIN_ID} مجاز است.`,
      show_alert: true,
    });
    return true;
  }

  await client.answerCallbackQuery(query.id);

  // Main menu
  if (data === 'adm:menu' || data === 'adm:refresh') {
    await sendAdminDashboard(client, chatId, messageId);
    return true;
  }

  // Close panel
  if (data === 'adm:close') {
    adminSteps.delete(chatId);
    await client.deleteMessage(chatId, messageId);
    await client.sendMessage(chatId, '✅ <b>پنل مدیریت بسته شد.</b>\nجهت باز کردن مجدد، دستور /admin یا /panel را ارسال کنید.', { parse_mode: 'HTML' });
    return true;
  }

  // 1. STATS SUBMENU
  if (data === 'adm:stats') {
    const state = getBotState();
    const config = loadBotConfig();
    const mem = process.memoryUsage();
    const usersCount = getRegisteredUsersCount();

    const text =
`📊 <b>آمار جامع سرور و ربات:</b>
━━━━━━━━━━━━━━━━━━━━
🤖 <b>شناسه ربات:</b> <code>${state.botInfo?.id || '8903893701'}</code>
👤 <b>نام کاربری ربات:</b> @${state.botInfo?.username || 'Downloder_socialbot'}
🔑 <b>توکن فعال:</b> <code>${state.tokenMasked}</code>

⏱ <b>زمان فعالیت (Uptime):</b> ${formatUptime(state.uptimeSeconds)}
📥 <b>تعداد کل دانلودهای موفق:</b> ${state.totalDownloads.toLocaleString('fa-IR')}
📨 <b>تعداد کل پیام‌ها و درخواست‌ها:</b> ${state.totalRequests.toLocaleString('fa-IR')}
👥 <b>تعداد کل کاربران منحصربه‌فرد:</b> ${usersCount.toLocaleString('fa-IR')} نفر
🔒 <b>کانال‌های قفل اجباری:</b> ${config.channels.length} کانال (${config.forceJoinEnabled ? 'فعال 🟢' : 'غیرفعال 🔴'})

💻 <b>منابع سخت‌افزاری سرور:</b>
• حافظه RAM اشغال‌شده (RSS): ${(mem.rss / 1024 / 1024).toFixed(1)} MB
• حافظه Node.js Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(1)} / ${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB
• نسخه Node: ${process.version}
• سیستم‌عامل: ${process.platform} (${process.arch})
• آخرین خطای ثبت‌شده: ${state.lastError ? `<code>${escapeHtml(state.lastError)}</code>` : 'هیچ خطایی وجود ندارد ✅'}`;

    const keyboard = [
      [{ text: '🔄 بروزرسانی آمار', callback_data: 'adm:stats' }],
      [{ text: '🔙 بازگشت به پنل اصلی', callback_data: 'adm:menu' }]
    ];

    await client.editMessageText(chatId, messageId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
    return true;
  }

  // 2. FORCE JOIN SUBMENU
  if (data === 'adm:forcejoin') {
    const config = loadBotConfig();
    const isEnabled = config.forceJoinEnabled;

    let chListText = '';
    if (config.channels.length === 0) {
      chListText = '<i>هنوز هیچ کانالی برای قفل اجباری ثبت نشده است.</i>';
    } else {
      chListText = config.channels.map((ch, idx) => 
        `${idx + 1}. <b>${escapeHtml(ch.title || ch.username || ch.id)}</b>\n   شناسه: <code>${ch.id}</code> | لینک: <a href="${ch.url || `https://t.me/${ch.username}`}">${ch.username || 'لینک'}</a>`
      ).join('\n\n');
    }

    const text =
`🔒 <b>مدیریت قفل جوین اجباری کانال‌ها:</b>
━━━━━━━━━━━━━━━━━━━━
وضعیت فعلی قفل: ${isEnabled ? '🟢 <b>روشن و فعال</b> (کاربران باید عضو شوند)' : '🔴 <b>خاموش و غیرفعال</b> (استفاده آزاد است)'}

📋 <b>لیست کانال‌های اسپانسر فعلی:</b>
${chListText}

💡 <i>نکته: ربات باید در این کانال‌ها ادمین باشد تا بتواند عضویت کاربر را بررسی کند.</i>`;

    const keyboard = [
      [
        {
          text: isEnabled ? '🔴 غیرفعال‌سازی قفل' : '🟢 فعال‌سازی قفل',
          callback_data: 'adm:fj_toggle'
        }
      ],
      [
        { text: '➕ افزودن کانال جدید', callback_data: 'adm:fj_add' },
        { text: '➖ حذف کانال', callback_data: 'adm:fj_remove' }
      ],
      [
        { text: '🔍 تست دسترسی ادمین ربات', callback_data: 'adm:fj_test' }
      ],
      [
        { text: '🔙 بازگشت به پنل اصلی', callback_data: 'adm:menu' }
      ]
    ];

    await client.editMessageText(chatId, messageId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
    return true;
  }

  // Toggle Force Join
  if (data === 'adm:fj_toggle') {
    const config = loadBotConfig();
    const newState = !config.forceJoinEnabled;
    saveBotConfig({ forceJoinEnabled: newState });
    addLog('تغییر قفل اجباری', `قفل جوین اجباری توسط ادمین ${newState ? 'فعال' : 'غیرفعال'} شد.`);
    await client.answerCallbackQuery(query.id, {
      text: newState ? '✅ قفل جوین اجباری فعال شد.' : '⚠️ قفل جوین اجباری غیرفعال شد.',
      show_alert: false,
    });
    // Re-render
    query.data = 'adm:forcejoin';
    return handleAdminCallbackQuery(client, query);
  }

  // Add channel prompt
  if (data === 'adm:fj_add') {
    adminSteps.set(chatId, { step: 'awaiting_channel_id' });
    const text =
`➕ <b>افزودن کانال جدید برای قفل جوین اجباری:</b>
━━━━━━━━━━━━━━━━━━━━
لطفاً <b>یوزرنیم کانال</b> (مانند <code>@mychannel</code>) یا <b>شناسه عددی کانال</b> (مانند <code>-1001234567890</code>) را ارسال فرمایید.

⚠️ <b>پیش‌نیاز مهم:</b>
حتماً قبل از ارسال، ربات @${(getBotState().botInfo?.username) || 'Downloder_socialbot'} را در کانال خود <b>ادمین (Admin)</b> کنید.

جهت انصراف، کلمه <b>انصراف</b> یا /cancel را ارسال کنید.`;

    const keyboard = [
      [{ text: '❌ انصراف و بازگشت', callback_data: 'adm:forcejoin' }]
    ];

    await client.editMessageText(chatId, messageId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
    return true;
  }

  // Remove channel prompt
  if (data === 'adm:fj_remove') {
    const config = loadBotConfig();
    if (config.channels.length === 0) {
      await client.answerCallbackQuery(query.id, { text: 'کانالی برای حذف وجود ندارد!', show_alert: true });
      return true;
    }

    const keyboard: any[] = config.channels.map(ch => [
      { text: `🗑 حذف ${ch.title || ch.username || ch.id}`, callback_data: `adm:fj_del:${encodeURIComponent(ch.id)}` }
    ]);
    keyboard.push([{ text: '🔙 بازگشت', callback_data: 'adm:forcejoin' }]);

    await client.editMessageText(chatId, messageId, '👇 <b>روی کانالی که قصد حذف آن را دارید کلیک کنید:</b>', {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
    return true;
  }

  // Delete specific channel
  if (data.startsWith('adm:fj_del:')) {
    const targetId = decodeURIComponent(data.replace('adm:fj_del:', ''));
    const config = loadBotConfig();
    const filtered = config.channels.filter(c => c.id !== targetId);
    saveBotConfig({ channels: filtered });
    addLog('حذف کانال اجباری', `کانال ${targetId} از لیست حذف شد.`);
    await client.answerCallbackQuery(query.id, { text: '✅ کانال با موفقیت حذف شد.', show_alert: false });
    query.data = 'adm:forcejoin';
    return handleAdminCallbackQuery(client, query);
  }

  // Test channels access
  if (data === 'adm:fj_test') {
    const config = loadBotConfig();
    if (config.channels.length === 0) {
      await client.answerCallbackQuery(query.id, { text: 'کانالی برای تست وجود ندارد!', show_alert: true });
      return true;
    }

    let report = '🔍 <b>نتیجه بررسی دسترسی ربات در کانال‌ها:</b>\n━━━━━━━━━━━━━━━━━━━━\n';
    for (const ch of config.channels) {
      const res = await testChannelAccess(ch.id);
      if (res.success) {
        report += `✅ <b>${escapeHtml(ch.title || ch.username)}:</b> دسترسی ادمین تایید شد.\n`;
      } else {
        report += `❌ <b>${escapeHtml(ch.title || ch.username)}:</b> دسترسی ناموفق (${escapeHtml(res.message)})\n`;
      }
    }

    const keyboard = [
      [{ text: '🔙 بازگشت به قفل کانال‌ها', callback_data: 'adm:forcejoin' }]
    ];
    await client.editMessageText(chatId, messageId, report, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
    return true;
  }

  // 3. BROADCAST SUBMENU
  if (data === 'adm:broadcast') {
    const usersCount = getRegisteredUsersCount();
    const text =
`📢 <b>ارسال همگانی پیام (Broadcast):</b>
━━━━━━━━━━━━━━━━━━━━
👥 تعداد کل کاربران ثبت‌شده در دیتابیس ربات: <b>${usersCount.toLocaleString('fa-IR')}</b> نفر

👇 <b>نوع ارسال همگانی را انتخاب کنید:</b>

1️⃣ <b>ارسال پیام به همه (Copy):</b> متن، عکس، یا ویدیوی شما به صورت پیام مستقل از سمت ربات برای همه ارسال می‌شود.
2️⃣ <b>فوروارد همگانی (Forward):</b> پیام شما با منبع و تگ فوروارد برای تمام کاربران ارسال می‌شود.`;

    const keyboard = [
      [
        { text: '✉️ ارسال پیام به همه (Copy)', callback_data: 'adm:bc_copy' },
        { text: '🔄 فوروارد همگانی (Forward)', callback_data: 'adm:bc_fwd' }
      ],
      [
        { text: '🔙 بازگشت به پنل اصلی', callback_data: 'adm:menu' }
      ]
    ];

    await client.editMessageText(chatId, messageId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
    return true;
  }

  // Broadcast copy prompt
  if (data === 'adm:bc_copy') {
    adminSteps.set(chatId, { step: 'awaiting_broadcast_copy' });
    const text =
`✉️ <b>آماده ارسال پیام به همه کاربران:</b>
━━━━━━━━━━━━━━━━━━━━
لطفاً پیامی که می‌خواهید برای تمام کاربران ارسال شود را در پیام بعدی بفرستید.
(پشتیبانی از متن، عکس، ویدیو، وویس، موزیک با کپشن).

جهت انصراف، کلمه <b>انصراف</b> یا /cancel را ارسال کنید.`;

    const keyboard = [[{ text: '❌ انصراف و بازگشت', callback_data: 'adm:broadcast' }]];
    await client.editMessageText(chatId, messageId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
    return true;
  }

  // Broadcast forward prompt
  if (data === 'adm:bc_fwd') {
    adminSteps.set(chatId, { step: 'awaiting_broadcast_fwd' });
    const text =
`🔄 <b>آماده فوروارد همگانی برای تمام کاربران:</b>
━━━━━━━━━━━━━━━━━━━━
لطفاً پیامی که می‌خواهید فوروارد شود را به همین صفحه فوروارد (Forward) کنید.

جهت انصراف، کلمه <b>انصراف</b> یا /cancel را ارسال کنید.`;

    const keyboard = [[{ text: '❌ انصراف و بازگشت', callback_data: 'adm:broadcast' }]];
    await client.editMessageText(chatId, messageId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
    return true;
  }

  // 4. INSTAGRAM SESSION SUBMENU
  if (data === 'adm:instagram') {
    const hasCookies = hasInstagramCookies();
    const text =
`📷 <b>مدیریت سشن اینستاگرام:</b>
━━━━━━━━━━━━━━━━━━━━
وضعیت فعلی: ${hasCookies ? '🟢 <b>سشن و کوکی فعال است</b> (دانلود پست‌های سن‌دار و محدود مجاز است)' : '⚪ <b>بدون سشن اختصاصی</b> (دانلود تمام ریلزها و پست‌های عمومی فعال است)'}

💡 <b>چرا سشن اینستاگرام؟</b>
پست‌های عمومی بدون نیاز به سشن دانلود می‌شوند. اگر پستی دارای محدودیت سنی یا منطقه‌ای باشد، با وارد کردن مقدار <code>sessionid</code> می‌توانید محدودیت را دور بزنید.`;

    const keyboard = [
      [{ text: '🔑 تنظیم سشن جدید', callback_data: 'adm:ig_set' }],
      ...(hasCookies ? [[{ text: '🗑 پاکسازی سشن ذخیره‌شده', callback_data: 'adm:ig_clear' }]] : []),
      [{ text: '🔙 بازگشت به پنل اصلی', callback_data: 'adm:menu' }]
    ];

    await client.editMessageText(chatId, messageId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
    return true;
  }

  // Set Instagram Session prompt
  if (data === 'adm:ig_set') {
    adminSteps.set(chatId, { step: 'awaiting_ig_session' });
    const text =
`🔑 <b>تنظیم سشن کوکی اینستاگرام:</b>
━━━━━━━━━━━━━━━━━━━━
لطفاً مقدار کوکی <code>sessionid</code> اکانت اینستاگرام خود یا متن کوکی با فرمت Netscape را ارسال فرمایید.

جهت انصراف، کلمه <b>انصراف</b> یا /cancel را ارسال کنید.`;

    const keyboard = [[{ text: '❌ انصراف', callback_data: 'adm:instagram' }]];
    await client.editMessageText(chatId, messageId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
    return true;
  }

  // Clear Instagram session
  if (data === 'adm:ig_clear') {
    clearInstagramCookies();
    addLog('پاکسازی سشن', 'کوکی اینستاگرام توسط ادمین پاک شد.');
    await client.answerCallbackQuery(query.id, { text: '✅ سشن اینستاگرام پاک شد.', show_alert: true });
    query.data = 'adm:instagram';
    return handleAdminCallbackQuery(client, query);
  }

  // 5. WEBHOOK SUBMENU
  if (data === 'adm:webhook') {
    const state = getBotState();
    const whInfo = await getBotWebhookInfo().catch(() => null);
    const activeUrl = whInfo?.url || state.webhookUrl;

    const text =
`🌐 <b>مدیریت وب‌هوک و اتصال ۲۴ ساعته:</b>
━━━━━━━━━━━━━━━━━━━━
• <b>حالت فعلی:</b> ${activeUrl ? '🌐 وب‌هوک فعال' : '⚡ Long Polling زنده (اتصال دائم)'}
• <b>آدرس وب‌هوک:</b> ${activeUrl ? `<code>${escapeHtml(activeUrl)}</code>` : 'ثبت نشده (حالت Polling)'}
• <b>پیام‌های معلق در تلگرام (Pending Updates):</b> ${whInfo?.pending_update_count || 0}
• <b>آخرین خطای وب‌هوک تلگرام:</b> ${whInfo?.last_error_message ? `<code>${escapeHtml(whInfo.last_error_message)}</code>` : 'هیچ خطایی گزارش نشده ✅'}

💡 <i>نکته: روی سرورهای VPS/Docker حالت Long Polling پایدارترین حالت است و نیازی به وب‌هوک ندارد.</i>`;

    const keyboard = [
      [{ text: '🔗 ثبت یا تغییر آدرس وب‌هوک', callback_data: 'adm:wh_set' }],
      ...(activeUrl ? [[{ text: '🗑 حذف وب‌هوک و سوئیچ به Polling', callback_data: 'adm:wh_del' }]] : []),
      [{ text: '🏓 تست سلامت اتصال (Ping)', callback_data: 'adm:wh_ping' }],
      [{ text: '🔙 بازگشت به پنل اصلی', callback_data: 'adm:menu' }]
    ];

    await client.editMessageText(chatId, messageId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
    return true;
  }

  // Prompt set webhook URL
  if (data === 'adm:wh_set') {
    adminSteps.set(chatId, { step: 'awaiting_webhook_url' });
    const text =
`🔗 <b>ثبت آدرس وب‌هوک جدید:</b>
━━━━━━━━━━━━━━━━━━━━
لطفاً آدرس کامل و امن HTTPS وب‌هوک سرور خود را ارسال فرمایید (مثلاً:
<code>https://your-domain.com/api/telegram/webhook</code>)

جهت انصراف، کلمه <b>انصراف</b> یا /cancel را ارسال کنید.`;

    const keyboard = [[{ text: '❌ انصراف', callback_data: 'adm:webhook' }]];
    await client.editMessageText(chatId, messageId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
    return true;
  }

  // Delete webhook
  if (data === 'adm:wh_del') {
    const res = await removeBotWebhook();
    addLog('حذف وب‌هوک', res.message);
    await client.answerCallbackQuery(query.id, { text: res.message, show_alert: true });
    query.data = 'adm:webhook';
    return handleAdminCallbackQuery(client, query);
  }

  // Ping test
  if (data === 'adm:wh_ping') {
    const start = Date.now();
    try {
      await client.getMe();
      const latency = Date.now() - start;
      await client.answerCallbackQuery(query.id, {
        text: `🏓 پینگ اتصال به سرورهای تلگرام: ${latency} میلی‌ثانیه (عالی ✅)`,
        show_alert: true,
      });
    } catch (e: any) {
      await client.answerCallbackQuery(query.id, {
        text: `❌ خطا در پینگ: ${e?.message || 'ناموفق'}`,
        show_alert: true,
      });
    }
    return true;
  }

  // 6. LIVE LOGS SUBMENU
  if (data === 'adm:logs') {
    const state = getBotState();
    const logs = state.logs.slice(0, 8);

    let logsText = '';
    if (logs.length === 0) {
      logsText = '<i>هنوز هیچ لاگی ثبت نشده است.</i>';
    } else {
      logsText = logs.map(l => {
        const icon = l.status === 'success' ? '✅' : l.status === 'error' ? '❌' : '⏳';
        return `${icon} <b>[${l.timestamp}] ${escapeHtml(l.action)}</b>\n   جزئیات: ${escapeHtml(l.details)}${l.userName ? ` (${escapeHtml(l.userName)})` : ''}`;
      }).join('\n\n');
    }

    const text =
`📜 <b>آخرین رویدادها و لاگ‌های زنده ربات:</b>
━━━━━━━━━━━━━━━━━━━━
${logsText}`;

    const keyboard = [
      [{ text: '🔄 بروزرسانی لاگ‌ها', callback_data: 'adm:logs' }],
      [{ text: '🔙 بازگشت به پنل اصلی', callback_data: 'adm:menu' }]
    ];

    await client.editMessageText(chatId, messageId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
    return true;
  }

  // 7. DIRECT MESSAGE TO USER SUBMENU
  if (data === 'adm:dm') {
    adminSteps.set(chatId, { step: 'awaiting_dm_user_id' });
    const text =
`✉️ <b>ارسال پیام خصوصی به یک کاربر مشخص:</b>
━━━━━━━━━━━━━━━━━━━━
لطفاً <b>شناسه عددی کاربر (User ID)</b> مورد نظر را ارسال فرمایید (مثلاً: <code>123456789</code>).

جهت انصراف، کلمه <b>انصراف</b> یا /cancel را ارسال کنید.`;

    const keyboard = [[{ text: '❌ انصراف', callback_data: 'adm:menu' }]];
    await client.editMessageText(chatId, messageId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
    return true;
  }

  // 8. SETTINGS & ADMINS SUBMENU
  if (data === 'adm:settings') {
    const config = loadBotConfig();
    const text =
`⚙️ <b>تنظیمات پیشرفته و مدیریت ادمین‌ها:</b>
━━━━━━━━━━━━━━━━━━━━
👑 <b>مالک و سوپر ادمین اصلی:</b> <code>${SUPER_ADMIN_ID}</code> (همیشه ثابت)
👥 <b>لیست ادمین‌های مجاز:</b> ${config.adminIds.map(id => `<code>${id}</code>`).join(', ')}

📢 <b>کانال اصلی ربات:</b> ${config.mainChannelUrl || 'ثبت نشده'}
🎫 <b>آیدی پشتیبانی:</b> @${config.supportUsername || 'admin'}`;

    const keyboard = [
      [
        { text: '➕ افزودن ادمین کمکی', callback_data: 'adm:admin_add' },
        { text: '➖ حذف ادمین کمکی', callback_data: 'adm:admin_remove' }
      ],
      [
        { text: '📢 ویرایش لینک کانال اصلی', callback_data: 'adm:set_main_ch' },
        { text: '🎫 ویرایش آیدی پشتیبانی', callback_data: 'adm:set_support' }
      ],
      [
        { text: '🔙 بازگشت به پنل اصلی', callback_data: 'adm:menu' }
      ]
    ];

    await client.editMessageText(chatId, messageId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
    return true;
  }

  // Add admin prompt
  if (data === 'adm:admin_add') {
    adminSteps.set(chatId, { step: 'awaiting_new_admin_id' });
    const text =
`➕ <b>افزودن ادمین کمکی جدید:</b>
━━━━━━━━━━━━━━━━━━━━
لطفاً <b>شناسه عددی (Numeric User ID)</b> فرد مورد نظر را ارسال فرمایید.

جهت انصراف، کلمه <b>انصراف</b> یا /cancel را ارسال کنید.`;

    const keyboard = [[{ text: '❌ انصراف', callback_data: 'adm:settings' }]];
    await client.editMessageText(chatId, messageId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
    return true;
  }

  // Remove admin list
  if (data === 'adm:admin_remove') {
    const config = loadBotConfig();
    const secondaryAdmins = config.adminIds.filter(id => id !== SUPER_ADMIN_ID);
    if (secondaryAdmins.length === 0) {
      await client.answerCallbackQuery(query.id, { text: 'ادمین کمکی برای حذف وجود ندارد.', show_alert: true });
      return true;
    }

    const keyboard = secondaryAdmins.map(id => [
      { text: `🗑 حذف ادمین ${id}`, callback_data: `adm:del_admin:${id}` }
    ]);
    keyboard.push([{ text: '🔙 بازگشت', callback_data: 'adm:settings' }]);

    await client.editMessageText(chatId, messageId, '👇 <b>روی ادمینی که قصد حذف دسترسی او را دارید کلیک کنید:</b>', {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
    return true;
  }

  // Delete admin action
  if (data.startsWith('adm:del_admin:')) {
    const targetId = Number(data.replace('adm:del_admin:', ''));
    removeAdminId(targetId);
    await client.answerCallbackQuery(query.id, { text: `✅ ادمین ${targetId} حذف شد.`, show_alert: false });
    query.data = 'adm:settings';
    return handleAdminCallbackQuery(client, query);
  }

  // Set main channel prompt
  if (data === 'adm:set_main_ch') {
    adminSteps.set(chatId, { step: 'awaiting_main_channel_url' });
    const text =
`📢 <b>تنظیم لینک چنل اصلی:</b>
━━━━━━━━━━━━━━━━━━━━
لطفاً لینک کانال خود را ارسال فرمایید (مانند <code>https://t.me/mychannel</code>):

جهت انصراف، کلمه <b>انصراف</b> یا /cancel را ارسال کنید.`;

    const keyboard = [[{ text: '❌ انصراف', callback_data: 'adm:settings' }]];
    await client.editMessageText(chatId, messageId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
    return true;
  }

  // Set support username prompt
  if (data === 'adm:set_support') {
    adminSteps.set(chatId, { step: 'awaiting_support_username' });
    const text =
`🎫 <b>تنظیم آیدی پشتیبانی:</b>
━━━━━━━━━━━━━━━━━━━━
لطفاً یوزرنیم پشتیبانی را ارسال فرمایید (مانند <code>support_admin</code> بدون @):

جهت انصراف، کلمه <b>انصراف</b> یا /cancel را ارسال کنید.`;

    const keyboard = [[{ text: '❌ انصراف', callback_data: 'adm:settings' }]];
    await client.editMessageText(chatId, messageId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
    return true;
  }

  return false;
}

/**
 * Handle incoming message when an admin is in a multi-step conversation
 */
export async function handleAdminMessageStep(
  client: TelegramClient,
  msg: any
): Promise<boolean> {
  const chatId = msg.chat?.id;
  const userId = msg.from?.id || chatId;
  const text = (msg.text || '').trim();

  if (!isUserAdmin(userId)) return false;

  const current = adminSteps.get(chatId);
  if (!current) return false;

  // Global cancel
  if (text === 'انصراف' || text === '/cancel' || text === '❌ انصراف') {
    adminSteps.delete(chatId);
    await client.sendMessage(chatId, '✅ <b>عملیات لغو شد.</b>', { parse_mode: 'HTML' });
    await sendAdminDashboard(client, chatId);
    return true;
  }

  // 1. Awaiting Channel ID / Username
  if (current.step === 'awaiting_channel_id') {
    adminSteps.delete(chatId);
    const progress = await client.sendMessage(chatId, '⏳ <i>در حال بررسی و اعتبارسنجی کانال...</i>', { parse_mode: 'HTML' });
    
    let cleanCh = text.trim();
    if (!cleanCh.startsWith('@') && !cleanCh.startsWith('-100') && !cleanCh.includes('/')) {
      cleanCh = `@${cleanCh}`;
    }
    if (cleanCh.includes('t.me/')) {
      const match = cleanCh.match(/t\.me\/([A-Za-z0-9_+]+)/);
      if (match) cleanCh = `@${match[1]}`;
    }

    const access = await testChannelAccess(cleanCh);
    if (!access.success) {
      await client.editMessageText(chatId, progress.message_id, 
        `❌ <b>خطا در افزودن کانال:</b>\n${escapeHtml(access.message)}\n\n⚠️ لطفاً مطمئن شوید ربات در این کانال عضو بوده و به عنوان <b>ادمین (Administrator)</b> ثبت شده است.`,
        { parse_mode: 'HTML' }
      );
      return true;
    }

    const config = loadBotConfig();
    const channelTitle = access.chatTitle || cleanCh;
    const channelUrl = cleanCh.startsWith('@') ? `https://t.me/${cleanCh.replace('@', '')}` : config.mainChannelUrl;

    const newChannel: RequiredChannel = {
      id: cleanCh,
      title: channelTitle,
      username: cleanCh.startsWith('@') ? cleanCh.replace('@', '') : '',
      url: channelUrl,
    };

    const exists = config.channels.some(c => c.id === cleanCh);
    if (!exists) {
      config.channels.push(newChannel);
      saveBotConfig({ channels: config.channels });
      addLog('افزودن کانال', `کانال ${cleanCh} با موفقیت به قفل اجباری اضافه شد.`);
    }

    await client.editMessageText(chatId, progress.message_id,
      `✅ <b>کانال «${escapeHtml(channelTitle)}» با موفقیت افزوده شد!</b>\n\nهم‌اکنون در بخش قفل کانال‌ها ثبت شده و کاربران ملزم به عضویت در آن هستند.`,
      { parse_mode: 'HTML' }
    );
    await sendAdminDashboard(client, chatId);
    return true;
  }

  // 2. Awaiting Broadcast Message (Copy)
  if (current.step === 'awaiting_broadcast_copy') {
    adminSteps.delete(chatId);
    const users = getRegisteredUsers();
    if (users.length === 0) {
      await client.sendMessage(chatId, '❌ هنوز کاربری در دیتابیس ثبت نشده است.', { parse_mode: 'HTML' });
      return true;
    }

    const statusMsg = await client.sendMessage(chatId, `🚀 <b>در حال ارسال همگانی به ${users.length} کاربر...</b>\nلطفاً کمی صبور باشید.`, { parse_mode: 'HTML' });
    let successCount = 0;
    let failCount = 0;

    for (const uId of users) {
      try {
        await client.copyMessage(uId, chatId, msg.message_id);
        successCount++;
      } catch (err) {
        failCount++;
      }
      // Small throttle to avoid hitting Telegram broadcast limits
      await new Promise(r => setTimeout(r, 40));
    }

    addLog('ارسال همگانی', `ارسال به ${successCount} کاربر موفق و ${failCount} ناموفق بود.`);
    await client.editMessageText(chatId, statusMsg.message_id,
`✅ <b>ارسال همگانی با موفقیت پایان یافت!</b>
━━━━━━━━━━━━━━━━━━━━
• 👥 کل اعضا: <b>${users.length.toLocaleString('fa-IR')}</b>
• 🟢 ارسال موفق: <b>${successCount.toLocaleString('fa-IR')}</b>
• 🔴 ناموفق یا مسدودشده: <b>${failCount.toLocaleString('fa-IR')}</b>`,
      { parse_mode: 'HTML' }
    );
    await sendAdminDashboard(client, chatId);
    return true;
  }

  // 3. Awaiting Broadcast Forward
  if (current.step === 'awaiting_broadcast_fwd') {
    adminSteps.delete(chatId);
    const users = getRegisteredUsers();
    if (users.length === 0) {
      await client.sendMessage(chatId, '❌ هنوز کاربری در دیتابیس ثبت نشده است.', { parse_mode: 'HTML' });
      return true;
    }

    const statusMsg = await client.sendMessage(chatId, `🚀 <b>در حال فوروارد همگانی به ${users.length} کاربر...</b>\nلطفاً کمی صبور باشید.`, { parse_mode: 'HTML' });
    let successCount = 0;
    let failCount = 0;

    for (const uId of users) {
      try {
        await client.forwardMessage(uId, chatId, msg.message_id);
        successCount++;
      } catch (err) {
        failCount++;
      }
      await new Promise(r => setTimeout(r, 40));
    }

    addLog('فوروارد همگانی', `فوروارد به ${successCount} کاربر موفق و ${failCount} ناموفق بود.`);
    await client.editMessageText(chatId, statusMsg.message_id,
`✅ <b>فوروارد همگانی با موفقیت پایان یافت!</b>
━━━━━━━━━━━━━━━━━━━━
• 👥 کل اعضا: <b>${users.length.toLocaleString('fa-IR')}</b>
• 🟢 فوروارد موفق: <b>${successCount.toLocaleString('fa-IR')}</b>
• 🔴 ناموفق یا مسدودشده: <b>${failCount.toLocaleString('fa-IR')}</b>`,
      { parse_mode: 'HTML' }
    );
    await sendAdminDashboard(client, chatId);
    return true;
  }

  // 4. Awaiting Instagram Session
  if (current.step === 'awaiting_ig_session') {
    adminSteps.delete(chatId);
    const saveRes = saveInstagramSession(text);
    if (saveRes.success) {
      addLog('تنظیم سشن اینستاگرام', 'سشن جدید توسط ادمین ثبت شد.');
      await client.sendMessage(chatId, '✅ <b>سشن اینستاگرام با موفقیت ثبت و ذخیره شد!</b>', { parse_mode: 'HTML' });
    } else {
      await client.sendMessage(chatId, `❌ <b>خطا در ذخیره سشن:</b> ${escapeHtml(saveRes.message)}`, { parse_mode: 'HTML' });
    }
    await sendAdminDashboard(client, chatId);
    return true;
  }

  // 5. Awaiting Webhook URL
  if (current.step === 'awaiting_webhook_url') {
    adminSteps.delete(chatId);
    if (!text.startsWith('https://')) {
      await client.sendMessage(chatId, '❌ آدرس وب‌هوک باید با <code>https://</code> آغاز شود.', { parse_mode: 'HTML' });
      return true;
    }
    const res = await setBotWebhook(text);
    addLog('تنظیم وب‌هوک', res.message);
    await client.sendMessage(chatId, `${res.success ? '✅' : '❌'} ${escapeHtml(res.message)}`, { parse_mode: 'HTML' });
    await sendAdminDashboard(client, chatId);
    return true;
  }

  // 6. Awaiting Direct Message User ID
  if (current.step === 'awaiting_dm_user_id') {
    const targetUserId = parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (!targetUserId || isNaN(targetUserId)) {
      await client.sendMessage(chatId, '❌ شناسه عددی کاربر نامعتبر است. لطفاً فقط ارقام عددی ارسال فرمایید:', { parse_mode: 'HTML' });
      return true;
    }
    adminSteps.set(chatId, { step: 'awaiting_dm_text', data: { targetUserId } });
    await client.sendMessage(chatId, `✍️ <b>کاربر مقصد:</b> <code>${targetUserId}</code>\n\nلطفاً متنی که می‌خواهید برای این کاربر ارسال شود را بفرستید:`, { parse_mode: 'HTML' });
    return true;
  }

  // 7. Awaiting Direct Message Text
  if (current.step === 'awaiting_dm_text') {
    const targetUserId = current.data?.targetUserId;
    adminSteps.delete(chatId);
    try {
      await client.sendMessage(targetUserId, `📩 <b>پیام از طرف مدیریت ربات:</b>\n━━━━━━━━━━━━━━━━━━━━\n${escapeHtml(text)}`, { parse_mode: 'HTML' });
      addLog('ارسال پیام به کاربر', `پیام به کاربر ${targetUserId} ارسال شد.`);
      await client.sendMessage(chatId, `✅ <b>پیام با موفقیت به کاربر <code>${targetUserId}</code> تحویل داده شد.</b>`, { parse_mode: 'HTML' });
    } catch (e: any) {
      await client.sendMessage(chatId, `❌ خطا در ارسال پیام به کاربر: ${escapeHtml(e?.message || 'کاربر ربات را بلاک کرده است.')}`, { parse_mode: 'HTML' });
    }
    await sendAdminDashboard(client, chatId);
    return true;
  }

  // 8. Awaiting New Admin ID
  if (current.step === 'awaiting_new_admin_id') {
    adminSteps.delete(chatId);
    const newAdminId = parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (!newAdminId || isNaN(newAdminId)) {
      await client.sendMessage(chatId, '❌ شناسه عددی ادمین نامعتبر است.', { parse_mode: 'HTML' });
      return true;
    }
    addAdminId(newAdminId);
    addLog('افزودن ادمین', `شناسه ${newAdminId} به عنوان ادمین اضافه شد.`);
    await client.sendMessage(chatId, `✅ <b>کاربر با شناسه <code>${newAdminId}</code> به عنوان ادمین مجاز تایید شد.</b>`, { parse_mode: 'HTML' });
    await sendAdminDashboard(client, chatId);
    return true;
  }

  // 9. Awaiting Support Username
  if (current.step === 'awaiting_support_username') {
    adminSteps.delete(chatId);
    const cleanUser = text.replace('@', '').trim();
    saveBotConfig({ supportUsername: cleanUser });
    addLog('تغییر پشتیبانی', `آیدی پشتیبانی به @${cleanUser} تغییر یافت.`);
    await client.sendMessage(chatId, `✅ <b>آیدی پشتیبانی با موفقیت به @${escapeHtml(cleanUser)} تغییر یافت.</b>`, { parse_mode: 'HTML' });
    await sendAdminDashboard(client, chatId);
    return true;
  }

  // 10. Awaiting Main Channel URL
  if (current.step === 'awaiting_main_channel_url') {
    adminSteps.delete(chatId);
    saveBotConfig({ mainChannelUrl: text.trim() });
    addLog('تغییر چنل اصلی', `لینک کانال اصلی به ${text} تغییر یافت.`);
    await client.sendMessage(chatId, `✅ <b>لینک چنل اصلی با موفقیت ذخیره شد.</b>`, { parse_mode: 'HTML' });
    await sendAdminDashboard(client, chatId);
    return true;
  }

  return false;
}
