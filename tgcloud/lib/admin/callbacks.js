import {
  COMMAND_REGISTRY_VERSION,
} from '../constants.js';
import {
  isSuperadmin,
  isSuperadminContext,
} from '../services/permissions.js';
import { logAdminAction } from '../services/audit.js';
import {
  banUser,
  unbanUser,
} from '../services/moderation.js';
import { db } from 'sdk';
import { and, eq } from 'sdk/db';
import { reports } from '../../schema.js';
import { rollLink } from '../services/links.js';
import {
  getSetting,
  getBotUsername,
  isMessagingEnabled,
  setBoolSetting,
} from '../services/settings.js';
import { SETTING_KEYS } from '../constants.js';
import { answerCallback, editText, sendText } from '../telegram/apiSafe.js';
import { syncCommands } from '../telegram/commands.js';
import {
  confirmBanText,
  confirmRollText,
  conversationText,
  dashboardText,
  messageDetailText,
  messagesText,
  reportDetailText,
  reportsText,
  settingsText,
  userDetailText,
  userMessagesText,
  usersText,
  auditLogText,
  blocksText,
  broadcastMenuText,
  broadcastProgressText,
} from '../ui/admin.js';
import {
  auditKeyboard,
  broadcastMenuKeyboard,
  broadcastProgressKeyboard,
  blocksKeyboard,
  confirmBanKeyboard,
  confirmRollKeyboard,
  conversationKeyboard,
  dashboardKeyboard,
  messageDetailKeyboard,
  messagesKeyboard,
  reportDetailKeyboard,
  reportsKeyboard,
  settingsKeyboard,
  userDetailKeyboard,
  userMessagesKeyboard,
  usersKeyboard,
  exportKeyboard,
} from './keyboards.js';
import {
  getConversationData,
  getDashboardData,
  getMessageDetailData,
  getReportDetailData,
  getUserBlocksData,
  getUserDetailData,
  getUserMessagesPage,
  listAuditPage,
  listMessagesPage,
  listReportsPage,
  listUsersPage,
} from './data.js';
import {
  cancelBroadcast,
  cancelBroadcastCompose,
  confirmBroadcast,
  getBroadcastProgress,
  startBroadcastCompose,
  runBroadcastBatch,
} from './broadcast.js';
import { exportRecords } from './export.js';
import { logError } from '../util/log.js';
import { toPositiveInt } from '../util/validate.js';
import { escapeHtml } from '../util/html.js';
import { t, localeOf } from '../i18n/index.js';

