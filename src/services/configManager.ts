import fs from 'node:fs';
import path from 'node:path';

export interface RequiredChannel {
  id: string; // e.g. '@mychannel' or '-1001234567890'
  title: string; // e.g. 'چنل اصلی'
  username: string; // e.g. 'mychannel'
  url: string; // e.g. 'https://t.me/mychannel'
}

export interface BotAdminConfig {
  forceJoinEnabled: boolean;
  channels: RequiredChannel[];
  mainChannelUrl: string;
  supportUsername: string;
}

const PRIMARY_CONFIG_PATH = path.resolve(process.cwd(), 'bot_config.json');
const BACKUP_CONFIG_PATH = path.resolve('/tmp/bot_config.json');

const defaultConfig: BotAdminConfig = {
  forceJoinEnabled: false,
  channels: [],
  mainChannelUrl: 'https://t.me/Downloder_socialbot',
  supportUsername: 'admin',
};

export function loadBotConfig(): BotAdminConfig {
  try {
    if (fs.existsSync(PRIMARY_CONFIG_PATH)) {
      const data = fs.readFileSync(PRIMARY_CONFIG_PATH, 'utf-8');
      return { ...defaultConfig, ...JSON.parse(data) };
    }
    if (fs.existsSync(BACKUP_CONFIG_PATH)) {
      const data = fs.readFileSync(BACKUP_CONFIG_PATH, 'utf-8');
      return { ...defaultConfig, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Error loading bot config:', err);
  }
  return { ...defaultConfig };
}

export function saveBotConfig(config: Partial<BotAdminConfig>): BotAdminConfig {
  try {
    const current = loadBotConfig();
    const updated = { ...current, ...config };
    const jsonStr = JSON.stringify(updated, null, 2);
    
    fs.writeFileSync(PRIMARY_CONFIG_PATH, jsonStr, 'utf-8');
    try {
      fs.writeFileSync(BACKUP_CONFIG_PATH, jsonStr, 'utf-8');
    } catch {}

    return updated;
  } catch (err) {
    console.error('Error saving bot config:', err);
    return loadBotConfig();
  }
}
