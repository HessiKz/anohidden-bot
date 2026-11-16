import { CALLBACK } from '../constants.js';
import { upsertUser } from '../services/users.js';
import { ensureActiveLink } from '../services/links.js';
import { isSuperadmin } from '../services/permissions.js';
import { logAdminAction } from '../services/audit.js';
import { answerCallback } from '../telegram/apiSafe.js';
import { handleAdminCallback } from '../admin/callbacks.js';
import { handleAnonymousCallback } from './anonymousCallbacks.js';
import { handleUserCallback, handleLanguageCallback } from './userCallbacks.js';
import { t, localeOf } from '../i18n/index.js';
import { logError } from '../util/log.js';

export async function handleCallback(callbackQuery) {
  if (!callbackQuery?.from || callbackQuery.from.is_bot) return;
  const data = String(callbackQuery.data ?? '');
  if (!data) {
    await answerCallback(callbackQuery, t('fa', 'cb.noAction'));
    return;
  }
  const registered = await upsertUser(callbackQuery.from);
  if (!registered?.user) {
    await answerCallback(callbackQuery, t('fa', 'cb.accountError'));
    return;
  }
  const user = registered.user;
  const locale = localeOf(user);
  if (registered.isNew) {
    await ensureActiveLink(user.id).catch(() => {});
  }
  try {
    if (data.startsWith('usr:lang:')) {
      await handleLanguageCallback(callbackQuery, user, locale);
      return;
    }
    if (data.startsWith(CALLBACK.ADMIN)) {
      if (!isSuperadmin(user.tgId)) {
        await logAdminAction(user.tgId, 'unauthorized_admin_callback', {
          targetType: 'callback',
          targetId: data.slice(0, 80),
          metadata: { data: data.slice(0, 80) },
        }).catch(() => {});
        await answerCallback(callbackQuery, t(locale, 'cb.notAvailable'));
        return;
      }
      await handleAdminCallback(callbackQuery, user, data, locale);
      return;
    }
    if (
      data.startsWith(CALLBACK.ANON_REPLY) ||
      data.startsWith(CALLBACK.ANON_REPORT_REASON) ||
      data.startsWith(CALLBACK.ANON_REPORT) ||
      data.startsWith(CALLBACK.ANON_BLOCK) ||
      data.startsWith(CALLBACK.ANON_REVEAL)
    ) {
      await handleAnonymousCallback(callbackQuery, user, data, locale);
      return;
    }
    if (data.startsWith(CALLBACK.USER)) {
      await handleUserCallback(callbackQuery, user, data, locale);
      return;
    }
    await answerCallback(callbackQuery, t(locale, 'cb.noLongerAvailable'));
  } catch (error) {
    logError('callback_handler_failed', error, {
      userId: user.id,
      prefix: data.slice(0, 20),
    });
    await answerCallback(callbackQuery, t(locale, 'cb.genericError'));
  }
}