export async function handleAdminCallback(callbackQuery, user, data, locale) {
  const loc = locale ?? localeOf(user);
  if (!isSuperadmin(user.tgId) || !isSuperadminContext(callbackQuery)) {
    await answerCallback(callbackQuery, t(loc, 'cb.notAvailable'));
    return;
  }

  const parts = data.slice('adm:'.length).split(':');
  const action = parts[0];

  try {
    switch (action) {
      case 'h':
        await render(callbackQuery, user, dashboardText(loc, await getDashboardData()), dashboardKeyboard(loc));
        await answerCallback(callbackQuery, t(loc, 'adm.cb.dashboard'));
        return;
      case 'close':
        await render(callbackQuery, user, t(loc, 'adm.cb.adminPanelClosed'), undefined);
        await answerCallback(callbackQuery, t(loc, 'adm.cb.closed'));
        return;
      case 'u': {
        const page = pageOf(parts[1]);
        const pageData = await listUsersPage(page);
        await render(callbackQuery, user, usersText(loc, pageData), usersKeyboard(loc, pageData));
        await answerCallback(callbackQuery, t(loc, 'adm.cb.usersPage', { page: page + 1 }));
        return;
      }
      case 'ud':
        await renderUserDetail(callbackQuery, user, parts[1], parts[2], true);
        return;
      case 'um':
        await renderUserMessages(callbackQuery, user, parts[1], parts[2], parts[3]);
        return;
      case 'ub':
        await renderUserBlocks(callbackQuery, user, parts[1]);
        return;
      case 'banp':
        await renderBanConfirm(callbackQuery, user, parts[1], parts[2]);
        return;
      case 'banc':
        await executeBan(callbackQuery, user, parts[1], parts[2]);
        return;
      case 'unban':
        await executeUnban(callbackQuery, user, parts[1], parts[2]);
        return;
      case 'rollp':
        await renderRollConfirm(callbackQuery, user, parts[1], parts[2]);
        return;
      case 'rollc':
        await executeRoll(callbackQuery, user, parts[1], parts[2]);
        return;
      case 'm': {
        const filters = parseFilters(parts, 2);
        const page = pageOf(parts[1]);
        const pageData = await listMessagesPage(filters, page);
        await render(
          callbackQuery,
          user,
          messagesText(loc, pageData, filters),
          messagesKeyboard(loc, pageData, filters)
        );
        await answerCallback(callbackQuery, t(loc, 'adm.cb.messages'));
        return;
      }
      case 'md': {
        const filters = parseFilters(parts, 3);
        const page = pageOf(parts[2]);
        await renderMessageDetail(callbackQuery, user, parts[1], filters, page);
        return;
      }
      case 'conv': {
        const page = pageOf(parts[2]);
        const data = await getConversationData(parts[1]);
        if (!data) {
          await answerCallback(callbackQuery, t(loc, 'adm.cb.conversationNotFound'));
          return;
        }
        await render(callbackQuery, user, conversationText(loc, data), conversationKeyboard(loc, data));
        await answerCallback(callbackQuery, t(loc, 'adm.cb.conversation'));
        return;
      }
      case 'r': {
        const page = pageOf(parts[1]);
        const status = normalizeStatus(parts[2]);
        const pageData = await listReportsPage(status, page);
        await render(callbackQuery, user, reportsText(loc, pageData), reportsKeyboard(loc, pageData));
        await answerCallback(callbackQuery, t(loc, 'adm.cb.reports'));
        return;
      }
      case 'rd': {
        const page = pageOf(parts[2]);
        const status = normalizeStatus(parts[3]);
        await renderReportDetail(callbackQuery, user, parts[1], page, status);
        return;
      }
      case 'rev': {
        const page = pageOf(parts[2]);
        const status = normalizeStatus(parts[3]);
        await reviewReport(callbackQuery, user, parts[1], page, status);
        return;
      }
      case 'bl': {
        const page = pageOf(parts[1]);
        const pageData = await listAuditPage(page);
        await render(callbackQuery, user, auditLogText(loc, pageData), auditKeyboard(loc, pageData));
        await answerCallback(callbackQuery, t(loc, 'adm.cb.auditLog'));
        return;
      }
      case 'set':
        await renderSettings(callbackQuery, user);
        return;
      case 'sett':
        await toggleSetting(callbackQuery, user, parts[1]);
        return;
      case 'sync':
        await syncFromAdmin(callbackQuery, user);
        return;
      case 'exp':
        await render(callbackQuery, user, exportMenuText(loc), exportKeyboard(loc));
        await answerCallback(callbackQuery, t(loc, 'adm.cb.export'));
        return;
      case 'expj':
        await answerCallback(callbackQuery, t(loc, 'adm.cb.generatingJson'));
        await exportRecords(user, 'json');
        return;
      case 'expc':
        await answerCallback(callbackQuery, t(loc, 'adm.cb.generatingCsv'));
        await exportRecords(user, 'csv');
        return;
      case 'br':
        await render(callbackQuery, user, broadcastMenuText(loc), broadcastMenuKeyboard(loc));
        await answerCallback(callbackQuery, t(loc, 'adm.cb.broadcast'));
        return;
      case 'brnew':
        await startBroadcastCompose(user, loc);
        await answerCallback(callbackQuery, t(loc, 'adm.cb.sendBroadcastContent'));
        return;
      case 'brcancel':
        await cancelBroadcastCompose(user, loc);
        await answerCallback(callbackQuery, t(loc, 'adm.cb.composeCancelled'));
        return;
      case 'brc':
        await confirmBroadcast(callbackQuery, user, parts[1]);
        return;
      case 'brn':
        await continueBroadcast(callbackQuery, user, parts[1]);
        return;
      case 'brx':
        await stopBroadcast(callbackQuery, user, parts[1]);
        return;
      case 'search':
        await sendText(user.tgId, t(loc, 'adm.cb.searchHint'));
        await answerCallback(callbackQuery, t(loc, 'adm.btn.search'));
        return;
      case 'noop':
        await answerCallback(callbackQuery, t(loc, 'adm.cb.noAction'));
        return;
      default:
        await answerCallback(callbackQuery, t(loc, 'adm.cb.unknownAction'));
    }
  } catch (error) {
    logError('admin_callback_failed', error, {
      action,
      userId: user.id,
    });
    await answerCallback(callbackQuery, t(loc, 'adm.cb.actionFailed'));
  }
}

