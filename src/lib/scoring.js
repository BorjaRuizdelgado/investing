import { BAND_WEAK, BAND_MIXED, BAND_GOOD, SOFTEN_FLOOR, SOFTEN_CEILING } from './constants.js'

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

function safeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Map a 0-100 score to a CSS-class-friendly tone string.
 * Default thresholds: >= 70 → 'positive', < 40 → 'negative', else 'neutral'.
 */
export function tone(score, posThreshold = 70, negThreshold = 40) {
  if (!Number.isFinite(score)) return 'neutral'
  if (score >= posThreshold) return 'positive'
  if (score < negThreshold) return 'negative'
  return 'neutral'
}

export function averageScore(parts) {
  const valid = parts.map(safeNumber).filter((v) => v != null)
  if (valid.length === 0) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

export function countValidScores(parts) {
  return parts.map(safeNumber).filter((v) => v != null).length
}

export function softenScore(score, floor = SOFTEN_FLOOR, ceiling = SOFTEN_CEILING) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null
  return floor + (score / 100) * (ceiling - floor)
}

export function scoreLowBetter(value, good, bad) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value <= good) return 100
  if (value >= bad) return 0
  return clamp(100 * ((bad - value) / (bad - good)))
}

export function scoreHighBetter(value, bad, good) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value <= bad) return 0
  if (value >= good) return 100
  return clamp(100 * ((value - bad) / (good - bad)))
}

export function scoreRangeBetter(value, lowGood, highGood, lowBad, highBad) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value >= lowGood && value <= highGood) return 100
  if (value < lowGood) {
    if (value <= lowBad) return 0
    return clamp(100 * ((value - lowBad) / (lowGood - lowBad)))
  }
  if (value >= highBad) return 0
  return clamp(100 * ((highBad - value) / (highBad - highGood)))
}

export function labelFromScore(score, bands = [BAND_WEAK, BAND_MIXED, BAND_GOOD]) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'Unavailable'
  if (score < bands[0]) return 'Weak'
  if (score < bands[1]) return 'Mixed'
  if (score < bands[2]) return 'Good'
  return 'Strong'
}

export function opportunityLabel(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'Unavailable'
  if (score < 35) return 'Unattractive'
  if (score < 55) return 'Watchlist'
  if (score < 75) return 'Interesting'
  return 'High-conviction'
}

export function valuationLabel(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'Unavailable'
  if (score < 35) return 'Expensive'
  if (score < 60) return 'Fair'
  return 'Undervalued'
}

// Threshold-based sentiment rules per metric.
// { pos, neg } — if only `pos` is a function or thresholds, the metric is sign-based.
const METRIC_RULES = {
  trailingPE:             { pos: (v) => v < 15,   neg: (v) => v > 30 },
  forwardPE:              { pos: (v) => v < 15,   neg: (v) => v > 30 },
  priceToBook:            { pos: (v) => v < 1.5,  neg: (v) => v > 5 },
  priceToSales:           { pos: (v) => v < 2,    neg: (v) => v > 10 },
  eps:                    { pos: (v) => v > 0,     neg: (v) => v <= 0 },
  epsForward:             { pos: (v) => v > 0,     neg: (v) => v <= 0 },
  ebitda:                 { pos: (v) => v > 0,     neg: (v) => v <= 0 },
  netIncome:              { pos: (v) => v > 0,     neg: (v) => v <= 0 },
  grossProfit:            { pos: (v) => v > 0,     neg: (v) => v <= 0 },
  operatingIncome:        { pos: (v) => v > 0,     neg: (v) => v <= 0 },
  operatingCashflow:      { pos: (v) => v > 0,     neg: (v) => v <= 0 },
  freeCashflow:           { pos: (v) => v > 0,     neg: (v) => v <= 0 },
  revenueGrowth:          { pos: (v) => v > 0,     neg: (v) => v <= 0 },
  earningsGrowth:         { pos: (v) => v > 0,     neg: (v) => v <= 0 },
  earningsQuarterlyGrowth:{ pos: (v) => v > 0,     neg: (v) => v <= 0 },
  profitMargins:          { pos: (v) => v > 0.15,  neg: (v) => v < 0 },
  grossMargins:           { pos: (v) => v > 0.15,  neg: (v) => v < 0 },
  ebitdaMargins:          { pos: (v) => v > 0.15,  neg: (v) => v < 0 },
  operatingMargins:       { pos: (v) => v > 0.15,  neg: (v) => v < 0 },
  returnOnEquity:         { pos: (v) => v > 0.15,  neg: (v) => v < 0 },
  returnOnAssets:         { pos: (v) => v > 0.05,  neg: (v) => v < 0 },
  debtToEquity:           { pos: (v) => v < 50,    neg: (v) => v > 150 },
  currentRatio:           { pos: (v) => v > 1.5,   neg: (v) => v < 1 },
  quickRatio:             { pos: (v) => v > 1.5,   neg: (v) => v < 1 },
  dividendYield:          { pos: (v) => v > 2,     neg: () => false },
  payoutRatio:            { pos: (v) => v > 0 && v < 0.6, neg: (v) => v > 0.9 },
  beta:                   { pos: (v) => v >= 0.8 && v <= 1.2, neg: (v) => v > 1.5 || v < 0.5 },
  shortPercentOfFloat:    { pos: (v) => v < 5,     neg: (v) => v > 20 },
  fiftyTwoWeekChange:     { pos: (v) => v > 0,     neg: (v) => v <= 0 },
}

export function metricSentiment(key, val) {
  if (val == null || typeof val !== 'number' || isNaN(val)) return null
  const rule = METRIC_RULES[key]
  if (!rule) return null
  if (rule.pos(val)) return 'positive'
  if (rule.neg(val)) return 'negative'
  return null
}

export function buildFundamentalsScore(f) {
  const candidates = [
    ['forwardPE', f.forwardPE],
    ['trailingPE', f.trailingPE],
    ['priceToBook', f.priceToBook],
    ['priceToSales', f.priceToSales],
    ['eps', f.eps],
    ['epsForward', f.epsForward],
    ['revenueGrowth', f.revenueGrowth],
    ['earningsGrowth', f.earningsGrowth],
    ['profitMargins', f.profitMargins],
    ['grossMargins', f.grossMargins],
    ['operatingMargins', f.operatingMargins],
    ['returnOnEquity', f.returnOnEquity],
    ['returnOnAssets', f.returnOnAssets],
    ['debtToEquity', f.debtToEquity],
    ['currentRatio', f.currentRatio],
    ['quickRatio', f.quickRatio],
    ['dividendYield', f.dividendYield],
    ['payoutRatio', f.payoutRatio],
    ['beta', f.beta],
    ['shortPercentOfFloat', f.shortPercentOfFloat],
  ]

  const scores = candidates.map(([key, value]) => {
    const sentiment = metricSentiment(key, value)
    if (sentiment === 'positive') return 75
    if (sentiment === 'negative') return 25
    return null
  })

  const coverage = countValidScores(scores)
  if (coverage < 3) {
    return { hasData: false, score: null, label: 'Unavailable', tone: 'neutral' }
  }

  const score = softenScore(averageScore(scores))
  return {
    hasData: true,
    score,
    label: score != null && score >= 70 ? 'Strong' : score != null && score < 45 ? 'Weak' : 'Mixed',
    tone:
      score != null && score >= 70
        ? 'positive'
        : score != null && score < 45
          ? 'negative'
          : 'neutral',
  }
}
