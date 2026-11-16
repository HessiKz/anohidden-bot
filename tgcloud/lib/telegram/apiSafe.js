import { api, InputFile } from 'sdk';
import { logError, logWarn } from '../util/log.js';
import { MAX_MESSAGE_TEXT } from '../constants.js';
import { truncate } from '../util/html.js';

export function botErrorInfo(error) {
  return {
    code: Number(error?.code ?? 0) || 0,
    description: String(error?.description ?? error?.message ?? 'unknown error').slice(0, 300),
    method: error?.method ?? null,
    retryAfter: Number(error?.parameters?.retry_after ?? 0) || 0,
  };
}

export function isMessageNotModified(error) {
  return botErrorInfo(error).description.toLowerCase().includes('message is not modified');
}

export function isBlockedByRecipient(error) {
  return botErrorInfo(error).code === 403;
}

export function isRetryableServerError(error) {
  const info = botErrorInfo(error);
  return info.code === 429 || info.code >= 500;
}

function isParseError(error) {
  const text = botErrorInfo(error).description.toLowerCase();
  return text.includes('parse entities') || text.includes('unsupported start tag');
}

export async function answerCallback(callbackQuery, text, options = {}) {
  if (!callbackQuery?.id) return;
  try {
    await api.answerCallbackQuery({
      callback_query_id: callbackQuery.id,
      text: truncate(text, 190),
      show_alert: Boolean(options.alert),
    });
  } catch (error) {
    logWarn('answer_callback_failed', { code: botErrorInfo(error).code });
  }
}

export async function sendText(chatId, text, options = {}) {
  const payload = {
    chat_id: chatId,
    text: truncate(text, options.maxLength ?? MAX_MESSAGE_TEXT - 96),
    parse_mode: options.parseMode ?? 'HTML',
    disable_web_page_preview: options.disablePreview ?? true,
    reply_markup: options.replyMarkup,
    reply_to_message_id: options.replyToMessageId,
    allow_sending_without_reply: options.replyToMessageId ? true : undefined,
    disable_notification: options.silent,
  };
  try {
    return await api.sendMessage(payload);
  } catch (error) {
    if (payload.parse_mode && isParseError(error)) {
      try {
        return await api.sendMessage({ ...payload, parse_mode: undefined });
      } catch (retryError) {
        logError('send_text_failed', retryError, { chatId });
        return null;
      }
    }
    logError('send_text_failed', error, { chatId });
    return null;
  }
}

export async function editText(chatId, messageId, text, options = {}) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: truncate(text, options.maxLength ?? MAX_MESSAGE_TEXT - 96),
    parse_mode: options.parseMode ?? 'HTML',
    disable_web_page_preview: true,
    reply_markup: options.replyMarkup,
  };
  try {
    return await api.editMessageText(payload);
  } catch (error) {
    if (isMessageNotModified(error)) return null;
    if (payload.parse_mode && isParseError(error)) {
      try {
        return await api.editMessageText({ ...payload, parse_mode: undefined });
      } catch (retryError) {
        logError('edit_text_failed', retryError, { chatId, messageId });
        return null;
      }
    }
    logError('edit_text_failed', error, { chatId, messageId });
    return null;
  }
}

export async function editReplyMarkup(chatId, messageId, replyMarkup) {
  try {
    return await api.editMessageReplyMarkup({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: replyMarkup,
    });
  } catch (error) {
    if (isMessageNotModified(error)) return null;
    logWarn('edit_markup_failed', { code: botErrorInfo(error).code, chatId, messageId });
    return null;
  }
}

export async function sendDocument(chatId, bytes, filename, caption, options = {}) {
  try {
    return await api.sendDocument({
      chat_id: chatId,
      document: new InputFile(bytes, filename, { type: options.mimeType }),
      caption,
      parse_mode: 'HTML',
      reply_markup: options.replyMarkup,
    });
  } catch (error) {
    logError('send_document_failed', error, { chatId, filename });
    return null;
  }
}
