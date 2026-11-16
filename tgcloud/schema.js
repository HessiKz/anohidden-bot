// Database schema for the anonymous Telegram messaging platform.
//
// Telegram Serverless runs SQLite with foreign keys disabled. All relationships
// below are therefore logical (integer id columns) and are enforced in
// application code. Drops only happen through `.deprecated()`, and migrations
// are applied explicitly with `npx tgcloud migrate`.
//
// Every table is a named export so the platform can discover it.

import {
  table,
  integer,
  text,
  boolean,
  json,
  index,
  uniqueIndex,
  sql,
} from 'sdk/db';

// ---------------------------------------------------------------------------
// Users and links
// ---------------------------------------------------------------------------

export const users = table(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tgId: integer('tg_id').unique().notNull(),
    username: text('username'),
    firstName: text('first_name'),
    lastName: text('last_name'),
    languageCode: text('language_code'),
    // Bot UI language ('fa' | 'en'). Null = platform default (Persian).
    uiLanguage: text('ui_language'),
    isBot: boolean('is_bot').default(false),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    lastActiveAt: integer('last_active_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    usernameIdx: index('idx_users_username').on(t.username),
    createdIdx: index('idx_users_created').on(t.createdAt),
    activeIdx: index('idx_users_active').on(t.lastActiveAt),
  })
);

export const userLinks = table(
  'user_links',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull(),
    token: text('token').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  },
  (t) => ({
    tokenIdx: uniqueIndex('uidx_user_links_token').on(t.token),
    userIdx: index('idx_user_links_user').on(t.userId),
    // At most one active link per user. Historical rows stay for auditing.
    activeUserIdx: uniqueIndex('uidx_user_links_active_user')
      .on(t.userId)
      .where(sql`is_active = 1`),
  })
);

// A limited-lifetime routing context created by opening a deep link.
export const pendingTargets = table(
  'pending_targets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull(),
    recipientId: integer('recipient_id').notNull(),
    linkId: integer('link_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    userIdx: uniqueIndex('uidx_pending_targets_user').on(t.userId),
    expiryIdx: index('idx_pending_targets_expiry').on(t.expiresAt),
  })
);

// ---------------------------------------------------------------------------
// Conversations, messages, delivery routing
// ---------------------------------------------------------------------------

export const conversations = table(
  'conversations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    initiatorId: integer('initiator_id').notNull(),
    ownerId: integer('owner_id').notNull(),
    // Stable key for one Telegram media group, so every album item shares the
    // same conversation even when update handlers run concurrently.
    albumKey: text('album_key'),
    rootMessageId: integer('root_message_id'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    lastActivityAt: integer('last_activity_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    initiatorIdx: index('idx_conversations_initiator').on(t.initiatorId),
    ownerIdx: index('idx_conversations_owner').on(t.ownerId),
    activityIdx: index('idx_conversations_activity').on(t.lastActivityAt),
    albumKeyIdx: uniqueIndex('uidx_conversations_album_key').on(t.albumKey),
  })
);

export const messages = table(
  'messages',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    conversationId: integer('conversation_id').notNull(),
    senderId: integer('sender_id').notNull(),
    recipientId: integer('recipient_id').notNull(),
    parentId: integer('parent_id'),
    rootId: integer('root_id'),
    // Opaque token used only in inline-button callback data. It never reveals
    // an internal id and cannot be used by anyone except the verified recipient.
    publicToken: text('public_token').notNull(),
    messageType: text('message_type').notNull(),
    content: text('content'),
    payload: json('payload'),
    mediaGroupId: text('media_group_id'),
    sourceChatId: integer('source_chat_id').notNull(),
    sourceMessageId: integer('source_message_id').notNull(),
    deliveredChatId: integer('delivered_chat_id'),
    deliveredMessageId: integer('delivered_message_id'),
    deliveryStatus: text('delivery_status').notNull().default('pending'),
    deliveryError: text('delivery_error'),
    isAlbum: boolean('is_album').default(false),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    deliveredAt: integer('delivered_at', { mode: 'timestamp' }),
  },
  (t) => ({
    publicTokenIdx: uniqueIndex('uidx_messages_public_token').on(t.publicToken),
    sourceIdx: uniqueIndex('uidx_messages_source').on(
      t.sourceChatId,
      t.sourceMessageId
    ),
    conversationIdx: index('idx_messages_conversation').on(t.conversationId),
    senderIdx: index('idx_messages_sender').on(t.senderId),
    recipientIdx: index('idx_messages_recipient').on(t.recipientId),
    parentIdx: index('idx_messages_parent').on(t.parentId),
    rootIdx: index('idx_messages_root').on(t.rootId),
    createdIdx: index('idx_messages_created').on(t.createdAt),
    typeIdx: index('idx_messages_type').on(t.messageType),
    statusIdx: index('idx_messages_status').on(t.deliveryStatus),
    albumIdx: index('idx_messages_album').on(
      t.sourceChatId,
      t.mediaGroupId,
      t.deliveryStatus
    ),
  })
);

