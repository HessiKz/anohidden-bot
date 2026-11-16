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

const ADMIN = 564873641;

function button(chatId, messageId, prefix) {
  return buttons(chatId, messageId).find((b) =>
    String(b.callback_data ?? '').startsWith(prefix)
  );
}

async function seedUsersAndMessages() {
  const p = await setupTest();
  await sendStart(7001);
  const token = await getToken(7001);
  await sendStart(7002);
  await openLink(7002, token);
  for (let i = 0; i < 10; i++) await sendFrom(7002, `message ${i}`);
  await sendStart(ADMIN);
  return { p, token };
}

test('superadmin dashboard, user explorer, message explorer, and pagination work', async () => {
  const { p } = await seedUsersAndMessages();
  await sendFrom(ADMIN, '/admin');
  const dashboard = lastBotMessage(ADMIN);
  assert.match(dashboard.text, /داشبورد مدیریت/);
  const usersButton = button(ADMIN, dashboard.message_id, 'adm:u:');
  assert.ok(usersButton);
  await click(ADMIN, usersButton.callback_data, { messageId: dashboard.message_id });

  const usersPage = lastBotMessage(ADMIN);
  assert.match(usersPage.text, /کاربران/);
  assert.match(usersPage.text, /7001/);

  const userButton = button(ADMIN, usersPage.message_id, 'adm:ud:');
  assert.ok(userButton);
  await click(ADMIN, userButton.callback_data, { messageId: usersPage.message_id });
  const detail = lastBotMessage(ADMIN);
  assert.match(detail.text, /کاربر #/);
  assert.match(detail.text, /شناسهٔ تلگرام/);
  assert.match(detail.text, /لینک فعال/);

  await sendFrom(ADMIN, '/messages 2');
  assert.match(lastBotMessage(ADMIN).text, /صفحه ۲/);
  assert.match(lastBotMessage(ADMIN).text, /مرور سراسری پیام‌ها/);

  const row = rawSqlite().prepare('SELECT id FROM messages ORDER BY id DESC LIMIT 1').get();
  await sendFrom(ADMIN, `/message ${row.id}`);
  const messageDetail = lastBotMessage(ADMIN);
  assert.match(messageDetail.text, /پیام #/);
  assert.match(messageDetail.text, /فرستنده/);
  assert.match(messageDetail.text, /گیرنده/);
  assert.match(messageDetail.text, /ارجاع‌های تلگرام/);

  await sendFrom(ADMIN, '/search user_7001');
  assert.match(lastBotMessage(ADMIN).text, /جستجو:/);
  assert.ok(button(ADMIN, lastBotMessage(ADMIN).message_id, 'adm:ud:'));
});

test('ordinary users cannot execute admin commands or admin callbacks', async () => {
  const p = await setupTest();
  await sendStart(7011);
  await sendFrom(7011, '/admin');
  assert.match(lastBotMessage(7011).text, /در دسترس نیست/);
  assert.equal(lastTextContaining(7011, 'داشبورد مدیریت'), undefined);

  const before = lastBotMessage(7011);
  await click(7011, 'adm:h', { messageId: before.message_id });
  assert.equal(lastBotMessage(7011).message_id, before.message_id, 'dashboard was not rendered');
  assert.equal(lastTextContaining(7011, 'داشبورد مدیریت'), undefined);

  const audit = rawSqlite()
    .prepare("SELECT * FROM admin_logs WHERE action = 'unauthorized_admin_command'")
    .all();
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actor_tg_id, 7011);
});

test('reports can be reviewed and exports are generated as documents', async () => {
  const { p } = await seedUsersAndMessages();
  const owner = 7001;
  const sender = 7002;

  // Create a report through the recipient's real inline flow.
  const delivered = lastBotMessage(owner);
  const reportButton = button(owner, delivered.message_id, 'anon:report:');
  assert.ok(reportButton);
  await click(owner, reportButton.callback_data, { messageId: delivered.message_id });
  const menu = lastBotMessage(owner);
  await click(
    owner,
    button(owner, menu.message_id, 'anon:rr:').callback_data,
    { messageId: menu.message_id }
  );

  await sendFrom(ADMIN, '/reports');
  const list = lastBotMessage(ADMIN);
  assert.match(list.text, /گزارش‌ها/);
  const reportButtonAdmin = button(ADMIN, list.message_id, 'adm:rd:');
  assert.ok(reportButtonAdmin);
  await click(ADMIN, reportButtonAdmin.callback_data, { messageId: list.message_id });
  const detail = lastBotMessage(ADMIN);
  assert.match(detail.text, /گزارش #/);
  const review = button(ADMIN, detail.message_id, 'adm:rev:');
  assert.ok(review);
  await click(ADMIN, review.callback_data, { messageId: detail.message_id });
  assert.equal(rawSqlite().prepare('SELECT status FROM reports').get().status, 'reviewed');

  await sendFrom(ADMIN, '/export json');
  const jsonCall = calls('sendDocument').at(-1);
  assert.ok(jsonCall);
  assert.match(jsonCall.params.document.filename, /\.json$/);
  assert.ok(jsonCall.params.document.bytes.length > 0);

  await sendFrom(ADMIN, '/export csv');
  const csvCalls = calls('sendDocument').filter((c) => c.params.document.filename.endsWith('.csv'));
  assert.ok(csvCalls.length >= 2);
});

test('broadcast preview, confirmation, tracked batches, and duplicate prevention', async () => {
  const { p } = await seedUsersAndMessages();
  const totalUsers = rawSqlite().prepare('SELECT count(*) AS n FROM users').get().n;

  await sendFrom(ADMIN, '/broadcast');
  assert.match(lastBotMessage(ADMIN).text, /حالت نوشتن ارسال همگانی/);
  await sendFrom(ADMIN, 'announcement to everyone');

  const preview = lastBotMessage(ADMIN);
  assert.match(preview.text, /پیش‌نمایش همگانی/);
  const broadcast = rawSqlite().prepare('SELECT * FROM broadcasts ORDER BY id DESC LIMIT 1').get();
  assert.equal(broadcast.status, 'preview');
  const confirm = button(ADMIN, preview.message_id, 'adm:brc:');
  assert.ok(confirm);

  await click(ADMIN, confirm.callback_data, { messageId: preview.message_id });
  const completed = rawSqlite().prepare('SELECT * FROM broadcasts WHERE id = ?').get(broadcast.id);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.sent_count, totalUsers);
  assert.equal(completed.failed_count, 0);
  assert.equal(
    rawSqlite().prepare('SELECT count(*) AS n FROM broadcast_deliveries WHERE broadcast_id = ?').get(broadcast.id).n,
    totalUsers
  );

  // A second confirm callback (new update) must not send duplicates.
  const before = rawSqlite().prepare('SELECT count(*) AS n FROM broadcast_deliveries').get().n;
  await click(ADMIN, confirm.callback_data, { messageId: preview.message_id });
  assert.equal(
    rawSqlite().prepare('SELECT count(*) AS n FROM broadcast_deliveries').get().n,
    before
  );
});

test('settings toggle pauses messaging and audit log is superadmin-only', async () => {
  const p = await setupTest();
  await sendStart(7021);
  await sendStart(ADMIN);
  await sendFrom(ADMIN, '/admin');
  const dash = lastBotMessage(ADMIN);
  const settings = button(ADMIN, dash.message_id, 'adm:set');
  assert.ok(settings);
  await click(ADMIN, settings.callback_data, { messageId: dash.message_id });
  const settingsMessage = lastBotMessage(ADMIN);
  assert.match(settingsMessage.text, /تنظیمات پلتفرم/);
  const toggle = button(ADMIN, settingsMessage.message_id, 'adm:sett:msg');
  assert.ok(toggle);
  await click(ADMIN, toggle.callback_data, { messageId: settingsMessage.message_id });
  assert.equal(
    rawSqlite().prepare("SELECT value FROM platform_settings WHERE key = 'messaging_enabled'").get().value,
    'false'
  );

  // A normal user opening a link now sees the paused notice.
  await sendStart(7022);
  const link = await getToken(7021);
  await openLink(7022, link);
  assert.match(lastBotMessage(7022).text, /موقتاً متوقف/);

  // Restore and inspect the audit log.
  await click(ADMIN, toggle.callback_data, { messageId: settingsMessage.message_id });
  await sendFrom(ADMIN, '/admin');
  const dash2 = lastBotMessage(ADMIN);
  const auditButton = button(ADMIN, dash2.message_id, 'adm:bl:');
  assert.ok(auditButton);
  await click(ADMIN, auditButton.callback_data, { messageId: dash2.message_id });
  assert.match(lastBotMessage(ADMIN).text, /لاگ حسابرسی/);
});
