// Admin inline keyboards, locale-aware.
import { SUPERADMIN_ID } from '../constants.js';
import { t } from '../i18n/index.js';
import { displayName } from '../util/html.js';

function btn(text, callback_data) {
  return { text: String(text).replace(/\s+/g, ' ').slice(0, 60), callback_data };
}
function row(...buttons) {
  return buttons;
}
function pager(locale, page, hasNext, makeCallback) {
  const buttons = [];
  if (page > 0) buttons.push(btn(t(locale, 'adm.btn.prev'), makeCallback(page - 1)));
  if (hasNext) buttons.push(btn(t(locale, 'adm.btn.next'), makeCallback(page + 1)));
  return buttons.length ? [buttons] : [];
}

export function dashboardKeyboard(locale) {
  return {
    inline_keyboard: [
      row(btn(t(locale, 'adm.btn.users'), 'adm:u:0'), btn(t(locale, 'adm.btn.messages'), 'adm:m:0:all:0:0:0')),
      row(btn(t(locale, 'adm.btn.reports'), 'adm:r:0:open'), btn(t(locale, 'adm.btn.broadcast'), 'adm:br')),
      row(btn(t(locale, 'adm.btn.settings'), 'adm:set'), btn(t(locale, 'adm.btn.audit'), 'adm:bl:0')),
      row(btn(t(locale, 'adm.btn.export'), 'adm:exp'), btn(t(locale, 'adm.btn.search'), 'adm:search')),
      row(btn(t(locale, 'adm.btn.sync'), 'adm:sync'), btn(t(locale, 'adm.btn.close'), 'adm:close')),
    ],
  };
}

export function usersKeyboard(locale, pageData) {
  const rows = pageData.rows.map((u) => [
    btn(
      `#${u.id} ${u.firstName ?? u.username ?? u.tgId}`,
      `adm:ud:${u.id}:${pageData.page}`
    ),
  ]);
  return {
    inline_keyboard: [
      ...rows,
      ...pager(locale, pageData.page, pageData.hasNext, (p) => `adm:u:${p}`),
      [btn(t(locale, 'adm.btn.usersBack'), 'adm:h')],
    ],
  };
}

export function userDetailKeyboard(locale, data, page = 0) {
  const u = data.user;
  const banButton =
    Number(u.tgId) === SUPERADMIN_ID
      ? btn(t(locale, 'adm.btn.superadminProtected'), 'adm:noop')
      : data.ban
        ? btn(t(locale, 'adm.btn.unban'), `adm:unban:${u.id}:${page}`)
        : btn(t(locale, 'adm.btn.ban'), `adm:banp:${u.id}:${page}`);
  return {
    inline_keyboard: [
      row(
        btn(t(locale, 'adm.btn.sent'), `adm:um:${u.id}:0:sent`),
        btn(t(locale, 'adm.btn.received'), `adm:um:${u.id}:0:received`)
      ),
      row(
        btn(t(locale, 'adm.btn.allMessages'), `adm:um:${u.id}:0:all`),
        btn(t(locale, 'adm.btn.blocks'), `adm:ub:${u.id}`)
      ),
      row(banButton, btn(t(locale, 'adm.btn.regenerateLink'), `adm:rollp:${u.id}:${page}`)),
      row(btn(t(locale, 'adm.btn.usersBack'), `adm:u:${page}`), btn(t(locale, 'adm.btn.dashboard'), 'adm:h')),
    ],
  };
}

export function userMessagesKeyboard(locale, userId, pageData, direction) {
  return {
    inline_keyboard: [
      ...pager(locale, pageData.page, pageData.hasNext, (p) => `adm:um:${userId}:${p}:${direction}`),
      row(btn(t(locale, 'adm.btn.userBack'), `adm:ud:${userId}:0`), btn(t(locale, 'adm.btn.dashboard'), 'adm:h')),
    ],
  };
}

export function blocksKeyboard(locale, userId) {
  return {
    inline_keyboard: [
      row(btn(t(locale, 'adm.btn.userBack'), `adm:ud:${userId}:0`), btn(t(locale, 'adm.btn.dashboard'), 'adm:h')),
    ],
  };
}

