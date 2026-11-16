// Cryptographically secure, URL-safe tokens for deep links and opaque
// inline-button handles. There is deliberately no Math.random fallback: if the
// runtime has no secure RNG we fail closed rather than create guessable links.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function secureToken(bytes = 18) {
  const length = Math.max(12, Math.min(48, Number(bytes) || 18));
  const values = new Uint8Array(length);

  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(values);
  } else if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    // Fallback for runtimes that expose randomUUID but not getRandomValues.
    let hex = '';
    while (hex.length < length * 2) {
      hex += globalThis.crypto.randomUUID().replaceAll('-', '');
    }
    for (let i = 0; i < length; i++) {
      values[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
  } else {
    throw new Error('Secure random generator is unavailable; refusing to create a token.');
  }

  // base64url-ish without padding, one output char per input byte bucket.
  let out = '';
  for (let i = 0; i < values.length; i++) {
    out += ALPHABET[values[i] & 63];
  }
  // 18 bytes -> 18 chars is only ~108 bits, still well above guessing range.
  return out;
}

export function linkToken() {
  return secureToken(18);
}

export function publicToken() {
  return secureToken(12);
}
