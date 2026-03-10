/**
 * fetcher.js — Yahoo Finance data client.
 *
 * In production (Cloudflare), calls go to /api/* (the Worker proxy).
 * In dev, Vite proxies /api/* to the Worker automatically via the
 * Cloudflare Vite plugin.
 */

const API = "/api";

async function get(path, params = {}) {
  const url = new URL(path, window.location.origin);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch available expirations and spot price for a ticker.
 * Returns { ticker, price, expirations: [{ date, timestamp }] }
 */
export async function fetchOptions(ticker) {
  return get(`${API}/options`, { ticker });
}

/**
 * Fetch a single option chain for a ticker+expiry timestamp.
 * Returns { ticker, price, expiry, calls: [], puts: [] }
 */
export async function fetchChain(ticker, expTimestamp) {
  return get(`${API}/chain`, { ticker, exp: String(expTimestamp) });
}

/**
 * Fetch historical OHLCV bars.
 * Returns { ticker, bars: [{ date, open, high, low, close, volume }] }
 */
export async function fetchHistory(ticker, days = 60) {
  return get(`${API}/history`, { ticker, days: String(days) });
}

/**
 * Fetch risk-free rate. Returns { rate: number }
 */
export async function fetchRate() {
  return get(`${API}/rate`);
}

/**
 * Fetch trending tickers for the landing page.
 * Returns { stocks: [...], crypto: [...] }
 */
export async function fetchTrending() {
  return get(`${API}/trending`);
}

/**
 * Days from today to expiry string "YYYY-MM-DD".
 *
 * Uses calendar-day DTE (industry standard): expiry tomorrow = 1, day-after = 2, etc.
 * This is timezone-independent and matches how options are quoted on trading platforms.
 * For same-day (0 DTE) options the fractional hours remaining until 4 pm ET (21:00 UTC)
 * are used so that T > 0 for intraday pricing.
 */
export function daysToExpiry(expiry) {
  const now = new Date();
  // Calendar days between today (UTC date) and expiry date
  const todayMidnight = new Date(now.toISOString().slice(0, 10) + "T00:00:00Z");
  const expiryMidnight = new Date(expiry + "T00:00:00Z");
  const calDays = Math.round((expiryMidnight - todayMidnight) / (1000 * 60 * 60 * 24));

  if (calDays <= 0) {
    // Same-day or past expiry: use hours left until 4 pm ET close (21:00 UTC)
    const expiryClose = new Date(expiry + "T21:00:00Z");
    const hoursLeft = (expiryClose - now) / (1000 * 60 * 60);
    return Math.max(hoursLeft / 24, 1 / 24); // floor at 1 hour
  }

  return calDays;
}
