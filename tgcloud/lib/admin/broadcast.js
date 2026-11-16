import { db, api } from 'sdk';
import { and, eq, inArray, sql } from 'sdk/db';
import {
  BROADCAST_BATCH_SIZE,
  BROADCAST_STATUS,
  ADMIN_STATE,
} from '../constants.js';
import { broadcasts, broadcastDeliveries } from '../../schema.js';
import { isSuperadmin } from '../services/permissions.js';
import { countUsers } from '../services/users.js';
import { logAdminAction } from '../services/audit.js';
import { sendText, editText, answerCallback, botErrorInfo } from '../telegram/apiSafe.js';
import {
  broadcastPreviewKeyboard,
  broadcastProgressKeyboard,
} from './keyboards.js';
import {
  broadcastPreviewText,
  broadcastProgressText,
} from '../ui/admin.js';
import { setAdminState, clearAdminState } from './state.js';
import { detectMessageType, unsupportedReason } from '../services/messageTypes.js';
import { escapeHtml } from '../util/html.js';
import { t, localeOf } from '../i18n/index.js';

export async function startBroadcastCompose(user, locale) {
  if (!isSuperadmin(user.tgId)) return;
  const loc = locale ?? localeOf(user);
  await db
    .update(broadcasts)
    .set({ status: BROADCAST_STATUS.CANCELLED })
    .where(
      and(
        eq(broadcasts.adminTgId, Number(user.tgId)),
        eq(broadcasts.status, BROADCAST_STATUS.PREVIEW)
      )
    )
    .run();
  await setAdminState(user.id, ADMIN_STATE.BROADCAST_COMPOSE);
  await sendText(user.tgId, t(loc, 'admin.composePrompt'), {
    replyMarkup: {
      inline_keyboard: [[{ text: t(loc, 'adm.btn.cancel'), callback_data: 'adm:brcancel' }]],
    },
  });
}

export async function cancelBroadcastCompose(user, locale) {
  await clearAdminState(user.id);
  await sendText(user.tgId, t(locale ?? localeOf(user), 'adm.cb.composeCancelled'));
}

export async function handleBroadcastCompose(message, user) {
  if (!isSuperadmin(user.tgId)) {
    await clearAdminState(user.id);
    return;
  }

  const loc = localeOf(user);
  if (message.media_group_id) {
    await clearAdminState(user.id);
    await sendText(user.tgId, t(loc, 'admin.composeAlbumUnsupported'));
    return;
  }

  if (message.has_protected_content) {
    await sendText(user.tgId, t(loc, 'admin.composeProtected'));
    return;
  }

  const type = detectMessageType(message);
  if (type === 'unsupported') {
    await sendText(user.tgId, '⚠️ ' + t(loc, `delivery.unsupported.${unsupportedReason(message, type)}`));
    return;
  }
  if (
    ['invoice', 'successful_payment', 'story', 'giveaway', 'giveaway_winners', 'giveaway_created'].includes(
      type
    )
  ) {
    await sendText(user.tgId, '⚠️ ' + t(loc, `delivery.unsupported.${unsupportedReason(message, type)}`));
    return;
  }

  const inserted = await db
    .insert(broadcasts)
    .values({
      adminTgId: Number(user.tgId),
      sourceChatId: Number(message.chat.id),
      sourceMessageId: Number(message.message_id),
      messageType: type,
      content: message.text ?? message.caption ?? null,
      status: BROADCAST_STATUS.PREVIEW,
    })
    .returning();

  const broadcast = inserted[0];
  await clearAdminState(user.id);
  const total = await countUsers();

  await logAdminAction(user.tgId, 'admin.broadcast_start', {
    targetType: 'broadcast',
    targetId: broadcast.id,
    metadata: { type, recipients: total },
  });

  await sendText(user.tgId, broadcastPreviewText(loc, broadcast, total), {
    replyMarkup: broadcastPreviewKeyboard(loc, broadcast.id),
  });
}

export async function confirmBroadcast(callbackQuery, user, rawId) {
  const locale = localeOf(user);
  if (!isSuperadmin(user.tgId)) {
    await answerCallback(callbackQuery, t(locale, 'cb.notAvailable'));
    return;
  }
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    await answerCallback(callbackQuery, t(locale ?? localeOf(user), 'adm.cb.broadcastNotFound'));
    return;
  }

  const broadcast = await getBroadcast(id);
  if (!broadcast || Number(broadcast.adminTgId) !== Number(user.tgId)) {
    await answerCallback(callbackQuery, t(locale ?? localeOf(user), 'adm.cb.broadcastNotFound'));
    return;
  }

  const total = await countUsers();
  const claimed = await db
    .update(broadcasts)
    .set({
      status: BROADCAST_STATUS.SENDING,
      totalRecipients: total,
      completedAt: null,
    })
    .where(
      and(eq(broadcasts.id, id), eq(broadcasts.status, BROADCAST_STATUS.PREVIEW))
    )
    .returning({ id: broadcasts.id });

  if (claimed.length === 0) {
    await answerCallback(callbackQuery, t(locale, 'adm.cb.reportAlreadyReviewed'));
    return;
  }

  await logAdminAction(user.tgId, 'admin.broadcast_confirm', {
    targetType: 'broadcast',
    targetId: id,
    metadata: { recipients: total },
  });

  await answerCallback(callbackQuery, t(locale, 'adm.cb.broadcast'));
  const progress = await runBroadcastBatch(id, user);
  if (!progress) {
    await sendText(user.tgId, t(locale, 'adm.cb.broadcastNotRunning'));
    return;
  }
  await renderProgress(callbackQuery, user, progress);
}

