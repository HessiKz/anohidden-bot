import { db } from 'sdk';
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  like,
  or,
  sql,
} from 'sdk/db';
import {
  conversations,
  messageAttachments,
  messageRoutes,
  messages,
} from '../../schema.js';
import { MEDIA_TYPES, MESSAGE_STATUS, PAGE_SIZE } from '../constants.js';
import { publicToken } from '../util/token.js';
import { daysAgo } from '../util/time.js';

export async function getMessageById(id) {
  if (!Number.isFinite(Number(id))) return null;
  return db.select().from(messages).where(eq(messages.id, Number(id))).get();
}

export async function getMessageByPublicToken(token) {
  if (typeof token !== 'string' || !token) return null;
  return db
    .select()
    .from(messages)
    .where(eq(messages.publicToken, token))
    .get();
}

export async function getMessageBySource(sourceChatId, sourceMessageId) {
  return db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.sourceChatId, Number(sourceChatId)),
        eq(messages.sourceMessageId, Number(sourceMessageId))
      )
    )
    .get();
}

/**
 * Insert one internal message record. The unique (source_chat_id,
 * source_message_id) index makes a duplicate update harmless.
 */
export async function createMessage(values) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const inserted = await db
        .insert(messages)
        .values({ ...values, publicToken: publicToken() })
        .returning();
      if (inserted.length > 0) return { message: inserted[0], created: true };
    } catch (error) {
      const existing = await getMessageBySource(
        values.sourceChatId,
        values.sourceMessageId
      );
      if (existing) return { message: existing, created: false };
      // Only a token collision is safely retryable here.
      if (attempt === 4) throw error;
    }
  }
  throw new Error('Could not create a unique message record.');
}

export async function updateMessage(id, values) {
  await db.update(messages).set(values).where(eq(messages.id, Number(id))).run();
}

export async function markMessageDelivered(id, { chatId, telegramMessageId, isAlbum }) {
  await db
    .update(messages)
    .set({
      deliveryStatus: MESSAGE_STATUS.DELIVERED,
      deliveredChatId: Number(chatId),
      deliveredMessageId: Number(telegramMessageId),
      deliveredAt: new Date(),
      deliveryError: null,
      ...(isAlbum === undefined ? {} : { isAlbum: Boolean(isAlbum) }),
    })
    .where(eq(messages.id, Number(id)))
    .run();
}

export async function markMessageFailed(id, error, status = MESSAGE_STATUS.FAILED) {
  await db
    .update(messages)
    .set({
      deliveryStatus: status,
      deliveryError: String(error ?? 'unknown error').slice(0, 500),
    })
    .where(eq(messages.id, Number(id)))
    .run();
}

export async function claimAlbumGroup(sourceChatId, mediaGroupId) {
  if (!mediaGroupId) return [];
  const result = await db.run(sql`
    UPDATE messages
    SET delivery_status = ${MESSAGE_STATUS.DELIVERING}
    WHERE source_chat_id = ${Number(sourceChatId)}
      AND media_group_id = ${String(mediaGroupId)}
      AND delivery_status = ${MESSAGE_STATUS.PENDING_ALBUM}
    RETURNING *
  `);
  return result?.rows ?? [];
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function createRoute(messageId, chatId, telegramMessageId, isControl = false) {
  const result = await db.run(sql`
    INSERT INTO message_routes (message_id, chat_id, telegram_message_id, is_control)
    VALUES (${Number(messageId)}, ${Number(chatId)}, ${Number(telegramMessageId)}, ${isControl ? 1 : 0})
    ON CONFLICT(chat_id, telegram_message_id) DO NOTHING
    RETURNING *
  `);
  return result?.rows?.[0] ?? null;
}

export async function findRoute(chatId, telegramMessageId) {
  return db
    .select()
    .from(messageRoutes)
    .where(
      and(
        eq(messageRoutes.chatId, Number(chatId)),
        eq(messageRoutes.telegramMessageId, Number(telegramMessageId))
      )
    )
    .get();
}

export async function listRoutesForMessage(messageId) {
  return db
    .select()
    .from(messageRoutes)
    .where(eq(messageRoutes.messageId, Number(messageId)))
    .orderBy(asc(messageRoutes.id))
    .all();
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export async function createConversation(initiatorId, ownerId) {
  const inserted = await db
    .insert(conversations)
    .values({
      initiatorId: Number(initiatorId),
      ownerId: Number(ownerId),
      lastActivityAt: new Date(),
    })
    .returning();
  return inserted[0];
}

/**
 * One album update arrives as several Telegram messages. They must all share a
 * conversation. The unique album_key makes this race-safe.
 */
export async function ensureAlbumConversation(initiatorId, ownerId, sourceChatId, mediaGroupId) {
  const albumKey = `${Number(sourceChatId)}:${String(mediaGroupId)}`;
  const existing = await db
    .select()
    .from(conversations)
    .where(eq(conversations.albumKey, albumKey))
    .get();
  if (existing) return existing;

  const inserted = await db
    .insert(conversations)
    .values({
      initiatorId: Number(initiatorId),
      ownerId: Number(ownerId),
      albumKey,
      lastActivityAt: new Date(),
    })
    .onConflictDoNothing({ target: conversations.albumKey })
    .returning();
  if (inserted.length > 0) return inserted[0];

  return db
    .select()
    .from(conversations)
    .where(eq(conversations.albumKey, albumKey))
    .get();
}

export async function getConversation(id) {
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.id, Number(id)))
    .get();
}