export function messagesKeyboard(locale, pageData, filters) {
  const f = filters;
  const rows = pageData.rows.map((m) => [
    btn(
      `#${m.id} ${m.messageType}`,
      `adm:md:${m.id}:${pageData.page}:${f.type}:${f.days}:${f.senderId ?? 0}:${f.recipientId ?? 0}`
    ),
  ]);
  const mk = (type, days) =>
    `adm:m:${pageData.page}:${type}:${days}:${f.senderId ?? 0}:${f.recipientId ?? 0}`;
  return {
    inline_keyboard: [
      ...rows,
      ...pager(locale, pageData.page, pageData.hasNext, (p) =>
        `adm:m:${p}:${f.type}:${f.days}:${f.senderId ?? 0}:${f.recipientId ?? 0}`
      ),
      row(
        btn(t(locale, 'adm.btn.allTypes'), mk('all', f.days)),
        btn(t(locale, 'adm.btn.text'), mk('text', f.days)),
        btn(t(locale, 'adm.btn.media'), mk('media', f.days))
      ),
      row(
        btn(t(locale, 'adm.btn.failed'), mk('failed', f.days)),
        btn(t(locale, 'adm.btn.today'), mk(f.type, 1)),
        btn(t(locale, 'adm.btn.days7'), mk(f.type, 7))
      ),
      row(btn(t(locale, 'adm.btn.days30'), mk(f.type, 30)), btn(t(locale, 'adm.btn.clearDates'), mk(f.type, 0))),
      [btn(t(locale, 'adm.btn.dashboard'), 'adm:h')],
    ],
  };
}

export function messageDetailKeyboard(locale, data, filters, page = 0) {
  const m = data.message;
  const back = `adm:m:${page}:${filters.type}:${filters.days}:${filters.senderId ?? 0}:${filters.recipientId ?? 0}`;
  const rows = [];
  if (data.parent) {
    rows.push(row(btn(t(locale, 'adm.btn.parent', { id: data.parent.id }), `adm:md:${data.parent.id}:0:all:0:0:0`)));
  }
  rows.push(row(btn(t(locale, 'adm.btn.conversation', { id: m.conversationId }), `adm:conv:${m.conversationId}:0`)));
  rows.push([
    btn(t(locale, 'adm.btn.sender'), `adm:ud:${m.senderId}:0`),
    btn(t(locale, 'adm.btn.recipient'), `adm:ud:${m.recipientId}:0`),
  ]);
  if (Number(data.sender?.tgId) !== SUPERADMIN_ID) {
    rows.push(row(btn(t(locale, 'adm.btn.banSender'), `adm:banp:${m.senderId}:0`)));
  }
  if (data.reports.length) {
    rows.push(row(btn(t(locale, 'adm.btn.report', { id: data.reports[0].id }), `adm:rd:${data.reports[0].id}:0:all`)));
  }
  rows.push(row(btn(t(locale, 'adm.btn.messagesBack'), back), btn(t(locale, 'adm.btn.dashboard'), 'adm:h')));
  return { inline_keyboard: rows };
}

export function conversationKeyboard(locale, data) {
  const first = data.messages[0];
  const back = first ? `adm:md:${first.id}:0:all:0:0:0` : 'adm:h';
  return {
    inline_keyboard: [row(btn(t(locale, 'adm.btn.messageBack'), back), btn(t(locale, 'adm.btn.dashboard'), 'adm:h'))],
  };
}

export function reportsKeyboard(locale, pageData) {
  const rows = pageData.rows.map((r) => [
    btn(
      `#${r.id} ${r.status} ${r.reason ?? ''}`.trim(),
      `adm:rd:${r.id}:${pageData.page}:${pageData.status}`
    ),
  ]);
  return {
    inline_keyboard: [
      ...rows,
      ...pager(locale, pageData.page, pageData.hasNext, (p) => `adm:r:${p}:${pageData.status}`),
      [
        btn(t(locale, 'adm.btn.open'), `adm:r:0:open`),
        btn(t(locale, 'adm.btn.reviewed'), `adm:r:0:reviewed`),
        btn(t(locale, 'adm.btn.statusAll'), `adm:r:0:all`),
      ],
      [btn(t(locale, 'adm.btn.dashboard'), 'adm:h')],
    ],
  };
}

