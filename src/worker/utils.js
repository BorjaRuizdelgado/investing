/**
 * Shared constants, validation helpers, CORS, and response builders.
 */

// ---- Per-IP sliding-window rate limiter ----

const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const RATE_LIMIT_MAX = 60 // max requests per window per IP
const ipHits = new Map() // IP → { count, resetAt }

let lastPrune = 0

/**
 * Returns true if the request should be allowed, false if rate-limited.
 * Uses a simple fixed-window counter per IP, pruned lazily on access.
 */
export function rateLimit(ip) {
  const now = Date.now()

  // Lazily prune stale entries so the Map doesn't grow unbounded.
  if (now - lastPrune >= RATE_LIMIT_WINDOW_MS) {
    lastPrune = now
    for (const [key, entry] of ipHits) {
      if (now >= entry.resetAt) ipHits.delete(key)
    }
  }

  const entry = ipHits.get(ip)
  if (!entry || now >= entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  entry.count += 1
  if (entry.count > RATE_LIMIT_MAX) return false
  return true
}

export const YF_BASE = 'https://query2.finance.yahoo.com'
export const BYBIT_BASE = 'https://api.bybit.com/v5/market'
export const DERIBIT_BASE = 'https://www.deribit.com/api/v2/public'
export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// ---- Input validation ----

const TICKER_RE = /^[A-Z0-9.\-^]{1,10}$/

/** Validate and normalise a ticker param. Returns null if invalid. */
export function validateTicker(raw) {
  if (!raw) return null
  const t = raw.toUpperCase().trim()
  return TICKER_RE.test(t) ? t : null
}

/** Validate days param. Returns a positive integer <= 365, or null. */
export function validateDays(raw) {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1 || n > 365) return null
  return n
}

// ---- Structured error logging ----

/**
 * Log a structured JSON error for observability.
 * Plug in Sentry, Logpush, or any external logger here later.
 */
export function logError(route, error, context = {}) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      route,
      error: error?.message || String(error),
      ticker: context.ticker || null,
      upstreamStatus: context.upstreamStatus || null,
    }),
  )
}

// ---- Common ----

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

/**
 * Like jsonResp but adds a Cache-Control header so browsers (and Cloudflare's
 * edge cache) serve repeated requests without hitting Yahoo / Bybit again.
 * Use only for responses where a few minutes of staleness is acceptable.
 */
export function cachedJsonResp(data, maxAgeSeconds) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      'Cache-Control': `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${Math.floor(maxAgeSeconds / 2)}`,
    },
  })
}
