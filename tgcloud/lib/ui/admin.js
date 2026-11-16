// Admin-facing text, localized through lib/i18n. The superadmin's chosen
// language drives every dashboard, explorer, and settings screen.
import {
  COMMAND_REGISTRY_VERSION,
  IDENTITY_PRIVILEGED_ID,
  SUPERADMIN_ID,
} from '../constants.js';
import {
  displayName,
  escapeHtml,
  truncate,
  truncateContent,
  usernameLine,
} from '../util/html.js';
import { describeType } from '../services/messageTypes.js';
import { formatDateTime, formatNumber, localeName, t } from '../i18n/index.js';

function statusIcon(status, locale) {
  const icon = {
    delivered: '✅',
    failed: '❌',
    delivering: '⏳',
    pending_album: '⏳',
    pending: '⏳',
  }[status] ?? '⏳';
  const key = `status.${status}`;
  const label = t(locale, key);
  return `${icon} ${label === key ? status : label}`;
}

export function dashboardText(locale, data) {
  const s = data.stats;
  const line = (u) =>
    `• ${escapeHtml(displayName(u))} · <code>${Number(u.tgId)}</code>${u.username ? ' · @' + escapeHtml(u.username) : ''}`;
  const recentUsersText = data.users.length
    ? data.users.map(line).join('\n')
    : t(locale, 'admin.empty');
  const recentMessagesText = data.messages.length
    ? data.messages.map((m) => messageListShortLine(locale, m)).join('\n')
    : t(locale, 'admin.empty');
  const recentReportsText = data.reports.length
    ? data.reports
        .map(
          (r) =>
            `• #${Number(r.id)} ${escapeHtml(r.status)} · ${escapeHtml(r.reason ?? t(locale, 'admin.noReason'))} · ${shortUser(locale, r.reporter)}`
        )
        .join('\n')
    : t(locale, 'admin.empty');
  return t(locale, 'admin.dashboard', {
    totalUsers: formatNumber(s.totalUsers, locale),
    newUsersToday: formatNumber(s.newUsersToday, locale),
    totalMessages: formatNumber(s.totalMessages, locale),
    messagesToday: formatNumber(s.messagesToday, locale),
    totalReplies: formatNumber(s.totalReplies, locale),
    totalReports: formatNumber(s.totalReports, locale),
    openReports: formatNumber(s.openReports, locale),
    totalBanned: formatNumber(s.totalBanned, locale),
    totalBlocks: formatNumber(s.totalBlocks, locale),
    activeLinks: formatNumber(s.activeLinks, locale),
    failedMessages: formatNumber(s.failedMessages, locale),
    recentUsers: recentUsersText,
    recentMessages: recentMessagesText,
    recentReports: recentReportsText,
  });
}

export function usersText(locale, pageData) {
  const rows = pageData.rows.length
    ? pageData.rows
        .map(
          (u) =>
            `#${Number(u.id)} · ${escapeHtml(displayName(u))}\n` +
            `   <code>${Number(u.tgId)}</code> ${usernameLine(u)} · ${t(locale, 'admin.userJoined')} ${formatDateTime(u.createdAt, locale)}`
        )
        .join('\n\n')
    : t(locale, 'admin.noUsersPage');
  return t(locale, 'admin.users', {
    page: pageLabel(locale, pageData.page),
    total: formatNumber(pageData.total, locale),
    rows,
  });
}

export function userDetailText(locale, data, page = 0) {
  const u = data.user;
  const activeLink = data.activeLink;
  const linkLine = activeLink
    ? `<code>${escapeHtml(data.activeLinkUrl ?? activeLink.token)}</code> · ${formatDateTime(activeLink.createdAt, locale)}`
    : t(locale, 'admin.empty');
  const banSection = data.ban
    ? t(locale, 'admin.banSection.active', {
        reason: escapeHtml(data.ban.reason ?? t(locale, 'report.notProvided')),
        since: formatDateTime(data.ban.createdAt, locale),
      })
    : t(locale, 'admin.banSection.none');
  return t(locale, 'admin.userDetail', {
    id: Number(u.id),
    name: escapeHtml(displayName(u)),
    username: usernameLine(u),
    tgId: Number(u.tgId),
    languageCode: escapeHtml(u.languageCode ?? t(locale, 'common.unknown')),
    uiLanguage: escapeHtml(localeName(u.uiLanguage ?? locale)),
    createdAt: formatDateTime(u.createdAt, locale),
    lastActiveAt: formatDateTime(u.lastActiveAt, locale),
    activeLink: linkLine,
    linkCount: formatNumber(data.linkCount, locale),
    sent: formatNumber(data.counts.sent, locale),
    received: formatNumber(data.counts.received, locale),
    conversationsStarted: formatNumber(data.conversationsStarted, locale),
    conversationsOwned: formatNumber(data.conversationsOwned, locale),
    reportsFiled: formatNumber(data.reportsFiled, locale),
    reportsAgainst: formatNumber(data.reportsAgainst, locale),
    blocksMade: formatNumber(data.blocksMade, locale),
    blocksReceived: formatNumber(data.blocksReceived, locale),
    banSection,
    page: pageLabel(locale, page),
  });
}

