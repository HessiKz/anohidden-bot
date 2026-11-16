// Small, dependency-free formatting helpers for Telegram HTML messages.

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function truncate(value, max = 3800) {
  const text = String(value ?? '');
  if (text.length <= max) return text;
  if (max <= 1) return '…';
  return text.slice(0, max - 1) + '…';
}

export function code(value) {
  return `<code>${escapeHtml(value)}</code>`;
}

export function userMention(user) {
  if (!user) return '<i>unknown</i>';
  const name = displayName(user);
  return `<a href="tg://user?id=${Number(user.tgId)}">${escapeHtml(name)}</a>`;
}

export function displayName(user) {
  if (!user) return 'Unknown';
  const first = (user.firstName ?? '').trim();
  const last = (user.lastName ?? '').trim();
  const full = [first, last].filter(Boolean).join(' ');
  if (full) return full;
  if (user.username) return '@' + user.username;
  return 'User ' + user.tgId;
}

export function usernameLine(user) {
  return user?.username ? '@' + escapeHtml(user.username) : '<i>none</i>';
}

export function formatDate(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(Number(value) * 1000);
  if (Number.isNaN(date.getTime())) return '—';
  const iso = date.toISOString();
  return iso.replace('T', ' ').replace('.000Z', ' UTC').replace('Z', ' UTC');
}

export function formatDateShort(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(Number(value) * 1000);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

export function formatNumber(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function truncateContent(value, max = 60) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '<i>no text</i>';
  return escapeHtml(truncate(text, max));
}

export function statusIcon(status) {
  switch (status) {
    case 'delivered':
      return '✅ delivered';
    case 'failed':
      return '❌ failed';
    case 'delivering':
      return '⏳ delivering';
    case 'pending_album':
      return '⏳ queued album';
    default:
      return '⏳ pending';
  }
}
