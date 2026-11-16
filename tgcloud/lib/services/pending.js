import { db } from 'sdk';
import { eq, sql } from 'sdk/db';
import { pendingTargets } from '../../schema.js';
import { PENDING_TARGET_TTL_MS } from '../constants.js';

export async function setPendingTarget(userId, recipientId, linkId, ttlMs = PENDING_TARGET_TTL_MS) {
  const expiresAt = new Date(Date.now() + ttlMs);
  await db
    .insert(pendingTargets)
    .values({
      userId: Number(userId),
      recipientId: Number(recipientId),
      linkId: Number(linkId),
      expiresAt,
    })
    .onConflictDoUpdate({
      target: pendingTargets.userId,
      set: {
        recipientId: Number(recipientId),
        linkId: Number(linkId),
        createdAt: new Date(),
        expiresAt,
      },
    })
    .run();
}

export async function getPendingTarget(userId) {
  const row = await db
    .select()
    .from(pendingTargets)
    .where(eq(pendingTargets.userId, Number(userId)))
    .get();
  if (!row) return null;
  if (row.expiresAt instanceof Date && row.expiresAt.getTime() <= Date.now()) {
    await clearPendingTarget(userId);
    return null;
  }
  return row;
}

export async function clearPendingTarget(userId) {
  await db
    .delete(pendingTargets)
    .where(eq(pendingTargets.userId, Number(userId)))
    .run();
}

export async function clearExpiredPendingTargets() {
  // Raw unix seconds: the real SDK does not bind Date in WHERE clauses.
  await db.run(
    sql`DELETE FROM pending_targets WHERE expires_at < ${Math.floor(Date.now() / 1000)}`
  );
}
