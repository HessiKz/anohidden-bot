import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setupTest,
  sendStart,
  sendFrom,
  click,
  getToken,
  lastBotMessage,
  lastTextContaining,
  openLink,
  buttons,
  getUser,
} from './helpers.mjs';
import { fa } from '../tgcloud/lib/i18n/fa.js';
import { en } from '../tgcloud/lib/i18n/en.js';
import {
  CATALOGS,
  DEFAULT_LOCALE,
  formatBytes,
  formatDateTime,
  formatNumber,
  localeOf,
  normalizeLocale,
  t,
  toJalali,
  toPersianDigits,
} from '../tgcloud/lib/i18n/index.js';

test('the default locale is Persian for everything without an explicit choice', async () => {
  await setupTest();
  assert.equal(DEFAULT_LOCALE, 'fa');
  // A brand-new user with no stored preference gets Persian copy.
  await sendStart(9001);
  const message = lastBotMessage(9001);
  assert.match(message.text, /به پیام‌رسان ناشناس خوش آمدید/);
  assert.ok(!message.text.includes('Welcome to anonymous messaging'));
  const user = await getUser(9001);
  assert.equal(user.uiLanguage, null);
  assert.equal(localeOf(user), 'fa');
});

test('the catalogs keep key parity and shape', () => {
  const faKeys = Object.keys(fa).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(enKeys, faKeys, 'both catalogs must expose identical keys');
  assert.ok(faKeys.length >= 150, 'the catalog is substantial');
  for (const key of faKeys) {
    assert.equal(typeof fa[key], typeof en[key], key);
    if (typeof fa[key] === 'string') {
      assert.ok(fa[key].length > 0, `${key} is empty (fa)`);
      assert.ok(en[key].length > 0, `${key} is empty (en)`);
    }
  }
  // Distinct translations where it matters.
  assert.notEqual(fa['user.onboarding'], en['user.onboarding']);
  assert.notEqual(fa['cmd.start'], en['cmd.start']);
});

test('t() falls back to the default locale and then to the key', () => {
  assert.equal(t('fa', 'status.delivered'), 'تحویل‌شده');
  assert.equal(t('en', 'status.delivered'), 'delivered');
  assert.equal(t('en', 'user.onboarding', { link: 'x' }).includes('x'), true);
  // Unknown key: same value in both locales (the key itself), no crash.
  assert.equal(t('fa', 'missing.key'), 'missing.key');
  assert.equal(t('en', 'missing.key'), 'missing.key');
  // Unknown/unsupported locale values normalize to the default (Persian).
  assert.equal(normalizeLocale('de-DE'), 'fa');
  assert.equal(normalizeLocale(null), 'fa');
  assert.equal(normalizeLocale('en-GB'), 'en');
  assert.equal(normalizeLocale('fa-IR'), 'fa');
  assert.equal(normalizeLocale('per'), 'fa');
});

test('formatting is Persian-first: digits, Jalali dates, byte sizes', () => {
  assert.equal(formatNumber(12345, 'fa'), '۱۲٬۳۴۵'.replace('٬', ','));
  // formatNumber uses the ASCII comma as grouping char; Persian digits around it.
  assert.equal(formatNumber(12345, 'fa'), '۱۲,۳۴۵');
  assert.equal(formatNumber(12345, 'en'), '12,345');

  // 2026-02-21 12:00 UTC == 1404/12/02 15:30 Tehran (Jalali)
  const ts = Date.UTC(2026, 1, 21, 12, 0, 0) / 1000;
  const jalali = toJalali(new Date(ts * 1000 + 3.5 * 3600 * 1000));
  assert.equal(jalali.jy, 1404);
  assert.equal(jalali.jm, 12);
  assert.equal(jalali.jd, 2);
  const faDate = formatDateTime(ts, 'fa');
  assert.ok(faDate.includes('۱۴۰۴'), faDate);
  assert.ok(faDate.includes('۱۲'), faDate);
  const enDate = formatDateTime(ts, 'en');
  assert.match(enDate, /2026-02-21 12:00/);

  const size = formatBytes(2048, 'fa');
  assert.ok(size.includes('۲') && size.includes('KB'), size);
  assert.equal(formatBytes(2048, 'en'), '2.0 KB');
});

test('the /help text carries no operator-disclosure wording in either locale', () => {
  for (const [catalog, code, forbidden] of [
    [fa, 'fa', ['مسؤول پلتفرم', 'حریم خصوصی\n']],
    [en, 'en', ['platform operator', '<b>Privacy</b>']],
  ]) {
    const help = catalog['user.help']({ isSuperadmin: false, link: 'x' });
    for (const needle of forbidden) {
      assert.ok(!help.includes(needle), `${code}: help must not contain "${needle}"`);
    }
  }
  // Onboarding stays clean too.
  for (const catalog of [fa, en]) {
    const onboarding = catalog['user.onboarding']({ link: 'x' });
    assert.ok(!onboarding.includes('مسؤول پلتفرم'));
    assert.ok(!onboarding.includes('Privacy note'));
  }
});

test('the language menu switches the stored language and the copy follows', async () => {
  await setupTest();
  await sendStart(9101);
  await sendFrom(9101, '/language');
  const menu = lastBotMessage(9101);
  assert.match(menu.text, /انتخاب زبان ربات/);
  const langButtons = buttons(9101, menu.message_id);
  const faButton = langButtons.find((b) => b.callback_data === 'usr:lang:fa');
  const enButton = langButtons.find((b) => b.callback_data === 'usr:lang:en');
  assert.ok(faButton && enButton, 'both language buttons exist');

  await click(9101, 'usr:lang:en', { messageId: menu.message_id });
  assert.equal((await getUser(9101)).uiLanguage, 'en');
  const confirmation = lastTextContaining(9101, 'English');
  assert.ok(confirmation, 'the switch was confirmed');
  const help = lastTextContaining(9101, 'How anonymous messaging works');
  assert.ok(help, 'help now speaks English');
  assert.ok(!help.text.includes('چطور پاسخ بدهید'));

  // A persisted preference survives new updates and flows: open someone
  // else's link and the anonymous-mode context still speaks English.
  await sendStart(9102);
  const otherToken = await getToken(9102);
  await openLink(9101, otherToken);
  const context = lastBotMessage(9101);
  assert.match(context.text, /Anonymous message mode/);
  assert.ok(!context.text.includes('حالت پیام ناشناس'));

  // Back to Persian.
  const helpMessage = lastBotMessage(9101);
  await click(9101, 'usr:lang:fa', { messageId: helpMessage.message_id });
  assert.equal((await getUser(9101)).uiLanguage, 'fa');
  assert.match(lastTextContaining(9101, 'فارسی').text, /تغییر کرد/);
});

test('both locales exist with the same command names', () => {
  assert.deepEqual(Object.keys(CATALOGS).sort(), ['en', 'fa']);
});
