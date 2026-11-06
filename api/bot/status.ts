import { getBotState } from '../../src/services/telegramBot.ts';
import { hasInstagramCookies } from '../../src/services/mediaDownloader.ts';

export default function handler(req: any, res: any) {
  const state = getBotState();
  res.status(200).json({
    ...state,
    hasInstagramCookies: hasInstagramCookies(),
    platform: 'Vercel Serverless',
  });
}
