import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setupTest,
  sendStart,
  openLink,
  sendFrom,
  getToken,
  botMessages,
  lastBotMessage,
  lastTextContaining,
  calls,
  callsFor,
  buttons,
  rawSqlite,
  queueFailure,
} from './helpers.mjs';

async function pair(p, { recipient = 3001, sender = 3002 } = {}) {
  await sendStart(recipient);
  const token = await getToken(recipient);
  await sendStart(sender);
  await openLink(sender, token);
  return { token, recipient, sender };
}

test('anonymous text is copied to the recipient with recipient-only controls', async () => {
  const p = await setupTest();
  await pair(p);
  await sendFrom(3002, 'hello anonymous world');

  const copy = calls('copyMessage').at(-1);
  assert.ok(copy, 'copyMessage was used');
  assert.equal(Number(copy.params.chat_id), 3001);
  assert.equal(Number(copy.params.from_chat_id), 3002);
  assert.equal(copy.result.message_id, lastBotMessage(3001).message_id);

  const delivered = lastBotMessage(3001);
  assert.equal(delivered.text, 'hello anonymous world');
  const flat = buttons(3001, delivered.message_id);
  assert.ok(flat.some((b) => b.callback_data.startsWith('anon:reply:')));
  assert.ok(flat.some((b) => b.callback_data.startsWith('anon:report:')));
  assert.ok(flat.some((b) => b.callback_data.startsWith('anon:block:')));
  assert.ok(flat.every((b) => /^anon:(reply|report|block):[A-Za-z0-9_-]{12,32}$/.test(b.callback_data)));
  assert.ok(!flat.some((b) => String(b.callback_data).startsWith('adm:')));
  assert.ok(!flat.some((b) => b.text.includes('Reveal')));

  const row = rawSqlite()
    .prepare('SELECT * FROM messages WHERE source_chat_id = 3002 AND source_message_id = ?')
    .get(4);
  assert.ok(row, 'message record exists');
  assert.equal(row.delivery_status, 'delivered');
  assert.match(row.public_token, /^[A-Za-z0-9_-]{12,32}$/);
  assert.notEqual(String(row.public_token), String(row.id));

  assert.ok(lastTextContaining(3002, 'ناشناس تحویل شد'));
  assert.equal(callsFor('copyMessage', 3001).length, 1);
});

test('photo delivery stores an attachment reference and is not downloaded', async () => {
  const p = await setupTest();
  await pair(p, { recipient: 3011, sender: 3012 });
  await sendFrom(3012, {
    photo: [
      { file_id: 'small_file', file_unique_id: 'u-small', width: 90, height: 90 },
      { file_id: 'large_file', file_unique_id: 'u-large', width: 1280, height: 720, file_size: 1234 },
    ],
    caption: 'a photo caption',
  });

  const copy = calls('copyMessage').at(-1);
  assert.equal(Number(copy.params.chat_id), 3011);
  const row = rawSqlite().prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 1').get();
  assert.equal(row.message_type, 'photo');
  assert.equal(row.content, 'a photo caption');

  const attachment = rawSqlite()
    .prepare('SELECT * FROM message_attachments WHERE message_id = ?')
    .get(row.id);
  assert.equal(attachment.attachment_type, 'photo');
  assert.equal(attachment.file_id, 'large_file');
  assert.equal(attachment.file_unique_id, 'u-large');
  assert.equal(attachment.width, 1280);
  assert.ok(!calls('getFile').length, 'the bot never downloads media');
  assert.ok(!calls('getFileContent').length);
});

test('copy failure falls back to sendMessage for text and still records success', async () => {
  const p = await setupTest();
  await pair(p, { recipient: 3021, sender: 3022 });
  queueFailure('copyMessage', 400, "Bad Request: message can't be copied");
  await sendFrom(3022, 'fallback text');

  const fallback = calls('sendMessage').filter(
    (c) => Number(c.params.chat_id) === 3021 && c.params.text === 'fallback text'
  );
  assert.equal(fallback.length, 1, 'text fallback used');
  const row = rawSqlite().prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 1').get();
  assert.equal(row.delivery_status, 'delivered');
});

test('forward headers are stripped by re-sending instead of copying', async () => {
  const p = await setupTest();
  await pair(p, { recipient: 3031, sender: 3032 });
  await sendFrom(3032, {
    text: 'forwarded content',
    forward_origin: { type: 'user', sender_user: { id: 999 } },
  });

  assert.equal(
    calls('copyMessage').filter((c) => Number(c.params.chat_id) === 3031).length,
    0,
    'forwarded messages are not copied'
  );
  const fallback = calls('sendMessage').filter(
    (c) => Number(c.params.chat_id) === 3031 && c.params.text === 'forwarded content'
  );
  assert.equal(fallback.length, 1, 'forwarded text was re-sent');
});

test('protected content is refused instead of bypassing Telegram protection', async () => {
  const p = await setupTest();
  await pair(p, { recipient: 3051, sender: 3052 });
  const beforeCopy = calls('copyMessage').length;
  const beforeSend = calls('sendMessage').filter((c) => Number(c.params.chat_id) === 3051).length;

  await sendFrom(3052, {
    text: 'protected text',
    has_protected_content: true,
  });

  assert.equal(calls('copyMessage').length, beforeCopy);
  assert.equal(
    calls('sendMessage').filter((c) => Number(c.params.chat_id) === 3051).length,
    beforeSend
  );
  const row = rawSqlite().prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 1').get();
  assert.equal(row.delivery_status, 'failed');
  assert.match(lastTextContaining(3052, 'محافظت‌شده')?.text ?? '', /محافظت‌شده/);
});

test('a delivery failure is reported to the sender, never as success', async () => {
  const p = await setupTest();
  await pair(p, { recipient: 3041, sender: 3042 });
  queueFailure('copyMessage', 403, 'Forbidden: bot was blocked by the user');
  await sendFrom(3042, 'this will fail');

  const row = rawSqlite().prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 1').get();
  assert.equal(row.delivery_status, 'failed');
  const failure = lastTextContaining(3042, 'تحویل نشد');
  assert.ok(failure, 'sender sees a failure');
  assert.ok(!lastTextContaining(3042, 'ناشناس تحویل شد'));
});
