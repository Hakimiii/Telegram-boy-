import { handleWebhookUpdate } from '../../src/services/telegramBot.ts';

export default async function handler(req: any, res: any) {
  if (req.method === 'POST') {
    // Acknowledge immediately to Telegram within milliseconds
    res.status(200).send('OK');

    try {
      if (req.body) {
        await handleWebhookUpdate(req.body);
      }
    } catch (err) {
      console.error('Vercel Webhook processing error:', err);
    }
  } else {
    res.status(200).json({
      status: 'active',
      message: 'Telegram Webhook is ready and listening on Vercel.',
      endpoint: '/api/telegram/webhook',
    });
  }
}
