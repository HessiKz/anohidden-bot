// All user-facing text, localized through lib/i18n. Every builder takes the
// locale as its first argument so flows can pass the user's stored choice.
import { escapeHtml } from '../util/html.js';
import { t, LOCALES, localeName } from '../i18n/index.js';

export function onboardingText(locale, user, link) {
  return t(locale, 'user.onboarding', { link: escapeHtml(link), user });
}

export function targetContextText(locale, owner, isSelf, isUnavailable) {
  if (isSelf) return t(locale, 'user.target.self');
  if (isUnavailable) return t(locale, 'user.target.unavailable');
  return t(locale, 'user.target.body', { owner });
}

export function helpText(locale, isSuperadmin = false) {
  return t(locale, 'user.help', { isSuperadmin: Boolean(isSuperadmin) });
}

export function privacyText(locale) {
  return t(locale, 'user.privacy');
}

export function languageMenuText(locale) {
  return t(locale, 'user.languageMenu', { current: localeName(locale) });
}

export function languageSetText(locale, newLocale) {
  return t(locale, 'user.languageSet', { name: localeName(newLocale) });
}

export function languageKeyboard() {
  return {
    inline_keyboard: [
      LOCALES.map((l) => ({
        text: t(l.code, `btn.lang${l.code === 'fa' ? 'Fa' : 'En'}`),
        callback_data: `usr:lang:${l.code}`,
      })),
    ],
  };
}

export function linkText(locale, link) {
  return t(locale, 'user.link', { link: escapeHtml(link) });
}

export function rollText(locale, link) {
  return t(locale, 'user.roll', { link: escapeHtml(link) });
}

export function invalidLinkText(locale) {
  return t(locale, 'user.invalidLink');
}

export function inactiveLinkText(locale) {
  return t(locale, 'user.inactiveLink');
}

export function suspendedText(locale) {
  return t(locale, 'user.suspended');
}

export function pausedText(locale) {
  return t(locale, 'user.paused');
}

export function notInConversationText(locale) {
  return t(locale, 'user.notInConversation');
}

export function replyInstructionText(locale) {
  return t(locale, 'user.replyInstruction');
}

export function replyUnavailableText(locale) {
  return t(locale, 'user.replyUnavailable');
}

export function blockedConversationText(locale) {
  return t(locale, 'user.blockedConversation');
}

export function linkErrorText(locale) {
  return t(locale, 'user.linkError');
}
