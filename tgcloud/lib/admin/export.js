import { db } from 'sdk';
import { sql } from 'sdk/db';
import { EXPORT_BYTE_LIMIT, EXPORT_ROW_LIMIT } from '../constants.js';
import { isSuperadmin } from '../services/permissions.js';
import { logAdminAction } from '../services/audit.js';
import { getBotUsername } from '../services/settings.js';
import { sendDocument, sendText } from '../telegram/apiSafe.js';
import { formatBytes, formatNumber, t, localeOf } from '../i18n/index.js';

const TABLES = [
  { name: 'users', query: () => sql`SELECT * FROM users LIMIT ${EXPORT_ROW_LIMIT + 1}` },
  { name: 'user_links', query: () => sql`SELECT * FROM user_links LIMIT ${EXPORT_ROW_LIMIT + 1}` },
  { name: 'pending_targets', query: () => sql`SELECT * FROM pending_targets LIMIT ${EXPORT_ROW_LIMIT + 1}` },
  { name: 'conversations', query: () => sql`SELECT * FROM conversations LIMIT ${EXPORT_ROW_LIMIT + 1}` },
  { name: 'messages', query: () => sql`SELECT * FROM messages LIMIT ${EXPORT_ROW_LIMIT + 1}` },
  { name: 'message_routes', query: () => sql`SELECT * FROM message_routes LIMIT ${EXPORT_ROW_LIMIT + 1}` },
  { name: 'message_attachments', query: () => sql`SELECT * FROM message_attachments LIMIT ${EXPORT_ROW_LIMIT + 1}` },
  { name: 'blocked_users', query: () => sql`SELECT * FROM blocked_users LIMIT ${EXPORT_ROW_LIMIT + 1}` },
  { name: 'reports', query: () => sql`SELECT * FROM reports LIMIT ${EXPORT_ROW_LIMIT + 1}` },
  { name: 'banned_users', query: () => sql`SELECT * FROM banned_users LIMIT ${EXPORT_ROW_LIMIT + 1}` },
  { name: 'processed_updates', query: () => sql`SELECT * FROM processed_updates LIMIT ${EXPORT_ROW_LIMIT + 1}` },
  { name: 'admin_logs', query: () => sql`SELECT * FROM admin_logs LIMIT ${EXPORT_ROW_LIMIT + 1}` },
  { name: 'platform_settings', query: () => sql`SELECT * FROM platform_settings LIMIT ${EXPORT_ROW_LIMIT + 1}` },
  { name: 'admin_states', query: () => sql`SELECT * FROM admin_states LIMIT ${EXPORT_ROW_LIMIT + 1}` },
  { name: 'broadcasts', query: () => sql`SELECT * FROM broadcasts LIMIT ${EXPORT_ROW_LIMIT + 1}` },
  { name: 'broadcast_deliveries', query: () => sql`SELECT * FROM broadcast_deliveries LIMIT ${EXPORT_ROW_LIMIT + 1}` },
];

export async function exportRecords(user, format = 'json') {
  if (!isSuperadmin(user.tgId)) return;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  try {
    if (format === 'csv') {
      await exportCsv(user, stamp);
    } else {
      await exportJson(user, stamp);
    }
  } catch (error) {
    await sendText(
      user.tgId,
      `❌ Export failed: ${String(error?.message ?? 'unknown error').slice(0, 200)}`
    );
  }
}

async function exportJson(user, stamp, locale) {
  const tables = {};
  const counts = {};
  const truncated = [];
  let totalRows = 0;
  let usedBytes = 0;
  const reserve = 1024 * 1024; // metadata and JSON framing

  for (const item of TABLES) {
    const rows = await db.all(item.query());
    const limitHit = rows.length > EXPORT_ROW_LIMIT;
    const page = rows.slice(0, EXPORT_ROW_LIMIT);
    const remaining = Math.max(0, EXPORT_BYTE_LIMIT - reserve - usedBytes);
    const fitted = fitRowsByBytes(page, remaining);
    tables[item.name] = fitted;
    counts[item.name] = fitted.length;
    totalRows += fitted.length;
    usedBytes += jsonBytes(fitted);
    if (limitHit || fitted.length < page.length) truncated.push(item.name);
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    bot: await getBotUsername().catch(() => null),
    format: 'json',
    rowLimitPerTable: EXPORT_ROW_LIMIT,
    byteLimit: EXPORT_BYTE_LIMIT,
    truncated,
    counts,
    tables,
  };
  const text = JSON.stringify(payload, null, 2);
  const bytes = new TextEncoder().encode(text);
  const sent = await sendDocument(
    user.tgId,
    bytes,
    `anonymous-platform-${stamp}.json`,
    t(locale, 'admin.exportCaptionJson', {
      size: formatBytes(bytes.length, locale),
      rows: formatNumber(totalRows, locale),
      truncated: truncated.length
        ? `\n${t(locale, 'admin.exportTruncatedList')}: ${truncated.slice(0, 5).join(', ')}${truncated.length > 5 ? ` +${truncated.length - 5}` : ''}`
        : '',
    }),
    { mimeType: 'application/json' }
  );
  await logAdminAction(user.tgId, 'admin.export', {
    targetType: 'export',
    targetId: 'json',
    metadata: { bytes: bytes.length, rows: totalRows, truncated },
  }).catch(() => {});
  if (!sent) {
    await sendText(user.tgId, t(locale, 'admin.exportSendFailed'));
  }
}