export function reportDetailKeyboard(locale, data, page = 0, status = 'open') {
  const r = data.report;
  const rows = [];
  if (r.status === 'open') {
    rows.push(row(btn(t(locale, 'adm.btn.markReviewed'), `adm:rev:${r.id}:${page}:${status}`)));
  }
  rows.push(row(btn(t(locale, 'adm.btn.openMessage'), `adm:md:${r.messageId}:0:all:0:0:0`)));
  if (Number(data.sender?.tgId) !== SUPERADMIN_ID) {
    rows.push(row(btn(t(locale, 'adm.btn.banSender'), `adm:banp:${r.reportedSenderId}:0`)));
  }
  rows.push(row(btn(t(locale, 'adm.btn.reportsBack'), `adm:r:${page}:${status}`), btn(t(locale, 'adm.btn.dashboard'), 'adm:h')));
  return { inline_keyboard: rows };
}

export function auditKeyboard(locale, pageData) {
  return {
    inline_keyboard: [
      ...pager(locale, pageData.page, pageData.hasNext, (p) => `adm:bl:${p}`),
      [btn(t(locale, 'adm.btn.dashboard'), 'adm:h')],
    ],
  };
}

export function settingsKeyboard(locale, enabled) {
  return {
    inline_keyboard: [
      row(btn(enabled ? t(locale, 'adm.btn.pauseMessaging') : t(locale, 'adm.btn.enableMessaging'), 'adm:sett:msg')),
      [btn(t(locale, 'adm.btn.sync'), 'adm:sync')],
      [btn(t(locale, 'adm.btn.dashboard'), 'adm:h')],
    ],
  };
}

export function exportKeyboard(locale) {
  return {
    inline_keyboard: [
      [btn(t(locale, 'adm.btn.exportJson'), 'adm:expj')],
      [btn(t(locale, 'adm.btn.exportCsv'), 'adm:expc')],
      [btn(t(locale, 'adm.btn.dashboard'), 'adm:h')],
    ],
  };
}

export function broadcastMenuKeyboard(locale) {
  return {
    inline_keyboard: [
      [btn(t(locale, 'adm.btn.compose'), 'adm:brnew')],
      [btn(t(locale, 'adm.btn.dashboard'), 'adm:h')],
    ],
  };
}

export function broadcastPreviewKeyboard(locale, broadcastId) {
  return {
    inline_keyboard: [
      [btn(t(locale, 'adm.btn.confirmSend'), `adm:brc:${broadcastId}`)],
      [btn(t(locale, 'adm.btn.cancel'), `adm:brx:${broadcastId}`)],
      [btn(t(locale, 'adm.btn.broadcastBack'), 'adm:br')],
    ],
  };
}

export function broadcastProgressKeyboard(locale, broadcastId, remaining) {
  const rows = [];
  if (remaining > 0) {
    rows.push(row(btn(t(locale, 'adm.btn.continueBatch'), `adm:brn:${broadcastId}`)));
    rows.push(row(btn(t(locale, 'adm.btn.stopBroadcast'), `adm:brx:${broadcastId}`)));
  }
  rows.push([btn(t(locale, 'adm.btn.dashboard'), 'adm:h')]);
  return { inline_keyboard: rows };
}

export function confirmBanKeyboard(locale, userId, back) {
  return {
    inline_keyboard: [
      row(btn(t(locale, 'adm.btn.confirmBan'), `adm:banc:${userId}:${back}`)),
      [btn(t(locale, 'adm.btn.cancel'), back === 'u' ? 'adm:u:0' : `adm:ud:${userId}:0`)],
    ],
  };
}

export function confirmRollKeyboard(locale, userId, back) {
  return {
    inline_keyboard: [
      row(btn(t(locale, 'adm.btn.confirmRotation'), `adm:rollc:${userId}:${back}`)),
      [btn(t(locale, 'adm.btn.cancel'), back === 'u' ? 'adm:u:0' : `adm:ud:${userId}:0`)],
    ],
  };
}

export function searchKeyboard(locale, data) {
  const rows = [];
  for (const u of data.users.slice(0, 5)) {
    rows.push([btn(`👤 ${displayName(u)}`, `adm:ud:${u.id}:0`)]);
  }
  for (const m of data.messages.slice(0, 5)) {
    rows.push([btn(`💬 #${m.id} ${m.messageType}`, `adm:md:${m.id}:0:all:0:0:0`)]);
  }
  rows.push([btn(t(locale, 'adm.btn.dashboard'), 'adm:h')]);
  return { inline_keyboard: rows };
}