export async function runBroadcastBatch(id, user) {
  if (!isSuperadmin(user.tgId)) return null;
  const broadcast = await getBroadcast(id);
  if (!broadcast || Number(broadcast.adminTgId) !== Number(user.tgId)) return null;
  if (broadcast.status !== BROADCAST_STATUS.SENDING) return null;

  const recipients = await db.all(sql`
    SELECT u.id, u.tg_id
    FROM users u
    WHERE NOT EXISTS (
      SELECT 1 FROM broadcast_deliveries d
      WHERE d.broadcast_id = ${Number(id)} AND d.user_id = u.id
    )
    ORDER BY u.id ASC
    LIMIT ${BROADCAST_BATCH_SIZE}
  `);

  for (const recipient of recipients) {
    const inserted = await db.run(sql`
      INSERT INTO broadcast_deliveries (broadcast_id, user_id, status)
      VALUES (${Number(id)}, ${Number(recipient.id)}, 'pending')
      ON CONFLICT(broadcast_id, user_id) DO NOTHING
      RETURNING id
    `);

    if (!inserted?.rows?.length) continue;
    const deliveryId = inserted.rows[0].id;

    let error = null;
    try {
      await api.copyMessage({
        chat_id: Number(recipient.tg_id),
        from_chat_id: Number(broadcast.sourceChatId),
        message_id: Number(broadcast.sourceMessageId),
      });
    } catch (copyError) {
      const info = botErrorInfo(copyError);
      if (broadcast.messageType === 'text' && broadcast.content) {
        try {
          await sendText(Number(recipient.tg_id), escapeHtml(broadcast.content), {
            maxLength: 4096,
          });
        } catch (textError) {
          error = info.description;
        }
      } else {
        error = info.description;
      }
    }

    await db
      .update(broadcastDeliveries)
      .set({
        status: error ? 'failed' : 'sent',
        error: error ? String(error).slice(0, 400) : null,
        sentAt: error ? null : new Date(),
      })
      .where(eq(broadcastDeliveries.id, deliveryId))
      .run();
  }

  const progress = await getBroadcastProgress(id);
  if (!progress) return null;

  await db
    .update(broadcasts)
    .set({
      sentCount: progress.totals.sent,
      failedCount: progress.totals.failed,
      ...(progress.totals.remaining === 0
        ? { status: BROADCAST_STATUS.COMPLETED, completedAt: new Date() }
        : {}),
    })
    .where(eq(broadcasts.id, id))
    .run();

  const updated = await getBroadcast(id);
  if (progress.totals.remaining === 0) {
    await logAdminAction(user.tgId, 'admin.broadcast_complete', {
      targetType: 'broadcast',
      targetId: id,
      metadata: progress.totals,
    });
  }

  return {
    broadcast: updated ?? { ...broadcast, status: progress.totals.remaining === 0 ? BROADCAST_STATUS.COMPLETED : broadcast.status },
    totals: progress.totals,
  };
}

export async function getBroadcastProgress(id) {
  const broadcast = await getBroadcast(id);
  if (!broadcast) return null;
  const [total, sent, failed, pending, remainingRow] = await Promise.all([
    countUsers(),
    db.$count(
      broadcastDeliveries,
      and(
        eq(broadcastDeliveries.broadcastId, Number(id)),
        eq(broadcastDeliveries.status, 'sent')
      )
    ),
    db.$count(
      broadcastDeliveries,
      and(
        eq(broadcastDeliveries.broadcastId, Number(id)),
        eq(broadcastDeliveries.status, 'failed')
      )
    ),
    db.$count(
      broadcastDeliveries,
      and(
        eq(broadcastDeliveries.broadcastId, Number(id)),
        eq(broadcastDeliveries.status, 'pending')
      )
    ),
    db.get(sql`
      SELECT count(*) AS n
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM broadcast_deliveries d
        WHERE d.broadcast_id = ${Number(id)} AND d.user_id = u.id
      )
    `),
  ]);
  return {
    broadcast,
    totals: {
      total,
      sent: Number(sent),
      failed: Number(failed),
      pending: Number(pending),
      remaining: Number(remainingRow?.n ?? 0),
    },
  };
}

export async function cancelBroadcast(id, user) {
  if (!isSuperadmin(user.tgId)) return null;
  const broadcast = await getBroadcast(id);
  if (!broadcast || Number(broadcast.adminTgId) !== Number(user.tgId)) return null;
  await db
    .update(broadcasts)
    .set({ status: BROADCAST_STATUS.CANCELLED, completedAt: new Date() })
    .where(
      and(
        eq(broadcasts.id, Number(id)),
        inArray(broadcasts.status, [
          BROADCAST_STATUS.PREVIEW,
          BROADCAST_STATUS.SENDING,
        ])
      )
    )
    .run();
  await logAdminAction(user.tgId, 'admin.broadcast_cancel', {
    targetType: 'broadcast',
    targetId: id,
    metadata: {},
  });
  return getBroadcastProgress(id);
}

async function renderProgress(callbackQuery, user, progress) {
  const locale = localeOf(user);
  const text = broadcastProgressText(locale, progress.broadcast, progress.totals);
  const keyboard = broadcastProgressKeyboard(
    locale,
    progress.broadcast.id,
    progress.totals.remaining
  );
  if (callbackQuery.message && typeof callbackQuery.message.text === 'string') {
    const edited = await editText(
      callbackQuery.message.chat.id,
      callbackQuery.message.message_id,
      text,
      { replyMarkup: keyboard }
    );
    if (edited) return;
  }
  await sendText(user.tgId, text, { replyMarkup: keyboard });
}

async function getBroadcast(id) {
  return db
    .select()
    .from(broadcasts)
    .where(eq(broadcasts.id, Number(id)))
    .get();
}
