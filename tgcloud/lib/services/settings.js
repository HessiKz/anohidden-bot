import { db, api } from 'sdk';
import { eq } from 'sdk/db';
import { platformSettings } from '../../schema.js';
import { SETTING_KEYS } from '../constants.js';
import { t } from '../i18n/index.js';

let botUsernameCache = null;

export async function getSetting(key, fallback = null) {
  const row = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .get();
  return row ? row.value : fallback;
}

export async function setSetting(key, value) {
  await db
    .insert(platformSettings)
    .values({ key, value: String(value) })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: String(value), updatedAt: new Date() },
    })
    .run();
}

export async function getBoolSetting(key, fallback = false) {
  const value = await getSetting(key, null);
  if (value === null) return fallback;
  return value === 'true' || value === '1';
}

export async function setBoolSetting(key, value) {
  await setSetting(key, value ? 'true' : 'false');
}

export async function isMessagingEnabled() {
  return getBoolSetting(SETTING_KEYS.MESSAGING_ENABLED, true);
}

export async function getBotUsername() {
  if (botUsernameCache) return botUsernameCache;
  const cached = await getSetting(SETTING_KEYS.BOT_USERNAME, null);
  if (cached) {
    botUsernameCache = cached;
    return cached;
  }
  const me = await api.getMe();
  const username = String(me?.username ?? '').replace(/^@/, '');
  if (!username) throw new Error('The bot has no Telegram username.');
  botUsernameCache = username;
  await setSetting(SETTING_KEYS.BOT_USERNAME, username);
  return username;
}

export async function buildUserLink(token) {
  const username = await getBotUsername();
  return `https://t.me/${username}?start=${encodeURIComponent(token)}`;
}

export async function buildShareUrl(link, locale = 'fa') {
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(
    t(locale, 'misc.shareFallback')
  )}`;
}
