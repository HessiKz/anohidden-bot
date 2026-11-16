import {
  ALBUM_SETTLE_MS,
  MESSAGE_STATUS,
} from '../constants.js';
import {
  claimAlbumGroup,
  createConversation,
  createMessage,
  createRoute,
  ensureAlbumConversation,
  getConversation,
  insertAttachments,
  listRoutesForMessage,
  markMessageDelivered,
  markMessageFailed,
  setConversationRoot,
  setConversationRootIfEmpty,
  touchConversation,
} from './messages.js';
import {
  copyAlbumWithFallback,
  copyMessageWithFallback,
  deliveryFailureText,
  keyboardFor,
  sendAlbumControl,
  sendDeliveryConfirmation,
} from './outbound.js';
import {
  detectMessageType,
  extractAttachments,
  sanitizeMessagePayload,
  unsupportedReason,
} from './messageTypes.js';
import { sleep } from '../util/sleep.js';
import { logError } from '../util/log.js';
import { formatNumber, t, localeOf } from '../i18n/index.js';

const EARLY_UNSUPPORTED_TYPES = new Set([
  'invoice',
  'successful_payment',
  'story',
  'giveaway',
  'giveaway_winners',
  'giveaway_created',
]);

/**
 * Store and deliver one anonymous message (or one item of a media group).
 *
 * `parentMessage` is an already-verified internal message for a native Telegram
 * reply. It is never taken from callback data or a user-supplied id.
 */
export async function submitAnonymousMessage({
  senderUser,
  recipientUser,
  sourceMessage,
  parentMessage = null,
}) {
  const type = detectMessageType(sourceMessage);
  const isAlbum = Boolean(sourceMessage.media_group_id);
  const sourceChatId = Number(sourceMessage.chat.id);
  const sourceMessageId = Number(sourceMessage.message_id);

  let conversation;
  if (parentMessage) {
    conversation = await getConversation(parentMessage.conversationId);
  } else if (isAlbum) {
    conversation = await ensureAlbumConversation(
      senderUser.id,
      recipientUser.id,
      sourceChatId,
      sourceMessage.media_group_id
    );
  } else {
    conversation = await createConversation(senderUser.id, recipientUser.id);
  }
  if (!conversation) throw new Error('Could not create or load the conversation.');

  const parentId = parentMessage ? Number(parentMessage.id) : null;
  const rootId = parentMessage
    ? Number(parentMessage.rootId ?? conversation.rootMessageId ?? parentMessage.id)
    : null;

  const { message, created } = await createMessage({
    conversationId: conversation.id,
    senderId: senderUser.id,
    recipientId: recipientUser.id,
    parentId,
    rootId,
    messageType: type,
    content: sourceMessage.text ?? sourceMessage.caption ?? null,
    payload: sanitizeMessagePayload(sourceMessage),
    mediaGroupId: sourceMessage.media_group_id ?? null,
    sourceChatId,
    sourceMessageId,
    deliveryStatus: isAlbum ? MESSAGE_STATUS.PENDING_ALBUM : MESSAGE_STATUS.PENDING,
    isAlbum,
  });

  if (created) {
    await insertAttachments(message.id, extractAttachments(sourceMessage, type));
    if (!parentMessage && !isAlbum) {
      await setConversationRoot(conversation.id, message.id);
    }
    if (!parentMessage && isAlbum) {
      await setConversationRootIfEmpty(conversation.id, message.id);
    }
  }

  await touchConversation(conversation.id);

  if (isAlbum) {
    if (message.deliveryStatus === MESSAGE_STATUS.DELIVERED) {
      return { duplicate: true, delivered: true, message };
    }
    if (message.deliveryStatus === MESSAGE_STATUS.FAILED) {
      return { duplicate: true, delivered: false, message };
    }
    if (created) await sleep(ALBUM_SETTLE_MS);
    return deliverAlbumGroup({
      senderUser,
      recipientUser,
      sourceChatId,
      mediaGroupId: sourceMessage.media_group_id,
    });
  }

  if (!created && message.deliveryStatus === MESSAGE_STATUS.DELIVERED) {
    return { duplicate: true, delivered: true, message };
  }
  if (!created && message.deliveryStatus === MESSAGE_STATUS.FAILED) {
    return { duplicate: true, delivered: false, message };
  }
  if (!created) {
    // A route row is proof that Telegram accepted the copy even if a later DB
    // write was interrupted. Never deliver the same source twice.
    const routes = await listRoutesForMessage(message.id);
    if (routes.length > 0) {
      return { duplicate: true, delivered: true, message, routes };
    }
    if (message.deliveryStatus === MESSAGE_STATUS.DELIVERING) {
      return { duplicate: true, delivered: false, message, ambiguous: true };
    }
  }

  const senderLocale = localeOf(senderUser);
  const recipientLocale = localeOf(recipientUser);
  if (type === 'unsupported' || EARLY_UNSUPPORTED_TYPES.has(type)) {
    const reason = unsupportedReason(sourceMessage, type);
    await markMessageFailed(message.id, reason);
    await sendDeliveryConfirmation(
      senderUser.tgId,
      sourceMessageId,
      t(senderLocale, `delivery.unsupported.${reason}`)
    );
    return { delivered: false, message, reason };
  }


  try {
    const keyboard = keyboardFor(message, recipientUser, recipientLocale);
    const result = await copyMessageWithFallback(
      sourceMessage,
      recipientUser.tgId,
      keyboard
    );

    if (!result.ok) {
      const code = result.code ?? 0;
      await markMessageFailed(
        message.id,
        result.reason
          ? result.reason.slice(0, 500)
          : result.protected
            ? 'protected_content'
            : `telegram_error_${code}`
      );
      await sendDeliveryConfirmation(
        senderUser.tgId,
        sourceMessageId,
        deliveryFailureText(result, senderLocale)
      );
      return { delivered: false, message, reason: deliveryFailureText(result, senderLocale) };
    }

    await createRoute(message.id, recipientUser.tgId, result.messageId, false);
    await markMessageDelivered(message.id, {
      chatId: recipientUser.tgId,
      telegramMessageId: result.messageId,
    });
    await sendDeliveryConfirmation(
      senderUser.tgId,
      sourceMessageId,
      t(senderLocale, 'delivery.confirmed')
    );
    return { delivered: true, message, deliveredMessageId: result.messageId };
  } catch (error) {
    logError('single_delivery_failed', error, {
      messageId: message.id,
      senderId: senderUser.id,
      recipientId: recipientUser.id,
    });
    await markMessageFailed(message.id, 'internal_delivery_error');
    await sendDeliveryConfirmation(
      senderUser.tgId,
      sourceMessageId,
      t(senderLocale, 'delivery.fail.generic')
    );
    return { delivered: false, message, error };
  }
}

