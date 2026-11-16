import { db } from 'sdk';
import { asc, desc, eq, inArray } from 'sdk/db';
import {
  blockedUsers,
  conversations,
  messages,
  reports,
  users,
  userLinks,
} from '../../schema.js';
import {
  countMessages,
  countMessagesForUser,
  getConversation,
  getMessageById,
  listAttachments,
  listMessages,
  listRoutesForMessage,
  messagesForUser,
  searchMessages,
} from '../services/messages.js';
import {
  getActiveBan,
  listBlocksForUser,
} from '../services/moderation.js';
import {
  countUsers,
  getUserById,
  getUserByTgId,
  listUsers,
  searchUsers,
  userMessageCounts,
} from '../services/users.js';
import {
  getActiveLink,
  listLinksForUser,
} from '../services/links.js';
import { buildUserLink } from '../services/settings.js';
import { listAdminLogs } from '../services/audit.js';
import {
  overviewStats,
  recentMessages,
  recentReports,
} from '../services/stats.js';
import { recentUsers } from '../services/users.js';
import { PAGE_SIZE } from '../constants.js';

export async function enrichUsers(ids) {
  const unique = [...new Set(ids.filter((id) => Number.isFinite(Number(id))))].map(Number);
  if (unique.length === 0) return new Map();
  const rows = await db
    .select()
    .from(users)
    .where(inArray(users.id, unique))
    .all();
  return new Map(rows.map((row) => [row.id, row]));
}

export async function enrichMessages(rows) {
  const userMap = await enrichUsers(
    rows.flatMap((row) => [row.senderId, row.recipientId])
  );
  return rows.map((row) => ({
    ...row,
    sender: userMap.get(row.senderId) ?? null,
    recipient: userMap.get(row.recipientId) ?? null,
  }));
}

export async function enrichReports(rows) {
  const userMap = await enrichUsers(
    rows.flatMap((row) => [row.reporterId, row.reportedSenderId, row.reportedRecipientId])
  );
  return rows.map((row) => ({
    ...row,
    reporter: userMap.get(row.reporterId) ?? null,
    sender: userMap.get(row.reportedSenderId) ?? null,
    recipient: userMap.get(row.reportedRecipientId) ?? null,
  }));
}

export async function getDashboardData() {
  const [stats, usersList, messagesList, reportsList] = await Promise.all([
    overviewStats(),
    recentUsers(5),
    recentMessages(5),
    recentReports(5),
  ]);
  return {
    stats,
    users: usersList,
    messages: await enrichMessages(messagesList),
    reports: await enrichReports(reportsList),
  };
}

export async function listUsersPage(page = 0) {
  const [total, rows] = await Promise.all([
    countUsers(),
    listUsers(page, PAGE_SIZE),
  ]);
  return { total, rows, page, hasNext: (page + 1) * PAGE_SIZE < total };
}

export async function getUserDetailData(userId) {
  const user = await getUserById(userId);
  if (!user) return null;
  const [
    activeLink,
    links,
    ban,
    counts,
    reportsFiled,
    reportsAgainst,
    blocksMade,
    blocksReceived,
    started,
    owned,
    linkCount,
  ] = await Promise.all([
    getActiveLink(user.id),
    listLinksForUser(user.id, 10),
    getActiveBan(user.id),
    userMessageCounts(user.id),
    db.$count(reports, eq(reports.reporterId, user.id)),
    db.$count(reports, eq(reports.reportedSenderId, user.id)),
    db.$count(blockedUsers, eq(blockedUsers.blockerId, user.id)),
    db.$count(blockedUsers, eq(blockedUsers.blockedId, user.id)),
    db.$count(conversations, eq(conversations.initiatorId, user.id)),
    db.$count(conversations, eq(conversations.ownerId, user.id)),
    db.$count(userLinks, eq(userLinks.userId, user.id)),
  ]);
  return {
    user,
    activeLink,
    activeLinkUrl: activeLink
      ? await buildUserLink(activeLink.token).catch(() => null)
      : null,
    links,
    linkCount,
    ban,
    counts,
    reportsFiled,
    reportsAgainst,
    blocksMade,
    blocksReceived,
    conversationsStarted: started,
    conversationsOwned: owned,
  };
}

