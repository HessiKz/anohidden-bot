// mock-sdk/api.js — in-memory Telegram Bot API mock for the `sdk` virtual module.
//
// Mirrors the documented `api` surface: every method resolves to the unwrapped
// Bot API `result` (no {ok, result} envelope) and throws BotApiError on
// failure. All successful sends/copies allocate a monotonically increasing
// message_id per chat (starting at 1000), record the call, and store the
// message. Failures are driven by test state — no real network anywhere.

// ---------------------------------------------------------------------------
// Error / value classes (same shapes the platform SDK exports)
// ---------------------------------------------------------------------------

export class BotApiError extends Error {
  constructor({ code, description, method, parameters }) {
    super(`${method || 'bot'}: ${description ?? 'unknown error'}`);
    this.name = 'BotApiError';
    this.code = code; // Bot API error_code: 400 / 403 / 429 / …
    this.description = description;
    this.method = method;
    this.parameters = parameters ?? null; // e.g. { retry_after: 3 }
  }
}

export class InputFile {
  constructor(bytes, filename, opts = {}) {
    this.bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    this.filename = filename;
    this.type = opts.type ?? null;
  }
}

export class EndpointError extends Error {
  constructor(description, parameters) {
    if (typeof description !== 'string') {
      throw new TypeError('EndpointError: description must be a string');
    }
    if (
      parameters !== undefined &&
      (parameters === null || typeof parameters !== 'object' || Array.isArray(parameters))
    ) {
      throw new TypeError('EndpointError: parameters must be a plain object');
    }
    super(description);
    this.name = 'EndpointError';
    this.description = description;
    this.parameters = parameters ?? {};
  }
}

/** Minimal FormData stand-in (multipart is never interpreted by the mock). */
export class FormData {
  #entries = [];
  append(key, value) {
    this.#entries.push([String(key), value]);
  }
  get(key) {
    const hit = this.#entries.find(([k]) => k === key);
    return hit ? hit[1] : null;
  }
  entries() {
    return this.#entries[Symbol.iterator]();
  }
  [Symbol.iterator]() {
    return this.#entries[Symbol.iterator]();
  }
}

