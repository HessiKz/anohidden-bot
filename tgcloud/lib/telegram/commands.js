import { api } from 'sdk';
import {
  COMMAND_DESCRIPTION_MAX,
  COMMAND_DESCRIPTION_MIN,
  COMMAND_NAME_RE,
  COMMAND_REGISTRY_VERSION,
  IDENTITY_PRIVILEGED_ID,
  SETTING_KEYS,
  SUPERADMIN_ID,
} from '../constants.js';
import { t, DEFAULT_LOCALE } from '../i18n/index.js';
import { getSetting, setSetting } from '../services/settings.js';
import { logError, logWarn } from '../util/log.js';

// Canonical registry. Every command implemented by the bot appears here with
// its name; descriptions come from the i18n catalogs so the Telegram menu can
// be registered per language (Persian default, English for en clients).
export const USER_COMMANDS = [
  'start',
  'help',
  'link',
  'roll',
  'about',
  'language',
];

export const ADMIN_COMMANDS = [
  'admin',
  'stats',
  'users',
  'user',
  'messages',
  'message',
  'search',
  'reports',
  'ban',
  'unban',
  'broadcast',
  'export',
];

export function commandsInLocale(locale) {
  const describe = (name) => t(locale, `cmd.${name}`);
  const build = (names) =>
    names.map((command) => ({ command, description: describe(command) }));
  return {
    user: build(USER_COMMANDS),
    admin: build(ADMIN_COMMANDS),
  };
}

/** Back-compat exports used by tests and guards. */
export function userCommands(locale = DEFAULT_LOCALE) {
  return commandsInLocale(locale).user;
}
export function adminCommands(locale = DEFAULT_LOCALE) {
  return commandsInLocale(locale).admin;
}

export function superadminCommands(locale = DEFAULT_LOCALE) {
  const { user, admin } = commandsInLocale(locale);
  return [...user, ...admin];
}

export const ADMIN_COMMAND_NAMES = new Set(ADMIN_COMMANDS);
export const USER_COMMAND_NAMES = new Set(USER_COMMANDS);
export const ALL_COMMAND_NAMES = new Set([
  ...USER_COMMAND_NAMES,
  ...ADMIN_COMMAND_NAMES,
]);

export function validateCommandRegistry() {
  const errors = [];
  const seen = new Set();
  for (const [group, names] of [
    ['user', USER_COMMANDS],
    ['admin', ADMIN_COMMANDS],
  ]) {
    for (const name of names) {
      if (!COMMAND_NAME_RE.test(name)) {
        errors.push(`${group}: invalid command "${name}"`);
      }
      if (seen.has(name)) {
        errors.push(`duplicate command "${name}"`);
      }
      seen.add(name);
      for (const locale of [DEFAULT_LOCALE, 'en']) {
        const len = t(locale, `cmd.${name}`).length;
        if (len < COMMAND_DESCRIPTION_MIN || len > COMMAND_DESCRIPTION_MAX) {
          errors.push(
            `${group}: description for "${name}" (${locale}) is ${len} chars (allowed ${COMMAND_DESCRIPTION_MIN}-${COMMAND_DESCRIPTION_MAX})`
          );
        }
      }
    }
  }
  return errors;
}

function normalizeCommands(commands) {
  return (commands ?? [])
    .map((c) => ({ command: String(c.command), description: String(c.description) }))
    .sort((a, b) => a.command.localeCompare(b.command));
}

function sameCommands(a, b) {
  const left = normalizeCommands(a);
  const right = normalizeCommands(b);
  if (left.length !== right.length) return false;
  return left.every(
    (item, index) =>
      item.command === right[index].command &&
      item.description === right[index].description
  );
}

/**
 * Scopes are registered twice: once without a language code (the fallback —
 * Persian, the platform default) and once with language_code 'en' so clients
 * set to English see English descriptions.
 */
