// handlers/message.js — every private message update.
// The platform passes the Telegram Message and puts the full Update on ctx.

import { claimUpdate } from '../lib/services/dedup.js';
import { handleMessage } from '../lib/flow/message.js';
import { logError } from '../lib/util/log.js';

export default async function (message, ctx) {
  const updateId = ctx?.update?.update_id;
  try {
    if (!(await claimUpdate(updateId, 'message'))) return;
    await handleMessage(message);
  } catch (error) {
    logError('message_update_failed', error, { updateId });
  }
}
