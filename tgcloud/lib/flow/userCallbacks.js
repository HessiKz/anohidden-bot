import { ensureActiveLink } from '../services/links.js';
import { clearPendingTarget } from '../services/pending.js';
import { isBanned } from '../services/moderation.js';
import { buildShareUrl, buildUserLink } from '../services/settings.js';
import { isSuperadmin } from '../services/permissions.js';
import { sendText } from '../telegram/apiSafe.js';
import {
  startKeyboard,
  backToHelpKeyboard,
  helpKeyboard,
} from '../telegram/keyboards.js';
import {
  helpText,
  linkText,
  privacyText,
  replyInstructionText,
  suspendedText,
} from '../ui/user.js';
import { CALLBACK } from '../constants.js';
import { t } from '../i18n/index.js';
import { handleLanguageCallback } from './userCommands.js';
import { answerCallback } from '../telegram/apiSafe.js';

export async function handleUserCallback(callbackQuery, user, data, locale) {
  if (
    callbackQuery.message?.chat?.type !== 'private' ||
    Number(callbackQuery.message?.chat?.id) !== Number(callbackQuery.from.id)
  ) {
    await answerCallback(callbackQuery, t(locale, 'cb.notAvailableHere'));
    return;
  }
  const action = data.slice(CALLBACK.USER.length);
  if (action === 'link') {
    if (await isBanned(user.id)) {
      await answerCallback(callbackQuery, t(locale, 'cb.suspended'));
      return;
    }
    const { link } = await ensureActiveLink(user.id);
    await clearPendingTarget(user.id);
    const url = await buildUserLink(link.token);
    const share = await buildShareUrl(url, locale);
    await sendText(user.tgId, linkText(locale, url), {
      replyMarkup: startKeyboard(locale, share),
    });
    await answerCallback(callbackQuery, t(locale, 'cb.linkSent'));
    return;
  }
  if (action === 'help') {
    await sendText(user.tgId, helpText(locale, isSuperadmin(user.tgId)), {
      replyMarkup: helpKeyboard(locale),
    });
    await answerCallback(callbackQuery, t(locale, 'cb.helpSent'));
    return;
  }
  if (action === 'privacy') {
    await sendText(user.tgId, privacyText(locale), {
      replyMarkup: backToHelpKeyboard(locale),
    });
    await answerCallback(callbackQuery, t(locale, 'cb.privacySent'));
    return;
  }
  if (action === 'replyhelp') {
    await sendText(user.tgId, replyInstructionText(locale));
    await answerCallback(callbackQuery, t(locale, 'cb.replyHelpSent'));
    return;
  }
  await answerCallback(callbackQuery, t(locale, 'cb.noLongerAvailable'));
}

export { handleLanguageCallback };
