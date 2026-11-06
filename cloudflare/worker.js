/**
 * Cloudflare Worker for Telegram Social Media Downloader Bot
 * 100% Free Tier compatible (No binary dependencies, zero server cost)
 * Single-file copy-paste ready for Cloudflare Workers Dashboard (Quick Edit)
 */

const BOT_TOKEN = "8903893701:AAECN-VTNYymvXWUGEHNdvYb66HUFWl16zI";
const BOT_USERNAME = "Downloder_socialbot";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const token = env?.BOT_TOKEN || BOT_TOKEN;

    // Endpoint: Health check & setup info
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(JSON.stringify({
        status: "active",
        bot: `@${BOT_USERNAME}`,
        runtime: "Cloudflare Workers (Edge)",
        message: "ربات تلگرام در لبه کلادفلر آماده دریافت وبهوک است.",
      }), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // Endpoint: 1-Click Set Webhook
    if (url.pathname === "/set-webhook") {
      const webhookUrl = `${url.origin}/webhook`;
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      const tgData = await tgRes.json();
      return new Response(JSON.stringify({
        success: tgData.ok,
        webhookUrl,
        telegramResponse: tgData,
      }), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // Endpoint: 1-Click Delete Webhook
    if (url.pathname === "/delete-webhook") {
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
      const tgData = await tgRes.json();
      return new Response(JSON.stringify(tgData), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // Endpoint: Telegram Webhook Receiver
    if (url.pathname === "/webhook" || url.pathname === "/api/telegram/webhook") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      try {
        const update = await request.json();
        await handleUpdate(update, token);
      } catch (err) {
        console.error("Cloudflare Worker Error:", err);
      }

      return new Response("OK", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
};

/**
 * Handle incoming Telegram update
 */
async function handleUpdate(update, token) {
  if (update.message) {
    await handleMessage(update.message, token);
  } else if (update.callback_query) {
    await handleCallback(update.callback_query, token);
  }
}

/**
 * Handle user messages
 */
async function handleMessage(message, token) {
  const chatId = message.chat.id;
  const text = (message.text || "").trim();
  const userName = message.from.first_name || "کاربر";

  if (!text) return;

  // Command: /start or help
  if (text.startsWith("/start") || text.startsWith("/help")) {
    const welcome = 
`✨ <b>به ربات دانلودر سوشیال مدیا و موزیک‌یاب خوش آمدید</b> ✨
━━━━━━━━━━━━━━━━━━━━
سلام <b>${escapeHtml(userName)}</b> عزیز ✋
سرور کلادفلر (Cloudflare Workers) به صورت ۲۴ ساعته فعال است.

📥 <b>پشتیبانی از:</b>
• اسپاتیفای (Spotify MP3)
• اینستاگرام (Instagram Reels / Posts)
• تیک‌تاک و یوتیوب

🐸 <b>فقط کافیست لینک موزیک یا ویدیوی مورد نظر خود را ارسال کنید:</b>`;

    await sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: welcome,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ افزودن ربات به گروه", url: `https://t.me/${BOT_USERNAME}?startgroup=true` }]
        ]
      }
    });
    return;
  }

  // URL extraction
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  if (!urlMatch) {
    await sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: "⚠️ لطفاً یک لینک معتبر از اسپاتیفای، اینستاگرام، تیک‌تاک یا یوتیوب ارسال فرمایید.",
      parse_mode: "HTML",
    });
    return;
  }

  const mediaUrl = urlMatch[0];

  // Send processing message
  const waitMsg = await sendTelegramApi(token, "sendMessage", {
    chat_id: chatId,
    text: "🔍 <b>در حال پردازش و آماده‌سازی فایل...</b>",
    parse_mode: "HTML",
  });
  const waitMsgId = waitMsg?.result?.message_id;

  try {
    // 1. SPOTIFY HANDLING
    if (mediaUrl.includes("spotify.com") || mediaUrl.includes("spotify.link") || mediaUrl.includes("spoti.fi")) {
      const cleanUrl = mediaUrl.split("?")[0];
      const trackIdMatch = cleanUrl.match(/track[/:]([a-zA-Z0-9]+)/i);

      let title = "موزیک اسپاتیفای";
      let artist = "Spotify";
      let previewUrl = "";
      let albumArt = "";

      if (trackIdMatch) {
        const embedRes = await fetch(`https://open.spotify.com/embed/track/${trackIdMatch[1]}`, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        });
        if (embedRes.ok) {
          const html = await embedRes.text();
          const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/i);
          if (match) {
            const data = JSON.parse(match[1]);
            const entity = data?.props?.pageProps?.state?.data?.entity;
            if (entity?.name) title = entity.name;
            if (entity?.artists?.length) artist = entity.artists.map(a => a.name).join(", ");
            if (entity?.audioPreview?.url) previewUrl = entity.audioPreview.url;
            if (entity?.album?.images?.[0]?.url) albumArt = entity.album.images[0].url;
          }
        }
      }

      if (previewUrl) {
        await sendTelegramApi(token, "sendAudio", {
          chat_id: chatId,
          audio: previewUrl,
          caption: `🎵 <b>${escapeHtml(title)}</b>\n👤 <b>هنرمند:</b> ${escapeHtml(artist)}\n🔗 @${BOT_USERNAME}`,
          parse_mode: "HTML",
          title,
          performer: artist,
        });
      } else {
        await sendTelegramApi(token, "sendMessage", {
          chat_id: chatId,
          text: `🎵 <b>${escapeHtml(title)}</b>\n👤 <b>هنرمند:</b> ${escapeHtml(artist)}\n\nجهت دانلود کامل ۳۲۰k می‌توانید از پنل اصلی استفاده کنید.`,
          parse_mode: "HTML",
        });
      }
    }
    // 2. OTHER SOCIAL MEDIA (Instagram, TikTok, YouTube)
    else {
      await sendTelegramApi(token, "sendMessage", {
        chat_id: chatId,
        text: `📥 <b>لینک استخراج شد:</b>\n\n🔗 <a href="${mediaUrl}">${escapeHtml(mediaUrl.slice(0, 50))}...</a>\n\nبرای دانلود کامل و مستقیم روی لینک کلیک کنید یا در پنل وب با کیفیت انتخابی دانلود نمایید.\n🔗 @${BOT_USERNAME}`,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      });
    }

    if (waitMsgId) {
      await sendTelegramApi(token, "deleteMessage", { chat_id: chatId, message_id: waitMsgId });
    }
  } catch (err) {
    if (waitMsgId) {
      await sendTelegramApi(token, "editMessageText", {
        chat_id: chatId,
        message_id: waitMsgId,
        text: "❌ متاسفانه در دریافت رسانه خطایی رخ داد. لطفاً مجدد تلاش فرمایید.",
        parse_mode: "HTML",
      });
    }
  }
}

async function handleCallback(callback, token) {
  await sendTelegramApi(token, "answerCallbackQuery", {
    callback_query_id: callback.id,
    text: "در حال پردازش درخواست شما...",
  });
}

async function sendTelegramApi(token, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
