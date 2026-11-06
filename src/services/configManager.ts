import fs from 'node:fs';
import path from 'node:path';

/**
 * Primary Super Admin ID specified by the owner
 */
export const SUPER_ADMIN_ID = 567645818;

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
  adminIds: number[];
}

const PRIMARY_CONFIG_PATH = path.resolve(process.cwd(), 'bot_config.json');
const BACKUP_CONFIG_PATH = path.resolve('/tmp/bot_config.json');

const PRIMARY_USERS_PATH = path.resolve(process.cwd(), 'bot_users.json');
const BACKUP_USERS_PATH = path.resolve('/tmp/bot_users.json');

const defaultConfig: BotAdminConfig = {
  forceJoinEnabled: false,
  channels: [],
  mainChannelUrl: 'https://t.me/Downloder_socialbot',
  supportUsername: 'admin',
  adminIds: [SUPER_ADMIN_ID],
};

export function loadBotConfig(): BotAdminConfig {
  try {
    if (fs.existsSync(PRIMARY_CONFIG_PATH)) {
      const data = fs.readFileSync(PRIMARY_CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      const adminIds = Array.isArray(parsed.adminIds) ? parsed.adminIds : [SUPER_ADMIN_ID];
      if (!adminIds.includes(SUPER_ADMIN_ID)) adminIds.push(SUPER_ADMIN_ID);
      return { ...defaultConfig, ...parsed, adminIds };
    }
    if (fs.existsSync(BACKUP_CONFIG_PATH)) {
      const data = fs.readFileSync(BACKUP_CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      const adminIds = Array.isArray(parsed.adminIds) ? parsed.adminIds : [SUPER_ADMIN_ID];
      if (!adminIds.includes(SUPER_ADMIN_ID)) adminIds.push(SUPER_ADMIN_ID);
      return { ...defaultConfig, ...parsed, adminIds };
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
    if (!updated.adminIds) updated.adminIds = [SUPER_ADMIN_ID];
    if (!updated.adminIds.includes(SUPER_ADMIN_ID)) updated.adminIds.push(SUPER_ADMIN_ID);
    
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

/**
 * Check if a numeric user ID is authorized as an Admin
 */
export function isUserAdmin(userId: number | string): boolean {
  const numId = Number(userId);
  if (!numId || isNaN(numId)) return false;
  if (numId === SUPER_ADMIN_ID) return true;
  const config = loadBotConfig();
  return config.adminIds?.includes(numId) || false;
}

/**
 * Add a secondary admin ID
 */
export function addAdminId(id: number): boolean {
  if (!id || isNaN(id)) return false;
  const config = loadBotConfig();
  if (config.adminIds.includes(id)) return true;
  config.adminIds.push(id);
  saveBotConfig({ adminIds: config.adminIds });
  return true;
}

/**
 * Remove an admin ID (Super admin cannot be removed)
 */
export function removeAdminId(id: number): boolean {
  if (id === SUPER_ADMIN_ID) return false;
  const config = loadBotConfig();
  const filtered = config.adminIds.filter(x => x !== id);
  saveBotConfig({ adminIds: filtered });
  return true;
}

// Memory cache for registered users
let cachedUsers: Set<number> | null = null;

function loadUsers(): Set<number> {
  if (cachedUsers) return cachedUsers;
  const users = new Set<number>();
  try {
    if (fs.existsSync(PRIMARY_USERS_PATH)) {
      const data = JSON.parse(fs.readFileSync(PRIMARY_USERS_PATH, 'utf-8'));
      if (Array.isArray(data)) {
        data.forEach(id => typeof id === 'number' && users.add(id));
      }
    } else if (fs.existsSync(BACKUP_USERS_PATH)) {
      const data = JSON.parse(fs.readFileSync(BACKUP_USERS_PATH, 'utf-8'));
      if (Array.isArray(data)) {
        data.forEach(id => typeof id === 'number' && users.add(id));
      }
    }
  } catch (err) {
    console.error('Error loading registered users:', err);
  }
  cachedUsers = users;
  return users;
}

function saveUsersDebounced() {
  if (!cachedUsers) return;
  try {
    const list = Array.from(cachedUsers);
    const json = JSON.stringify(list);
    fs.writeFileSync(PRIMARY_USERS_PATH, json, 'utf-8');
    try {
      fs.writeFileSync(BACKUP_USERS_PATH, json, 'utf-8');
    } catch {}
  } catch (err) {
    console.error('Error saving users to disk:', err);
  }
}

let saveTimer: NodeJS.Timeout | null = null;

export function registerUserId(userId: number | string): void {
  const numId = Number(userId);
  if (!numId || isNaN(numId)) return;
  const users = loadUsers();
  if (!users.has(numId)) {
    users.add(numId);
    if (!saveTimer) {
      saveTimer = setTimeout(() => {
        saveTimer = null;
        saveUsersDebounced();
      }, 2000);
    }
  }
}

export function getRegisteredUsers(): number[] {
  return Array.from(loadUsers());
}

export function getRegisteredUsersCount(): number {
  return loadUsers().size;
}