export async function getUserMessagesPage(userId, direction, page = 0) {
  const [total, rows] = await Promise.all([
    countMessagesForUser(userId, direction),
    messagesForUser(userId, direction, page, PAGE_SIZE),
  ]);
  return {
    total,
    rows: await enrichMessages(rows),
    page,
    hasNext: (page + 1) * PAGE_SIZE < total,
  };
}

export async function getUserBlocksData(userId) {
  const rows = await listBlocksForUser(userId);
  const limited = rows.slice(0, 20);
  const userMap = await enrichUsers(
    limited.flatMap((row) => [row.blockerId, row.blockedId])
  );
  return {
    total: rows.length,
    rows: limited.map((row) => ({
      ...row,
      blocker: userMap.get(row.blockerId) ?? null,
      blocked: userMap.get(row.blockedId) ?? null,
    })),
  };
}

export async function listMessagesPage(filters = {}, page = 0) {
  const [total, rows] = await Promise.all([
    countMessages(filters),
    listMessages(filters, page, PAGE_SIZE),
  ]);
  return {
    total,
    rows: await enrichMessages(rows),
    page,
    hasNext: (page + 1) * PAGE_SIZE < total,
  };
}

export async function getMessageDetailData(messageId) {
  const message = await getMessageById(messageId);
  if (!message) return null;
  const [sender, recipient, parent, routes, attachments, messageReports] =
    await Promise.all([
      getUserById(message.senderId),
      getUserById(message.recipientId),
      message.parentId ? getMessageById(message.parentId) : null,
      listRoutesForMessage(message.id),
      listAttachments(message.id),
      db
        .select()
        .from(reports)
        .where(eq(reports.messageId, message.id))
        .orderBy(desc(reports.createdAt))
        .all(),
    ]);
  return {
    message,
    sender,
    recipient,
    parent,
    routes,
    attachments,
    reports: await enrichReports(messageReports),
  };
}

export async function getConversationData(conversationId) {
  const conversation = await getConversation(conversationId);
  if (!conversation) return null;
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversation.id))
    .orderBy(asc(messages.id))
    .all();
  return {
    conversation,
    total: rows.length,
    messages: await enrichMessages(rows.slice(-12)),
  };
}

export async function listReportsPage(status = 'open', page = 0) {
  const where =
    status === 'open'
      ? eq(reports.status, 'open')
      : status === 'reviewed'
        ? eq(reports.status, 'reviewed')
        : undefined;
  const base = db.select().from(reports);
  const filtered = where ? base.where(where) : base;
  const rows = await filtered
    .orderBy(desc(reports.createdAt), desc(reports.id))
    .limit(PAGE_SIZE + 1)
    .offset(Math.max(0, page) * PAGE_SIZE)
    .all();
  const hasNext = rows.length > PAGE_SIZE;
  return {
    rows: await enrichReports(rows.slice(0, PAGE_SIZE)),
    page,
    status,
    hasNext,
  };
}

export async function getReportDetailData(reportId) {
  const report = await db
    .select()
    .from(reports)
    .where(eq(reports.id, Number(reportId)))
    .get();
  if (!report) return null;
  const [message, reporter, sender, recipient] = await Promise.all([
    getMessageById(report.messageId),
    getUserById(report.reporterId),
    getUserById(report.reportedSenderId),
    getUserById(report.reportedRecipientId),
  ]);
  return {
    report: (await enrichReports([report]))[0],
    message,
    reporter,
    sender,
    recipient,
    attachments: message ? await listAttachments(message.id) : [],
  };
}

export async function searchAllData(query) {
  const [userRows, messageRows] = await Promise.all([
    searchUsers(query, 8),
    searchMessages(query, 8),
  ]);
  return {
    users: userRows,
    messages: await enrichMessages(messageRows),
  };
}

export async function listAuditPage(page = 0) {
  const rows = await listAdminLogs(page, PAGE_SIZE + 1);
  return {
    rows: rows.slice(0, PAGE_SIZE),
    page,
    hasNext: rows.length > PAGE_SIZE,
  };
}

export async function findUserByTgId(tgId) {
  return getUserByTgId(tgId);
}
