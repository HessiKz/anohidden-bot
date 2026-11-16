import { db } from 'sdk';
import { desc, eq, isNotNull, sql } from 'sdk/db';
import {
  bannedUsers,
  blockedUsers,
  messages,
  reports,
  userLinks,
  users,
} from '../../schema.js';
import { startOfToday } from '../util/time.js';
import { countNewUsersToday, countUsers } from './users.js';

export async function overviewStats() {
  const todaySeconds = Math.floor(startOfToday().getTime() / 1000);
  const [
    totalUsers,
    newUsersToday,
    totalMessages,
    messagesToday,
    totalReplies,
    totalReports,
    openReports,
    totalBanned,
    totalBlocks,
    activeLinks,
    failedMessages,
  ] = await Promise.all([
    countUsers(),
    countNewUsersToday(),
    db.$count(messages),
    countMessagesSince(todaySeconds),
    db.$count(messages, isNotNull(messages.parentId)),
    db.$count(reports),
    db.$count(reports, eq(reports.status, 'open')),
    db.$count(bannedUsers, eq(bannedUsers.active, true)),
    db.$count(blockedUsers),
    db.$count(userLinks, eq(userLinks.isActive, true)),
    db.$count(messages, eq(messages.deliveryStatus, 'failed')),
  ]);

  return {
    totalUsers,
    newUsersToday,
    totalMessages,
    messagesToday,
    totalReplies,
    totalReports,
    openReports,
    totalBanned,
    totalBlocks,
    activeLinks,
    failedMessages,
  };
}

export async function recentMessages(limit = 5) {
  return db
    .select()
    .from(messages)
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(limit)
    .all();
}

export async function recentReports(limit = 5) {
  return db
    .select()
    .from(reports)
    .orderBy(desc(reports.createdAt), desc(reports.id))
    .limit(limit)
    .all();
}

export async function totalMessageCount() {
  return db.$count(messages);
}

export async function messagesTodayCount() {
  return countMessagesSince(Math.floor(startOfToday().getTime() / 1000));
}

async function countMessagesSince(seconds) {
  // Raw unix seconds avoid binding a Date object in a real SDK WHERE clause.
  const row = await db.get(
    sql`SELECT count(*) AS n FROM messages WHERE created_at >= ${Number(seconds)}`
  );
  return Number(row?.n ?? 0);
}

export async function userGrowth(dayCount = 7) {
  const since = new Date(Date.now() - dayCount * 86400000);
  const rows = await db.all(
    sql`SELECT date(created_at, 'unixepoch') AS day, count(*) AS n
        FROM users WHERE created_at >= ${Math.floor(since.getTime() / 1000)}
        GROUP BY day ORDER BY day ASC`
  );
  return rows;
}