// Maps a Telegram message delivered by the bot in a user's chat back to the
// internal message. Reply routing uses (chat_id, telegram_message_id) supplied
// by Telegram itself — never a user-supplied internal id.
export const messageRoutes = table(
  'message_routes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    messageId: integer('message_id').notNull(),
    chatId: integer('chat_id').notNull(),
    telegramMessageId: integer('telegram_message_id').notNull(),
    isControl: boolean('is_control').default(false),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    routeIdx: uniqueIndex('uidx_message_routes_chat_msg').on(
      t.chatId,
      t.telegramMessageId
    ),
    messageIdx: index('idx_message_routes_message').on(t.messageId),
    chatIdx: index('idx_message_routes_chat').on(t.chatId),
  })
);

export const messageAttachments = table(
  'message_attachments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    messageId: integer('message_id').notNull(),
    position: integer('position').notNull().default(0),
    attachmentType: text('attachment_type').notNull(),
    fileId: text('file_id'),
    fileUniqueId: text('file_unique_id'),
    mimeType: text('mime_type'),
    fileName: text('file_name'),
    fileSize: integer('file_size'),
    width: integer('width'),
    height: integer('height'),
    duration: integer('duration'),
    caption: text('caption'),
    metadata: json('metadata'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    messageIdx: index('idx_message_attachments_message').on(
      t.messageId,
      t.position
    ),
    typeIdx: index('idx_message_attachments_type').on(t.attachmentType),
  })
);

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

export const blockedUsers = table(
  'blocked_users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    blockerId: integer('blocker_id').notNull(),
    blockedId: integer('blocked_id').notNull(),
    sourceMessageId: integer('source_message_id'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    pairIdx: uniqueIndex('uidx_blocked_users_pair').on(
      t.blockerId,
      t.blockedId
    ),
    blockerIdx: index('idx_blocked_users_blocker').on(t.blockerId),
    blockedIdx: index('idx_blocked_users_blocked').on(t.blockedId),
  })
);

export const reports = table(
  'reports',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    messageId: integer('message_id').notNull(),
    reporterId: integer('reporter_id').notNull(),
    reportedSenderId: integer('reported_sender_id').notNull(),
    reportedRecipientId: integer('reported_recipient_id').notNull(),
    reason: text('reason'),
    status: text('status').notNull().default('open'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    reviewedBy: integer('reviewed_by'),
  },
  (t) => ({
    messageReporterIdx: uniqueIndex('uidx_reports_message_reporter').on(
      t.messageId,
      t.reporterId
    ),
    statusIdx: index('idx_reports_status').on(t.status),
    createdIdx: index('idx_reports_created').on(t.createdAt),
    senderIdx: index('idx_reports_sender').on(t.reportedSenderId),
    reporterIdx: index('idx_reports_reporter').on(t.reporterId),
  })
);

export const bannedUsers = table(
  'banned_users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').unique().notNull(),
    active: boolean('active').notNull().default(true),
    reason: text('reason'),
    bannedBy: integer('banned_by'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    unbannedAt: integer('unbanned_at', { mode: 'timestamp' }),
  },
  (t) => ({
    activeIdx: index('idx_banned_users_active').on(t.active),
  })
);

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export const processedUpdates = table(
  'processed_updates',
  {
    updateId: integer('update_id').primaryKey(),
    handler: text('handler').notNull(),
    processedAt: integer('processed_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    processedIdx: index('idx_processed_updates_time').on(t.processedAt),
  })
);

export const adminLogs = table(
  'admin_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    actorTgId: integer('actor_tg_id').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    metadata: json('metadata'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    actorIdx: index('idx_admin_logs_actor').on(t.actorTgId),
    actionIdx: index('idx_admin_logs_action').on(t.action),
    createdIdx: index('idx_admin_logs_created').on(t.createdAt),
  })
);

export const platformSettings = table('platform_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const adminStates = table(
  'admin_states',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    adminId: integer('admin_id').notNull(),
    state: text('state').notNull(),
    payload: json('payload'),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    adminIdx: uniqueIndex('uidx_admin_states_admin').on(t.adminId),
  })
);

export const broadcasts = table(
  'broadcasts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    adminTgId: integer('admin_tg_id').notNull(),
    sourceChatId: integer('source_chat_id').notNull(),
    sourceMessageId: integer('source_message_id').notNull(),
    messageType: text('message_type').notNull(),
    content: text('content'),
    status: text('status').notNull().default('preview'),
    totalRecipients: integer('total_recipients').default(0),
    sentCount: integer('sent_count').default(0),
    failedCount: integer('failed_count').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
  },
  (t) => ({
    adminIdx: index('idx_broadcasts_admin').on(t.adminTgId),
    statusIdx: index('idx_broadcasts_status').on(t.status),
    createdIdx: index('idx_broadcasts_created').on(t.createdAt),
  })
);

export const broadcastDeliveries = table(
  'broadcast_deliveries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    broadcastId: integer('broadcast_id').notNull(),
    userId: integer('user_id').notNull(),
    status: text('status').notNull().default('pending'),
    error: text('error'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    sentAt: integer('sent_at', { mode: 'timestamp' }),
  },
  (t) => ({
    pairIdx: uniqueIndex('uidx_broadcast_deliveries_pair').on(
      t.broadcastId,
      t.userId
    ),
    statusIdx: index('idx_broadcast_deliveries_status').on(
      t.broadcastId,
      t.status
    ),
  })
);

export const rateLimits = table('rate_limits', {
  key: text('key').primaryKey(),
  windowStart: integer('window_start').notNull(),
  count: integer('count').notNull().default(0),
});
