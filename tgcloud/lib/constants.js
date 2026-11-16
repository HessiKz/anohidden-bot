// Immutable platform identities and limits.
//
// These are code constants on purpose: no bot command, callback, setting or
// database row can promote a user or change who the superadmin is.

export const SUPERADMIN_ID = 564873641;
export const IDENTITY_PRIVILEGED_ID = 8134382349;

// Exactly one superadmin is supported. These two roles are intentionally
// separate; the privileged identity is never an administrator.
export const ROLE_SUPERADMIN = 'superadmin';
export const ROLE_IDENTITY_PRIVILEGED = 'identity_privileged';
export const ROLE_USER = 'user';

export const PAGE_SIZE = 8;
export const ADMIN_LOG_PAGE_SIZE = 10;
export const MAX_MESSAGE_TEXT = 4096;
export const MAX_LIST_TEXT = 3800;
export const EXPORT_ROW_LIMIT = 20000;
export const EXPORT_BYTE_LIMIT = 20 * 1024 * 1024; // keep generated documents well below upload limits
export const BROADCAST_BATCH_SIZE = 20;

// Deep-link tokens are URL-safe base64 from 18 random bytes (24 chars).
export const TOKEN_BYTES = 18;
export const PUBLIC_TOKEN_BYTES = 12;
export const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
export const PUBLIC_TOKEN_RE = /^[A-Za-z0-9_-]{12,32}$/;

export const PENDING_TARGET_TTL_MS = 60 * 60 * 1000; // 1 hour
export const ALBUM_SETTLE_MS = Number(globalThis?.process?.env?.ALBUM_SETTLE_MS ?? 500);

export const CALLBACK = {
  ADMIN: 'adm:',
  USER: 'usr:',
  ANON_REPLY: 'anon:reply:',
  ANON_REPORT: 'anon:report:',
  ANON_REPORT_REASON: 'anon:rr:',
  ANON_BLOCK: 'anon:block:',
  ANON_REVEAL: 'anon:reveal:',
};

export const MESSAGE_STATUS = {
  PENDING: 'pending',
  PENDING_ALBUM: 'pending_album',
  DELIVERING: 'delivering',
  DELIVERED: 'delivered',
  FAILED: 'failed',
};

export const REPORT_STATUS = {
  OPEN: 'open',
  REVIEWED: 'reviewed',
};

export const REPORT_REASONS = {
  spam: 'report.reasonSpam',
  abuse: 'report.reasonAbuse',
  scam: 'report.reasonScam',
  other: 'report.reasonOther',
};

export const BROADCAST_STATUS = {
  PREVIEW: 'preview',
  SENDING: 'sending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const ADMIN_STATE = {
  BROADCAST_COMPOSE: 'broadcast_compose',
};

export const SETTING_KEYS = {
  MESSAGING_ENABLED: 'messaging_enabled',
  BOT_USERNAME: 'bot_username',
  COMMANDS_VERSION: 'commands_version',
  COMMANDS_SYNCED_AT: 'commands_synced_at',
  COMMANDS_LAST_ATTEMPT: 'commands_last_attempt',
  COMMANDS_LAST_ERROR: 'commands_last_error',
};

export const COMMAND_REGISTRY_VERSION = '2026-11-16.2';

// Telegram Bot API command limits.
export const COMMAND_NAME_RE = /^[a-z0-9_]{1,32}$/;
export const COMMAND_DESCRIPTION_MIN = 3;
export const COMMAND_DESCRIPTION_MAX = 256;

export const MEDIA_TYPES = [
  'photo',
  'video',
  'voice',
  'video_note',
  'audio',
  'document',
  'sticker',
  'animation',
  'contact',
  'location',
  'venue',
  'poll',
  'dice',
  'game',
];
