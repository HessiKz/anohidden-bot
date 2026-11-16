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

const PRIVILEGED = 8134382349;
const ADMIN = 564873641;

function button(chatId, messageId, prefix) {
  return buttons(chatId, messageId).find((b) =>
    String(b.callback_data ?? '').startsWith(prefix)
  );
}

test('identity-privileged account can reveal a sender only for messages addressed to it', async () => {
  const p = await setupTest();
  await sendStart(PRIVILEGED);
  const token = await getToken(PRIVILEGED);
  await sendStart(8001);
  await openLink(8001, token);
  const context = lastBotMessage(8001);
  assert.ok(!context.text.includes('enhanced identity visibility'));
  assert.ok(!context.text.includes('🔎 Important'));
  assert.ok(!context.text.includes('Anonymity is between users'));
  assert.ok(!context.text.includes('platform operator'));
  await sendFrom(8001, 'secret message to privileged');
  // The onboarding copy carries no operator disclosure either.
  const onboarding = lastTextContaining(8001, 'به پیام‌رسان ناشناس خوش آمدید');
  if (onboarding) {
    assert.ok(!onboarding.text.includes('مسؤول پلتفرم'));
    assert.ok(!onboarding.text.includes('Privacy note'));
  }

  const delivered = lastBotMessage(PRIVILEGED);
  const reveal = button(PRIVILEGED, delivered.message_id, 'anon:reveal:');
  assert.ok(reveal, 'privileged recipient has a reveal button');
  await click(PRIVILEGED, reveal.callback_data, { messageId: delivered.message_id });

  const identity = lastTextContaining(PRIVILEGED, '<b>هویت فرستنده</b>');
  assert.ok(identity, 'identity card sent');
  assert.match(identity.text, /شناسهٔ تلگرام:/);
  assert.match(identity.text, /8001/);
  assert.match(identity.text, /نام:/);
  assert.match(identity.text, /نام خانوادگی:/);
  assert.match(identity.text, /آیدی:/);
  assert.match(identity.text, /زبان کلاینت:/);
  assert.match(identity.text, /secret message to privileged/);
  assert.match(identity.text, /این پیام خطاب به شما بوده است/);

  // The privileged account is not an administrator.
  await sendFrom(PRIVILEGED, '/admin');
  assert.match(lastBotMessage(PRIVILEGED).text, /در دسترس نیست/);
  await click(PRIVILEGED, 'adm:h', { messageId: lastBotMessage(PRIVILEGED).message_id });
  assert.equal(lastTextContaining(PRIVILEGED, 'داشبورد مدیریت'), undefined);
});

test('ordinary recipients have no reveal button and forged reveal callbacks are denied', async () => {
  const p = await setupTest();
  await sendStart(8011);
  const token = await getToken(8011);
  await sendStart(8012);
  await openLink(8012, token);
  await sendFrom(8012, 'ordinary message');

  const delivered = lastBotMessage(8011);
  assert.equal(button(8011, delivered.message_id, 'anon:reveal:'), undefined);

  const report = button(8011, delivered.message_id, 'anon:report:');
  const tokenFromCallback = report.callback_data.split(':').pop();
  await click(8011, `anon:reveal:${tokenFromCallback}`, {
    messageId: delivered.message_id,
  });
  assert.equal(lastTextContaining(8011, '<b>هویت فرستنده</b>'), undefined);
  const denial = calls('answerCallbackQuery').at(-1);
  assert.match(String(denial?.params?.text ?? ''), /مجاز نیست/);
});

test('the privileged account cannot reveal a message delivered to someone else', async () => {
  const p = await setupTest();
  await sendStart(8021);
  const token = await getToken(8021);
  await sendStart(8022);
  await openLink(8022, token);
  await sendFrom(8022, 'message for ordinary 8021');

  const delivered = lastBotMessage(8021);
  const report = button(8021, delivered.message_id, 'anon:report:');
  const publicToken = report.callback_data.split(':').pop();

  // The privileged account forges a callback using the ordinary recipient's token.
  await sendStart(PRIVILEGED);
  await click(PRIVILEGED, `anon:reveal:${publicToken}`, {
    messageId: lastBotMessage(PRIVILEGED).message_id,
  });
  assert.equal(lastTextContaining(PRIVILEGED, '<b>هویت فرستنده</b>'), undefined);
});

test('superadmin can reveal identities globally through the admin message detail', async () => {
  const p = await setupTest();
  await sendStart(PRIVILEGED);
  const token = await getToken(PRIVILEGED);
  await sendStart(8031);
  await openLink(8031, token);
  await sendFrom(8031, 'for privileged only');

  await sendStart(ADMIN);
  const row = rawSqlite().prepare('SELECT id FROM messages ORDER BY id DESC LIMIT 1').get();
  await sendFrom(ADMIN, `/message ${row.id}`);
  const detail = lastBotMessage(ADMIN);
  assert.match(detail.text, /فرستنده/);
  assert.match(detail.text, /8031/);
  assert.match(detail.text, /گیرنده/);
  assert.match(detail.text, new RegExp(String(PRIVILEGED)));
});
