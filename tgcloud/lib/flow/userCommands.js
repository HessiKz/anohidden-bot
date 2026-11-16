import { isBanned, areBlocked } from '../services/moderation.js';
import { isMessagingEnabled } from '../services/settings.js';
import { isSuperadmin } from '../services/permissions.js';
import { setUserUiLanguage } from '../services/users.js';
import {
  ensureActiveLink,
  resolveLinkToken,
  rollLink,
} from '../services/links.js';
import { buildShareUrl, buildUserLink } from '../services/settings.js';
import {
  clearPendingTarget,
  setPendingTarget,
} from '../services/pending.js';
import { sendText } from '../telegram/apiSafe.js';
import {
  backToHelpKeyboard,
  helpKeyboard,
  startKeyboard,
} from '../telegram/keyboards.js';
import { languageKeyboard } from '../ui/user.js';
import { consumeRateLimit } from '../services/rateLimit.js';
import {
  helpText,
  inactiveLinkText,
  invalidLinkText,
  languageMenuText,
  languageSetText,
  linkErrorText,
  linkText,
  onboardingText,
  pausedText,
  privacyText,
  rollText,
  suspendedText,
  targetContextText,
} from '../ui/user.js';
import { t, localeName, localeOf } from '../i18n/index.js';
import { parseStartPayload, isToken } from '../util/validate.js';
import { logError } from '../util/log.js';

export async function handleUserCommand(message, user, parsed) {
  const locale = localeOf(user);
  switch (parsed.command) {
    case 'start':
      await handleStart(message, user, locale);
      return true;
    case 'help':
      await sendText(user.tgId, helpText(locale, isSuperadmin(user.tgId)), {
        replyMarkup: helpKeyboard(locale),
      });
      return true;
    case 'about':
      await sendText(user.tgId, privacyText(locale), {
        replyMarkup: backToHelpKeyboard(locale),
      });
      return true;
    case 'language':
      await sendText(user.tgId, languageMenuText(locale), {
        replyMarkup: languageKeyboard(),
      });
      return true;
    case 'link':
      await handleLink(user, locale);
      return true;
    case 'roll':
      await handleRoll(user, locale);
      return true;
    default:
      return false;
  }
}

async function handleStart(message, user, locale) {
  if (await isBanned(user.id)) {
    await clearPendingTarget(user.id);
    await sendText(user.tgId, suspendedText(locale));
    return;
  }
  const payload = parseStartPayload(message.text);
  if (!payload) {
    await clearPendingTarget(user.id);
    await sendOwnLink(user, { intro: true });
    return;
  }
  // Opening any deep link replaces the previous temporary target, including
  // when the new link turns out to be invalid or is the user's own link.
  await clearPendingTarget(user.id);
  if (!(await isMessagingEnabled())) {
    await sendText(user.tgId, pausedText(locale));
    return;
  }
  if (!isToken(payload)) {
    await sendText(user.tgId, invalidLinkText(locale));
    return;
  }
  const resolved = await resolveLinkToken(payload);
  if (!resolved || !resolved.owner) {
    await sendText(user.tgId, invalidLinkText(locale));
    return;
  }
  if (!resolved.active) {
    await sendText(user.tgId, inactiveLinkText(locale));
    return;
  }
  const owner = resolved.owner;
  if (Number(owner.id) === Number(user.id)) {
    await sendText(user.tgId, targetContextText(locale, owner, true, false));
    return;
  }
  if (await isBanned(owner.id)) {
    await sendText(user.tgId, targetContextText(locale, owner, false, true));
    return;
  }
  if (await areBlocked(user.id, owner.id)) {
    await sendText(user.tgId, targetContextText(locale, owner, false, true));
    return;
  }
  await setPendingTarget(user.id, owner.id, resolved.link.id);
  await sendText(user.tgId, targetContextText(locale, owner, false, false));
}

async function handleLink(user, locale) {
  if (await isBanned(user.id)) {
    await clearPendingTarget(user.id);
    await sendText(user.tgId, suspendedText(locale));
    return;
  }
  await clearPendingTarget(user.id);
  await sendOwnLink(user, { intro: false });
}

async function handleRoll(user, locale) {
  if (await isBanned(user.id)) {
    await clearPendingTarget(user.id);
    await sendText(user.tgId, suspendedText(locale));
    return;
  }
  const limit = await consumeRateLimit(user.id, 'roll', 5, 3600);
  if (!limit.allowed) {
    await sendText(user.tgId, t(locale, 'limits.roll'));
    return;
  }
  const { link } = await rollLink(user.id);
  const url = await buildUserLink(link.token);
  const share = await buildShareUrl(url, locale);
  await sendText(user.tgId, rollText(locale, url), {
    replyMarkup: startKeyboard(locale, share),
  });
}

export async function sendOwnLink(user, options = {}) {
  const locale = localeOf(user);
  try {
    const { link } = await ensureActiveLink(user.id);
    const url = await buildUserLink(link.token);
    const share = await buildShareUrl(url, locale);
    const text = options.intro ? onboardingText(locale, user, url) : linkText(locale, url);
    await sendText(user.tgId, text, { replyMarkup: startKeyboard(locale, share) });
    return url;
  } catch (error) {
    logError('own_link_failed', error, { userId: user.id });
    await sendText(user.tgId, linkErrorText(locale));
    return null;
  }
}

/** Callback handler for the /language menu buttons. */
export async function handleLanguageCallback(callbackQuery, user, locale) {
  const requested = String(
    callbackQuery.data.slice('usr:lang:'.length)
  ).trim();
  const normalized = requested === 'en' ? 'en' : 'fa';
  const updated = await setUserUiLanguage(user.tgId, normalized);
  const effective = localeOf(updated ?? user);
  await sendText(user.tgId, languageSetText(effective, normalized), {
    replyMarkup: helpKeyboard(effective),
  });
  await sendText(user.tgId, helpText(effective, isSuperadmin(user.tgId)), {
    replyMarkup: helpKeyboard(effective),
  });
  return { ok: true, locale: normalized, name: localeName(normalized) };
}
