/**
 * /api/trending — trending tickers for the landing page.
 */

import { fetchYF } from '../yahoo.js'
import { cachedJsonResp } from '../utils.js'

let cachedTrending = null
let trendingExpiry = 0

const FALLBACK_STOCKS = ['SPY', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOGL']
const CRYPTO_SYMBOLS = [
  'BTC-USD',
  'ETH-USD',
  'SOL-USD',
  'XRP-USD',
  'DOGE-USD',
  'BNB-USD',
  'ADA-USD',
  'AVAX-USD',
]

/** Check if a stock ticker has options on Yahoo Finance. */
async function checkStockOptions(symbol) {
  try {
    const data = await fetchYF(`/v7/finance/options/${symbol}`)
    const exps = data?.optionChain?.result?.[0]?.expirationDates || []
    return exps.length > 0
  } catch {
    return false
  }
}

export async function handleTrending() {
  const now = Date.now()
  if (cachedTrending && now < trendingExpiry) return cachedJsonResp(cachedTrending, 300)

  // 1. Get candidate stock symbols (trending or fallback)
  let stockSymbols = FALLBACK_STOCKS
  try {
    const trending = await fetchYF('/v1/finance/trending/US?count=20')
    const symbols = trending?.finance?.result?.[0]?.quotes?.map((q) => q.symbol) || []
    if (symbols.length > 0) stockSymbols = symbols.slice(0, 20)
  } catch {
    /* use fallback */
  }

  // 2. Batch-fetch quotes for all candidates
  const allSymbols = [...stockSymbols, ...CRYPTO_SYMBOLS].join(',')
  const quoteData = await fetchYF(`/v7/finance/quote?symbols=${encodeURIComponent(allSymbols)}`)
  const quotes = quoteData?.quoteResponse?.result || []

  const cryptoSet = new Set(CRYPTO_SYMBOLS)
  const cryptoBaseSet = new Set(CRYPTO_SYMBOLS.map((s) => s.replace('-USD', '')))
  const stockCandidates = []
  const crypto = []

  for (const q of quotes) {
    const item = {
      symbol: q.symbol,
      name: q.shortName || q.longName || q.symbol,
      price: q.regularMarketPrice ?? 0,
      change: q.regularMarketChange ?? 0,
      changePct: q.regularMarketChangePercent ?? 0,
      marketCap: q.marketCap ?? null,
    }
    if (cryptoSet.has(q.symbol)) {
      crypto.push({ ...item, symbol: q.symbol.replace('-USD', '') })
    } else if (!cryptoBaseSet.has(q.symbol)) {
      // Skip tickers that collide with crypto base symbols (e.g. BTC, ETH)
      stockCandidates.push(item)
    }
  }

  // 3. Verify options availability for stock candidates (check in parallel, take first 8 that pass)
  const optChecks = await Promise.all(
    stockCandidates.map((s) => checkStockOptions(s.symbol).then((ok) => ({ ...s, ok }))),
  )
  const stocks = optChecks
    .filter((s) => s.ok)
    .slice(0, 8)
    .map(({ ok: _ok, ...s }) => s)

  // If none passed (unlikely), use fallback symbols that always have options
  if (stocks.length === 0) {
    for (const sym of FALLBACK_STOCKS) {
      const q = stockCandidates.find((s) => s.symbol === sym)
      if (q) stocks.push(q)
    }
  }

  const result = { stocks, crypto }
  cachedTrending = result
  trendingExpiry = now + 5 * 60_000 // 5-minute cache
  return cachedJsonResp(result, 300)
}
