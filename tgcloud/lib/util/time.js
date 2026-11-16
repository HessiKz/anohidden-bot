// Time helpers. Database timestamp columns store unix seconds.

export function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function nowDate() {
  return new Date();
}

export function addMs(ms) {
  return new Date(Date.now() + ms);
}

export function startOfToday() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export function unixToDate(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  return new Date(Number(value) * 1000);
}

export function unixNow() {
  return nowSeconds();
}
