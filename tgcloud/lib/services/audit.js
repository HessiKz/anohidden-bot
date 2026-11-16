import { db } from 'sdk';
import { desc } from 'sdk/db';
import { adminLogs } from '../../schema.js';
import { ADMIN_LOG_PAGE_SIZE } from '../constants.js';
import { logError } from '../util/log.js';

export async function logAdminAction(actorTgId, action, options = {}) {
  try {
    await db
      .insert(adminLogs)
      .values({
        actorTgId: Number(actorTgId),
        action: String(action).slice(0, 100),
        targetType: options.targetType ? String(options.targetType).slice(0, 40) : null,
        targetId:
          options.targetId === null || options.targetId === undefined
            ? null
            : String(options.targetId).slice(0, 80),
        metadata: options.metadata ?? null,
      })
      .run();
  } catch (error) {
    // Auditing must not turn a completed administrative action into a false
    // failure for the operator. Surface the failure in console logs instead.
    logError('audit_log_failed', error, { action });
  }
}

export async function listAdminLogs(page = 0, pageSize = ADMIN_LOG_PAGE_SIZE) {
  return db
    .select()
    .from(adminLogs)
    .orderBy(desc(adminLogs.createdAt), desc(adminLogs.id))
    .limit(pageSize)
    .offset(Math.max(0, page) * pageSize)
    .all();
}

export async function countAdminLogs() {
  return db.$count(adminLogs);
}
