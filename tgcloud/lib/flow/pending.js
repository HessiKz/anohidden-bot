import { getLinkById, isLinkActive } from '../services/links.js';
import { getUserById } from '../services/users.js';
import { areBlocked, isBanned } from '../services/moderation.js';
import { isMessagingEnabled } from '../services/settings.js';
import { consumeRateLimit } from '../services/rateLimit.js';
import { clearPendingTarget } from '../services/pending.js';
import { submitAnonymousMessage } from '../services/delivery.js';
import { sendText } from '../telegram/apiSafe.js';
import {
  inactiveLinkText,
  pausedText,
  suspendedText,
  targetContextText,
} from '../ui/user.js';
import { t } from '../i18n/index.js';

export async function handlePendingMessage(message, user, pending, locale) {
  const recipient = await getUserById(pending.recipientId);
  if (!recipient) {
    await clearPendingTarget(user.id);
    await sendText(user.tgId, targetContextText(locale, null, false, true));
    return;
  }
  if (!(await isLinkActive(pending.linkId))) {
    await clearPendingTarget(user.id);
    await sendText(user.tgId, inactiveLinkText(locale));
    return;
  }
  if (Number(recipient.id) === Number(user.id)) {
    await clearPendingTarget(user.id);
    await sendText(user.tgId, targetContextText(locale, recipient, true, false));
    return;
  }
  if (await isBanned(user.id)) {
    await clearPendingTarget(user.id);
    await sendText(user.tgId, suspendedText(locale));
    return;
  }
  if (await isBanned(recipient.id)) {
    await clearPendingTarget(user.id);
    await sendText(user.tgId, targetContextText(locale, recipient, false, true));
    return;
  }
  if (!(await isMessagingEnabled())) {
    await sendText(user.tgId, pausedText(locale));
    return;
  }
  if (await areBlocked(user.id, recipient.id)) {
    await clearPendingTarget(user.id);
    await sendText(user.tgId, targetContextText(locale, recipient, false, true));
    return;
  }
  const limit = await consumeRateLimit(user.id, 'send', 30, 60);
  if (!limit.allowed) {
    await sendText(user.tgId, t(locale, 'limits.send'));
    return;
  }
  // Keep the context for the rest of its TTL so a visitor can send several
  // messages. It is revalidated on every send.
  const link = await getLinkById(pending.linkId);
  if (!link || Number(link.userId) !== Number(recipient.id)) {
    await clearPendingTarget(user.id);
    await sendText(user.tgId, inactiveLinkText(locale));
    return;
  }
  await submitAnonymousMessage({
    senderUser: user,
    recipientUser: recipient,
    sourceMessage: message,
  });
}
