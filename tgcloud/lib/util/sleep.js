// A best-effort delay used only to let Telegram's album updates settle.
// Telegram Serverless documentation does not guarantee timer APIs, so a missing
// setTimeout degrades to immediate delivery instead of crashing the handler.
export function sleep(ms) {
  const delay = Math.max(0, Number(ms) || 0);
  if (delay === 0 || typeof setTimeout !== 'function') return Promise.resolve();
  try {
    return new Promise((resolve) => {
      try {
        setTimeout(resolve, delay);
      } catch {
        // The isolate may expose setTimeout but disallow timers; degrade to
        // immediate delivery rather than losing the album.
        resolve();
      }
    });
  } catch {
    return Promise.resolve();
  }
}
