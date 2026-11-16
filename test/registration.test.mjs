import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setupTest,
  sendStart,
  sendFrom,
  getUser,
  getToken,
  lastBotMessage,
  rawSqlite,
} from './helpers.mjs';

test('new user registration creates one user and one active link', async () => {
  const p = await setupTest();
  const user = { id: 1001, first_name: 'Alice', username: 'alice', language_code: 'en' };
  await sendStart(user);

  const row = await getUser(1001);
  assert.ok(row, 'user row exists');
  assert.equal(row.tgId, 1001);
  assert.equal(row.firstName, 'Alice');
  assert.equal(row.username, 'alice');
  assert.equal(row.languageCode, 'en');
  assert.ok(row.createdAt instanceof Date);

  const token = await getToken(1001);
  assert.match(token, /^[A-Za-z0-9_-]{16,64}$/);

  const linkCount = rawSqlite()
    .prepare('SELECT count(*) AS n FROM user_links WHERE user_id = ? AND is_active = 1')
    .get(row.id).n;
  assert.equal(linkCount, 1);

  const message = lastBotMessage(1001);
  assert.match(message.text, /به پیام‌رسان ناشناس خوش آمدید/);
  assert.match(message.text, /https:\/\/t\.me\/harness_bot\?start=/);
  assert.ok(message.reply_markup?.inline_keyboard?.length >= 1);
});

test('existing user registration is idempotent and keeps the same link', async () => {
  const p = await setupTest();
  await sendStart(1002);
  const first = await getToken(1002);
  const firstUser = await getUser(1002);

  await sendFrom(
    { id: 1002, first_name: 'Bobby', username: 'bobby_new', language_code: 'de' },
    '/start'
  );

  const second = await getToken(1002);
  const secondUser = await getUser(1002);
  assert.equal(first, second, 'existing link is reused');
  assert.equal(firstUser.id, secondUser.id, 'same internal user row');
  assert.equal(secondUser.firstName, 'Bobby');
  assert.equal(secondUser.username, 'bobby_new');

  const counts = rawSqlite()
    .prepare('SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM user_links) AS links')
    .get();
  assert.equal(counts.users, 1);
  assert.equal(counts.links, 1);
});

test('self link and invalid link do not create a pending target', async () => {
  const p = await setupTest();
  await sendStart(1003);
  const token = await getToken(1003);

  await sendFrom(1003, `/start ${token}`);
  assert.match(lastBotMessage(1003).text, /این لینک خودِ شماست/);

  await sendFrom(1003, '/start not-a-real-token');
  assert.match(lastBotMessage(1003).text, /نامعتبر است/);

  const pending = rawSqlite().prepare('SELECT count(*) AS n FROM pending_targets').get().n;
  assert.equal(pending, 0);
});