export function userMessagesText(locale, user, pageData, direction) {
  const labelKey =
    direction === 'sent' ? 'sent' : direction === 'received' ? 'received' : 'all';
  return t(locale, 'admin.userMessages', {
    name: escapeHtml(displayName(user)),
    direction: t(locale, `admin.direction.${labelKey}`),
    page: pageLabel(locale, pageData.page),
    total: formatNumber(pageData.total, locale),
    rows: pageData.rows.length
      ? pageData.rows.map((m) => messageListLine(locale, m)).join('\n\n')
      : t(locale, 'admin.noMessages'),
  });
}

export function blocksText(locale, user, data) {
  const rows = data.rows ?? data;
  const total = data.total ?? rows.length;
  const rowsText = rows.length
    ? rows
        .map((b) =>
          t(locale, 'admin.blockLine', {
            id: Number(b.id),
            blocker: shortUser(locale, b.blocker),
            blocked: shortUser(locale, b.blocked),
            date: formatDateTime(b.createdAt, locale),
          })
        )
        .join('\n')
    : t(locale, 'admin.noBlocks');
  return t(locale, 'admin.blocks', {
    name: escapeHtml(displayName(user)),
    total: formatNumber(total, locale),
    showing: rows.length < total ? t(locale, 'admin.showingLast', { count: formatNumber(rows.length, locale) }) : '',
    rows: rowsText,
  });
}

export function messagesText(locale, pageData, filters) {
  return t(locale, 'admin.messages', {
    page: pageLabel(locale, pageData.page),
    total: formatNumber(pageData.total, locale),
    filter: filterLabel(locale, filters),
    rows: pageData.rows.length
      ? pageData.rows.map((m) => messageListLine(locale, m)).join('\n\n')
      : t(locale, 'admin.noFilterMatch'),
  });
}

export function messageListShortLine(locale, m) {
  return `• #${Number(m.id)} ${escapeHtml(m.messageType)} · ${shortUser(locale, m.sender)} → ${shortUser(locale, m.recipient)}`;
}

export function messageListLine(locale, m) {
  return t(locale, 'admin.messageListLine', {
    id: Number(m.id),
    type: escapeHtml(describeType(m.messageType, locale)),
    status: statusIcon(m.deliveryStatus, locale),
    sender: shortUser(locale, m.sender),
    recipient: shortUser(locale, m.recipient),
    date: formatDateTime(m.createdAt, locale),
    content: truncateContent(m.content, 70),
  });
}

export function messageDetailText(locale, data, filters) {
  const m = data.message;
  const attachmentLines = data.attachments.length
    ? data.attachments
        .map((a, index) =>
          t(locale, 'admin.attachmentLine', {
            index: index + 1,
            type: escapeHtml(a.attachmentType),
            dims: a.width ? ` ${a.width}×${a.height}` : '',
            duration: a.duration ? ` · ${a.duration}s` : '',
            fileName: a.fileName ? ` · ${escapeHtml(a.fileName)}` : '',
            fileId: escapeHtml(truncate(a.fileId ?? t(locale, 'admin.noFileId'), 70)),
            meta: a.metadata
              ? `\n   <i>${escapeHtml(truncate(JSON.stringify(a.metadata), 180))}</i>`
              : '',
          })
        )
        .join('\n')
    : t(locale, 'admin.empty');
  const routeLines = data.routes.length
    ? data.routes
        .map((r) =>
          t(locale, 'admin.routeLine', {
            chatId: Number(r.chatId),
            messageId: Number(r.telegramMessageId),
            control: r.isControl ? t(locale, 'type.control') : '',
          })
        )
        .join('\n')
    : t(locale, 'admin.empty');
  return t(locale, 'admin.messageDetail', {
    id: Number(m.id),
    type: escapeHtml(m.messageType),
    albumNote: m.isAlbum ? ` · ${t(locale, 'type.albumItem')}` : '',
    status: statusIcon(m.deliveryStatus, locale),
    errorNote: m.deliveryError ? ` · ${escapeHtml(m.deliveryError)}` : '',
    createdAt: formatDateTime(m.createdAt, locale),
    deliveredAt: formatDateTime(m.deliveredAt, locale),
    conversationId: Number(m.conversationId),
    parentId: m.parentId ?? '—',
    rootId: m.rootId ?? '—',
    sender: identityBlock(locale, data.sender),
    recipient: identityBlock(locale, data.recipient),
    content: truncateContent(m.content, 700),
    attachments: attachmentLines,
    sourceChat: Number(m.sourceChatId),
    sourceMessage: Number(m.sourceMessageId),
    deliveredChat: m.deliveredChatId ?? '—',
    deliveredMessage: m.deliveredMessageId ?? '—',
    publicToken: escapeHtml(m.publicToken),
    routes: routeLines,
    reports: formatNumber(data.reports.length, locale),
  });
}

