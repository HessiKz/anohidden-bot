// handlers/callback_query.js — every inline-keyboard callback.

import { claimUpdate } from '../lib/services/dedup.js';
import { handleCallback } from '../lib/flow/callbacks.js';
import { answerCallback } from '../lib/telegram/apiSafe.js';
import { logError } from '../lib/util/log.js';

export default async function (callbackQuery, ctx) {
  const updateId = ctx?.update?.update_id;
  try {
    if (!(await claimUpdate(updateId, 'callback_query'))) {
      await answerCallback(callbackQuery, 'This action was already processed.');
      return;
    }
    await handleCallback(callbackQuery);
  } catch (error) {
    logError('callback_update_failed', error, { updateId });
    await answerCallback(callbackQuery, 'Something went wrong. Please try again.');
  }
}