async function render(callbackQuery, user, text, keyboard) {
  if (callbackQuery.message && typeof callbackQuery.message.text === 'string') {
    const edited = await editText(
      callbackQuery.message.chat.id,
      callbackQuery.message.message_id,
      text,
      { replyMarkup: keyboard }
    );
    if (edited) return;
  }
  await sendText(user.tgId, text, { replyMarkup: keyboard });
}

async function renderUserDetail(callbackQuery, user, rawId, rawPage, log) {
  const locale = localeOf(user);
  const id = toPositiveInt(rawId);
  const page = pageOf(rawPage);
  const data = id ? await getUserDetailData(id) : null;
  if (!data) {
    await answerCallback(callbackQuery, t(locale, 'adm.cb.userNotFound'));
    return;
  }
  if (log) {
    await logAdminAction(user.tgId, 'admin.view_user', {
      targetType: 'user',
      targetId: data.user.id,
      metadata: { tgId: data.user.tgId },
    });
  }
  await render(
    callbackQuery,
    user,
    userDetailText(locale, data, page),
    userDetailKeyboard(locale, data, page)
  );
  await answerCallback(callbackQuery, t(locale, 'adm.cb.user'));
}

async function renderUserMessages(callbackQuery, user, rawId, rawPage, rawDirection) {
  const locale = localeOf(user);
  const id = toPositiveInt(rawId);
  const page = pageOf(rawPage);
  const direction = ['all', 'sent', 'received'].includes(rawDirection)
    ? rawDirection
    : 'all';
  const detail = id ? await getUserDetailData(id) : null;
  if (!detail) {
    await answerCallback(callbackQuery, t(locale, 'adm.cb.userNotFound'));
    return;
  }
  const pageData = await getUserMessagesPage(id, direction, page);
  await render(
    callbackQuery,
    user,
    userMessagesText(locale, detail.user, pageData, direction),
    userMessagesKeyboard(locale, id, pageData, direction)
  );
  await answerCallback(callbackQuery, t(locale, 'adm.cb.userMessages'));
}

async function renderUserBlocks(callbackQuery, user, rawId) {
  const locale = localeOf(user);
  const id = toPositiveInt(rawId);
  const detail = id ? await getUserDetailData(id) : null;
  if (!detail) {
    await answerCallback(callbackQuery, t(locale, 'adm.cb.userNotFound'));
    return;
  }
  const blocks = await getUserBlocksData(id);
  await render(
    callbackQuery,
    user,
    t(locale, 'admin.blockRelationships') + blocksText(locale, detail.user, blocks),
    blocksKeyboard(locale, id)
  );
  await answerCallback(callbackQuery, t(locale, 'adm.cb.blocks'));
}

async function renderBanConfirm(callbackQuery, user, rawId, rawBack) {
  const locale = localeOf(user);
  const id = toPositiveInt(rawId);
  const data = id ? await getUserDetailData(id) : null;
  if (!data) {
    await answerCallback(callbackQuery, t(locale, 'adm.cb.userNotFound'));
    return;
  }
  if (data.ban) {
    await answerCallback(callbackQuery, t(locale, 'adm.cb.alreadyBanned'));
    return;
  }
  const back = rawBack ?? 'u';
  await render(
    callbackQuery,
    user,
    confirmBanText(locale, data.user),
    confirmBanKeyboard(locale, id, back)
  );
  await answerCallback(callbackQuery, t(locale, 'adm.cb.confirmBan'));
}

async function executeBan(callbackQuery, user, rawId, rawBack) {
  const locale = localeOf(user);
  const targetLocale = localeOf(data?.user);
  const id = toPositiveInt(rawId);
  const data = id ? await getUserDetailData(id) : null;
  if (!data) {
    await answerCallback(callbackQuery, t(locale, 'adm.cb.userNotFound'));
    return;
  }
  if (isSuperadmin(data.user.tgId)) {
    await answerCallback(callbackQuery, t(locale, 'adm.cb.superadminCannotBan'));
    return;
  }
  await banUser(id, 'Banned from admin panel', user.tgId);
  await logAdminAction(user.tgId, 'admin.ban', {
    targetType: 'user',
    targetId: id,
    metadata: { tgId: data.user.tgId, back: rawBack ?? 'u' },
  });
  await sendText(data.user.tgId, t(targetLocale, 'adm.notify.banned'));
  await answerCallback(callbackQuery, t(locale, 'adm.cb.userBanned'));
  await renderUserDetail(callbackQuery, user, String(id), '0', false);
}

