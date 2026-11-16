// Message classification, safe storage payloads, and attachment extraction.
// We store references (file ids and metadata), never media bytes.
import { t } from '../i18n/index.js';

const TYPE_ORDER = [
  'text',
  'photo',
  'video',
  'voice',
  'video_note',
  'audio',
  'document',
  'sticker',
  'animation',
  'contact',
  'venue',
  'location',
  'poll',
  'dice',
  'game',
  'invoice',
  'successful_payment',
  'story',
  'giveaway',
  'giveaway_winners',
  'giveaway_created',
];

const SERVICE_FIELDS = [
  'new_chat_members',
  'left_chat_member',
  'new_chat_title',
  'new_chat_photo',
  'delete_chat_photo',
  'group_chat_created',
  'supergroup_chat_created',
  'channel_chat_created',
  'message_auto_delete_timer_changed',
  'pinned_message',
  'forum_topic_created',
  'forum_topic_edited',
  'forum_topic_closed',
  'forum_topic_reopened',
  'video_chat_scheduled',
  'video_chat_started',
  'video_chat_ended',
  'video_chat_participants_invited',
  'web_app_data',
  'users_shared',
  'chat_shared',
  'connected_website',
  'passport_data',
  'proximity_alert_triggered',
  'boost_added',
  'chat_background_set',
  'checklist_tasks_done',
  'checklist_tasks_added',
  'direct_message_price_changed',
  'paid_message_price_changed',
  'suggested_post_approved',
  'suggested_post_declined',
  'suggested_post_paid',
  'suggested_post_refunded',
];

const STORED_FIELDS = [
  'message_id',
  'date',
  'media_group_id',
  'text',
  'caption',
  'entities',
  'caption_entities',
  'link_preview_options',
  'photo',
  'video',
  'voice',
  'video_note',
  'audio',
  'document',
  'sticker',
  'animation',
  'contact',
  'location',
  'venue',
  'poll',
  'dice',
  'game',
  'invoice',
  'successful_payment',
  'story',
  'giveaway',
  'giveaway_winners',
  'giveaway_created',
  'has_media_spoiler',
  'show_caption_above_media',
  'has_protected_content',
  'forward_origin',
  'forward_from',
  'forward_from_chat',
  'forward_sender_name',
  'forward_date',
  'is_automatic_forward',
];

export function detectMessageType(message) {
  if (!message || typeof message !== 'object') return 'unsupported';
  for (const type of TYPE_ORDER) {
    if (type === 'text') {
      if (typeof message.text === 'string') return 'text';
    } else if (message[type] !== undefined && message[type] !== null) {
      return type;
    }
  }
  return 'unsupported';
}

export function isServiceMessage(message) {
  return SERVICE_FIELDS.some((field) => message?.[field] !== undefined);
}

/**
 * Telegram copies preserve forward headers. A forward can contain the original
 * author's identity (sometimes the sender's own channel), so the delivery path
 * re-sends those messages instead of copying them.
 */
export function hasForwardHeader(message) {
  return Boolean(
    message?.forward_origin ||
      message?.forward_from ||
      message?.forward_from_chat ||
      message?.forward_sender_name ||
      message?.forward_date ||
      message?.is_automatic_forward
  );
}

export function unsupportedReason(message, type) {
  if (isServiceMessage(message)) return 'service_message';
  if (type === 'invoice' || type === 'successful_payment') return 'payment';
  if (type === 'story') return 'story';
  if (type === 'giveaway' || type === 'giveaway_winners' || type === 'giveaway_created') {
    return 'giveaway';
  }
  return 'generic';
}

export function getContent(message) {
  if (typeof message?.text === 'string') return message.text;
  if (typeof message?.caption === 'string') return message.caption;
  return null;
}

export function isMediaType(type) {
  return [
    'photo',
    'video',
    'voice',
    'video_note',
    'audio',
    'document',
    'sticker',
    'animation',
  ].includes(type);
}

export function sanitizeMessagePayload(message) {
  const out = {};
  for (const key of STORED_FIELDS) {
    if (message?.[key] !== undefined) out[key] = message[key];
  }
  return out;
}

/**
 * One row per media item. Photos provide several sizes; store the largest.
 */
export function extractAttachments(message, type = detectMessageType(message)) {
  if (!message) return [];
  const caption = message.caption ?? null;

  if (type === 'photo' && Array.isArray(message.photo) && message.photo.length) {
    const photo = message.photo[message.photo.length - 1];
    return [
      {
        position: 0,
        attachmentType: 'photo',
        fileId: photo.file_id,
        fileUniqueId: photo.file_unique_id,
        width: photo.width,
        height: photo.height,
        fileSize: photo.file_size,
        caption,
      },
    ];
  }

  const media = message[type];
  if (!media || typeof media !== 'object') return [];

  const base = {
    position: 0,
    attachmentType: type,
    fileId: media.file_id ?? null,
    fileUniqueId: media.file_unique_id ?? null,
    mimeType: media.mime_type ?? null,
    fileName: media.file_name ?? null,
    fileSize: media.file_size ?? null,
    width: media.width ?? null,
    height: media.height ?? null,
    duration: media.duration ?? null,
    caption,
    metadata: {
      emoji: media.emoji,
      is_animated: media.is_animated,
      is_video: media.is_video,
      performer: media.performer,
      title: media.title,
      thumbnail: media.thumbnail ?? media.thumb,
    },
  };

  if (type === 'contact' || type === 'location' || type === 'venue' || type === 'poll' || type === 'dice') {
    return [
      {
        position: 0,
        attachmentType: type,
        metadata: message[type],
        caption,
      },
    ];
  }

  return [base];
}

export function describeType(type, locale = 'fa') {
  const key = `type.${type}`;
  const value = t(locale, key);
  return value === key ? type : value;
}
