// Input parsing and validation. Privileged decisions never come from these
// values alone; callers must still verify the actor and the database record.

import { PUBLIC_TOKEN_RE, TOKEN_RE } from '../constants.js';

export function toInt(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return Number.isSafeInteger(n) ? n : null;
  }
  return null;
}

export function toPositiveInt(value) {
  const n = toInt(value);
  return n !== null && n > 0 ? n : null;
}

export function parseTelegramId(value) {
  const n = toInt(value);
  return n !== null && n > 0 ? n : null;
}

export function parsePage(value) {
  const n = toInt(value);
  return n !== null && n >= 0 ? n : 0;
}

export function clampPage(value, maxPage = 100000) {
  return Math.min(parsePage(value), maxPage);
}

export function isToken(value) {
  return typeof value === 'string' && TOKEN_RE.test(value);
}

export function isPublicToken(value) {
  return typeof value === 'string' && PUBLIC_TOKEN_RE.test(value);
}

export function splitCommand(text) {
  if (typeof text !== 'string' || !text.startsWith('/')) return null;
  const firstSpace = text.search(/\s/);
  const head = (firstSpace === -1 ? text : text.slice(0, firstSpace)).slice(1);
  const rest = firstSpace === -1 ? '' : text.slice(firstSpace + 1).trim();
  if (!head) return null;
  const at = head.indexOf('@');
  const command = (at === -1 ? head : head.slice(0, at)).toLowerCase();
  const mention = at === -1 ? null : head.slice(at + 1);
  return { command, mention, argsText: rest };
}

export function parseStartPayload(text) {
  const parsed = splitCommand(text);
  if (!parsed || parsed.command !== 'start') return null;
  const payload = parsed.argsText.split(/\s+/).filter(Boolean)[0] ?? '';
  return payload;
}

export function parseArgs(text) {
  return String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function parseKeyValueArgs(args) {
  const result = { positional: [], flags: {} };
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq === -1) {
        result.flags[arg.slice(2).toLowerCase()] = true;
      } else {
        result.flags[arg.slice(2, eq).toLowerCase()] = arg.slice(eq + 1);
      }
    } else {
      result.positional.push(arg);
    }
  }
  return result;
}

export function isValidCallbackToken(value) {
  return isPublicToken(value);
}
