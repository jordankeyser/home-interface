/**
 * Fetch helper with a timeout and caller-supplied abort signal.
 *
 * Every network call in the app goes through this. Without it, a slow response
 * on flaky home wifi could resolve after a newer one and overwrite fresh state
 * with stale data.
 */
export const fetchJson = async (url, { signal, timeoutMs = 12_000 } = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const err = new Error(`Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
};

export const isAbortError = (err) =>
  err?.name === 'AbortError' || err?.code === 20;

/**
 * Exponential backoff with a ceiling, so a transient outage doesn't keep
 * retrying at the normal interval (and doesn't leave a red error card up for a
 * full 15-minute refresh cycle either).
 */
export const backoffDelay = (attempt, baseMs, maxMs = 5 * 60_000) =>
  Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