/**
 * Claim every currently pending item of a media group atomically, then deliver
 * it as one Telegram album. Items that arrive after the claim form a later
 * group; the short settle delay makes that rare.
 */
export async function deliverAlbumGroup({
  senderUser,
  recipientUser,
  sourceChatId,
  mediaGroupId,
}) {
  const claimed = await claimAlbumGroup(sourceChatId, mediaGroupId);
  if (!claimed.length) {
    return { claimed: 0, delivered: false };
  }

  const rows = claimed
    .map((row) => ({
      ...row,
      publicToken: row.public_token,
      sourceMessageId: row.source_message_id,
      sourceChatId: row.source_chat_id,
      conversationId: row.conversation_id,
      parsedPayload: safeJson(row.payload),
    }))
    .sort((a, b) => Number(a.source_message_id) - Number(b.source_message_id));

  const sourceMessages = rows.map((row) => ({
    ...(row.parsedPayload ?? {}),
    message_id: Number(row.source_message_id),
    chat: { id: Number(row.source_chat_id) },
  }));

  let firstSuccess = null;
  let successCount = 0;
  const deliveredIds = new Set();
  try {
    const result = await copyAlbumWithFallback(sourceMessages, recipientUser.tgId);
    const bySource = new Map(result.results.map((item) => [item.sourceMessageId, item]));

    for (const row of rows) {
      const item = bySource.get(Number(row.source_message_id));
      if (item?.messageId) {
        await createRoute(row.id, recipientUser.tgId, item.messageId, false);
        deliveredIds.add(row.id);
        await markMessageDelivered(row.id, {
          chatId: recipientUser.tgId,
          telegramMessageId: item.messageId,
          isAlbum: true,
        });
        successCount++;
        if (!firstSuccess) firstSuccess = row;
      } else {
        await markMessageFailed(row.id, 'album_item_failed');
      }
    }

    if (firstSuccess) {
      const control = await sendAlbumControl(
        recipientUser.tgId,
        firstSuccess,
        recipientUser,
        successCount,
        localeOf(recipientUser)
      );
      if (control) {
        await createRoute(firstSuccess.id, recipientUser.tgId, control.message_id, true);
      }
    }

    const total = rows.length;
    if (successCount === total) {
      await sendDeliveryConfirmation(
        senderUser.tgId,
        Number(rows[0].source_message_id),
        t(localeOf(senderUser), 'delivery.albumDone', {
          count: successCount,
          countText: formatNumber(successCount, localeOf(senderUser)),
          totalText: formatNumber(total, localeOf(senderUser)),
        })
      );
    } else if (successCount > 0) {
      await sendDeliveryConfirmation(
        senderUser.tgId,
        Number(rows[0].source_message_id),
        t(localeOf(senderUser), 'delivery.albumPartial', {
          success: successCount,
          total,
          successText: formatNumber(successCount, localeOf(senderUser)),
          totalText: formatNumber(total, localeOf(senderUser)),
        })
      );
    } else {
      await sendDeliveryConfirmation(
        senderUser.tgId,
        Number(rows[0].source_message_id),
        result.protected
          ? t(localeOf(senderUser), 'delivery.unsupported.albumProtected')
          : t(localeOf(senderUser), 'delivery.unsupported.albumGeneric')
      );
    }

    return { claimed: total, delivered: successCount > 0, successCount };
  } catch (error) {
    logError('album_delivery_failed', error, {
      sourceChatId,
      mediaGroupId,
      count: rows.length,
    });
    for (const row of rows) {
      if (!deliveredIds.has(row.id)) {
        await markMessageFailed(row.id, 'album_delivery_error');
      }
    }
    await sendDeliveryConfirmation(
      senderUser.tgId,
      Number(rows[0].source_message_id),
      t(localeOf(senderUser), 'delivery.fail.generic')
    );
    return { claimed: rows.length, delivered: false, error };
  }
}

function safeJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
