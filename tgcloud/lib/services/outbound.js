import { api } from 'sdk';
import {
  anonymousMessageKeyboard,
} from '../telegram/keyboards.js';
import {
  botErrorInfo,
  isBlockedByRecipient,
  isRetryableServerError,
} from '../telegram/apiSafe.js';
import { isIdentityPrivileged, isSuperadmin } from './permissions.js';
import {
  detectMessageType,
  describeType,
  hasForwardHeader,
  isMediaType,
} from './messageTypes.js';
import { formatNumber, t } from '../i18n/index.js';
import { logWarn } from '../util/log.js';
import { sendText } from '../telegram/apiSafe.js';

export function recipientCanReveal(recipientUser) {
  return isSuperadmin(recipientUser?.tgId) || isIdentityPrivileged(recipientUser?.tgId);
}

export function keyboardFor(messageRow, recipientUser, locale) {
  const loc = locale ?? recipientUser?.uiLanguage ?? 'fa';
  return anonymousMessageKeyboard(loc, messageRow.publicToken, {
    canReveal: recipientCanReveal(recipientUser),
  });
}

/**
 * Copy a message, with a narrow retry and a type-specific fallback.
 *
 * Retries happen only when Telegram rejected the request (429/5xx). Network
 * errors are never retried because the copy may already have been delivered.
 */
export async function copyMessageWithFallback(sourceMessage, toChatId, replyMarkup) {
  const type = detectMessageType(sourceMessage);

  if (sourceMessage.has_protected_content) {
    return {
      ok: false,
      protected: true,
      code: 400,
      error: new Error('Protected content cannot be mirrored anonymously.'),
    };
  }

  if (hasForwardHeader(sourceMessage)) {
    try {
      const fallback = await sendFallback(sourceMessage, type, toChatId, replyMarkup);
      return { ok: true, messageId: fallback.message_id, via: 'fallback-forward-stripped' };
    } catch (error) {
      const info = botErrorInfo(error);
      return {
        ok: false,
        error,
        code: info.code,
        reason: info.code === 0 ? String(error?.message ?? '').slice(0, 300) : null,
        forwardStripFailed: true,
      };
    }
  }

  const base = {
    chat_id: toChatId,
    from_chat_id: sourceMessage.chat.id,
    message_id: sourceMessage.message_id,
    reply_markup: replyMarkup,
  };

  let copyError = null;
  try {
    const copied = await api.copyMessage(base);
    return { ok: true, messageId: copied.message_id, via: 'copy' };
  } catch (error) {
    copyError = error;
    if (isRetryableServerError(error)) {
      try {
        const copied = await api.copyMessage(base);
        return { ok: true, messageId: copied.message_id, via: 'copy-retry' };
      } catch (retryError) {
        return { ok: false, error: retryError, code: botErrorInfo(retryError).code };
      }
    }
  }

  const info = botErrorInfo(copyError);
  // 403 means the recipient cannot receive bot messages. Never fall back.
  if (info.code === 403) {
    return { ok: false, error: copyError, code: 403, blocked: true };
  }
  // A network failure is ambiguous; returning failure avoids a duplicate.
  if (info.code === 0) {
    return { ok: false, error: copyError, code: 0, ambiguous: true };
  }

  try {
    const fallback = await sendFallback(sourceMessage, type, toChatId, replyMarkup);
    return { ok: true, messageId: fallback.message_id, via: 'fallback' };
  } catch (fallbackError) {
    const fallbackInfo = botErrorInfo(fallbackError);
    return {
      ok: false,
      error: fallbackError,
      code: fallbackInfo.code,
      reason:
        fallbackInfo.code === 0
          ? fallbackError?.name === 'TypeError'
            ? 'This message could not be prepared for Telegram.'
            : String(fallbackError?.message ?? '').slice(0, 300)
          : null,
      copyError: info.description,
    };
  }
}

