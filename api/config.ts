import { loadBotConfig, saveBotConfig } from '../src/services/configManager.ts';

export default function handler(req: any, res: any) {
  if (req.method === 'POST') {
    try {
      const updated = saveBotConfig(req.body);
      res.status(200).json({ success: true, config: updated, message: 'تنظیمات با موفقیت ذخیره شد.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'خطا در ذخیره تنظیمات' });
    }
  } else {
    const config = loadBotConfig();
    res.status(200).json(config);
  }
}
