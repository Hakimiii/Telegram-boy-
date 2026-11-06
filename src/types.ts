export interface QualityOption {
  id: string;
  label: string;
  labelFa: string;
  resolution: string;
  ext: string;
  isAudioOnly?: boolean;
  qualityRank: number;
}

export interface IdentifiedSong {
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  confidence?: 'high' | 'medium' | 'estimated';
  searchQuery?: string;
}

export interface MediaInfo {
  url: string;
  title: string;
  thumbnail: string;
  duration: number;
  durationFormatted: string;
  uploader: string;
  platform: string;
  platformNameFa: string;
  platformNameEn: string;
  viewCount?: number;
  availableFormats: QualityOption[];
  track?: string;
  artist?: string;
  album?: string;
  genre?: string;
}

export interface BotStateResponse {
  isActive: boolean;
  botInfo: {
    id?: number;
    username?: string;
    first_name?: string;
  } | null;
  startTime: number;
  uptimeSeconds: number;
  totalRequests: number;
  totalDownloads: number;
  uniqueUsersCount: number;
  lastError: string | null;
  logs: {
    id: string;
    timestamp: string;
    userId?: number | string;
    userName?: string;
    action: string;
    platform?: string;
    details: string;
    status: 'pending' | 'success' | 'error';
  }[];
  tokenMasked: string;
  hasInstagramCookies?: boolean;
  isWebhookMode?: boolean;
  webhookUrl?: string | null;
}

export interface RequiredChannel {
  id: string; // e.g. '@mychannel' or '-1001234567890'
  title: string;
  username: string;
  url: string;
}

export interface BotAdminConfig {
  forceJoinEnabled: boolean;
  channels: RequiredChannel[];
  mainChannelUrl: string;
  supportUsername: string;
}