async function sendFallback(message, type, chatId, replyMarkup) {
  switch (type) {
    case 'text':
      return api.sendMessage({
        chat_id: chatId,
        text: message.text,
        entities: message.entities,
        link_preview_options: message.link_preview_options,
        reply_markup: replyMarkup,
      });
    case 'photo': {
      const photo = message.photo[message.photo.length - 1];
      return api.sendPhoto({
        chat_id: chatId,
        photo: photo.file_id,
        caption: message.caption,
        caption_entities: message.caption_entities,
        show_caption_above_media: message.show_caption_above_media,
        has_spoiler: message.has_media_spoiler,
        reply_markup: replyMarkup,
      });
    }
    case 'video':
      return api.sendVideo({
        chat_id: chatId,
        video: message.video.file_id,
        duration: message.video.duration,
        width: message.video.width,
        height: message.video.height,
        caption: message.caption,
        caption_entities: message.caption_entities,
        show_caption_above_media: message.show_caption_above_media,
        has_spoiler: message.has_media_spoiler,
        supports_streaming: message.video.supports_streaming,
        reply_markup: replyMarkup,
      });
    case 'voice':
      return api.sendVoice({
        chat_id: chatId,
        voice: message.voice.file_id,
        caption: message.caption,
        caption_entities: message.caption_entities,
        duration: message.voice.duration,
        reply_markup: replyMarkup,
      });
    case 'video_note':
      return api.sendVideoNote({
        chat_id: chatId,
        video_note: message.video_note.file_id,
        duration: message.video_note.duration,
        length: message.video_note.length,
        reply_markup: replyMarkup,
      });
    case 'audio':
      return api.sendAudio({
        chat_id: chatId,
        audio: message.audio.file_id,
        caption: message.caption,
        caption_entities: message.caption_entities,
        duration: message.audio.duration,
        performer: message.audio.performer,
        title: message.audio.title,
        reply_markup: replyMarkup,
      });
    case 'document':
      return api.sendDocument({
        chat_id: chatId,
        document: message.document.file_id,
        caption: message.caption,
        caption_entities: message.caption_entities,
        reply_markup: replyMarkup,
      });
    case 'sticker':
      return api.sendSticker({
        chat_id: chatId,
        sticker: message.sticker.file_id,
        reply_markup: replyMarkup,
      });
    case 'animation':
      return api.sendAnimation({
        chat_id: chatId,
        animation: message.animation.file_id,
        caption: message.caption,
        caption_entities: message.caption_entities,
        duration: message.animation.duration,
        width: message.animation.width,
        height: message.animation.height,
        has_spoiler: message.has_media_spoiler,
        reply_markup: replyMarkup,
      });
    case 'contact':
      return api.sendContact({
        chat_id: chatId,
        phone_number: message.contact.phone_number,
        first_name: message.contact.first_name,
        last_name: message.contact.last_name,
        vcard: message.contact.vcard,
        reply_markup: replyMarkup,
      });
    case 'location':
      return api.sendLocation({
        chat_id: chatId,
        latitude: message.location.latitude,
        longitude: message.location.longitude,
        horizontal_accuracy: message.location.horizontal_accuracy,
        live_period: message.location.live_period,
        heading: message.location.heading,
        proximity_alert_radius: message.location.proximity_alert_radius,
        reply_markup: replyMarkup,
      });
    case 'venue':
      return api.sendVenue({
        chat_id: chatId,
        latitude: message.venue.location.latitude,
        longitude: message.venue.location.longitude,
        title: message.venue.title,
        address: message.venue.address,
        foursquare_id: message.venue.foursquare_id,
        foursquare_type: message.venue.foursquare_type,
        google_place_id: message.venue.google_place_id,
        google_place_type: message.venue.google_place_type,
        reply_markup: replyMarkup,
      });
    case 'poll':
      return sendPollFallback(message.poll, chatId, replyMarkup);
    case 'dice':
      return api.sendDice({
        chat_id: chatId,
        emoji: message.dice.emoji,
        reply_markup: replyMarkup,
      });
    default:
      throw new Error(`This ${type} message cannot be mirrored by Telegram.`);
  }
}

async function sendPollFallback(poll, chatId, replyMarkup) {
  if (!poll || !Array.isArray(poll.options)) {
    throw new Error('The poll has no options to copy.');
  }
  if (poll.type === 'quiz' && poll.correct_option_id == null) {
    // Stable machine code; the delivery layer turns it into localized copy.
    throw new Error('quiz_poll_no_answer');
  }

  const params = {
    chat_id: chatId,
    question: poll.question,
    question_entities: poll.question_entities,
    options: poll.options.map((option) =>
      option.text_entities
        ? { text: option.text, text_entities: option.text_entities }
        : option.text
    ),
    is_anonymous: poll.is_anonymous,
    type: poll.type,
    allows_multiple_answers: poll.allows_multiple_answers,
    correct_option_id: poll.correct_option_id,
    explanation: poll.explanation,
    explanation_entities: poll.explanation_entities,
    is_closed: poll.is_closed,
    reply_markup: replyMarkup,
  };
  if (poll.close_date) params.close_date = poll.close_date;
  else if (poll.open_period) params.open_period = poll.open_period;
  return api.sendPoll(params);
}

/**
 * Copy an album as one Telegram media group. On a definite copy failure, retry
 * each item separately so one unsupported item does not lose the whole album.
 * Returns one result per source item, in input order.
 */