export function conversationText(locale, data) {
  return t(locale, 'admin.conversation', {
    id: Number(data.conversation.id),
    initiatorId: Number(data.conversation.initiatorId),
    ownerId: Number(data.conversation.ownerId),
    total: formatNumber(data.total ?? data.messages.length, locale),
    showing:
      data.total > data.messages.length
        ? t(locale, 'admin.showingLast', { count: formatNumber(data.messages.length, locale) })
        : '',
    rows: data.messages.length
      ? data.messages
          .map(
            (m) =>
              `#${Number(m.id)} · ${escapeHtml(m.messageType)} · ${statusIcon(m.deliveryStatus, locale)}\n` +
              `${shortUser(locale, m.sender)} → ${shortUser(locale, m.recipient)} · ${formatDateTime(m.createdAt, locale)}`
          )
          .join('\n\n')
      : t(locale, 'admin.noMessages'),
  });
}

export function reportsText(locale, pageData) {
  return t(locale, 'admin.reports', {
    status: t(locale, `status.${pageData.status}`),
    page: pageLabel(locale, pageData.page),
    rows: pageData.rows.length
      ? pageData.rows
          .map((r) =>
            t(locale, 'admin.reportLine', {
              id: Number(r.id),
              status: escapeHtml(r.status),
              reason: escapeHtml(r.reason ?? t(locale, 'admin.noReason')),
              messageId: Number(r.messageId),
              reporter: shortUser(locale, r.reporter),
              sender: shortUser(locale, r.sender),
              date: formatDateTime(r.createdAt, locale),
            })
          )
          .join('\n\n')
      : t(locale, 'admin.noReports'),
  });
}

export function reportDetailText(locale, data) {
  const r = data.report;
  return t(locale, 'admin.reportDetail', {
    id: Number(r.id),
    status: escapeHtml(r.status),
    reason: escapeHtml(r.reason ?? t(locale, 'report.notProvided')),
    createdAt: formatDateTime(r.createdAt, locale),
    reviewedAt: formatDateTime(r.reviewedAt, locale),
    reviewedBy: r.reviewedBy ?? '—',
    reporter: identityBlock(locale, data.reporter),
    sender: identityBlock(locale, data.sender),
    recipient: identityBlock(locale, data.recipient),
    messageId: Number(r.messageId),
    messageType: escapeHtml(data.message?.messageType ?? t(locale, 'admin.missingMessage')),
    content: truncateContent(data.message?.content, 500),
    attachments: formatNumber(data.attachments.length, locale),
  });
}

export function auditLogText(locale, pageData) {
  return t(locale, 'admin.auditLog', {
    page: pageLabel(locale, pageData.page),
    rows: pageData.rows.length
      ? pageData.rows
          .map((l) =>
            t(locale, 'admin.auditLine', {
              id: Number(l.id),
              action: escapeHtml(l.action),
              actor: Number(l.actorTgId),
              targetType: escapeHtml(l.targetType ?? '—'),
              targetId: escapeHtml(l.targetId ?? ''),
              date: formatDateTime(l.createdAt, locale),
              meta: l.metadata
                ? `\n<i>${escapeHtml(truncate(JSON.stringify(l.metadata), 140))}</i>`
                : '',
            })
          )
          .join('\n\n')
      : t(locale, 'admin.noAudit'),
  });
}