/** The project never uses outbound HTTP in tests; fail loudly. */
export async function fetch() {
  throw new Error('mock-sdk: fetch is not used by the test harness');
}
fetch.body = {
  json: (v) => JSON.stringify(v),
  form: (v) => new URLSearchParams(v).toString(),
  text: (v) => String(v),
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export const __state = {
  /** Every api.<method> call, success or failure, in order. */
  calls: [],
  /** chat_id → array of stored Message objects. */
  messages: new Map(),
  /** chat_id → last allocated message_id (monotonic, starts at 1000). */
  seq: new Map(),
  /** chat_ids that fail all sends with 403 "blocked by the user". */
  blockedChats: new Set(),
  /** Consumable failures: [{ method, code, description, parameters }]. */
  failNext: [],
  /** getMyCommands/setMyCommands storage keyed by normalized scope. */
  commands: new Map(),
  /** Identity returned by getMe. */
  bot: {
    id: 987654321,
    is_bot: true,
    first_name: 'Harness',
    username: 'harness_bot',
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
  },
};

export function __resetApi() {
  __state.calls = [];
  __state.messages = new Map();
  __state.seq = new Map();
  __state.blockedChats = new Set();
  __state.failNext = [];
  __state.commands = new Map();
}

export function __getApiState() {
  return __state;
}

export function __setBlockedChat(chatId, blocked) {
  if (blocked) __state.blockedChats.add(Number(chatId));
  else __state.blockedChats.delete(Number(chatId));
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function record(method, params, result) {
  __state.calls.push({ method, params, result, at: Date.now() });
}

function recordError(method, params, error) {
  __state.calls.push({
    method,
    params,
    error: { code: error.code, description: error.description },
    at: Date.now(),
  });
}

/** Consume the first queued failure matching this method (order preserved). */
function consumeFailure(method) {
  const idx = __state.failNext.findIndex(
    (f) => f.method === method || f.method === '*'
  );
  if (idx === -1) return null;
  const f = __state.failNext.splice(idx, 1)[0];
  return new BotApiError({
    code: f.code,
    description: f.description ?? `simulated failure (${f.code})`,
    method,
    parameters: f.parameters,
  });
}

function chatIdOf(params) {
  return params?.chat_id == null ? null : Number(params.chat_id);
}

function nextMessageId(chatId) {
  const next = (__state.seq.get(chatId) ?? 999) + 1;
  __state.seq.set(chatId, next);
  return next;
}

function checkChat(chatId, method) {
  if (chatId != null && __state.blockedChats.has(chatId)) {
    throw new BotApiError({
      code: 403,
      description: 'Forbidden: bot was blocked by the user',
      method,
      parameters: null,
    });
  }
}

function baseMessage(chatId, messageId, extra = {}) {
  const chat =
    typeof chatId === 'number' && chatId < 0
      ? { id: chatId, type: 'group' }
      : { id: chatId, type: 'private' };
  return {
    message_id: messageId,
    from: { ...__state.bot },
    chat,
    date: Math.floor(Date.now() / 1000),
    ...extra,
  };
}

// Content field each send* method stores, keyed by its Bot API parameter.
const SEND_FIELDS = {
  sendMessage: ['text', 'parse_mode', 'reply_markup', 'reply_to_message_id'],
  sendPoll: ['question', 'options', 'is_anonymous', 'allows_multiple_answers'],
  sendContact: ['phone_number', 'first_name', 'last_name'],
  sendLocation: ['latitude', 'longitude'],
  sendVenue: ['latitude', 'longitude', 'title', 'address'],
  sendDice: ['emoji'],
};

function dispatchSend(method, params) {
  const fail = consumeFailure(method);
  if (fail) {
    recordError(method, params, fail);
    throw fail;
  }
  const chatId = chatIdOf(params);
  checkChat(chatId, method);
  const message = baseMessage(chatId, nextMessageId(chatId));
  for (const field of SEND_FIELDS[method] ?? []) {
    if (params?.[field] !== undefined) message[field] = params[field];
  }
  // File-based sends: record the media field as a small descriptor.
  const mediaField = {
    sendSticker: 'sticker',
    sendAnimation: 'animation',
    sendDocument: 'document',
    sendPhoto: 'photo',
    sendVideo: 'video',
    sendVoice: 'voice',
    sendVideoNote: 'video_note',
    sendAudio: 'audio',
  }[method];
  if (mediaField) {
    const v = params?.[mediaField];
    message[mediaField] =
      v instanceof InputFile
        ? { file_id: `mock-${method}-${message.message_id}`, file_name: v.filename, is_mock_upload: true }
        : v; // file_id string or input media object
  }
  if (params?.caption !== undefined) message.caption = params.caption;
  if (params?.parse_mode !== undefined) message.parse_mode = params.parse_mode;
  if (params?.reply_markup !== undefined) message.reply_markup = params.reply_markup;

  const list = __state.messages.get(chatId) ?? [];
  list.push(message);
  __state.messages.set(chatId, list);
  record(method, params, message);
  return message;
}

function findStoredMessage(chatId, messageId) {
  const list = __state.messages.get(Number(chatId)) ?? [];
  return list.find((m) => m.message_id === Number(messageId)) ?? null;
}

function dispatchEdit(method, params) {
  const fail = consumeFailure(method);
  if (fail) {
    recordError(method, params, fail);
    throw fail;
  }
  const chatId = chatIdOf(params);
  checkChat(chatId, method);
  const message = findStoredMessage(chatId, params?.message_id);
  if (!message) {
    const err = new BotApiError({
      code: 400,
      description: `Bad Request: message to edit not found`,
      method,
      parameters: null,
    });
    recordError(method, params, err);
    throw err;
  }
  if (method === 'editMessageText') {
    message.text = params.text;
    if (params.parse_mode !== undefined) message.parse_mode = params.parse_mode;
    if (params.reply_markup !== undefined) message.reply_markup = params.reply_markup;
    else delete message.reply_markup;
  } else if (method === 'editMessageReplyMarkup') {
    if (params.reply_markup !== undefined) message.reply_markup = params.reply_markup;
  }
  record(method, params, message);
  return message;
}

function scopeKey(scope) {
  // Bot API scope objects are normalized into a stable JSON key.
  if (!scope || Object.keys(scope).length === 0) return '{}';
  return JSON.stringify(scope, Object.keys(scope).sort());
}

function dispatch(method, params) {
  switch (method) {
    case 'getMe': {
      const fail = consumeFailure(method);
      if (fail) {
        recordError(method, params, fail);
        throw fail;
      }
      const me = { ...__state.bot };
      record(method, params, me);
      return me;
    }
    case 'copyMessage': {
      const fail = consumeFailure(method);
      if (fail) {
        recordError(method, params, fail);
        throw fail;
      }
      const chatId = chatIdOf(params);
      checkChat(chatId, method);
      const source = findStoredMessage(params?.from_chat_id, params?.message_id);
      const message = baseMessage(chatId, nextMessageId(chatId));
      if (source) {
        // Copy content fields (never identity fields) from the source message.
        for (const key of [
          'text',
          'parse_mode',
          'caption',
          'document',
          'photo',
          'video',
          'voice',
          'video_note',
          'animation',
          'sticker',
          'audio',
          'poll',
          'contact',
          'location',
          'venue',
          'dice',
        ]) {
          if (source[key] !== undefined) message[key] = source[key];
        }
      }
      message.is_automatic_forward = false;
      if (params?.reply_markup !== undefined) message.reply_markup = params.reply_markup;
      const list = __state.messages.get(chatId) ?? [];
      list.push(message);
      __state.messages.set(chatId, list);
      const result = { message_id: message.message_id };
      record(method, params, result);
      return result;
    }
    case 'copyMessages': {
      const fail = consumeFailure(method);
      if (fail) {
        recordError(method, params, fail);
        throw fail;
      }
      const chatId = chatIdOf(params);
      checkChat(chatId, method);
      const ids = params?.message_ids ?? [];
      const result = ids.map((id) => ({ message_id: nextMessageId(chatId) }));
      for (let i = 0; i < ids.length; i++) {
        const source = findStoredMessage(params?.from_chat_id, ids[i]);
        const message = baseMessage(chatId, result[i].message_id);
        if (source) {
          for (const key of ['text', 'parse_mode', 'caption', 'document', 'photo']) {
            if (source[key] !== undefined) message[key] = source[key];
          }
        }
        const list = __state.messages.get(chatId) ?? [];
        list.push(message);
        __state.messages.set(chatId, list);
      }
      record(method, params, result);
      return result;
    }
    case 'sendMediaGroup': {
      const fail = consumeFailure(method);
      if (fail) {
        recordError(method, params, fail);
        throw fail;
      }
      const chatId = chatIdOf(params);
      checkChat(chatId, method);
      const media = params?.media ?? [];
      const groupId = `mock-album-${Date.now()}-${nextMessageId(chatId)}`;
      const result = media.map((m, i) => {
        const message = baseMessage(chatId, nextMessageId(chatId), { media_group_id: groupId });
        message[m.type] =
          m.media instanceof InputFile
            ? { file_id: `mock-${m.type}-${message.message_id}`, file_name: m.media.filename, is_mock_upload: true }
            : m.media;
        if (m.caption !== undefined) message.caption = m.caption;
        if (i === 0 && params.caption !== undefined) message.caption = params.caption;
        const list = __state.messages.get(chatId) ?? [];
        list.push(message);
        __state.messages.set(chatId, list);
        return message;
      });
      record(method, params, result);
      return result;
    }
    case 'editMessageText':
    case 'editMessageReplyMarkup':
      return dispatchEdit(method, params);
    case 'deleteMessage': {
      const fail = consumeFailure(method);
      if (fail) {
        recordError(method, params, fail);
        throw fail;
      }
      const chatId = chatIdOf(params);
      checkChat(chatId, method);
      const list = __state.messages.get(chatId) ?? [];
      const idx = list.findIndex((m) => m.message_id === Number(params?.message_id));
      if (idx === -1) {
        const err = new BotApiError({
          code: 400,
          description: 'Bad Request: message to delete not found',
          method,
          parameters: null,
        });
        recordError(method, params, err);
        throw err;
      }
      list.splice(idx, 1);
      record(method, params, true);
      return true;
    }
    case 'answerCallbackQuery': {
      const fail = consumeFailure(method);
      if (fail) {
        recordError(method, params, fail);
        throw fail;
      }
      record(method, params, true);
      return true;
    }
    case 'setMyCommands': {
      const fail = consumeFailure(method);
      if (fail) {
        recordError(method, params, fail);
        throw fail;
      }
      __state.commands.set(scopeKey(params?.scope), params?.commands ?? []);
      record(method, params, true);
      return true;
    }
    case 'getMyCommands': {
      const fail = consumeFailure(method);
      if (fail) {
        recordError(method, params, fail);
        throw fail;
      }
      const result = __state.commands.get(scopeKey(params?.scope)) ?? [];
      record(method, params, result);
      return result;
    }
    default: {
      if (method.startsWith('send') && params && chatIdOf(params) != null) {
        // Generic send fallback (e.g. future send* methods): behaves like a send.
        return dispatchSend(method, params);
      }
      const fail = consumeFailure(method);
      if (fail) {
        recordError(method, params, fail);
        throw fail;
      }
      record(method, params, true);
      return true;
    }
  }
}

// Proxy dispatch: every Bot API method name resolves to a call through
// `dispatch`, so any current (or future) method works.
export const api = new Proxy(
  {},
  {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined;
      return (params) => Promise.resolve().then(() => dispatch(prop, params));
    },
  }
);
