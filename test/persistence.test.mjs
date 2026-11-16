import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  setupTest,
  sendStart,
  sendFrom,
  getToken,
  openLink,
  testDbPath,
  rawSqlite,
} from './helpers.mjs';

test('schema tables exist and data survives a second SQLite connection', async () => {
  const p = await setupTest();
  await sendStart(9101);
  const token = await getToken(9101);
  await sendStart(9102);
  await openLink(9102, token);
  await sendFrom(9102, 'persisted message');

  const tables = rawSqlite()
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((r) => r.name);
  for (const required of [
    'users',
    'user_links',
    'pending_targets',
    'conversations',
    'messages',
    'message_routes',
    'message_attachments',
    'blocked_users',
    'reports',
    'banned_users',
    'processed_updates',
    'admin_logs',
    'platform_settings',
    'admin_states',
    'broadcasts',
    'broadcast_deliveries',
    'rate_limits',
  ]) {
    assert.ok(tables.includes(required), `missing table ${required}`);
  }

  // Open a completely separate connection to the same file and read the rows.
  const other = new DatabaseSync(testDbPath());
  try {
    const user = other.prepare('SELECT tg_id, username FROM users WHERE tg_id = ?').get(9101);
    assert.equal(user.tg_id, 9101);
    assert.equal(user.username, 'user_9101');

    const message = other
      .prepare('SELECT content, delivery_status FROM messages ORDER BY id DESC LIMIT 1')
      .get();
    assert.equal(message.content, 'persisted message');
    assert.equal(message.delivery_status, 'delivered');

    const link = other
      .prepare('SELECT token, is_active FROM user_links WHERE user_id = (SELECT id FROM users WHERE tg_id = ?)')
      .get(9101);
    assert.equal(link.token, token);
    assert.equal(Number(link.is_active), 1);
  } finally {
    other.close();
  }

  // The same rows are visible from the harness connection after the other closes.
  assert.equal(rawSqlite().prepare('SELECT count(*) AS n FROM users').get().n, 2);
  assert.equal(rawSqlite().prepare('SELECT count(*) AS n FROM messages').get().n, 1);
});
