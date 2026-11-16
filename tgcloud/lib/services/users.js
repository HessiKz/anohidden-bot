import { db } from 'sdk';
import { desc, eq, like, or, sql } from 'sdk/db';
import { bannedUsers, messages, users } from '../../schema.js';
import { PAGE_SIZE } from '../constants.js';
import { normalizeLocale } from '../i18n/index.js';
import { startOfToday } from '../util/time.js';

export async function getUserByTgId(tgId) {
  if (!Number.isFinite(Number(tgId))) return null;
  return db.select().from(users).where(eq(users.tgId, Number(tgId))).get();
}

export async function getUserById(id) {
  if (!Number.isFinite(Number(id))) return null;
  return db.select().from(users).where(eq(users.id, Number(id))).get();
}

/**
 * Register or refresh a Telegram user. Existing users keep their id, creation
 * date and link; only profile fields and last activity are updated.
 */
export async function upsertUser(from) {
  const tgId = Number(from?.id);
  if (!Number.isFinite(tgId) || tgId <= 0 || from?.is_bot) return null;

  const profile = {
    tgId,
    username: from.username ?? null,
    firstName: from.first_name ?? null,
    lastName: from.last_name ?? null,
    languageCode: from.language_code ?? null,
    isBot: false,
  };

  const inserted = await db
    .insert(users)
    .values({ ...profile, lastActiveAt: new Date() })
    .onConflictDoNothing({ target: users.tgId })
    .returning();

  if (inserted.length > 0) {
    return { user: inserted[0], isNew: true };
  }

  await db
    .update(users)
    .set({ ...profile, updatedAt: new Date(), lastActiveAt: new Date() })
    .where(eq(users.tgId, tgId))
    .run();

  const user = await getUserByTgId(tgId);
  return user ? { user, isNew: false } : null;
}

export async function touchUser(tgId) {
  if (!Number.isFinite(Number(tgId))) return;
  await db
    .update(users)
    .set({ lastActiveAt: new Date(), updatedAt: new Date() })
    .where(eq(users.tgId, Number(tgId)))
    .run();
}

/** Persist the user's bot-language choice ('fa' | 'en'). */
export async function setUserUiLanguage(tgId, locale) {
  if (!Number.isFinite(Number(tgId))) return null;
  await db
    .update(users)
    .set({ uiLanguage: normalizeLocale(locale), updatedAt: new Date() })
    .where(eq(users.tgId, Number(tgId)))
    .run();
  return getUserByTgId(tgId);
}

export async function updateUserProfile(userId, from) {
  await db
    .update(users)
    .set({
      username: from?.username ?? null,
      firstName: from?.first_name ?? null,
      lastName: from?.last_name ?? null,
      languageCode: from?.language_code ?? null,
      updatedAt: new Date(),
      lastActiveAt: new Date(),
    })
    .where(eq(users.id, Number(userId)))
    .run();
}

export async function countUsers() {
  return db.$count(users);
}

export async function countNewUsersToday() {
  // The real SDK binds a Date as an object in WHERE comparisons; use raw
  // unix seconds so this works on the platform as well as in the mock.
  const seconds = Math.floor(startOfToday().getTime() / 1000);
  const row = await db.get(sql`SELECT count(*) AS n FROM users WHERE created_at >= ${seconds}`);
  return Number(row?.n ?? 0);
}

export async function countBannedUsers() {
  return db.$count(bannedUsers, eq(bannedUsers.active, true));
}

export async function listUsers(page = 0, pageSize = PAGE_SIZE) {
  const offset = Math.max(0, page) * pageSize;
  return db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(pageSize)
    .offset(offset)
    .all();
}

export async function recentUsers(limit = 5) {
  return db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(limit)
    .all();
}

export async function searchUsers(query, limit = 10) {
  const q = String(query ?? '').trim();
  if (!q) return [];
  const numeric = /^\d+$/.test(q) ? Number(q) : null;
  const pattern = `%${q}%`;

  const conditions = [
    like(users.username, pattern),
    like(users.firstName, pattern),
    like(users.lastName, pattern),
  ];
  if (numeric !== null && Number.isSafeInteger(numeric)) {
    conditions.unshift(eq(users.tgId, numeric));
  }

  return db
    .select()
    .from(users)
    .where(or(...conditions))
    .orderBy(desc(users.lastActiveAt))
    .limit(limit)
    .all();
}

export async function userMessageCounts(userId) {
  const sent = await db.$count(messages, eq(messages.senderId, userId));
  const received = await db.$count(messages, eq(messages.recipientId, userId));
  return { sent, received };
}
