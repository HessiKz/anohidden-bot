// endpoints/setup.js — explicit deployment/setup step.
//
// Called as `npx tgcloud run endpoints/setup '{"action":"sync-commands"}'`.
// When called over HTTP by a Mini App, the platform verifies init data first
// and this endpoint additionally requires the superadmin account.

import { EndpointError } from 'sdk';
import { SUPERADMIN_ID } from '../lib/constants.js';
import { syncCommands } from '../lib/telegram/commands.js';
import { isSuperadmin } from '../lib/services/permissions.js';
import { logAdminAction } from '../lib/services/audit.js';

export default async function (input, ctx) {
  const hasInitData = Boolean(ctx?.initData);
  const caller = ctx?.initData?.user?.id;
  if (hasInitData && !isSuperadmin(caller)) {
    throw new EndpointError('Not authorized.', { code: 'FORBIDDEN' });
  }
  if (input?.action && input.action !== 'sync-commands') {
    throw new EndpointError('Unknown setup action.', { code: 'BAD_ACTION' });
  }

  const report = await syncCommands();
  if (hasInitData) {
    await logAdminAction(SUPERADMIN_ID, 'admin.sync_commands', {
      targetType: 'commands',
      targetId: 'telegram',
      metadata: { ok: report.ok, errors: report.errors },
    });
  }
  return report;
}
