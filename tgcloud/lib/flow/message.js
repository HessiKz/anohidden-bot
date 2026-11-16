import {
  ADMIN_COMMAND_NAMES,
  USER_COMMAND_NAMES,
} from '../telegram/commands.js';
import { handleAdminCommand } from '../admin/commands.js';
import { handleBroadcastCompose } from '../admin/broadcast.js';
import { getAdminState, clearAdminState } from '../admin/state.js';
import { ADMIN_STATE } from '../constants.js';
import { upsertUser } from '../services/users.js';
import { ensureActiveLink } from '../services/links.js';
import { isBanned } from '../services/moderation.js';
import { getBotUsername, isMessagingEnabled } from '../services/settings.js';
import { isSuperadmin, isPrivateChatFrom } from '../services/permissions.js';
import { consumeRateLimit } from '../services/rateLimit.js';
import { findRoute } from '../services/messages.js';
import { getPendingTarget } from '../services/pending.js';
import { logAdminAction } from '../services/audit.js';
import { sendText } from '../telegram/apiSafe.js';
import { splitCommand } from '../util/validate.js';
import {
  notInConversationText,
  pausedText,
  replyUnavailableText,
  suspendedText,
} from '../ui/user.js';
import { t, localeOf } from '../i18n/index.js';
import { handleUserCommand } from './userCommands.js';
import { handleReplyMessage } from './replies.js';
import { handlePendingMessage } from './pending.js';
import { logWarn } from '../util/log.js';

export async function handleMessage(message) {
  if (!message?.from || message.from.is_bot) return;
  if (!isPrivateChatFrom(message, message.from.id)) return;

  const registered = await upsertUser(message.from);
  if (!registered?.user) return;
  const user = registered.user;
  const locale = localeOf(user);

  // Every registered user owns exactly one active link.
  if (registered.isNew) {
    try {
      await ensureActiveLink(user.id);
    } catch (error) {
      logWarn('initial_link_failed', { userId: user.id, code: error?.code });
    }
  }

  const parsed = splitCommand(message.text);
  if (parsed) {
    await handleCommand(message, user, parsed, locale);
    return;
  }

  if (await isBanned(user.id)) {
    await sendText(user.tgId, suspendedText(locale));
    return;
  }

  if (isSuperadmin(user.tgId)) {
    const state = await getAdminState(user.id);
    if (state?.state === ADMIN_STATE.BROADCAST_COMPOSE) {
      await handleBroadcastCompose(message, user);
      return;
    }
  }

  if (!(await isMessagingEnabled())) {
    await sendText(user.tgId, pausedText(locale));
    return;
  }
  // Native reply routing has priority over a pending deep-link target: the
  // reply's Telegram message reference is the authoritative routing key.
  if (message.reply_to_message?.message_id) {
    const route = await findRoute(
      message.chat.id,
      message.reply_to_message.message_id
    );
    if (route) {
      await handleReplyMessage(message, user, route, locale);
      return;
    }
    if (message.reply_to_message.from?.is_bot) {
      await sendText(user.tgId, replyUnavailableText(locale));
      return;
    }
  }
  const pending = await getPendingTarget(user.id);
  if (pending) {
    await handlePendingMessage(message, user, pending, locale);
    return;
  }
  await sendText(user.tgId, notInConversationText(locale));
}

async function handleCommand(message, user, parsed, locale) {
  if (parsed.mention) {
    try {
      const username = await getBotUsername();
      if (parsed.mention.toLowerCase() !== username.toLowerCase()) return;
    } catch (error) {
      logWarn('command_mention_check_failed', { code: error?.code });
      return;
    }
  }
  const limit = await consumeRateLimit(user.id, 'command', 60, 60);
  if (!limit.allowed) {
    await sendText(user.tgId, t(locale, 'limits.command'));
    return;
  }
  if (ADMIN_COMMAND_NAMES.has(parsed.command)) {
    if (!isSuperadmin(user.tgId) || message.chat.id !== message.from.id) {
      // Authorization is server-side and always fail-closed. Never trust the
      // command text, callback data, or the presence of an admin keyboard.
      await logAdminAction(user.tgId, 'unauthorized_admin_command', {
        targetType: 'command',
        targetId: parsed.command,
        metadata: { command: parsed.command },
      }).catch(() => {});
      await sendText(user.tgId, t(locale, 'adm.cmd.notAvailable'));
      return;
    }
    if (parsed.command !== 'broadcast') await clearAdminState(user.id);
    await handleAdminCommand(message, user, parsed, locale);
    return;
  }
  if (USER_COMMAND_NAMES.has(parsed.command)) {
    if (isSuperadmin(user.tgId)) await clearAdminState(user.id);
    await handleUserCommand(message, user, parsed);
    return;
  }
  await sendText(user.tgId, t(locale, 'user.unknownCommand'));
}
