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
  rawSqlite,
} from './helpers.mjs';

function replyTo(message, chatId, text) {
  return {
    text,
    reply_to_message: {
      message_id: message.message_id,
      from: { is_bot: true },
      chat: { id: chatId, type: 'private' },
    },
  };
}

test('native reply routes back to the original sender', async () => {
  const p = await setupTest();
  await sendStart(5001);
  const token = await getToken(5001);
  await sendStart(5002);
  await openLink(5002, token);
  await sendFrom(5002, 'original');

  const delivered = lastBotMessage(5001);
  await sendFrom(5001, replyTo(delivered, 5001, 'anonymous reply'));

  const rows = rawSqlite().prepare('SELECT * FROM messages ORDER BY id').all();
  assert.equal(rows.length, 2);
  const owner = await getUser(5001);
  const sender = await getUser(5002);
  const reply = rows[1];
  assert.equal(reply.sender_id, owner.id);
  assert.equal(reply.recipient_id, sender.id);
  assert.equal(reply.parent_id, rows[0].id);
  assert.equal(reply.conversation_id, rows[0].conversation_id);
  assert.match(lastTextContaining(5002, 'anonymous reply')?.text ?? '', /anonymous reply/);
  assert.equal(calls('copyMessage').at(-1).params.from_chat_id, 5001);
});

test('reply chains continue indefinitely without revealing identities', async () => {
  const p = await setupTest();
  await sendStart(5011);
  const token = await getToken(5011);
  await sendStart(5012);
  await openLink(5012, token);
  await sendFrom(5012, 'level 0');

  const toOwner = lastBotMessage(5011);
  await sendFrom(5011, replyTo(toOwner, 5011, 'level 1'));

  const toSender = lastBotMessage(5012);
  await sendFrom(5012, replyTo(toSender, 5012, 'level 2'));

  const toOwner2 = lastBotMessage(5011);
  await sendFrom(5011, replyTo(toOwner2, 5011, 'level 3'));

  const rows = rawSqlite().prepare('SELECT * FROM messages ORDER BY id').all();
  assert.equal(rows.length, 4);
  assert.equal(new Set(rows.map((r) => r.conversation_id)).size, 1);
  assert.equal(rows[3].parent_id, rows[2].id);
  assert.ok(rows.every((r) => r.delivery_status === 'delivered'));

  for (const chatId of [5011, 5012]) {
    for (const m of botMessages(chatId)) {
      const text = String(m.text ?? m.caption ?? '');
      assert.ok(!text.includes('5011'), 'no numeric identity in delivered content');
      assert.ok(!text.includes('5012'), 'no numeric identity in delivered content');
    }
  }
});

test('replying to an unrelated bot message does not guess a destination', async () => {
  const p = await setupTest();
  await sendStart(5021);
  const help = lastBotMessage(5021);
  const before = rawSqlite().prepare('SELECT count(*) AS n FROM messages').get().n;

  await sendFrom(5021, replyTo(help, 5021, 'not a conversation reply'));
  assert.match(lastBotMessage(5021).text, /گفتگوهای ناشناس نیست/);
  assert.equal(
    rawSqlite().prepare('SELECT count(*) AS n FROM messages').get().n,
    before
  );
});

test('a reply to an album control message routes to the album sender', async () => {
  const p = await setupTest();
  await sendStart(5031);
  const token = await getToken(5031);
  await sendStart(5032);
  await openLink(5032, token);

  await Promise.all([
    sendFrom(5032, {
      photo: [{ file_id: 'r1', file_unique_id: 'ru1', width: 10, height: 10 }],
      media_group_id: 'reply-album',
    }),
    sendFrom(5032, {
      photo: [{ file_id: 'r2', file_unique_id: 'ru2', width: 10, height: 10 }],
      media_group_id: 'reply-album',
    }),
  ]);

  const control = botMessages(5031).find((m) => m.text?.includes('آلبوم ناشناس'));
  assert.ok(control);
  await sendFrom(5031, replyTo(control, 5031, 'album reply'));

  const rows = rawSqlite().prepare('SELECT * FROM messages ORDER BY id').all();
  assert.equal(rows.length, 3);
  assert.match(lastTextContaining(5032, 'album reply')?.text ?? '', /album reply/);
});
