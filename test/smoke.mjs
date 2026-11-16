// test/smoke.mjs — end-to-end check of the mock SDK against the real schema.
// Run: node test/smoke.mjs
import './setup.mjs';

import assert from 'node:assert/strict';
import {
  db,
  sql,
  eq,
  and,
  like,
  inArray,
  isNotNull,
  desc,
  applySchema,
  resetDatabase,
  __getSqlite,
} from './mock-sdk/db.js';
import { api, __resetApi, __getApiState, __setBlockedChat, BotApiError, EndpointError, InputFile } from './mock-sdk/index.js';

const DB_PATH = process.env.ANON_TEST_DB || '/tmp/opencode/anon-test.sqlite';
resetDatabase(DB_PATH);

// 1. Import the production schema through the loader hook and create all tables.
const schema = await import('/home/tgcloud/schema.js');
const created = applySchema(schema);
console.log(`schema applied: ${created.length} tables`);
assert(created.includes('users') && created.includes('messages'));

// 2. Insert a user; timestamp + boolean columns convert at the wire.
const created1 = new Date('2026-01-02T03:04:05Z');
await db
  .insert(schema.users)
  .values({ tgId: 4242, username: 'smoke_user', isBot: true, createdAt: created1, updatedAt: created1 })
  .run();

const user = await db.select().from(schema.users).where(eq(schema.users.tgId, 4242)).get();
assert(user, 'user round-trip');
assert.equal(user.isBot, true, 'boolean 0/1 → true');
assert(user.createdAt instanceof Date, 'timestamp int → Date');
assert.equal(user.createdAt.toISOString(), created1.toISOString(), 'timestamp seconds round-trip');
assert.equal(typeof user.id, 'number', 'AUTOINCREMENT id');

// Boolean false reads as false, not 0.
const u2 = await db
  .insert(schema.users)
  .values({ tgId: 4243, username: 'smoke_false' })
  .returning();
assert.equal(u2[0].isBot, false, 'default false (not 0)');

// 3. json payload column round-trips.
await db.insert(schema.messages).values({
  conversationId: 1,
  senderId: user.id,
  recipientId: 2,
  publicToken: 'tok_smoke',
  messageType: 'text',
  payload: { editHistory: ['one', 'two'], edited: true },
  sourceChatId: 555,
  sourceMessageId: 1001,
  deliveredChatId: 555,
  deliveredMessageId: 1000,
  deliveryStatus: 'delivered',
});
const msg = await db.select().from(schema.messages).where(eq(schema.messages.publicToken, 'tok_smoke')).get();
assert.deepEqual(msg.payload, { editHistory: ['one', 'two'], edited: true }, 'json stringify/parse');
assert(msg.createdAt instanceof Date, 'default (unixepoch()) → Date');

// 4. Builders: update, $count, onConflict, delete, operators.
await db
  .insert(schema.users)
  .values({ tgId: 4242, username: 'dup' })
  .onConflictDoNothing({ target: schema.users.tgId })
  .run();
assert.equal(await db.$count(schema.users), 2, 'onConflictDoNothing kept unique constraint');

await db
  .insert(schema.users)
  .values({ tgId: 4242, username: 'first' })
  .onConflictDoUpdate({ target: schema.users.tgId, set: { username: 'upserted' } })
  .run();
const upserted = await db.select().from(schema.users).where(eq(schema.users.tgId, 4242)).get();
assert.equal(upserted.username, 'upserted', 'onConflictDoUpdate applied');

await db.update(schema.users).set({ username: 'renamed' }).where(eq(schema.users.id, upserted.id)).run();
assert.equal((await db.select().from(schema.users).where(eq(schema.users.id, upserted.id)).get()).username, 'renamed');

assert.equal(await db.$count(schema.users, like(schema.users.username, 'smoke%')), 1, 'like');
assert.equal(await db.$count(schema.users, inArray(schema.users.tgId, [4243, 999999])), 1, 'inArray');
assert.equal(await db.$count(schema.messages, isNotNull(schema.messages.payload)), 1, 'isNotNull');

