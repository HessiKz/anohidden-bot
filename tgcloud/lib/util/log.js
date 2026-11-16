// Structured logging without credentials or message content.
//
// Console output is captured by `npx tgcloud run`. Keep log lines useful for
// operations while avoiding tokens, raw updates, and private message text.

export function logInfo(event, fields = {}) {
  console.log(`[anon] ${event}`, safeFields(fields));
}

export function logWarn(event, fields = {}) {
  console.warn(`[anon] ${event}`, safeFields(fields));
}

export function logError(event, error, fields = {}) {
  const detail = {
    ...safeFields(fields),
    error: error?.code ? { code: error.code, method: error.method } : undefined,
    message: error?.message ? String(error.message).slice(0, 300) : undefined,
  };
  console.error(`[anon] ${event}`, detail);
}

function safeFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields ?? {})) {
    if (value === undefined || value === null) continue;
    if (/token|secret|password|credential/i.test(key)) continue;
    if (typeof value === 'string') {
      out[key] = value.length > 200 ? value.slice(0, 200) + '…' : value;
    } else {
      out[key] = value;
    }
  }
  return out;
}
