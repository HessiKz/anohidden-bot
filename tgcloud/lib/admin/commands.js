import {
  SUPERADMIN_ID,
} from '../constants.js';
import {
  isPrivateChatFrom,
  isSuperadmin,
} from '../services/permissions.js';
import {
  banUser,
  unbanUser,
  getActiveBan,
} from '../services/moderation.js';
import { getUserByTgId } from '../services/users.js';
import { logAdminAction } from '../services/audit.js';
import { sendText } from '../telegram/apiSafe.js';
import { startBroadcastCompose } from './broadcast.js';
import { exportRecords } from './export.js';
import {
  getDashboardData,
  getUserDetailData,
  getUserMessagesPage,
  getMessageDetailData,
  listMessagesPage,
  listReportsPage,
  searchAllData,
  listUsersPage,
} from './data.js';
import {
  dashboardKeyboard,
  messagesKeyboard,
  messageDetailKeyboard,
  reportsKeyboard,
  userDetailKeyboard,
  userMessagesKeyboard,
  usersKeyboard,
  searchKeyboard,
} from './keyboards.js';
import {
  dashboardText,
  messagesText,
  messageDetailText,
  reportsText,
  searchText,
  userDetailText,
  userMessagesText,
  usersText,
} from '../ui/admin.js';
import { parseArgs, parseKeyValueArgs, toPositiveInt } from '../util/validate.js';
import { t, localeOf } from '../i18n/index.js';

export async function handleAdminCommand(message, user, parsed, locale) {
  const loc = locale ?? localeOf(user);
  if (!isSuperadmin(user.tgId) || !isPrivateChatFrom(message, user.tgId)) {
    await sendText(user.tgId, t(loc, 'adm.cmd.notAvailable'));
    return;
  }

  const args = parseArgs(parsed.argsText);

  switch (parsed.command) {
    case 'admin':
      await showDashboard(user, loc);
      return;
    case 'stats':
      await showDashboard(user, loc);
      return;
    case 'users': {
      const page = Math.max(0, (toPositiveInt(args[0]) ?? 1) - 1);
      const data = await listUsersPage(page);
      await sendText(user.tgId, usersText(loc, data), { replyMarkup: usersKeyboard(loc, data) });
      return;
    }
    case 'user':
      await showUser(user, args[0], loc);
      return;
    case 'messages':
      await showMessages(user, args, loc);
      return;
    case 'message':
      await showMessage(user, args[0], loc);
      return;
    case 'search':
      await showSearch(user, parsed.argsText, loc);
      return;
    case 'reports': {
      const page = Math.max(0, (toPositiveInt(args[0]) ?? 1) - 1);
      const data = await listReportsPage('open', page);
      await sendText(user.tgId, reportsText(loc, data), { replyMarkup: reportsKeyboard(loc, data) });
      return;
    }
    case 'ban':
      await doBan(user, args, loc);
      return;
    case 'unban':
      await doUnban(user, args[0], loc);
      return;
    case 'broadcast':
      await startBroadcastCompose(user, loc);
      return;
    case 'export': {
      const format = (args[0] ?? 'json').toLowerCase() === 'csv' ? 'csv' : 'json';
      await exportRecords(user, format);
      return;
    }
    default:
      await sendText(user.tgId, t(loc, 'adm.cmd.unknown'));
  }
}

export async function showDashboard(user, locale) {
  const loc = locale ?? localeOf(user);
  const data = await getDashboardData();
  await sendText(user.tgId, dashboardText(loc, data), { replyMarkup: dashboardKeyboard(loc) });
}

async function showUser(user, rawId, locale) {
  const tgId = toPositiveInt(rawId);
  if (!tgId) {
    await sendText(user.tgId, t(locale, 'adm.cmd.usageUser', { arg: 'telegram_id' }));
    return;
  }
  const target = await getUserByTgId(tgId);
  if (!target) {
    await sendText(user.tgId, t(locale, 'adm.cmd.noUser', { id: tgId }));
    return;
  }
  const data = await getUserDetailData(target.id);
  await logAdminAction(user.tgId, 'admin.view_user', {
    targetType: 'user',
    targetId: target.id,
    metadata: { tgId },
  });
  await sendText(user.tgId, userDetailText(locale, data, 0), {
    replyMarkup: userDetailKeyboard(locale, data, 0),
  });
}

