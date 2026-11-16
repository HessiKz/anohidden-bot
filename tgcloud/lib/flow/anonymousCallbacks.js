import { db } from 'sdk';
import { sql } from 'sdk/db';
import {
  CALLBACK,
  REPORT_STATUS,
  SUPERADMIN_ID,
} from '../constants.js';
import {
  getMessageByPublicToken,
  listAttachments,
} from '../services/messages.js';
import { getUserById } from '../services/users.js';
import {
  blockUser,
  isBanned,
  isBlockedDirection,
} from '../services/moderation.js';
import {
  canRevealIdentity,
  isIdentityPrivileged,
  isSuperadmin,
} from '../services/permissions.js';
import { logAdminAction } from '../services/audit.js';
import { answerCallback, editText, sendText } from '../telegram/apiSafe.js';
import { reportReasonKeyboard } from '../telegram/keyboards.js';
import {
  displayName,
  escapeHtml,
  truncateContent,
  usernameLine,
} from '../util/html.js';
import {
  replyInstructionText,
} from '../ui/user.js';
import { formatDateTime, t } from '../i18n/index.js';
import { isPublicToken } from '../util/validate.js';

export async function handleAnonymousCallback(callbackQuery, user, data, locale) {
  if (data.startsWith(CALLBACK.ANON_REPLY)) {
    await handleReplyButton(callbackQuery, user, data.slice(CALLBACK.ANON_REPLY.length), locale);
    return;
  }
  if (data.startsWith(CALLBACK.ANON_REPORT_REASON)) {
    await handleReportReason(
      callbackQuery,
      user,
      data.slice(CALLBACK.ANON_REPORT_REASON.length),
      locale
    );
    return;
  }
  if (data.startsWith(CALLBACK.ANON_REPORT)) {
    await handleReportMenu(callbackQuery, user, data.slice(CALLBACK.ANON_REPORT.length), locale);
    return;
  }
  if (data.startsWith(CALLBACK.ANON_BLOCK)) {
    await handleBlock(callbackQuery, user, data.slice(CALLBACK.ANON_BLOCK.length), locale);
    return;
  }
  if (data.startsWith(CALLBACK.ANON_REVEAL)) {
    await handleReveal(callbackQuery, user, data.slice(CALLBACK.ANON_REVEAL.length), locale);
    return;
  }
  await answerCallback(callbackQuery, t(locale, 'cb.noLongerAvailable'));
}

async function loadContext(callbackQuery, user, token) {
  if (!isPublicToken(token)) return null;
  if (
    callbackQuery.message?.chat?.type !== 'private' ||
    Number(callbackQuery.message?.chat?.id) !== Number(callbackQuery.from.id)
  ) {
    return null;
  }
  const message = await getMessageByPublicToken(token);
  if (!message) return null;
  // Only the verified recipient of this exact message may act on it.
  if (Number(message.recipientId) !== Number(user.id)) return null;
  return { message };
}

async function handleReplyButton(callbackQuery, user, token, locale) {
  const ctx = await loadContext(callbackQuery, user, token);
  if (!ctx) {
    await answerCallback(callbackQuery, t(locale, 'cb.notAvailableToYou'));
    return;
  }
  await answerCallback(callbackQuery, replyInstructionText(locale), { alert: true });
}

async function handleReportMenu(callbackQuery, user, token, locale) {
  const ctx = await loadContext(callbackQuery, user, token);
  if (!ctx) {
    await answerCallback(callbackQuery, t(locale, 'cb.notAvailableToYou'));
    return;
  }
  await answerCallback(callbackQuery, t(locale, 'cb.chooseReason'));
  await sendText(user.tgId, t(locale, 'report.menu'), {
    replyMarkup: reportReasonKeyboard(locale, token),
  });
}

async function handleReportReason(callbackQuery, user, payload, locale) {
  const split = payload.lastIndexOf(':');
  const token = split === -1 ? '' : payload.slice(0, split);
  const code = split === -1 ? '' : payload.slice(split + 1);
  const reason = t(locale, `report.reason${code[0].toUpperCase()}${code.slice(1)}`);
  if (!['spam', 'abuse', 'scam', 'other'].includes(code)) {
    await answerCallback(callbackQuery, t(locale, 'cb.invalidReason'));
    return;
  }
  const ctx = await loadContext(callbackQuery, user, token);
  if (!ctx) {
    await answerCallback(callbackQuery, t(locale, 'cb.notAvailableToYou'));
    return;
  }
  const { message } = ctx;
  const inserted = await db.run(sql`
    INSERT INTO reports (
      message_id, reporter_id, reported_sender_id, reported_recipient_id,
      reason, status
    ) VALUES (
      ${Number(message.id)}, ${Number(user.id)}, ${Number(message.senderId)},
      ${Number(message.recipientId)}, ${reason}, ${REPORT_STATUS.OPEN}
    )
    ON CONFLICT(message_id, reporter_id) DO NOTHING
    RETURNING *
  `);
  if (!inserted?.rows?.length) {
    await answerCallback(callbackQuery, t(locale, 'cb.alreadyReported'));
    return;
  }
  const report = inserted.rows[0];
  await notifySuperadminAboutReport(report, message, user, reason);
  await answerCallback(callbackQuery, t(locale, 'cb.reportSubmitted'));
  if (callbackQuery.message) {
    await editText(
      callbackQuery.message.chat.id,
      callbackQuery.message.message_id,
      t(locale, 'report.submitted', { reason })
    );
  }
}