async function exportCsv(user, stamp, locale) {
  const users = await db.all(sql`
    SELECT u.*, CASE WHEN b.active = 1 THEN 1 ELSE 0 END AS is_banned
    FROM users u
    LEFT JOIN banned_users b ON b.user_id = u.id
    LIMIT ${EXPORT_ROW_LIMIT + 1}
  `);
  const messages = await db.all(sql`
    SELECT m.*, s.tg_id AS sender_tg_id, r.tg_id AS recipient_tg_id
    FROM messages m
    LEFT JOIN users s ON s.id = m.sender_id
    LEFT JOIN users r ON r.id = m.recipient_id
    ORDER BY m.id ASC
    LIMIT ${EXPORT_ROW_LIMIT + 1}
  `);

  const usersPage = users.slice(0, EXPORT_ROW_LIMIT);
  const messagesPage = messages.slice(0, EXPORT_ROW_LIMIT);
  const usersResult = toCsvLimited(usersPage, EXPORT_BYTE_LIMIT);
  const messagesResult = toCsvLimited(messagesPage, EXPORT_BYTE_LIMIT);
  const usersTruncated =
    users.length > EXPORT_ROW_LIMIT || usersResult.included < usersPage.length;
  const messagesTruncated =
    messages.length > EXPORT_ROW_LIMIT ||
    messagesResult.included < messagesPage.length;

  const usersBytes = new TextEncoder().encode(usersResult.csv);
  const messagesBytes = new TextEncoder().encode(messagesResult.csv);

  const usersSent = await sendDocument(
    user.tgId,
    usersBytes,
    `users-${stamp}.csv`,
    t(locale, 'admin.exportCaptionUsers', {
      rows: formatNumber(usersResult.included, locale),
      truncated: usersTruncated ? t(locale, 'admin.exportTruncated') : '',
    }),
    { mimeType: 'text/csv' }
  );
  const messagesSent = await sendDocument(
    user.tgId,
    messagesBytes,
    `messages-${stamp}.csv`,
    t(locale, 'admin.exportCaptionMessages', {
      rows: formatNumber(messagesResult.included, locale),
      truncated: messagesTruncated ? t(locale, 'admin.exportTruncated') : '',
    }),
    { mimeType: 'text/csv' }
  );

  await logAdminAction(user.tgId, 'admin.export', {
    targetType: 'export',
    targetId: 'csv',
    metadata: {
      users: usersResult.included,
      messages: messagesResult.included,
      usersTruncated,
      messagesTruncated,
    },
  }).catch(() => {});

  if (!usersSent || !messagesSent) {
    await sendText(user.tgId, t(locale, 'admin.exportSendFailed'));
  }
}

function jsonBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function fitRowsByBytes(rows, maxBytes) {
  if (maxBytes <= 0) return [];
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (jsonBytes(rows.slice(0, mid)) <= maxBytes) lo = mid;
    else hi = mid - 1;
  }
  return rows.slice(0, lo);
}

function toCsvLimited(rows, maxBytes) {
  if (!rows.length) return { csv: '', included: 0 };
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvCell).join(',')];
  let bytes = new TextEncoder().encode(lines[0] + '\n').length;
  let included = 0;
  for (const row of rows) {
    const line = headers.map((header) => csvCell(row[header])).join(',');
    const lineBytes = new TextEncoder().encode(line + '\n').length;
    if (bytes + lineBytes > maxBytes) break;
    lines.push(line);
    bytes += lineBytes;
    included++;
  }
  return { csv: lines.join('\n') + '\n', included };
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

