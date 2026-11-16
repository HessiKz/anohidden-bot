import { db } from 'sdk';
import { and, eq, or, sql } from 'sdk/db';
import { bannedUsers, blockedUsers } from '../../schema.js';

export async function isBanned(userId) {
  if (!Number.isFinite(Number(userId))) return false;
  const row = await db
    .select()
    .from(bannedUsers)
    .where(and(eq(bannedUsers.userId, Number(userId)), eq(bannedUsers.active, true)))
    .get();
  return Boolean(row);
}

export async function getActiveBan(userId) {
  return db
    .select()
    .from(bannedUsers)
    .where(and(eq(bannedUsers.userId, Number(userId)), eq(bannedUsers.active, true)))
    .get();
}

export async function banUser(userId, reason, adminTgId) {
  await db
    .insert(bannedUsers)
    .values({
      userId: Number(userId),
      active: true,
      reason: reason ? String(reason).slice(0, 500) : null,
      bannedBy: Number(adminTgId),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: bannedUsers.userId,
      set: {
        active: true,
        reason: reason ? String(reason).slice(0, 500) : null,
        bannedBy: Number(adminTgId),
        updatedAt: new Date(),
        unbannedAt: null,
      },
    })
    .run();
}

export async function unbanUser(userId, adminTgId) {
  const rows = await db
    .update(bannedUsers)
    .set({
      active: false,
      unbannedAt: new Date(),
      updatedAt: new Date(),
      bannedBy: Number(adminTgId),
    })
    .where(and(eq(bannedUsers.userId, Number(userId)), eq(bannedUsers.active, true)))
    .returning({ id: bannedUsers.id });
  return rows.length > 0;
}

/** Directional block: blocker no longer receives from blocked. */
export async function isBlockedDirection(blockerId, blockedId) {
  const row = await db
    .select()
    .from(blockedUsers)
    .where(
      and(
        eq(blockedUsers.blockerId, Number(blockerId)),
        eq(blockedUsers.blockedId, Number(blockedId))
      )
    )
    .get();
  return Boolean(row);
}

/**
 * A block severs the conversation in both directions so the blocked person
 * cannot continue contact by replying to an older message.
 */
export async function areBlocked(aId, bId) {
  const row = await db
    .select()
    .from(blockedUsers)
    .where(
      or(
        and(
          eq(blockedUsers.blockerId, Number(aId)),
          eq(blockedUsers.blockedId, Number(bId))
        ),
        and(
          eq(blockedUsers.blockerId, Number(bId)),
          eq(blockedUsers.blockedId, Number(aId))
        )
      )
    )
    .get();
  return Boolean(row);
}

export async function blockUser(blockerId, blockedId, sourceMessageId = null) {
  if (Number(blockerId) === Number(blockedId)) {
    return { created: false, self: true };
  }
  const result = await db.run(sql`
    INSERT INTO blocked_users (blocker_id, blocked_id, source_message_id)
    VALUES (${Number(blockerId)}, ${Number(blockedId)}, ${sourceMessageId ? Number(sourceMessageId) : null})
    ON CONFLICT(blocker_id, blocked_id) DO NOTHING
    RETURNING id
  `);
  return { created: (result?.rows?.length ?? 0) > 0, self: false };
}

export async function listBlocksForUser(userId) {
  const id = Number(userId);
  return db
    .select()
    .from(blockedUsers)
    .where(or(eq(blockedUsers.blockerId, id), eq(blockedUsers.blockedId, id)))
    .all();
}

export async function countBlocks() {
  return db.$count(blockedUsers);
}
