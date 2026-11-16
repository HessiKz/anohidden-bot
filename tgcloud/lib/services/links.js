import { db } from 'sdk';
import { and, desc, eq } from 'sdk/db';
import { userLinks } from '../../schema.js';
import { buildUserLink } from './settings.js';
import { getUserById } from './users.js';
import { linkToken } from '../util/token.js';
import { logWarn } from '../util/log.js';

export async function getActiveLink(userId) {
  if (!Number.isFinite(Number(userId))) return null;
  return db
    .select()
    .from(userLinks)
    .where(and(eq(userLinks.userId, Number(userId)), eq(userLinks.isActive, true)))
    .get();
}

/**
 * Return the user's one active link, creating it if necessary. The partial
 * unique index on (user_id) WHERE is_active = 1 makes the one-link invariant
 * true even if two updates race.
 */
export async function ensureActiveLink(userId) {
  const existing = await getActiveLink(userId);
  if (existing) return { link: existing, created: false };

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const inserted = await db
        .insert(userLinks)
        .values({ userId: Number(userId), token: linkToken(), isActive: true })
        .returning();
      if (inserted.length > 0) return { link: inserted[0], created: true };
    } catch (error) {
      // A concurrent request may have created the active link, or the random
      // token collided. Both are recoverable by checking the active link.
      logWarn('link_insert_retry', { userId, attempt, code: error?.code });
    }
    const winner = await getActiveLink(userId);
    if (winner) return { link: winner, created: false };
  }

  throw new Error('Could not create a unique anonymous link.');
}

export async function rollLink(userId) {
  await db
    .update(userLinks)
    .set({ isActive: false, revokedAt: new Date() })
    .where(and(eq(userLinks.userId, Number(userId)), eq(userLinks.isActive, true)))
    .run();
  return ensureActiveLink(userId);
}

export async function findLinkByToken(token) {
  if (typeof token !== 'string' || !token) return null;
  return db.select().from(userLinks).where(eq(userLinks.token, token)).get();
}

/**
 * Resolve a deep-link token without ever exposing the owner's Telegram id to
 * the caller. Returns { link, owner, active } or null when unknown.
 */
export async function resolveLinkToken(token) {
  const link = await findLinkByToken(token);
  if (!link) return null;
  const owner = await getUserById(link.userId);
  return { link, owner, active: Boolean(link.isActive) };
}

export async function listLinksForUser(userId, limit = 20) {
  return db
    .select()
    .from(userLinks)
    .where(eq(userLinks.userId, Number(userId)))
    .orderBy(desc(userLinks.createdAt), desc(userLinks.id))
    .limit(limit)
    .all();
}

export async function getLinkUrlForUser(userId) {
  const { link } = await ensureActiveLink(userId);
  return { link, url: await buildUserLink(link.token) };
}

export async function countActiveLinks() {
  return db.$count(userLinks, eq(userLinks.isActive, true));
}

export async function getLinkById(id) {
  return db
    .select()
    .from(userLinks)
    .where(eq(userLinks.id, Number(id)))
    .get();
}

export async function isLinkActive(id) {
  const row = await db
    .select()
    .from(userLinks)
    .where(and(eq(userLinks.id, Number(id)), eq(userLinks.isActive, true)))
    .get();
  return Boolean(row);
}
