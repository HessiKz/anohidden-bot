import { db } from 'sdk';
import { processedUpdates } from '../../schema.js';
import { toPositiveInt } from '../util/validate.js';
import { logWarn } from '../util/log.js';

/**
 * Atomically claim a Telegram update id. Returns false for a replay.
 *
 * Failing closed on a missing/invalid update id prevents accidentally
 * processing the same update twice, which is critical for anonymous delivery.
 */
export async function claimUpdate(updateId, handler) {
  const id = toPositiveInt(updateId);
  if (id === null) {
    logWarn('update_missing_id', { handler });
    return false;
  }

  const inserted = await db
    .insert(processedUpdates)
    .values({ updateId: id, handler })
    .onConflictDoNothing({ target: processedUpdates.updateId })
    .returning({ updateId: processedUpdates.updateId });

  return inserted.length > 0;
}