async function executeUnban(callbackQuery, user, rawId) {
  const locale = localeOf(user);
  const targetLocale = localeOf(data?.user);
  const id = toPositiveInt(rawId);
  const data = id ? await getUserDetailData(id) : null;
  if (!data) {
    await answerCallback(callbackQuery, t(locale, 'adm.cb.userNotFound'));
    return;
  }
  await unbanUser(id, user.tgId);
  await logAdminAction(user.tgId, 'admin.unban', {
    targetType: 'user',
    targetId: id,
    metadata: { tgId: data.user.tgId },
  });
  await sendText(data.user.tgId, t(targetLocale, 'adm.notify.unbanned'));
  await answerCallback(callbackQuery, t(locale, 'adm.cb.userUnbanned'));
  await renderUserDetail(callbackQuery, user, String(id), '0', false);
}

async function renderRollConfirm(callbackQuery, user, rawId, rawBack) {
  const locale = localeOf(user);
  const id = toPositiveInt(rawId);
  const data = id ? await getUserDetailData(id) : null;
  if (!data) {
    await answerCallback(callbackQuery, t(locale, 'adm.cb.userNotFound'));
    return;
  }
  const back = rawBack ?? 'u';
  await render(
    callbackQuery,
    user,
    confirmRollText(locale, data.user),
    confirmRollKeyboard(locale, id, back)
  );
  await answerCallback(callbackQuery, t(locale, 'adm.cb.confirmRotation'));
}

async function executeRoll(callbackQuery, user, rawId, rawBack) {
  const locale = localeOf(user);
  const targetLocale = localeOf(data?.user);
  const id = toPositiveInt(rawId);
  const data = id ? await getUserDetailData(id) : null;
  if (!data) {
    await answerCallback(callbackQuery, t(locale, 'adm.cb.userNotFound'));
    return;
  }
  await rollLink(id);
  await logAdminAction(user.tgId, 'admin.regenerate_link', {
    targetType: 'user',
    targetId: id,
    metadata: { tgId: data.user.tgId, back: rawBack ?? 'u' },
  });
  await sendText(data.user.tgId, t(targetLocale, 'adm.notify.linkRegenerated'));
  await answerCallback(callbackQuery, t(locale, 'adm.cb.linkRegenerated'));
  await renderUserDetail(callbackQuery, user, String(id), '0', false);
}

async function renderMessageDetail(callbackQuery, user, rawId, filters, page) {
  const locale = localeOf(user);
  const id = toPositiveInt(rawId);
  const data = id ? await getMessageDetailData(id) : null;
  if (!data) {
    await answerCallback(callbackQuery, t(locale, 'adm.cb.messageNotFound'));
    return;
  }
  await logAdminAction(user.tgId, 'admin.view_message', {
    targetType: 'message',
    targetId: id,
    metadata: {},
  });
  await render(
    callbackQuery,
    user,
    messageDetailText(locale, data, filters),
    messageDetailKeyboard(locale, data, filters, page)
  );
  await answerCallback(callbackQuery, t(locale, 'adm.cb.message'));
}

async function renderReportDetail(callbackQuery, user, rawId, page, status) {
  const locale = localeOf(user);
  const id = toPositiveInt(rawId);
  const data = id ? await getReportDetailData(id) : null;
  if (!data) {
    await answerCallback(callbackQuery, t(locale, 'adm.cb.reportNotFound'));
    return;
  }
  await logAdminAction(user.tgId, 'admin.view_report', {
    targetType: 'report',
    targetId: id,
    metadata: { status: data.report.status },
  });
  await render(
    callbackQuery,
    user,
    reportDetailText(locale, data),
    reportDetailKeyboard(locale, data, page, status)
  );
  await answerCallback(callbackQuery, t(locale, 'adm.cb.report'));
}

async function reviewReport(callbackQuery, user, rawId, page, status) {
  const locale = localeOf(user);
  const id = toPositiveInt(rawId);
  if (!id) {
    await answerCallback(callbackQuery, t(locale, 'adm.cb.reportNotFound'));
    return;
  }
  const updated = await db
    .update(reports)
    .set({
      status: 'reviewed',
      reviewedAt: new Date(),
      reviewedBy: Number(user.tgId),
    })
    .where(and(eq(reports.id, id), eq(reports.status, 'open')))
    .returning({ id: reports.id });
  await logAdminAction(user.tgId, 'admin.report_review', {
    targetType: 'report',
    targetId: id,
    metadata: { changed: updated.length > 0 },
  });
  await answerCallback(
    callbackQuery,
    updated.length ? t(locale, 'adm.cb.reportReviewed') : t(locale, 'adm.cb.reportAlreadyReviewed')
  );
  await renderReportDetail(callbackQuery, user, String(id), page, status);
}