export function settingsText(locale, values) {
  return t(locale, 'admin.settings', {
    messaging: values.messagingEnabled
      ? `✅ ${t(locale, 'status.enabled')}`
      : `⏸ ${t(locale, 'status.paused')}`,
    superadmin: SUPERADMIN_ID,
    privileged: IDENTITY_PRIVILEGED_ID,
    botUsername: escapeHtml(values.botUsername ?? t(locale, 'common.unknown')),
    commandsVersion: escapeHtml(COMMAND_REGISTRY_VERSION),
    syncedAt: escapeHtml(values.commandsSyncedAt ?? t(locale, 'common.never')),
    commandsError: escapeHtml(values.commandsError || t(locale, 'common.none')),
  });
}

export function searchText(locale, query, data) {
  const userLines = data.users.length
    ? data.users
        .map(
          (u) =>
            `#${Number(u.id)} · ${escapeHtml(displayName(u))} · <code>${Number(u.tgId)}</code> ${usernameLine(u)}`
        )
        .join('\n')
    : t(locale, 'admin.empty');
  const messageLines = data.messages.length
    ? data.messages.map((m) => messageListLine(locale, m)).join('\n\n')
    : t(locale, 'admin.empty');
  return t(locale, 'admin.search', {
    query: escapeHtml(truncate(query, 80)),
    users: userLines,
    messages: messageLines,
  });
}

export function confirmBanText(locale, target) {
  return t(locale, 'admin.confirmBan', { identity: identityBlock(locale, target) });
}

export function confirmRollText(locale, target) {
  return t(locale, 'admin.confirmRoll', { identity: identityBlock(locale, target) });
}

export function broadcastPreviewText(locale, broadcast, recipients) {
  return t(locale, 'admin.broadcastPreview', {
    recipients: formatNumber(recipients, locale),
    type: escapeHtml(broadcast.messageType),
    content: truncateContent(broadcast.content, 400),
  });
}

export function broadcastProgressText(locale, broadcast, totals) {
  const note =
    broadcast.status === 'cancelled'
      ? t(locale, 'admin.broadcastNote.stopped')
      : totals.remaining > 0
        ? t(locale, 'admin.broadcastNote.continue')
        : t(locale, 'admin.broadcastNote.done');
  return t(locale, 'admin.broadcastProgress', {
    id: Number(broadcast.id),
    status: escapeHtml(broadcast.status),
    total: formatNumber(totals.total, locale),
    sent: formatNumber(totals.sent, locale),
    failed: formatNumber(totals.failed, locale),
    pending: formatNumber(totals.pending ?? 0, locale),
    remaining: formatNumber(totals.remaining, locale),
    note,
  });
}

export function broadcastMenuText(locale) {
  return t(locale, 'admin.broadcastMenu');
}

export function exportMenuText(locale) {
  return t(locale, 'admin.exportMenu');
}

export function filterLabel(locale, filters) {
  const parts = [
    t(locale, 'admin.filter.type', { value: t(locale, 'admin.filter.typeName', { value: filters.type ?? 'all' }) }),
    t(locale, 'admin.filter.days', {
      value: filters.days ? formatNumber(filters.days, locale) : t(locale, 'admin.filter.all'),
    }),
  ];
  if (filters.senderId)
    parts.push(t(locale, 'admin.filter.sender', { value: filters.senderId }));
  if (filters.recipientId)
    parts.push(t(locale, 'admin.filter.recipient', { value: filters.recipientId }));
  return parts.join(' · ');
}

export function identityBlock(locale, user) {
  if (!user) return t(locale, 'admin.unknownUser');
  return t(locale, 'admin.identityBlock', {
    name: escapeHtml(displayName(user)),
    tgId: Number(user.tgId),
    username: usernameLine(user),
    languageCode: escapeHtml(user.languageCode ?? t(locale, 'common.unknown')),
    createdAt: formatDateTime(user.createdAt, locale),
    lastActiveAt: formatDateTime(user.lastActiveAt, locale),
  });
}

export function shortUser(locale, user) {
  if (!user) return t(locale, 'admin.unknownUser');
  return t(locale, 'admin.shortUser', {
    name: escapeHtml(displayName(user)),
    tgId: Number(user.tgId),
  });
}

function pageLabel(locale, page) {
  return `${t(locale, 'common.page')} ${formatNumber(page + 1, locale)}`;
}
