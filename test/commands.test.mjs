import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setupTest,
  calls,
  rawSqlite,
} from './helpers.mjs';
import { IDENTITY_PRIVILEGED_ID, SUPERADMIN_ID } from '../tgcloud/lib/constants.js';
import { fa } from '../tgcloud/lib/i18n/fa.js';
import { en } from '../tgcloud/lib/i18n/en.js';

const ADMIN = SUPERADMIN_ID;
const PRIVILEGED = IDENTITY_PRIVILEGED_ID;

test('the canonical command registry is valid', async () => {
  const p = await setupTest();
  assert.deepEqual(p.commands.validateCommandRegistry(), []);
  assert.ok(p.commands.USER_COMMANDS.length >= 5);
  assert.ok(p.commands.ADMIN_COMMANDS.length >= 12);
  const names = new Set([...p.commands.USER_COMMANDS, ...p.commands.ADMIN_COMMANDS]);
  for (const required of [
    'start', 'help', 'link', 'roll', 'about', 'language',
    'admin', 'stats', 'users', 'user', 'messages', 'message',
    'search', 'reports', 'ban', 'unban', 'broadcast', 'export',
  ]) {
    assert.ok(names.has(required), `missing ${required}`);
  }
});

test('command descriptions exist in Persian (default) and English', () => {
  for (const command of [
    'start', 'help', 'link', 'roll', 'about', 'language',
    'admin', 'stats', 'users', 'user', 'messages', 'message',
    'search', 'reports', 'ban', 'unban', 'broadcast', 'export',
  ]) {
    for (const [catalog, code] of [[fa, 'fa'], [en, 'en']]) {
      const description = catalog[`cmd.${command}`];
      assert.ok(
        typeof description === 'string' && description.length >= 3 && description.length <= 256,
        `${code}: cmd.${command}`
      );
    }
  }
  // The default language of the platform is Persian.
  assert.equal(fa['cmd.start'], 'شروع ربات و دریافت لینک ناشناس شما');
});

test('command sync registers Persian (default) and English menus per scope and verifies them', async () => {
  const p = await setupTest();
  const report = await p.commands.syncCommands();
  assert.equal(report.ok, true, JSON.stringify(report.errors));
  assert.equal(report.scopes.length, 6, '3 scopes × 2 languages');
  assert.ok(report.scopes.every((s) => s.ok));

  const setCalls = calls('setMyCommands');
  assert.equal(setCalls.length, 6);
  const persian = setCalls.filter((c) => c.params.language_code === undefined);
  const english = setCalls.filter((c) => c.params.language_code === 'en');
  assert.equal(persian.length, 3, 'default language menus are Persian');
  assert.equal(english.length, 3);

  const byKey = new Map(
    setCalls.map((c) => [
      `${JSON.stringify(c.params.scope)}#${c.params.language_code ?? 'default'}`,
      c.params.commands,
    ])
  );
  const defaultPersian = byKey.get('{"type":"default"}#default');
  const adminPersian = byKey.get(`{"type":"chat","chat_id":${ADMIN}}#default`);
  const privilegedPersian = byKey.get(`{"type":"chat","chat_id":${PRIVILEGED}}#default`);
  const adminEnglish = byKey.get(`{"type":"chat","chat_id":${ADMIN}}#en`);

  assert.ok(defaultPersian.every((c) => !p.commands.ADMIN_COMMAND_NAMES.has(c.command)));
  assert.equal(
    defaultPersian.find((c) => c.command === 'start').description,
    fa['cmd.start'],
    'the default menu speaks Persian'
  );
  assert.ok(adminPersian.some((c) => c.command === 'admin'));
  assert.ok(adminPersian.some((c) => c.command === 'start'));
  assert.ok(privilegedPersian.every((c) => !p.commands.ADMIN_COMMAND_NAMES.has(c.command)));
  assert.equal(privilegedPersian.length, p.commands.USER_COMMANDS.length);
  assert.equal(
    adminEnglish.find((c) => c.command === 'admin').description,
    en['cmd.admin'],
    'the English menu carries English descriptions'
  );

  // getMyCommands was verified for every scope+language pair.
  assert.equal(calls('getMyCommands').length >= 6, true);

  const version = rawSqlite()
    .prepare("SELECT value FROM platform_settings WHERE key = 'commands_version'")
    .get();
  assert.equal(version.value, p.constants.COMMAND_REGISTRY_VERSION);
});

test('setup endpoint denies non-superadmin init data and allows CLI execution', async () => {
  const p = await setupTest();
  await assert.rejects(
    () => p.setupEndpoint({}, { initData: { user: { id: 111 } } }),
    /Not authorized/
  );
  const cli = await p.setupEndpoint({ action: 'sync-commands' }, {});
  assert.equal(cli.ok, true);
  const admin = await p.setupEndpoint(
    { action: 'sync-commands' },
    { initData: { user: { id: ADMIN } } }
  );
  assert.equal(admin.ok, true);
});