async function showMessages(user, args, locale) {
  const parsed = parseKeyValueArgs(args);
  const page = Math.max(0, (toPositiveInt(parsed.positional[0]) ?? 1) - 1);
  const filters = {
    type: normalizeType(parsed.flags.type),
    days: normalizeDays(parsed.flags.days),
    senderId: null,
    recipientId: null,
  };

  if (parsed.flags.sender) {
    const senderTg = toPositiveInt(parsed.flags.sender);
    const sender = senderTg ? await getUserByTgId(senderTg) : null;
    if (!sender) {
      await sendText(user.tgId, t(locale, 'adm.cmd.noSuchSender'));
      return;
    }
    filters.senderId = sender.id;
  }
  if (parsed.flags.recipient) {
    const recipientTg = toPositiveInt(parsed.flags.recipient);
    const recipient = recipientTg ? await getUserByTgId(recipientTg) : null;
    if (!recipient) {
      await sendText(user.tgId, t(locale, 'adm.cmd.noSuchRecipient'));
      return;
    }
    filters.recipientId = recipient.id;
  }

  const data = await listMessagesPage(filters, page);
  await logAdminAction(user.tgId, 'admin.list_messages', {
    targetType: 'messages',
    targetId: String(page),
    metadata: filters,
  });
  await sendText(user.tgId, messagesText(locale, data, filters), {
    replyMarkup: messagesKeyboard(locale, data, filters),
  });
}

async function showMessage(user, rawId, locale) {
  const id = toPositiveInt(rawId);
  if (!id) {
    await sendText(user.tgId, t(locale, 'adm.cmd.usageMessage', { arg: 'internal_id' }));
    return;
  }
  const data = await getMessageDetailData(id);
  if (!data) {
    await sendText(user.tgId, t(locale, 'adm.cmd.noMessage', { id }));
    return;
  }
  const filters = { type: 'all', days: 0, senderId: null, recipientId: null };
  await logAdminAction(user.tgId, 'admin.view_message', {
    targetType: 'message',
    targetId: id,
    metadata: {},
  });
  await sendText(user.tgId, messageDetailText(locale, data, filters), {
    replyMarkup: messageDetailKeyboard(locale, data, filters, 0),
  });
}

async function showSearch(user, query, locale) {
  const q = String(query ?? '').trim();
  if (!q) {
    await sendText(user.tgId, t(locale, 'adm.cmd.usageSearch', { arg: 'query' }));
    return;
  }
  const data = await searchAllData(q);
  await logAdminAction(user.tgId, 'admin.search', {
    targetType: 'query',
    targetId: q.slice(0, 80),
    metadata: { users: data.users.length, messages: data.messages.length },
  });
  await sendText(user.tgId, searchText(locale, q, data), {
    replyMarkup: searchKeyboard(locale, data),
  });
}

async function doBan(user, args, locale) {
  const tgId = toPositiveInt(args[0]);
  if (!tgId) {
    await sendText(user.tgId, t(locale, 'adm.cmd.usageBan', { arg: 'telegram_id' }));
    return;
  }
  if (tgId === SUPERADMIN_ID) {
    await sendText(user.tgId, t(locale, 'adm.cmd.superadminCannotBan'));
    return;
  }
  const target = await getUserByTgId(tgId);
  if (!target) {
    await sendText(user.tgId, t(locale, 'adm.cmd.noUser', { id: tgId }));
    return;
  }
  const reason = args.slice(1).join(' ').trim() || null;
  await banUser(target.id, reason, user.tgId);
  await logAdminAction(user.tgId, 'admin.ban', {
    targetType: 'user',
    targetId: target.id,
    metadata: { tgId, reason },
  });
  await sendText(target.tgId, t(locale, 'adm.notify.banned'));
  await sendText(user.tgId, t(locale, 'adm.cmd.banned', { id: tgId }));
}

async function doUnban(user, rawId, locale) {
  const tgId = toPositiveInt(rawId);
  if (!tgId) {
    await sendText(user.tgId, t(locale, 'adm.cmd.usageUnban', { arg: 'telegram_id' }));
    return;
  }
  const target = await getUserByTgId(tgId);
  if (!target) {
    await sendText(user.tgId, t(locale, 'adm.cmd.noUser', { id: tgId }));
    return;
  }
  const active = await getActiveBan(target.id);
  if (!active) {
    await sendText(user.tgId, t(locale, 'adm.cmd.notBanned'));
    return;
  }
  await unbanUser(target.id, user.tgId);
  await logAdminAction(user.tgId, 'admin.unban', {
    targetType: 'user',
    targetId: target.id,
    metadata: { tgId },
  });
  await sendText(target.tgId, t(locale, 'adm.notify.unbanned'));
  await sendText(user.tgId, t(locale, 'adm.cmd.unbanned', { id: tgId }));
}

function normalizeType(value) {
  const type = String(value ?? 'all').toLowerCase();
  return ['all', 'text', 'media', 'failed'].includes(type) ? type : 'all';
}

function normalizeDays(value) {
  const days = Number(value);
  if (!Number.isFinite(days) || days <= 0) return 0;
  return Math.min(365, Math.trunc(days));
}