const SCOPES = [
  {
    name: 'default',
    scope: { type: 'default' },
    commands: (locale) => superadminUserCommands(locale),
  },
  {
    name: 'superadmin',
    scope: { type: 'chat', chat_id: SUPERADMIN_ID },
    commands: (locale) => superadminCommands(locale),
  },
  {
    name: 'identity_privileged',
    scope: { type: 'chat', chat_id: IDENTITY_PRIVILEGED_ID },
    commands: (locale) => superadminUserCommands(locale),
  },
];

function superadminUserCommands(locale) {
  return userCommands(locale);
}

const LANGUAGES = [DEFAULT_LOCALE, 'en'];

/**
 * Register all command lists (per scope × language) and verify them with
 * getMyCommands. A failed per-scope registration is reported, not ignored.
 */
export async function syncCommands() {
  const registryErrors = validateCommandRegistry();
  if (registryErrors.length) {
    const message = registryErrors.join('; ');
    await setSetting(SETTING_KEYS.COMMANDS_LAST_ERROR, message);
    return { ok: false, errors: registryErrors, scopes: [] };
  }
  await setSetting(SETTING_KEYS.COMMANDS_LAST_ATTEMPT, String(Date.now()));
  const report = { ok: true, errors: [], scopes: [] };
  for (const item of SCOPES) {
    for (const language of LANGUAGES) {
      const scopeReport = {
        name: language === DEFAULT_LOCALE ? item.name : `${item.name}@${language}`,
        ok: false,
        expected: item.commands(language).length,
        actual: 0,
        error: null,
      };
      const payload = { commands: item.commands(language), scope: item.scope };
      if (language !== DEFAULT_LOCALE) payload.language_code = language;
      try {
        await api.setMyCommands(payload);
        let actual = await api.getMyCommands(payload);
        if (!sameCommands(actual, payload.commands)) {
          // Telegram occasionally needs a second write after a scope was
          // first created; retry once, then report a real mismatch.
          await api.setMyCommands(payload);
          actual = await api.getMyCommands(payload);
        }
        scopeReport.actual = (actual ?? []).length;
        scopeReport.ok = sameCommands(actual, payload.commands);
        if (!scopeReport.ok) {
          scopeReport.error = 'getMyCommands does not match the registry';
          report.ok = false;
          report.errors.push(`${scopeReport.name}: ${scopeReport.error}`);
        }
      } catch (error) {
        scopeReport.error = String(error?.description ?? error?.message ?? error).slice(0, 200);
        report.ok = false;
        report.errors.push(`${scopeReport.name}: ${scopeReport.error}`);
        logError('command_scope_sync_failed', error, { scope: scopeReport.name });
      }
      report.scopes.push(scopeReport);
    }
  }
  if (report.ok) {
    await setSetting(SETTING_KEYS.COMMANDS_VERSION, COMMAND_REGISTRY_VERSION);
    await setSetting(SETTING_KEYS.COMMANDS_SYNCED_AT, new Date().toISOString());
    await setSetting(SETTING_KEYS.COMMANDS_LAST_ERROR, '');
  } else {
    await setSetting(SETTING_KEYS.COMMANDS_LAST_ERROR, report.errors.join('; '));
    logWarn('command_sync_incomplete', { errors: report.errors });
  }
  return report;
}

/**
 * Called from /start as a self-healing deployment step. It is cheap: one
 * settings read unless the registry version changed. Failures never prevent
 * onboarding.
 */
export async function ensureCommandsSynced() {
  try {
    const version = await getSetting(SETTING_KEYS.COMMANDS_VERSION, null);
    if (version === COMMAND_REGISTRY_VERSION) return { skipped: true, ok: true };
    const lastAttempt = Number(
      await getSetting(SETTING_KEYS.COMMANDS_LAST_ATTEMPT, '0')
    );
    if (Number.isFinite(lastAttempt) && Date.now() - lastAttempt < 10 * 60 * 1000) {
      return { skipped: true, ok: false, cooldown: true };
    }
    return await syncCommands();
  } catch (error) {
    logError('ensure_commands_failed', error);
    return { ok: false, error };
  }
}

export async function getRegisteredCommands(scope) {
  return api.getMyCommands({ scope });
}