async function notifySuperadminAboutReport(report, message, reporter, reason) {
  const locale = 'fa'; // superadmin notification: platform default language
  const sender = await getUserById(message.senderId);
  const recipient = await getUserById(message.recipientId);
  const attachments = await listAttachments(message.id);
  const person = (u, fallbackTgId = 0) =>
    `${escapeHtml(displayName(u) + ' · ')}<code>${Number(u?.tgId ?? fallbackTgId)}</code> ${usernameLine(u)}`;
  const text = t(locale, 'report.superadminNotice', {
    reportId: Number(report.id),
    reason,
    messageId: Number(message.id),
    type: escapeHtml(message.messageType),
    createdAt: formatDateTime(message.createdAt, locale),
    content: truncateContent(message.content, 180),
    attachments: attachments.length,
    reporter: person(reporter),
    sender: person(sender),
    recipient: person(recipient),
  });
  const actionRows = [
    [
      { text: '📋 گزارش', callback_data: `adm:rd:${report.id}:0` },
      { text: '🔎 پیام', callback_data: `adm:md:${message.id}:0` },
    ],
  ];
  if (Number(sender?.tgId) !== SUPERADMIN_ID) {
    actionRows.push([
      { text: '⛔ مسدود کردن فرستنده', callback_data: `adm:banp:${message.senderId}` },
    ]);
  }
  await sendText(SUPERADMIN_ID, text, {
    replyMarkup: { inline_keyboard: actionRows },
  });
}

async function handleBlock(callbackQuery, user, token, locale) {
  const ctx = await loadContext(callbackQuery, user, token);
  if (!ctx) {
    await answerCallback(callbackQuery, t(locale, 'cb.notAvailableToYou'));
    return;
  }
  const { message } = ctx;
  if (await isBlockedDirection(message.recipientId, message.senderId)) {
    await answerCallback(callbackQuery, t(locale, 'cb.alreadyBlocked'));
    return;
  }
  const result = await blockUser(message.recipientId, message.senderId, message.id);
  if (result.self) {
    await answerCallback(callbackQuery, t(locale, 'cb.cannotBlockSelf'));
    return;
  }
  if (result.created) {
    await sendText(user.tgId, t(locale, 'block.confirmText'));
  }
  await answerCallback(
    callbackQuery,
    result.created ? t(locale, 'cb.blockedAlert') : t(locale, 'cb.alreadyBlocked'),
    { alert: result.created }
  );
}

async function handleReveal(callbackQuery, user, token, locale) {
  const ctx = await loadContext(callbackQuery, user, token);
  if (!ctx) {
    await answerCallback(callbackQuery, t(locale, 'cb.notAvailableToYou'));
    return;
  }
  const { message } = ctx;
  const recipientUser = await getUserById(message.recipientId);
  if (!canRevealIdentity(user.tgId, message, recipientUser)) {
    await logAdminAction(user.tgId, 'unauthorized_identity_reveal', {
      targetType: 'message',
      targetId: message.id,
      metadata: { messageId: message.id },
    }).catch(() => {});
    await answerCallback(callbackQuery, t(locale, 'cb.revealDenied'));
    return;
  }
  if (!isSuperadmin(user.tgId) && (await isBanned(user.id))) {
    await answerCallback(callbackQuery, t(locale, 'cb.suspended'));
    return;
  }
  const sender = await getUserById(message.senderId);
  if (!sender) {
    await answerCallback(callbackQuery, t(locale, 'cb.senderMissing'));
    return;
  }
  const attachments = await listAttachments(message.id);
  const attachmentTypes = attachments.length
    ? attachments.map((a) => a.attachmentType).join(', ')
    : t(locale, 'common.none');
  const scope = isSuperadmin(user.tgId)
    ? t(locale, 'reveal.scope.superadmin')
    : isIdentityPrivileged(user.tgId)
      ? t(locale, 'reveal.scope.privileged')
      : t(locale, 'reveal.scope.authorized');
  const text = t(locale, 'reveal.title', {
    scope,
    name: escapeHtml(displayName(sender)),
    firstName: escapeHtml(sender.firstName ?? t(locale, 'reveal.notAvailable')),
    lastName: escapeHtml(sender.lastName ?? t(locale, 'reveal.notAvailable')),
    username: usernameLine(sender),
    tgId: Number(sender.tgId),
    languageCode: escapeHtml(sender.languageCode ?? t(locale, 'common.unknown')),
    messageId: Number(message.id),
    messageType: escapeHtml(message.messageType),
    createdAt: formatDateTime(message.createdAt, locale),
    status: escapeHtml(message.deliveryStatus),
    content: truncateContent(message.content, 400),
    attachments: `${attachments.length}${attachments.length ? ` (${escapeHtml(attachmentTypes)})` : ''}`,
  });
  await sendText(user.tgId, text);
  await logAdminAction(user.tgId, 'identity_reveal', {
    targetType: 'message',
    targetId: message.id,
    metadata: {
      senderTgId: Number(sender.tgId),
      senderUserId: Number(sender.id),
      scope: isSuperadmin(user.tgId) ? 'superadmin' : 'identity_privileged',
    },
  });
  await answerCallback(callbackQuery, t(locale, 'cb.identitySent'));
}
