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
  calls,
  buttons,
  rawSqlite,
} from './helpers.mjs';

test('a media group is claimed once and copied with copyMessages', async () => {
  const p = await setupTest();
  await sendStart(4001);
  const token = await getToken(4001);
  await sendStart(4002);
  await openLink(4002, token);

  const group = 'album-1';
  const first = sendFrom(4002, {
    photo: [{ file_id: 'a1', file_unique_id: 'u1', width: 100, height: 100 }],
    caption: 'one',
    media_group_id: group,
  });
  const second = sendFrom(4002, {
    photo: [{ file_id: 'a2', file_unique_id: 'u2', width: 100, height: 100 }],
    caption: 'two',
    media_group_id: group,
  });
  await Promise.all([first, second]);

  const copies = calls('copyMessages').filter((c) => Number(c.params.chat_id) === 4001);
  assert.equal(copies.length, 1, 'one grouped copy');
  assert.deepEqual(copies[0].params.message_ids, [4, 5]);
  assert.equal(copies[0].result.length, 2);

  const rows = rawSqlite()
    .prepare('SELECT * FROM messages ORDER BY id')
    .all();
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.delivery_status === 'delivered' && Number(r.is_album) === 1));
  assert.equal(new Set(rows.map((r) => r.conversation_id)).size, 1, 'one conversation');

  const delivered = botMessages(4001);
  const control = delivered.find((m) => m.text?.includes('آلبوم ناشناس'));
  assert.ok(control, 'control message exists');
  assert.match(control.text, /۲ آیتم/);
  assert.ok(buttons(4001, control.message_id).some((b) => b.callback_data.startsWith('anon:report:')));

  const routes = rawSqlite()
    .prepare('SELECT count(*) AS n FROM message_routes WHERE chat_id = 4001')
    .get().n;
  assert.equal(routes, 3, 'two item routes plus the control route');

  const confirmations = botMessages(4002).filter((m) =>
    String(m.text ?? '').includes('آیتم آلبوم')
  );
  assert.equal(confirmations.length, 1, 'one confirmation for the group');
  assert.match(confirmations[0].text, /۲ آیتم آلبوم/);
});

test('a late album item is delivered rather than lost', async () => {
  const p = await setupTest();
  await sendStart(4011);
  const token = await getToken(4011);
  await sendStart(4012);
  await openLink(4012, token);

  await sendFrom(4012, {
    photo: [{ file_id: 'late1', file_unique_id: 'lu1', width: 10, height: 10 }],
    media_group_id: 'late-group',
  });
  await sendFrom(4012, {
    photo: [{ file_id: 'late2', file_unique_id: 'lu2', width: 10, height: 10 }],
    media_group_id: 'late-group',
  });

  const rows = rawSqlite().prepare('SELECT * FROM messages ORDER BY id').all();
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.delivery_status === 'delivered'));
  assert.ok(calls('copyMessages').length >= 1);
});
