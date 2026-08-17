import { fetchJson } from './fetchJson';

/**
 * Quote providers.
 *
 * The dashboard previously used Alpha Vantage on a schedule of roughly one
 * request per second (~1,400/day) while the free tier allows 25 requests per
 * DAY. The ticker was rate-limited within minutes of boot and then showed bare
 * symbols with no prices for the rest of the day.
 *
 * Finnhub's free tier is 60 requests/minute, which comfortably supports a real
 * refresh cadence, so it's the default. Alpha Vantage is kept as an option but
 * paced to fit inside 25 requests/day.
 */

export const PROVIDERS = {
  finnhub: {
    id: 'finnhub',
    name: 'Finnhub',
    keyUrl: 'https://finnhub.io/register',
    /** Refresh every symbol on this cadence. */
    cycleMs: 60_000,
    /** Minimum spacing between individual requests. */
    minRequestMs: 1_100,
    hint: 'Free tier allows 60 requests/minute — quotes refresh every minute.',
    async fetchQuote(symbol, apiKey, signal) {
      const data = await fetchJson(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
          symbol
        )}&token=${encodeURIComponent(apiKey)}`,
        { signal }
      );

      // Finnhub returns zeros rather than an error for unknown symbols.
      if (!data || typeof data.c !== 'number' || data.c === 0) {
        throw new Error(`No quote for ${symbol}`);
      }

      return {
        symbol,
        price: data.c,
        change: data.d,
        changePct: data.dp,
        ts: Date.now(),
      };
    },
  },

  alphavantage: {
    id: 'alphavantage',
    name: 'Alpha Vantage',
    keyUrl: 'https://www.alphavantage.co/support/#api-key',
    /** 25 requests/day total — one full cycle every 2 hours stays inside it. */
    cycleMs: 2 * 60 * 60_000,
    minRequestMs: 15_000,
    hint: 'Free tier allows only 25 requests/day, so quotes refresh slowly.',
    async fetchQuote(symbol, apiKey, signal) {
      const data = await fetchJson(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
          symbol
        )}&apikey=${encodeURIComponent(apiKey)}`,
        { signal }
      );

      if (data?.Note) {
        const err = new Error('Alpha Vantage rate limit reached');
        err.rateLimited = true;
        throw err;
      }
      if (data?.Information) {
        const err = new Error(String(data.Information));
        err.rateLimited = true;
        throw err;
      }
      if (data?.['Error Message']) throw new Error(`Invalid symbol ${symbol}`);

      const q = data?.['Global Quote'];
      const price = Number(q?.['05. price']);
      if (!Number.isFinite(price) || price === 0) {
        throw new Error(`No quote for ${symbol}`);
      }

      return {
        symbol,
        price,
        change: Number(q?.['09. change']),
        changePct: Number(String(q?.['10. change percent'] || '').replace('%', '')),
        ts: Date.now(),
      };
    },
  },
};

export const getProvider = (id) => PROVIDERS[id] || PROVIDERS.finnhub;

export const parseSymbols = (input) =>
  (input || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    // Guard against a typo turning into hundreds of requests.
    .slice(0, 12);
