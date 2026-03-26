/**
 * tickers.js — Shared crypto detection and ticker normalisation.
 *
 * Single source of truth used by both the Cloudflare Worker (server)
 * and the client-side fetcher so crypto-related logic is never duplicated.
 */

/** Tokens we treat as cryptocurrency (case-insensitive via uppercased set) */
export const LIKELY_CRYPTO = new Set([
  'BTC',
  'ETH',
  'SOL',
  'XRP',
  'BNB',
  'MATIC',
  'DOGE',
  'ADA',
  'AVAX',
  'DOT',
  'LINK',
  'LTC',
  'UNI',
  'ATOM',
  'FIL',
  'APT',
  'ARB',
  'OP',
  'NEAR',
  'PAXG',
  'USDC',
  'USDT',
  'USDE',
])

/** Coins with verified Bybit options coverage */
export const BYBIT_SUPPORTED = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'])

/** Suffixes stripped from crypto tickers to get the base symbol */
const CRYPTO_SUFFIXES = ['-USDT', '-USD', '-PERP', 'USDT', 'USD']

/** Strip common fiat/stablecoin suffixes: BTC-USD → BTC */
export function stripCryptoSuffix(ticker) {
  let t = ticker.toUpperCase().trim()
  for (const sfx of CRYPTO_SUFFIXES) {
    if (t.endsWith(sfx)) {
      t = t.slice(0, -sfx.length)
      break
    }
  }
  return t
}

/** Returns true if the (raw) ticker maps to a known crypto symbol */
export function isCrypto(ticker) {
  return LIKELY_CRYPTO.has(stripCryptoSuffix(ticker))
}

/** Returns true if Bybit has options for this coin */
export function isBybitSupported(ticker) {
  return BYBIT_SUPPORTED.has(stripCryptoSuffix(ticker))
}

/**
 * Canonical ticker form:
 *  - Crypto: base symbol only (BTC-USD → BTC)
 *  - Stocks: uppercased raw string (aapl → AAPL)
 */
export function normalizeTicker(raw) {
  const t = raw.toUpperCase().trim()
  if (isCrypto(t)) return stripCryptoSuffix(t)
  return t
}
