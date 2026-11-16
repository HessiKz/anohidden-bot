import {
  IDENTITY_PRIVILEGED_ID,
  ROLE_IDENTITY_PRIVILEGED,
  ROLE_SUPERADMIN,
  ROLE_USER,
  SUPERADMIN_ID,
} from '../constants.js';

export function isSuperadmin(userOrId) {
  const id = typeof userOrId === 'object' ? userOrId?.id ?? userOrId?.tgId : userOrId;
  const n = Number(id);
  return Number.isSafeInteger(n) && n === SUPERADMIN_ID;
}

export function isIdentityPrivileged(userOrId) {
  const id = typeof userOrId === 'object' ? userOrId?.id ?? userOrId?.tgId : userOrId;
  const n = Number(id);
  return Number.isSafeInteger(n) && n === IDENTITY_PRIVILEGED_ID;
}

export function roleOf(userOrId) {
  if (isSuperadmin(userOrId)) return ROLE_SUPERADMIN;
  if (isIdentityPrivileged(userOrId)) return ROLE_IDENTITY_PRIVILEGED;
  return ROLE_USER;
}

/** Admin actions are only legal in a private chat owned by the superadmin. */
export function isSuperadminContext(messageOrCallback) {
  const fromId = Number(messageOrCallback?.from?.id);
  const chat = messageOrCallback?.message?.chat ?? messageOrCallback?.chat;
  const chatId = Number(chat?.id);
  const chatType = chat?.type;
  return (
    isSuperadmin(fromId) &&
    Number.isFinite(chatId) &&
    chatId === fromId &&
    chatType === 'private'
  );
}

export function isPrivateChatFrom(message, tgId) {
  return (
    message?.chat?.type === 'private' &&
    Number(message?.chat?.id) === Number(tgId) &&
    Number(message?.from?.id) === Number(tgId)
  );
}

/**
 * Identity disclosure policy, checked on the server for every reveal operation:
 *  - SUPERADMIN: any message, globally.
 *  - IDENTITY_PRIVILEGED: only messages addressed to that account.
 *  - Everyone else: never.
 */
export function canRevealIdentity(actorTgId, messageRow, recipientUser) {
  if (isSuperadmin(actorTgId)) return true;
  if (!isIdentityPrivileged(actorTgId)) return false;
  if (!messageRow || !recipientUser) return false;
  return (
    Number(recipientUser.tgId) === IDENTITY_PRIVILEGED_ID &&
    Number(messageRow.recipientId) === Number(recipientUser.id)
  );
}

export class PermissionError extends Error {
  constructor(message = 'Not authorized.') {
    super(message);
    this.name = 'PermissionError';
  }
}

export function assertSuperadmin(userOrId) {
  if (!isSuperadmin(userOrId)) throw new PermissionError();
}
