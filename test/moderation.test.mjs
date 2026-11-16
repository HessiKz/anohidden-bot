import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setupTest,
  sendStart,
  openLink,
  sendFrom,
  getToken,
  getUser,
  lastBotMessage,
  lastTextContaining,
  botMessages,
  calls,
  buttons,
  click,
  rawSqlite,
} from './helpers.mjs';
import { SUPERADMIN_ID as ADMIN } from '../tgcloud/lib/constants.js';

async function pair(owner = 6001, sender = 6002) {
  const p = await setupTest();
  await sendStart(owner);
  const token = await getToken(owner);
  await sendStart(sender);
  await openLink(sender, token);
  await sendFrom(sender, 'hello');
  return { p, owner, sender, token, delivered: lastBotMessage(owner) };
}

function button(chatId, messageId, prefix) {
  return buttons(chatId, messageId).find((b) =>
    String(b.callback_data ?? '').startsWith(prefix)
  );
}

test('block stores the relationship, persists, and stops both directions', async () => {
  const { p, owner, sender, delivered } = await pair();
  const block = button(owner, delivered.message_id, 'anon:block:');
  assert.ok(block, 'block button exists');

  await click(owner, block.callback_data, { messageId: delivered.message_id });
  const ownerUser = await getUser(owner);
  const senderUser = await getUser(sender);
  const blocks = rawSqlite().prepare('SELECT * FROM blocked_users').all();
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].blocker_id, ownerUser.id);
  assert.equal(blocks[0].blocked_id, senderUser.id);
  assert.match(lastTextContaining(owner, 'فرستنده مسدود شد')?.text ?? '', /فرستنده مسدود شد/);

  const before = rawSqlite().prepare('SELECT count(*) AS n FROM messages').get().n;
  await sendFrom(sender, 'after block');
  assert.equal(
    rawSqlite().prepare('SELECT count(*) AS n FROM messages').get().n,
    before,
    'blocked sender cannot create a new message'
  );
  assert.match(lastBotMessage(sender).text, /در دسترس نیست/);

  await sendFrom(owner, {
    text: 'blocked reply',
    reply_to_message: {
      message_id: delivered.message_id,
      from: { is_bot: true },
      chat: { id: owner, type: 'private' },
    },
  });
  assert.match(lastBotMessage(owner).text, /دیگر در دسترس نیست/);

  await click(owner, block.callback_data, { messageId: delivered.message_id });
  assert.equal(rawSqlite().prepare('SELECT count(*) AS n FROM blocked_users').get().n, 1);
  assert.equal(
    rawSqlite().prepare('SELECT count(*) AS n FROM messages').get().n,
    before,
    'repeat block is idempotent'
  );
});

test('report stores the report, notifies the superadmin, and hides identity from the reporter', async () => {
  const { owner, sender, delivered } = await pair(6011, 6012);
  const report = button(owner, delivered.message_id, 'anon:report:');
  assert.ok(report);

  await click(owner, report.callback_data, { messageId: delivered.message_id });
  const menu = lastBotMessage(owner);
  assert.match(menu.text, /این پیام ناشناس گزارش شود/);
  const spam = button(owner, menu.message_id, 'anon:rr:');
  assert.ok(spam, 'reason buttons exist');

  await click(owner, spam.callback_data, { messageId: menu.message_id });

  const reports = rawSqlite().prepare('SELECT * FROM reports').all();
  assert.equal(reports.length, 1);
  assert.equal(reports[0].reason, 'هرزنامه یا تبلیغ');
  assert.equal(reports[0].status, 'open');
  const ownerUser = await getUser(owner);
  const senderUser = await getUser(sender);
  assert.equal(reports[0].reporter_id, ownerUser.id);
  assert.equal(reports[0].reported_sender_id, senderUser.id);
  assert.equal(reports[0].reported_recipient_id, ownerUser.id);

  const adminNotice = lastTextContaining(ADMIN, 'گزارش جدید پیام ناشناس');
  assert.ok(adminNotice, 'superadmin notified');
  assert.match(adminNotice.text, /6012/);
  const submitted = lastTextContaining(owner, 'گزارش ثبت شد');
  assert.ok(submitted);
  assert.ok(!submitted.text.includes('6012'));
  assert.ok(!submitted.text.includes('User 6012'));

  // Replaying the same reason must not create a second report.
  await click(owner, spam.callback_data, { messageId: menu.message_id });
  assert.equal(rawSqlite().prepare('SELECT count(*) AS n FROM reports').get().n, 1);
});

test('superadmin ban stops messaging and unban restores it', async () => {
  const { owner, sender, token } = await pair(6021, 6022);
  await sendStart(ADMIN);
  await sendFrom(ADMIN, '/ban 6022 test reason');

  const senderUser = await getUser(sender);
  const ban = rawSqlite().prepare('SELECT * FROM banned_users WHERE user_id = ?').get(senderUser.id);
  assert.ok(ban);
  assert.equal(Number(ban.active), 1);
  assert.equal(ban.reason, 'test reason');
  assert.match(lastTextContaining(6022, 'معلق')?.text ?? '', /معلق/);

  await sendFrom(sender, 'while banned');
  assert.equal(rawSqlite().prepare('SELECT count(*) AS n FROM messages').get().n, 1, 'only the pre-ban message');

  await sendFrom(ADMIN, '/unban 6022');
  assert.equal(
    Number(rawSqlite().prepare('SELECT active FROM banned_users WHERE user_id = ?').get(senderUser.id).active),
    0
  );
  await sendStart(sender);
  await openLink(sender, token);
  await sendFrom(sender, 'after unban');
  assert.equal(rawSqlite().prepare('SELECT count(*) AS n FROM messages').get().n, 2);
});
