import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setupTest,
  sendStart,
  sendFrom,
  openLink,
  getToken,
  getActiveLink,
  getUser,
  lastBotMessage,
  rawSqlite,
} from './helpers.mjs';

test('links are unique, random, and one active link per user', async () => {
  const p = await setupTest();
  const ids = [2001, 2002, 2003, 2004, 2005];
  for (const id of ids) await sendStart(id);
  const tokens = [];
  for (const id of ids) tokens.push(await getToken(id));

  assert.equal(new Set(tokens).size, tokens.length, 'tokens are unique');
  for (const token of tokens) {
    assert.match(token, /^[A-Za-z0-9_-]{16,64}$/);
    assert.ok(!token.includes(':'), 'token is URL-safe and not an id pair');
  }
});

test('rolling a link invalidates the old token and preserves history', async () => {
  const p = await setupTest();
  await sendStart(2010);
  const oldToken = await getToken(2010);
  const oldLink = await getActiveLink(2010);

  await sendFrom(2010, '/roll');
  const newToken = await getToken(2010);
  assert.notEqual(newToken, oldToken);
  assert.match(lastBotMessage(2010).text, /لینک شما عوض شد/);

  const rows = rawSqlite()
    .prepare('SELECT token, is_active FROM user_links WHERE user_id = ? ORDER BY id')
    .all((await getUser(2010)).id);
  assert.equal(rows.length, 2, 'old and new link rows are retained');
  assert.deepEqual(
    rows.map((r) => ({ token: r.token, active: Number(r.is_active) })),
    [
      { token: oldToken, active: 0 },
      { token: newToken, active: 1 },
    ]
  );

  // The old token resolves as inactive; the new token opens a target context.
  await openLink(2020, oldToken);
  assert.match(lastBotMessage(2020).text, /دیگر فعال نیست/);
  assert.equal(
    rawSqlite().prepare('SELECT count(*) AS n FROM pending_targets WHERE user_id = ?').get((await getUser(2020)).id).n,
    0
  );

  await openLink(2020, newToken);
  assert.match(lastBotMessage(2020).text, /حالت پیام ناشناس/);
  assert.equal(
    rawSqlite().prepare('SELECT count(*) AS n FROM pending_targets WHERE user_id = ?').get((await getUser(2020)).id).n,
    1
  );
});

test('rolling a link does not break an existing reply route', async () => {
  const p = await setupTest();
  await sendStart(2030);
  const token = await getToken(2030);
  await sendStart(2031);
  await openLink(2031, token);
  await sendFrom(2031, 'before roll');

  const delivered = lastBotMessage(2030);
  await sendFrom(2030, '/roll');

  await sendFrom(2030, {
    text: 'reply after roll',
    reply_to_message: {
      message_id: delivered.message_id,
      from: { is_bot: true },
      chat: { id: 2030, type: 'private' },
    },
  });

  const rows = rawSqlite()
    .prepare('SELECT count(*) AS n FROM messages')
    .get();
  assert.equal(rows.n, 2, 'the old conversation still routes');
  assert.equal((await getToken(2030)).length > 0, true);
});
