import { getMessageById } from '../services/messages.js';
import { getUserById } from '../services/users.js';
import { areBlocked, isBanned } from '../services/moderation.js';
import { isMessagingEnabled } from '../services/settings.js';
import { consumeRateLimit } from '../services/rateLimit.js';
import { submitAnonymousMessage } from '../services/delivery.js';
import { sendText } from '../telegram/apiSafe.js';
import {
  blockedConversationText,
  pausedText,
  replyUnavailableText,
  suspendedText,
} from '../ui/user.js';
import { t } from '../i18n/index.js';
import { logWarn } from '../util/log.js';

/**
 * Route a native Telegram reply using the (chat_id, telegram_message_id) pair
 * supplied by Telegram. The sender is resolved from the stored message, never
 * from anything the client can put in callback data.
 */
export async function handleReplyMessage(message, user, route, locale) {
  const parent = await getMessageById(route.messageId);
  if (!parent) {
    await sendText(user.tgId, replyUnavailableText(locale));
    return;
  }
  let recipientId = null;
  if (Number(user.id) === Number(parent.senderId)) {
    recipientId = parent.recipientId;
  } else if (Number(user.id) === Number(parent.recipientId)) {
    recipientId = parent.senderId;
  }
  if (recipientId === null || Number(recipientId) === Number(user.id)) {
    // A valid route is only ever exposed in the two participants' chats. This
    // branch is a fail-closed guard against inconsistent data.
    logWarn('reply_participant_mismatch', {
      userId: user.id,
      messageId: parent.id,
    });
    await sendText(user.tgId, replyUnavailableText(locale));
    return;
  }
  const recipient = await getUserById(recipientId);
  if (!recipient) {
    await sendText(user.tgId, replyUnavailableText(locale));
    return;
  }
  if (await isBanned(user.id)) {
    await sendText(user.tgId, suspendedText(locale));
    return;
  }
  if (await isBanned(recipient.id)) {
    await sendText(user.tgId, t(locale, 'user.blockedConversation'));
    return;
  }
  if (!(await isMessagingEnabled())) {
    await sendText(user.tgId, pausedText(locale));
    return;
  }
  if (await areBlocked(user.id, recipient.id)) {
    await sendText(user.tgId, blockedConversationText(locale));
    return;
  }
  const limit = await consumeRateLimit(user.id, 'send', 30, 60);
  if (!limit.allowed) {
    await sendText(user.tgId, t(locale, 'limits.send'));
    return;
  }
  await submitAnonymousMessage({
    senderUser: user,
    recipientUser: recipient,
    sourceMessage: message,
    parentMessage: parent,
  });
}
