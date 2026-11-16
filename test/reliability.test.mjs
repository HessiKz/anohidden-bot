import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setupTest,
  sendStart,
  openLink,
  sendFrom,
  getToken,
  lastBotMessage,
  lastTextContaining,
  buttons,
  calls,
  click,
  rawSqlite,
} from './helpers.mjs';

function button(chatId, messageId, prefix) {
  return buttons(chatId, messageId).find((b) =>
    String(b.callback_data ?? '').startsWith(prefix)
  );
}

test('the same update id is processed once even if the handler is called again', async () => {
  const p = await setupTest();
  await sendStart(9001);
  const token = await getToken(9001);
  await sendStart(9002);
  await openLink(9002, token);
  const message = await sendFrom(9002, 'only once', { updateId: 777 });
  await sendFrom(9002, 'only once', { updateId: 777, messageId: message.message_id });

  assert.equal(rawSqlite().prepare('SELECT count(*) AS n FROM messages').get().n, 1);
  assert.equal(
    rawSqlite().prepare("SELECT count(*) AS n FROM message_routes WHERE chat_id = 9001").get().n,
    1
  );
});

test('a replayed callback update does not repeat block or report actions', async () => {
  const p = await setupTest();
  await sendStart(9011);
  const token = await getToken(9011);
  await sendStart(9012);
  await openLink(9012, token);
  await sendFrom(9012, 'callback target');
  const delivered = lastBotMessage(9011);
  const block = button(9011, delivered.message_id, 'anon:block:');

  await click(9011, block.callback_data, { messageId: delivered.message_id, updateId: 800 });
  await click(9011, block.callback_data, { messageId: delivered.message_id, updateId: 800 });

  assert.equal(rawSqlite().prepare('SELECT count(*) AS n FROM blocked_users').get().n, 1);
  const replayAnswer = calls('answerCallbackQuery').at(-1);
  assert.match(String(replayAnswer?.params?.text ?? ''), /already|processed/i);
});

test('malformed updates fail closed without throwing', async () => {
  const p = await setupTest();
  await assert.doesNotReject(() => p.messageHandler(null, { update: { update_id: 1 } }));
  await assert.doesNotReject(() =>
    p.messageHandler({ from: { id: 9999, is_bot: false }, chat: { id: 9999, type: 'private' } }, { update: { update_id: 2 } })
  );
  await assert.doesNotReject(() =>
    p.callbackHandler({ id: 'cb', from: { id: 9999, is_bot: false }, data: '' }, { update: { update_id: 3 } })
  );
  await assert.doesNotReject(() =>
    p.callbackHandler({ id: 'cb2', from: { id: 9999, is_bot: false }, data: 'adm:h' }, { update: { update_id: 4 } })
  );
});

test('forged callback data cannot establish an admin or identity privilege', async () => {
  const p = await setupTest();
  await sendStart(9021);
  const token = await getToken(9021);
  await sendStart(9022);
  await openLink(9022, token);
  await sendFrom(9022, 'protected');
  const delivered = lastBotMessage(9021);
  const report = button(9021, delivered.message_id, 'anon:report:');
  const publicToken = report.callback_data.split(':').pop();

  await click(9021, `anon:reveal:${publicToken}`, { messageId: delivered.message_id });
  await click(9021, 'adm:h', { messageId: delivered.message_id });

  assert.equal(lastTextContaining(9021, 'Sender identity'), undefined);
  assert.equal(lastTextContaining(9021, 'Admin dashboard'), undefined);
});