export async function copyAlbumWithFallback(sourceMessages, toChatId) {
  if (sourceMessages.some((m) => m.has_protected_content)) {
    return {
      ok: false,
      protected: true,
      code: 400,
      results: sourceMessages.map((source) => ({
        sourceMessageId: source.message_id,
        messageId: null,
        error: new Error('Protected album content cannot be mirrored anonymously.'),
      })),
    };
  }

  // Forward headers are stripped by re-sending each item instead of copying.
  if (sourceMessages.some(hasForwardHeader)) {
    return copyAlbumPerItem(sourceMessages, toChatId, 'per-item-forward-stripped');
  }

  const ids = sourceMessages.map((m) => m.message_id);
  const base = {
    chat_id: toChatId,
    from_chat_id: sourceMessages[0].chat.id,
    message_ids: ids,
  };

  try {
    const copied = await api.copyMessages(base);
    const results = sourceMessages.map((source, index) => ({
      sourceMessageId: source.message_id,
      messageId: copied[index]?.message_id ?? null,
      error: copied[index] ? null : new Error('Telegram returned fewer copied messages.'),
    }));
    return { ok: results.some((r) => r.messageId), results, via: 'copyMessages' };
  } catch (error) {
    const info = botErrorInfo(error);
    if (isRetryableServerError(error)) {
      try {
        const copied = await api.copyMessages(base);
        const results = sourceMessages.map((source, index) => ({
          sourceMessageId: source.message_id,
          messageId: copied[index]?.message_id ?? null,
          error: copied[index] ? null : new Error('Telegram returned fewer copied messages.'),
        }));
        return { ok: results.some((r) => r.messageId), results, via: 'copyMessages-retry' };
      } catch (retryError) {
        return {
          ok: false,
          results: sourceMessages.map((source) => ({
            sourceMessageId: source.message_id,
            messageId: null,
            error: retryError,
          })),
          code: botErrorInfo(retryError).code,
        };
      }
    }
    if (info.code === 403 || info.code === 0) {
      return {
        ok: false,
        results: sourceMessages.map((source) => ({
          sourceMessageId: source.message_id,
          messageId: null,
          error,
        })),
        code: info.code,
        blocked: info.code === 403,
        ambiguous: info.code === 0,
      };
    }
  }

  const results = [];
  for (const source of sourceMessages) {
    const result = await copyMessageWithFallback(source, toChatId, undefined);
    results.push({
      sourceMessageId: source.message_id,
      messageId: result.ok ? result.messageId : null,
      error: result.ok ? null : result.error,
    });
  }
  return {
    ok: results.some((r) => r.messageId),
    results,
    via: 'per-item',
    partial: results.some((r) => !r.messageId),
  };
}

async function copyAlbumPerItem(sourceMessages, toChatId, via) {
  const results = [];
  for (const source of sourceMessages) {
    const result = await copyMessageWithFallback(source, toChatId, undefined);
    results.push({
      sourceMessageId: source.message_id,
      messageId: result.ok ? result.messageId : null,
      error: result.ok ? null : result.error,
    });
  }
  return {
    ok: results.some((r) => r.messageId),
    results,
    via,
    partial: results.some((r) => !r.messageId),
  };
}

export async function sendAlbumControl(chatId, messageRow, recipientUser, count, locale) {
  const loc = locale ?? recipientUser?.uiLanguage ?? 'fa';
  const text = t(loc, 'delivery.albumControl', {
    count: Number(count),
    countText: formatNumber(count, loc),
  });
  try {
    return await api.sendMessage({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: keyboardFor(messageRow, recipientUser, loc),
    });
  } catch (error) {
    logWarn('album_control_failed', { chatId, code: botErrorInfo(error).code });
    return null;
  }
}
export async function sendDeliveryConfirmation(senderTgId, sourceMessageId, text) {
  return sendText(senderTgId, text, {
    replyToMessageId: sourceMessageId,
    maxLength: 1000,
  });
}
export function deliveryFailureText(result, locale = 'fa') {
  if (result?.protected) return t(locale, 'delivery.fail.protected');
  if (result?.blocked) return t(locale, 'delivery.fail.unreachable');
  if (result?.reason === 'quiz_poll_no_answer') {
    return t(locale, 'delivery.unsupported.quizNoAnswer');
  }
  if (result?.reason) return '\u274c ' + result.reason;
  if (result?.code === 400) return t(locale, 'delivery.fail.refused');
  if (result?.code === 429) return t(locale, 'delivery.fail.limited');
  return t(locale, 'delivery.fail.generic');
}
export function describeTypeForConfirmation(type, locale = 'fa') {
  if (isMediaType(type)) return t(locale, 'type.mediaMessage');
  return describeType(type, locale);
}
