/**
 * /api/sentiment — per-ticker fear/greed-style sentiment score.
 */

import { fetchYF } from '../yahoo.js'
import { jsonResp, cachedJsonResp, logError } from '../utils.js'
import { isCrypto, normalizeTicker } from '../../lib/tickers.js'

// Classification thresholds
function classifySentiment(score) {
  if (score <= 24) return 'Extreme Fear'
  if (score <= 44) return 'Fear'
  if (score <= 55) return 'Neutral'
  if (score <= 75) return 'Greed'
  return 'Extreme Greed'
}

// Normalize a value to 0-100 where higher = more greed
function normalize(value, fearExtreme, greedExtreme) {
  if (!Number.isFinite(value) || !Number.isFinite(fearExtreme) || !Number.isFinite(greedExtreme))
    return 50
  const range = greedExtreme - fearExtreme
  if (range === 0) return 50
  return Math.max(0, Math.min(100, ((value - fearExtreme) / range) * 100))
}

// Per-ticker sentiment cache: yfTicker → { result, expiry }
const equitySentimentCache = new Map()

/**
 * Compute a fear/greed-style sentiment score from a ticker's own OHLCV history.
 * Five factors derived from price/volume data — equally weighted, normalized 0-100.
 * Works for both equities and crypto (pass the Yahoo Finance symbol, e.g. BTC-USD).
 *
 *  1. Price momentum    — close vs its 125-day SMA
 *  2. RSI (14)          — 14-day RSI: oversold=fear, overbought=greed
 *  3. 52-week position  — where price sits in its 52-week H/L range
 *  4. Volume pressure   — 10-day avg volume vs 60-day avg volume
 *  5. Bollinger %B      — position within the 20-day Bollinger Bands
 */
async function computeTickerSentiment(yfTicker, displayTicker, scope) {
  const now = Date.now()
  const cached = equitySentimentCache.get(yfTicker)
  if (cached && now < cached.expiry) return cached.result

  // 200 trading days covers all lookback windows (SMA 125, 52-week, BB 20, RSI 14, vol 60)
  const chartData = await fetchYF(`/v8/finance/chart/${encodeURIComponent(yfTicker)}?range=200d&interval=1d`)
  const result0 = chartData?.chart?.result?.[0]
  const rawCloses = result0?.indicators?.quote?.[0]?.close || []
  const rawVolumes = result0?.indicators?.quote?.[0]?.volume || []

  const closes = rawCloses.map((v) => (v != null ? v : null))
  const volumes = rawVolumes.map((v) => (v != null ? v : null))

  function sma(arr, n) {
    const valid = arr.slice(-n).filter((v) => v != null)
    if (valid.length < Math.floor(n * 0.8)) return null // require 80% of window filled
    return valid.reduce((a, b) => a + b, 0) / valid.length
  }

  // 14-day RSI
  function rsi14(arr) {
    const last = arr.filter((v) => v != null)
    if (last.length < 15) return null
    const slice = last.slice(-15)
    let gains = 0, losses = 0
    for (let i = 1; i < slice.length; i++) {
      const diff = slice[i] - slice[i - 1]
      if (diff > 0) gains += diff
      else losses -= diff
    }
    const n = slice.length - 1
    if (losses === 0) return 100
    const rs = (gains / n) / (losses / n)
    return 100 - 100 / (1 + rs)
  }

  // Bollinger %B: (close - lower) / (upper - lower)
  function bollingerB(arr, n = 20, k = 2) {
    const valid = arr.filter((v) => v != null)
    if (valid.length < n) return null
    const slice = valid.slice(-n)
    const mid = slice.reduce((a, b) => a + b, 0) / n
    const variance = slice.reduce((a, b) => a + (b - mid) ** 2, 0) / n
    const std = Math.sqrt(variance)
    if (std === 0) return 0.5
    const last = valid[valid.length - 1]
    return (last - (mid - k * std)) / (2 * k * std)
  }

  const components = []
  const scores = []

  // 1. Price momentum vs 125-day SMA
  {
    const sma125 = sma(closes, 125)
    const last = closes.filter((v) => v != null).at(-1) ?? null
    let score = 50
    if (sma125 && last != null) {
      const ratio = last / sma125
      // -15% below SMA = extreme fear (0.85), +15% above = extreme greed (1.15)
      score = Math.round(normalize(ratio, 0.85, 1.15))
    }
    scores.push(score)
    components.push({ label: 'Price Momentum', score, detail: 'Close vs 125-day SMA' })
  }

  // 2. RSI (14) — 20=fear, 80=greed
  {
    const rsiVal = rsi14(closes)
    const score = rsiVal != null ? Math.round(normalize(rsiVal, 20, 80)) : 50
    scores.push(score)
    components.push({ label: 'RSI (14)', score, detail: '14-day relative strength index' })
  }

  // 3. 52-week range position
  {
    const validCloses = closes.filter((v) => v != null)
    const lo = Math.min(...validCloses)
    const hi = Math.max(...validCloses)
    const last = validCloses.at(-1) ?? null
    let score = 50
    if (hi > lo && last != null) {
      score = Math.round(((last - lo) / (hi - lo)) * 100)
    }
    scores.push(score)
    components.push({ label: '52-Week Position', score, detail: 'Price position in 52-week range' })
  }

  // 4. Volume pressure: 10-day avg vs 60-day avg
  {
    const validVols = volumes.filter((v) => v != null && v > 0)
    const avg10 = sma(validVols, 10)
    const avg60 = sma(validVols, 60)
    let score = 50
    if (avg10 && avg60 && avg60 > 0) {
      const ratio = avg10 / avg60
      // 0.5x avg = fear (low participation), 2x avg = greed (high buying)
      score = Math.round(normalize(ratio, 0.5, 2.0))
    }
    scores.push(score)
    components.push({ label: 'Volume Pressure', score, detail: '10-day vs 60-day average volume' })
  }

  // 5. Bollinger %B
  {
    const pctB = bollingerB(closes)
    let score = 50
    if (pctB != null) {
      // %B: 0 = lower band (fear), 1 = upper band (greed); can exceed [0,1]
      score = Math.round(normalize(pctB, 0, 1))
    }
    scores.push(score)
    components.push({ label: 'Bollinger %B', score, detail: 'Price position within 20-day Bollinger Bands' })
  }

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  const composite = Math.round(Math.max(0, Math.min(100, avg)))
  const classification = classifySentiment(composite)

  const sentimentResult = {
    scope,
    source: 'house',
    name: 'Ticker Sentiment',
    score: composite,
    classification,
    summary: `${classification} (${composite})`,
    asOf: new Date().toISOString(),
    components,
    attribution: null,
  }

  equitySentimentCache.set(yfTicker, { result: sentimentResult, expiry: now + 60 * 60_000 })
  return sentimentResult
}

export async function handleSentiment(ticker) {
  try {
    const norm = normalizeTicker(ticker)
    const scope = isCrypto(ticker) ? 'crypto' : 'equity'
    const yfTicker = scope === 'crypto' ? `${norm}-USD` : norm
    const payload = await computeTickerSentiment(yfTicker, norm, scope)
    return cachedJsonResp(payload, 900)
  } catch (err) {
    logError('/api/sentiment', err, { ticker })
    return jsonResp({ error: err.message }, 502)
  }
}
