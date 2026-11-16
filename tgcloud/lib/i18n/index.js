// Internationalization core. Persian (fa) is the platform's default language;
// English is the selectable secondary locale. Keys and both catalogs live in
// fa.js / en.js; a test keeps the catalogs in parity.

import { fa } from './fa.js';
import { en } from './en.js';

export const CATALOGS = { fa, en };
export const DEFAULT_LOCALE = 'fa';
export const LOCALES = [
  { code: 'fa', label: 'فارسی', flag: '🇮🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

const LOCALE_NAMES = { fa: 'فارسی', en: 'English' };

export function isSupportedLocale(locale) {
  return Object.prototype.hasOwnProperty.call(CATALOGS, locale);
}

/** Map any user/profile value onto a supported locale code. */
export function normalizeLocale(value, fallback = DEFAULT_LOCALE) {
  const v = String(value ?? '').trim().toLowerCase();
  if (isSupportedLocale(v)) return v;
  if (v.startsWith('fa') || v === 'per') return 'fa';
  if (v.startsWith('en')) return 'en';
  return fallback;
}

/**
 * Resolve the locale for a user record. The stored preference wins; anything
 * unknown falls back to the platform default (Persian).
 */
export function localeOf(user) {
  return normalizeLocale(user?.uiLanguage ?? null, DEFAULT_LOCALE);
}

export function localeName(locale) {
  return LOCALE_NAMES[normalizeLocale(locale)] ?? LOCALE_NAMES[DEFAULT_LOCALE];
}

/**
 * Translate a key in a locale. Values may be strings or functions receiving
 * the params object. Unknown keys fall back to the default locale, then to
 * the key itself so missing copy is visible in testing.
 */
export function t(locale, key, params = {}) {
  const loc = normalizeLocale(locale);
  const value = CATALOGS[loc]?.[key] ?? CATALOGS[DEFAULT_LOCALE]?.[key];
  if (value === undefined) return key;
  return typeof value === 'function' ? value(params ?? {}) : value;
}

// ---------------------------------------------------------------------------
// Locale-aware formatting
// ---------------------------------------------------------------------------

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(value) {
  return String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/** Grouped integer with a locale-appropriate thousands separator. */
export function formatNumber(value, locale = DEFAULT_LOCALE) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return toPersianDigits('0');
  const grouped = String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return normalizeLocale(locale) === 'fa' ? toPersianDigits(grouped) : grouped;
}

// --- Jalali (Solar Hijri) conversion -------------------------------------

const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

function div(a, b) {
  return Math.floor(a / b);
}

/** Gregorian -> Jalali (pure arithmetic, no ICU dependency). */
export function toJalali(date) {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  const gDaysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let jy = gy <= 1600 ? 0 : 979;
  const gy2 = gy <= 1600 ? gy - 621 : gy - 1600;
  const gm2 = gm;
  let days =
    365 * gy2 +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) -
    80 +
    gd;
  for (let i = 1; i < gm2; i += 1) days += gDaysInMonth[i];
  if (gm2 > 2 && ((gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0)) days += 1;
  jy += 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Format a unix-seconds value (or Date) for display.
 * fa: Jalali calendar, Persian digits, Tehran time.
 * en: ISO-like UTC string.
 */
export function formatDateTime(value, locale = DEFAULT_LOCALE, options = {}) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(Number(value) * 1000);
  if (Number.isNaN(date.getTime())) return '—';
  const loc = normalizeLocale(locale);
  if (loc !== 'fa') {
    const iso = date.toISOString();
    return iso.replace('T', ' ').replace(/(\.\d+)?Z$/, ' UTC');
  }
  const tehran = new Date(date.getTime() + 3.5 * 60 * 60 * 1000);
  const { jy, jm, jd } = toJalali(tehran);
  const hh = pad2(tehran.getUTCHours());
  const mm = pad2(tehran.getUTCMinutes());
  const time = `${hh}:${mm}`;
  if (options.monthNames) {
    return `${toPersianDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${toPersianDigits(jy)} — ${toPersianDigits(time)}`;
  }
  return `${toPersianDigits(jy)}/${toPersianDigits(pad2(jm))}/${toPersianDigits(pad2(jd))} ${toPersianDigits(time)}`;
}

/** Byte sizes like "12.3 KB" / "۱۲٫۳ کیلوبایت". */
export function formatBytes(bytes, locale = DEFAULT_LOCALE) {
  const n = Number(bytes ?? 0);
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const text = `${value.toFixed(1)} ${units[unit]}`;
  return normalizeLocale(locale) === 'fa'
    ? `${toPersianDigits(text.replace('.', '٫'))} (${text})`
    : text;
}