export async function setConversationRoot(conversationId, messageId) {
  await db
    .update(conversations)
    .set({ rootMessageId: Number(messageId), lastActivityAt: new Date() })
    .where(eq(conversations.id, Number(conversationId)))
    .run();
}

export async function setConversationRootIfEmpty(conversationId, messageId) {
  await db.run(sql`
    UPDATE conversations
    SET root_message_id = ${Number(messageId)}, last_activity_at = ${Math.floor(Date.now() / 1000)}
    WHERE id = ${Number(conversationId)} AND root_message_id IS NULL
  `);
}

export async function touchConversation(conversationId) {
  await db
    .update(conversations)
    .set({ lastActivityAt: new Date() })
    .where(eq(conversations.id, Number(conversationId)))
    .run();
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export async function insertAttachments(messageId, attachments) {
  if (!attachments?.length) return;
  await db
    .insert(messageAttachments)
    .values(
      attachments.map((item) => ({
        messageId: Number(messageId),
        position: Number(item.position ?? 0),
        attachmentType: item.attachmentType,
        fileId: item.fileId ?? null,
        fileUniqueId: item.fileUniqueId ?? null,
        mimeType: item.mimeType ?? null,
        fileName: item.fileName ?? null,
        fileSize: item.fileSize ?? null,
        width: item.width ?? null,
        height: item.height ?? null,
        duration: item.duration ?? null,
        caption: item.caption ?? null,
        metadata: item.metadata ?? null,
      }))
    )
    .run();
}

export async function listAttachments(messageId) {
  return db
    .select()
    .from(messageAttachments)
    .where(eq(messageAttachments.messageId, Number(messageId)))
    .orderBy(asc(messageAttachments.position))
    .all();
}

// ---------------------------------------------------------------------------
// Explorer queries
// ---------------------------------------------------------------------------

function buildMessageFilters(filters = {}) {
  const conditions = [];
  if (filters.senderId) conditions.push(eq(messages.senderId, Number(filters.senderId)));
  if (filters.recipientId) {
    conditions.push(eq(messages.recipientId, Number(filters.recipientId)));
  }
  if (filters.type === 'text') conditions.push(eq(messages.messageType, 'text'));
  if (filters.type === 'media') {
    conditions.push(inArray(messages.messageType, MEDIA_TYPES));
  }
  if (filters.type === 'failed') {
    conditions.push(eq(messages.deliveryStatus, MESSAGE_STATUS.FAILED));
  }
  if (filters.days > 0) {
    const seconds = Math.floor(daysAgo(filters.days).getTime() / 1000);
    conditions.push(sql`${messages.createdAt} >= ${seconds}`);
  }
  if (filters.conversationId) {
    conditions.push(eq(messages.conversationId, Number(filters.conversationId)));
  }
  return conditions;
}

export async function listMessages(filters = {}, page = 0, pageSize = PAGE_SIZE) {
  const conditions = buildMessageFilters(filters);
  const base = db.select().from(messages);
  const filtered = conditions.length ? base.where(and(...conditions)) : base;
  return filtered
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(pageSize)
    .offset(Math.max(0, page) * pageSize)
    .all();
}

export async function countMessages(filters = {}) {
  const conditions = buildMessageFilters(filters);
  return conditions.length
    ? db.$count(messages, and(...conditions))
    : db.$count(messages);
}

export async function searchMessages(query, limit = 10) {
  const q = String(query ?? '').trim();
  if (!q) return [];
  return db
    .select()
    .from(messages)
    .where(like(messages.content, `%${q}%`))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(limit)
    .all();
}

export async function messagesForUser(userId, direction = 'all', page = 0, pageSize = PAGE_SIZE) {
  const id = Number(userId);
  let condition;
  if (direction === 'sent') condition = eq(messages.senderId, id);
  else if (direction === 'received') condition = eq(messages.recipientId, id);
  else condition = or(eq(messages.senderId, id), eq(messages.recipientId, id));

  return db
    .select()
    .from(messages)
    .where(condition)
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(pageSize)
    .offset(Math.max(0, page) * pageSize)
    .all();
}

export async function countMessagesForUser(userId, direction = 'all') {
  const id = Number(userId);
  if (direction === 'sent') return db.$count(messages, eq(messages.senderId, id));
  if (direction === 'received') return db.$count(messages, eq(messages.recipientId, id));
  return db.$count(messages, or(eq(messages.senderId, id), eq(messages.recipientId, id)));
}

export async function conversationMessages(conversationId) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, Number(conversationId)))
    .orderBy(asc(messages.createdAt), asc(messages.id))
    .all();
}

export async function countReplies() {
  return db.$count(messages, isNotNull(messages.parentId));
}

export async function countFailedMessages() {
  return db.$count(messages, eq(messages.deliveryStatus, MESSAGE_STATUS.FAILED));
}

export async function recentMessages(limit = 5) {
  return db
    .select()
    .from(messages)
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(limit)
    .all();
}