async function renderSettings(callbackQuery, user) {
  const locale = localeOf(user);
  const [enabled, username, syncedAt, error] = await Promise.all([
    isMessagingEnabled(),
    getBotUsername().catch(() => null),
    getSetting(SETTING_KEYS.COMMANDS_SYNCED_AT, null),
    getSetting(SETTING_KEYS.COMMANDS_LAST_ERROR, null),
  ]);
  await render(
    callbackQuery,
    user,
    settingsText(locale, {
      messagingEnabled: enabled,
      botUsername: username,
      commandsVersion: COMMAND_REGISTRY_VERSION,
      commandsSyncedAt: syncedAt,
      commandsError: error,
    }),
    settingsKeyboard(locale, enabled)
  );
  await answerCallback(callbackQuery, t(locale, 'adm.cb.settings'));
}

async function toggleSetting(callbackQuery, user, key) {
  const locale = localeOf(user);
  if (key !== 'msg') {
    await answerCallback(callbackQuery, t(locale, 'adm.cb.unknownSetting'));
    return;
  }
  const enabled = await isMessagingEnabled();
  await setBoolSetting(SETTING_KEYS.MESSAGING_ENABLED, !enabled);
  await logAdminAction(user.tgId, 'admin.settings_toggle', {
    targetType: 'setting',
    targetId: SETTING_KEYS.MESSAGING_ENABLED,
    metadata: { from: enabled, to: !enabled },
  });
  await answerCallback(
    callbackQuery,
    enabled ? t(locale, 'adm.cb.messagingPaused') : t(locale, 'adm.cb.messagingEnabled')
  );
  await renderSettings(callbackQuery, user);
}

async function syncFromAdmin(callbackQuery, user) {
  const locale = localeOf(user);
  await answerCallback(callbackQuery, t(locale, 'adm.cb.syncing'));
  const report = await syncCommands();
  await logAdminAction(user.tgId, 'admin.sync_commands', {
    targetType: 'commands',
    targetId: 'telegram',
    metadata: { ok: report.ok, errors: report.errors },
  });
  if (!report.ok) {
    await sendText(
      user.tgId,
      t(locale, 'adm.cb.syncIncomplete', { errors: escapeHtml(report.errors.join('; ')) }),
      { maxLength: 1200 }
    );
  }
  await renderSettings(callbackQuery, user);
}

async function continueBroadcast(callbackQuery, user, rawId) {
  const locale = localeOf(user);
  const id = toPositiveInt(rawId);
  if (!id) {
    await answerCallback(callbackQuery, t(locale, 'adm.cb.broadcastNotFound'));
    return;
  }
  await answerCallback(callbackQuery, t(locale, 'adm.cb.processingBatch'));
  const progress = await runBroadcastBatch(id, user);
  if (!progress) {
    await sendText(user.tgId, t(locale, 'adm.cb.broadcastNotRunning'));
    return;
  }
  await render(
    callbackQuery,
    user,
    broadcastProgressText(locale, progress.broadcast, progress.totals),
    broadcastProgressKeyboard(locale, id, progress.totals.remaining)
  );
}

async function stopBroadcast(callbackQuery, user, rawId) {
  const locale = localeOf(user);
  const id = toPositiveInt(rawId);
  if (!id) {
    await answerCallback(callbackQuery, t(locale, 'adm.cb.broadcastNotFound'));
    return;
  }
  await cancelBroadcast(id, user);
  const progress = await getBroadcastProgress(id);
  await answerCallback(callbackQuery, t(locale, 'adm.cb.broadcastStopped'));
  if (progress) {
    await render(
      callbackQuery,
      user,
      broadcastProgressText(locale, progress.broadcast, progress.totals),
      broadcastProgressKeyboard(
        locale,
        id,
        progress.broadcast.status === 'sending' ? progress.totals.remaining : 0
      )
    );
  }
}

function parseFilters(parts, start) {
  const type = ['all', 'text', 'media', 'failed'].includes(parts[start])
    ? parts[start]
    : 'all';
  const daysRaw = Number(parts[start + 1]);
  const days = Number.isFinite(daysRaw) && daysRaw > 0
    ? Math.min(365, Math.trunc(daysRaw))
    : 0;
  const senderId = toPositiveInt(parts[start + 2]) ?? null;
  const recipientId = toPositiveInt(parts[start + 3]) ?? null;
  return { type, days, senderId, recipientId };
}

function pageOf(value) {
  return toPositiveInt(value) ?? 0;
}

function normalizeStatus(value) {
  return ['open', 'reviewed', 'all'].includes(value) ? value : 'open';
}
