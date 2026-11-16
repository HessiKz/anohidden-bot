import { db } from 'sdk';
import { sql } from 'sdk/db';
import { logWarn } from '../util/log.js';

/**
 * Atomic sliding-window counter. Returns { allowed, count }.
 *
 * A database failure fails open: availability of user messaging should not
 * depend on the limiter table. Authorization and ban checks remain fail-closed.
 */
export async function consumeRateLimit(userId, action, limit, windowSeconds) {
  const key = `${Number(userId)}:${action}`;
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - Math.max(1, Number(windowSeconds) || 60);

  try {
    const result = await db.run(sql`
      INSERT INTO rate_limits (key, window_start, count)
      VALUES (${key}, ${now}, 1)
      ON CONFLICT(key) DO UPDATE SET
        count = CASE
          WHEN rate_limits.window_start <= ${cutoff} THEN 1
          ELSE rate_limits.count + 1
        END,
        window_start = CASE
          WHEN rate_limits.window_start <= ${cutoff} THEN ${now}
          ELSE rate_limits.window_start
        END
      RETURNING count
    `);
    const count = Number(result?.rows?.[0]?.count ?? 1);
    return { allowed: count <= Number(limit), count };
  } catch (error) {
    logWarn('rate_limit_unavailable', { userId, action, code: error?.code });
    return { allowed: true, count: 0 };
  }
}
