import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { extractMediaInfo, downloadMedia, saveInstagramSession, hasInstagramCookies, identifySongFromMedia, ensureYtDlpExecutable } from './src/services/mediaDownloader.ts';
import { startTelegramBot, getBotState, simulateBotResponse, testChannelAccess, handleWebhookUpdate, setBotWebhook, removeBotWebhook, getBotWebhookInfo } from './src/services/telegramBot.ts';
import { loadBotConfig, saveBotConfig } from './src/services/configManager.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure yt-dlp is executable on server startup
ensureYtDlpExecutable();

// Ensure Instagram session is active only if explicit environment variable is provided
if (process.env.INSTAGRAM_SESSION_ID) {
  saveInstagramSession(process.env.INSTAGRAM_SESSION_ID);
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(cors());
app.use(express.json());

// Start Telegram Bot on startup with new token
const defaultToken = process.env.TELEGRAM_BOT_TOKEN || '8903893701:AAECN-VTNYymvXWUGEHNdvYb66HUFWl16zI';
startTelegramBot(defaultToken).then(res => {
  console.log('[Telegram Bot Initialization]:', res.message);
}).catch(err => {
  console.error('[Telegram Bot Initialization Failed]:', err);
});

// API Routes

// Bot Status & telemetry
app.get('/api/bot/status', (req, res) => {
  const state = getBotState();
  res.json({
    ...state,
    hasInstagramCookies: hasInstagramCookies(),
  });
});

// Get Bot Admin & Channels Config (اد اجباری)
app.get('/api/config', (req, res) => {
  const config = loadBotConfig();
  res.json(config);
});

// Save Bot Admin & Channels Config
app.post('/api/config', (req, res) => {
  try {
    const updated = saveBotConfig(req.body);
    res.json({ success: true, config: updated, message: 'تنظیمات با موفقیت ذخیره شد.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'خطا در ذخیره تنظیمات' });
  }
});

// Test Telegram Channel Admin Access
app.post('/api/admin/channels/test', async (req, res) => {
  const { channelId } = req.body;
  if (!channelId) {
    return res.status(400).json({ success: false, message: 'شناسه کانال ارسال نشده است.' });
  }
  const result = await testChannelAccess(channelId);
  res.json(result);
});

// Save Instagram Session ID or Netscape Cookies
app.post('/api/settings/instagram', (req, res) => {
  const { sessionId } = req.body;
  const result = saveInstagramSession(sessionId || '');
  res.json(result);
});

// Restart bot or update token
app.post('/api/bot/restart', async (req, res) => {
  const { token } = req.body;
  const result = await startTelegramBot(token);
  res.json(result);
});

// Telegram Webhook endpoint (Telegram sends POST requests here)
app.post('/api/telegram/webhook', async (req, res) => {
  res.status(200).send('OK');
  try {
    if (req.body) {
      await handleWebhookUpdate(req.body);
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
  }
});

// Telegram Webhook Status & Management
app.get('/api/bot/webhook', async (req, res) => {
  try {
    const info = await getBotWebhookInfo();
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'خطا در دریافت اطلاعات وب‌هوک' });
  }
});

app.post('/api/bot/webhook/set', async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    if (!webhookUrl) {
      return res.status(400).json({ success: false, message: 'آدرس وب‌هوک ارسال نشده است.' });
    }
    const result = await setBotWebhook(webhookUrl);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'خطا در تنظیم وب‌هوک' });
  }
});

app.post('/api/bot/webhook/delete', async (req, res) => {
  try {
    const result = await removeBotWebhook();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'خطا در حذف وب‌هوک' });
  }
});

// Uptime keep-alive & health check endpoint
app.get(['/health', '/api/ping'], (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    botActive: getBotState().isActive,
  });
});

// Extract media info from URL
app.post('/api/media/info', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'آدرس URL ارسال نشده است.' });
    }
    const info = await extractMediaInfo(url);
    res.json(info);
  } catch (err: any) {
    console.error('Error fetching media info:', err);
    res.status(500).json({ error: err?.message || 'خطا در استخراج اطلاعات ویدیو' });
  }
});

// Identify song from Reel / Video
app.post('/api/media/identify-song', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'آدرس URL ارسال نشده است.' });
    }
    const mediaInfo = await extractMediaInfo(url);
    const song = await identifySongFromMedia(url, mediaInfo);
    res.json({
      success: true,
      song,
      mediaInfo,
    });
  } catch (err: any) {
    console.error('Error identifying song:', err);
    res.status(500).json({ error: err?.message || 'خطا در تشخیص موزیک' });
  }
});

// Download media
app.post('/api/media/download', async (req, res) => {
  try {
    const { url, qualityId } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'آدرس URL ارسال نشده است.' });
    }
    const download = await downloadMedia(url, qualityId || 'best_720');
    res.json({
      success: true,
      id: download.id,
      fileName: download.fileName,
      fileSize: download.fileSizeFormatted,
      fileSizeBytes: download.fileSizeBytes,
      mimeType: download.mimeType,
      downloadUrl: `/api/media/file/${download.id}`,
    });
  } catch (err: any) {
    console.error('Error downloading media:', err);
    res.status(500).json({ error: err?.message || 'خطا در دانلود فایل ویدیو' });
  }
});

// Serve downloaded file
app.get('/api/media/file/:id', (req, res) => {
  try {
    const fileId = req.params.id;
    const downloadDir = path.resolve('/tmp/downloads');
    if (!fs.existsSync(downloadDir)) {
      return res.status(404).json({ error: 'فایل یافت نشد.' });
    }

    const files = fs.readdirSync(downloadDir);
    const targetFile = files.find(f => f.startsWith(fileId));

    if (!targetFile) {
      return res.status(404).json({ error: 'فایل مورد نظر منقضی شده یا یافت نشد.' });
    }

    const fullPath = path.join(downloadDir, targetFile);
    const stat = fs.statSync(fullPath);
    const ext = path.extname(targetFile).toLowerCase();
    const isAudio = ext === '.mp3';

    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', isAudio ? 'audio/mpeg' : 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${targetFile}"`);

    const readStream = fs.createReadStream(fullPath);
    readStream.pipe(res);
  } catch (err: any) {
    console.error('File stream error:', err);
    res.status(500).json({ error: 'خطا در استریم فایل' });
  }
});

// Simulate bot message
app.post('/api/bot/simulate', async (req, res) => {
  try {
    const { message } = req.body;
    const response = await simulateBotResponse(message);
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'خطا در شبیه‌سازی' });
  }
});

// Vite or Static file serving (skipped in Vercel Serverless environment)
if (!process.env.VERCEL) {
  async function setupVite() {
    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd) {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.resolve(__dirname, 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  }

  setupVite();
}

export default app;
