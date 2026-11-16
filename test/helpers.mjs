// Shared integration-test harness. Import this after `test/setup.mjs` (or via
// this module, which imports setup first). Production modules are imported
// dynamically so the loader hook is registered before their `sdk` imports
// resolve.
import './setup.mjs';

import assert from 'node:assert/strict';
import {
  and,
  applySchema,
  db,
  eq,
  resetDatabase,
  __getSqlite,
} from './mock-sdk/db.js';
import {
  __getApiState,
  __resetApi,
  __setBlockedChat,
} from './mock-sdk/index.js';

process.env.ALBUM_SETTLE_MS ??= '50';

const DB_PATH =
  process.env.ANON_TEST_DB || `/tmp/opencode/anon-test-${process.pid}.sqlite`;

let prod = null;
let updateId = 1;
let userMessageId = 1;
let callbackId = 1;

export async function setupTest() {
  __resetApi();
  resetDatabase(DB_PATH);

  if (!prod) {
    prod = {
      schema: await import('../tgcloud/schema.js'),
      messageHandler: (await import('../tgcloud/handlers/message.js')).default,
      callbackHandler: (await import('../tgcloud/handlers/callback_query.js')).default,
      constants: await import('../tgcloud/lib/constants.js'),
      users: await import('../tgcloud/lib/services/users.js'),
      links: await import('../tgcloud/lib/services/links.js'),
      messages: await import('../tgcloud/lib/services/messages.js'),
      moderation: await import('../tgcloud/lib/services/moderation.js'),
      settings: await import('../tgcloud/lib/services/settings.js'),
      permissions: await import('../tgcloud/lib/services/permissions.js'),
      audit: await import('../tgcloud/lib/services/audit.js'),
      commands: await import('../tgcloud/lib/telegram/commands.js'),
      delivery: await import('../tgcloud/lib/services/delivery.js'),
      setupEndpoint: (await import('../tgcloud/endpoints/setup.js')).default,
    };
  }

  applySchema(prod.schema);
  updateId = 1;
  userMessageId = 1;
  callbackId = 1;
  return prod;
}

export function getProd() {
  assert(prod, 'setupTest() must be called first');
  return prod;
}

export function apiState() {
  return __getApiState();
}

export function makeUser(id, extra = {}) {
  return {
    id: Number(id),
    is_bot: false,
    first_name: `User ${id}`,
    last_name: null,
    username: `user_${id}`,
    language_code: 'en',
    ...extra,
  };
}

export async function sendFrom(userOrId, content, options = {}) {
  const p = getProd();
  const user = typeof userOrId === 'object' ? userOrId : makeUser(userOrId);
  const messageId = options.messageId ?? userMessageId++;
  const message = {
    message_id: messageId,
    from: { ...user, is_bot: false },
    chat: { id: Number(user.id), type: 'private' },
    date: Math.floor(Date.now() / 1000),
    ...(typeof content === 'string' ? { text: content } : content || {}),
  };

  // Make user-sent messages visible to the mock's copyMessage source lookup.
  const state = apiState();
  const list = state.messages.get(Number(user.id)) ?? [];
  list.push(message);
  state.messages.set(Number(user.id), list);

  const usedUpdateId = options.updateId ?? updateId++;
  await p.messageHandler(message, { update: { update_id: usedUpdateId } });
  return message;
}

export function sendStart(userOrId, options = {}) {
  return sendFrom(userOrId, '/start', options);
}

export function openLink(userOrId, token, options = {}) {
  return sendFrom(userOrId, `/start ${token}`, options);
}

export async function click(userOrId, data, options = {}) {
  const p = getProd();
  const user = typeof userOrId === 'object' ? userOrId : makeUser(userOrId);
  const chatId = Number(options.chatId ?? user.id);
  const messageId = options.messageId ?? lastBotMessage(chatId)?.message_id;
  assert(messageId, `no bot message in chat ${chatId} for callback`);
  const callback = {
    id: `cbq_${callbackId++}`,
    from: { ...user, is_bot: false },
    message: {
      message_id: messageId,
      date: Math.floor(Date.now() / 1000),
      chat: { id: chatId, type: 'private' },
      text: options.text ?? '',
    },
    chat_instance: 'test',
    data,
  };
  await p.callbackHandler(callback, {
    update: { update_id: options.updateId ?? updateId++ },
  });
  return callback;
}

export async function getUser(tgId) {
  const p = getProd();
  return db
    .select()
    .from(p.schema.users)
    .where(eq(p.schema.users.tgId, Number(tgId)))
    .get();
}

export async function getActiveLink(tgId) {
  const p = getProd();
  const user = await getUser(tgId);
  if (!user) return null;
  return db
    .select()
    .from(p.schema.userLinks)
    .where(
      and(
        eq(p.schema.userLinks.userId, user.id),
        eq(p.schema.userLinks.isActive, true)
      )
    )
    .get();
}

export async function getToken(tgId) {
  const link = await getActiveLink(tgId);
  assert(link, `user ${tgId} has no active link`);
  return link.token;
}

export function botMessages(chatId) {
  return (apiState().messages.get(Number(chatId)) ?? []).filter(
    (m) => m.from?.is_bot
  );
}

export function lastBotMessage(chatId) {
  const list = botMessages(chatId);
  return list[list.length - 1] ?? null;
}

export function lastTextContaining(chatId, needle) {
  const list = botMessages(chatId).filter((m) =>
    String(m.text ?? m.caption ?? '').includes(needle)
  );
  return list[list.length - 1];
}

export function queueFailure(method, code, description = `simulated ${code}`, parameters = null) {
  apiState().failNext.push({ method, code, description, parameters });
}

export function callsFor(method, chatId) {
  return calls(method).filter((c) => Number(c.params?.chat_id) === Number(chatId));
}

export function calls(method) {
  return apiState().calls.filter((c) => c.method === method);
}

export function lastCall(method, predicate = () => true) {
  const list = calls(method).filter(predicate);
  return list[list.length - 1] ?? null;
}

export function buttons(chatId, messageId) {
  const message = botMessages(chatId).find((m) => m.message_id === messageId);
  const rows = message?.reply_markup?.inline_keyboard ?? [];
  return rows.flat();
}

export function buttonByText(chatId, messageId, text) {
  return buttons(chatId, messageId).find((b) => b.text.includes(text)) ?? null;
}

export function buttonByPrefix(chatId, messageId, prefix) {
  return buttons(chatId, messageId).find((b) =>
    String(b.callback_data ?? '').startsWith(prefix)
  ) ?? null;
}

export function setBlockedChat(chatId, blocked) {
  __setBlockedChat(chatId, blocked);
}

export function rawSqlite() {
  return __getSqlite();
}

export function testDbPath() {
  return DB_PATH;
}