const listed = await db
  .select()
  .from(schema.users)
  .orderBy(desc(schema.users.id))
  .limit(1)
  .offset(0)
  .all();
assert.equal(listed.length, 1);
assert.equal(listed[0].tgId, 4243, 'orderBy/limit');

// 5. Raw SQL: run returns {rowsAffected, lastInsertRowid, rows}; no conversion.
const upd = await db.run(
  sql`UPDATE users SET username = ${'raw_name'} WHERE tg_id = ${4243} RETURNING id`
);
assert.equal(upd.rowsAffected, 1);
assert.equal(upd.lastInsertRowid, upd.rows[0].id);
assert.equal(typeof upd.rows[0].id, 'number');

const raw = await db.all(sql`SELECT username, created_at FROM users WHERE tg_id = ${4243}`);
assert.equal(raw[0].username, 'raw_name');
assert.equal(typeof raw[0].created_at, 'number', 'raw rows are NOT mode-converted');

const named = await db.run('UPDATE users SET username = :name WHERE tg_id = :id', {
  ':name': 'named_param',
  ':id': 4243,
});
assert.equal(named.rowsAffected, 1, '(queryString, params) form');

const got = await db.get(sql`SELECT count(*) AS c FROM users`);
assert.equal(got.c, 2);
const vals = await db.values(sql`SELECT tg_id, username FROM users ORDER BY tg_id`);
assert.deepEqual(vals[0], [4242, 'renamed'], 'db.values → positional arrays');

// 6. FK declarations throw, per the documented "No foreign keys" rule.
assert.throws(
  () => schema.users.tgId.references?.(),
  /not supported/,
  'references() throws'
);

// 7. Bot API mock: success shapes + failure injection + blocked chat.
__resetApi();
const me = await api.getMe();
assert.equal(me.username, 'harness_bot');

const sent = await api.sendMessage({ chat_id: 777, text: 'Hello!', parse_mode: 'HTML' });
assert.equal(sent.message_id, 1000, 'message_id starts at 1000');
assert.equal(sent.chat.id, 777);
const copied = await api.copyMessage({ chat_id: 888, from_chat_id: 777, message_id: 1000 });
assert.deepEqual(copied, { message_id: 1000 }, 'per-chat counter starts at 1000');

const state = __getApiState();
assert.equal(state.calls.length, 3);
assert.equal(state.messages.get(777).length, 1);
assert.equal(state.messages.get(888).length, 1);

// 429 failure consumed by the next matching call.
__getApiState().failNext.push({
  method: 'sendMessage',
  code: 429,
  description: 'Too Many Requests: retry after 3',
  parameters: { retry_after: 3 },
});
await assert.rejects(
  api.sendMessage({ chat_id: 777, text: 'x' }),
  (e) => e instanceof BotApiError && e.code === 429 && e.parameters.retry_after === 3
);

__setBlockedChat(999, true);
await assert.rejects(
  api.sendMessage({ chat_id: 999, text: 'x' }),
  (e) => e instanceof BotApiError && e.code === 403 && /blocked/.test(e.description)
);

const cmds = await api.setMyCommands({ commands: [{ command: 'start', description: 'Go' }] });
assert.equal(cmds, true);
assert.deepEqual(await api.getMyCommands({}), [{ command: 'start', description: 'Go' }]);

// Classes exist with the documented shape.
const inputFile = new InputFile(new Uint8Array([1, 2, 3]), 'a.txt');
assert.equal(inputFile.filename, 'a.txt');
const ee = new EndpointError('Out of stock', { code: 'OUT_OF_STOCK' });
assert.equal(ee.parameters.code, 'OUT_OF_STOCK');

// 8. Raw sqlite escape hatch points at a live DatabaseSync.
assert.equal(typeof __getSqlite().prepare, 'function');

console.log('SMOKE OK');
