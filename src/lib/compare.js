import { fmt, fmtCompact, fmtPct, fmtRatio } from './format.js'

export function formatCompareValue(value, kind) {
  if (!Number.isFinite(value)) return 'N/A'
  if (kind === 'money') return fmt(value)
  if (kind === 'compact') return fmtCompact(value)
  if (kind === 'pct') return fmtPct(value)
  if (kind === 'score') return String(Math.round(value))
  return fmtRatio(value)
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value))
  if (!valid.length) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function labelFromScore(score) {
  if (!Number.isFinite(score)) return 'Unavailable'
  if (score >= 75) return 'Strong'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Mixed'
  return 'Weak'
}

export const COMPARE_CATEGORY_DEFS = [
  { key: 'valuation', label: 'Valuation' },
  { key: 'growth', label: 'Growth' },
  { key: 'quality', label: 'Quality' },
  { key: 'risk', label: 'Risk' },
  { key: 'momentum', label: 'Momentum' },
]

export const COMPARE_METRIC_DEFS = [
  { key: 'forwardPE', label: 'Forward P/E', kind: 'ratio', lowerBetter: true },
  { key: 'revenueGrowth', label: 'Revenue Growth', kind: 'pct' },
  { key: 'operatingMargins', label: 'Operating Margin', kind: 'pct' },
  { key: 'returnOnEquity', label: 'Return on Equity', kind: 'pct' },
  { key: 'debtToEquity', label: 'Debt / Equity', kind: 'ratio', lowerBetter: true },
  { key: 'beta', label: 'Beta', kind: 'ratio', lowerBetter: true },
]

export function computeCorrelation(historyA, historyB) {
  const mapB = new Map()
  for (const bar of historyB || []) {
    if (bar.date && Number.isFinite(bar.close)) mapB.set(bar.date, bar.close)
  }

  const aligned = []
  for (const bar of historyA || []) {
    if (bar.date && Number.isFinite(bar.close) && mapB.has(bar.date)) {
      aligned.push({ a: bar.close, b: mapB.get(bar.date) })
    }
  }

  if (aligned.length < 20) return null

  const returnsA = []
  const returnsB = []
  for (let i = 1; i < aligned.length; i++) {
    if (aligned[i - 1].a > 0 && aligned[i - 1].b > 0) {
      returnsA.push((aligned[i].a - aligned[i - 1].a) / aligned[i - 1].a)
      returnsB.push((aligned[i].b - aligned[i - 1].b) / aligned[i - 1].b)
    }
  }

  if (returnsA.length < 15) return null

  const meanA = average(returnsA)
  const meanB = average(returnsB)
  let numerator = 0
  let sumSqA = 0
  let sumSqB = 0

  for (let i = 0; i < returnsA.length; i++) {
    const da = returnsA[i] - meanA
    const db = returnsB[i] - meanB
    numerator += da * db
    sumSqA += da * da
    sumSqB += db * db
  }

  const denominator = Math.sqrt(sumSqA * sumSqB)
  return denominator > 0 ? { r: numerator / denominator, days: returnsA.length } : null
}

export function correlationLabel(value) {
  if (value == null) return { text: 'Insufficient data', tone: 'neutral' }
  const abs = Math.abs(value)
  if (abs >= 0.8) {
    return {
      text: value > 0 ? 'Strongly correlated' : 'Strongly inversely correlated',
      tone: value > 0 ? 'negative' : 'positive',
    }
  }
  if (abs >= 0.5) {
    return {
      text: value > 0 ? 'Moderately correlated' : 'Moderately inversely correlated',
      tone: 'neutral',
    }
  }
  if (abs >= 0.3) return { text: 'Weakly correlated', tone: 'positive' }
  return { text: 'Low correlation', tone: 'positive' }
}

export function getHistoryWindow(history, bars) {
  const clean = (history || []).filter((bar) => bar.date && Number.isFinite(bar.close))
  if (!bars || clean.length <= bars) return clean
  return clean.slice(-bars)
}

export function indexHistory(history) {
  const clean = getHistoryWindow(history)
  if (!clean.length || clean[0].close <= 0) return []
  const base = clean[0].close
  return clean.map((bar) => ({
    ...bar,
    indexedClose: (bar.close / base) * 100,
  }))
}

export function trailingReturn(history, bars) {
  const window = getHistoryWindow(history, bars)
  if (window.length < 2) return null
  const first = window[0].close
  const last = window[window.length - 1].close
  if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0) return null
  return last / first - 1
}

export function annualizedVolatility(history, bars = 63) {
  const window = getHistoryWindow(history, bars)
  if (window.length < 10) return null
  const returns = []
  for (let i = 1; i < window.length; i++) {
    const prev = window[i - 1].close
    const next = window[i].close
    if (prev > 0 && Number.isFinite(next)) returns.push(next / prev - 1)
  }
  if (returns.length < 8) return null
  const mean = average(returns)
  const variance = average(returns.map((value) => (value - mean) ** 2))
  return Number.isFinite(variance) ? Math.sqrt(variance) * Math.sqrt(252) : null
}

export function maxDrawdown(history, bars = 252) {
  const window = getHistoryWindow(history, bars)
  if (window.length < 2) return null
  let peak = window[0].close
  let worst = 0

  for (const bar of window) {
    if (bar.close > peak) peak = bar.close
    if (peak > 0) worst = Math.min(worst, bar.close / peak - 1)
  }

  return worst
}

export function buildMomentumBucket(sentiment) {
  const score = sentiment?.score ?? null
  const topComponent = sentiment?.components?.[0]
  const reasons = topComponent
    ? [
        {
          tone: score >= 60 ? 'positive' : score < 40 ? 'negative' : 'neutral',
          title: topComponent.label,
          detail: `${topComponent.detail} scored ${topComponent.score}/100.`,
        },
      ]
    : []

  return {
    hasData: Number.isFinite(score),
    score,
    label: sentiment?.classification || labelFromScore(score),
    reasons,
  }
}

export function buildGrowthBucket(fundamentals) {
  const revenueGrowth = fundamentals?.revenueGrowth
  const earningsGrowth = fundamentals?.earningsGrowth
  const score = average([
    Number.isFinite(revenueGrowth) ? clamp(50 + revenueGrowth * 200, 0, 100) : null,
    Number.isFinite(earningsGrowth) ? clamp(50 + earningsGrowth * 160, 0, 100) : null,
  ])

  const reasons = []
  if (Number.isFinite(revenueGrowth)) {
    reasons.push({
      tone: revenueGrowth >= 0.1 ? 'positive' : revenueGrowth < 0 ? 'negative' : 'neutral',
      title: 'Revenue growth',
      detail: `Revenue growth is ${(revenueGrowth * 100).toFixed(1)}%.`,
    })
  }
  if (Number.isFinite(earningsGrowth)) {
    reasons.push({
      tone: earningsGrowth >= 0.1 ? 'positive' : earningsGrowth < 0 ? 'negative' : 'neutral',
      title: 'Earnings growth',
      detail: `Earnings growth is ${(earningsGrowth * 100).toFixed(1)}%.`,
    })
  }

  return {
    hasData: Number.isFinite(score),
    score,
    label: labelFromScore(score),
    reasons,
  }
}

export function getWinner(a, b, { lowerBetter = false, tieThreshold = 0 } = {}) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  const diff = a - b
  if (Math.abs(diff) <= tieThreshold) return 'tie'
  if (lowerBetter) return diff < 0 ? 'a' : 'b'
  return diff > 0 ? 'a' : 'b'
}

export function summarizeMatchup(left, right) {
  const rows = COMPARE_CATEGORY_DEFS.map(({ key, label }) => {
    const leftScore = left?.categories?.[key]?.score
    const rightScore = right?.categories?.[key]?.score
    return {
      key,
      label,
      leftScore,
      rightScore,
      winner: getWinner(leftScore, rightScore, { tieThreshold: 2 }),
    }
  })

  let leftWins = 0
  let rightWins = 0
  for (const row of rows) {
    if (row.winner === 'a') leftWins += 1
    if (row.winner === 'b') rightWins += 1
  }

  return { rows, leftWins, rightWins }
}

export function buildEdgeItems(subject, opponent) {
  const items = []

  for (const { key, label } of COMPARE_CATEGORY_DEFS) {
    const score = subject?.categories?.[key]?.score
    const otherScore = opponent?.categories?.[key]?.score
    if (!Number.isFinite(score) || !Number.isFinite(otherScore) || score <= otherScore + 2) continue

    items.push({
      label,
      delta: score - otherScore,
      detail:
        subject?.categories?.[key]?.reasons?.[0]?.detail ||
        `${label} score leads ${Math.round(score)} to ${Math.round(otherScore)}.`,
    })
  }

  return items.sort((a, b) => b.delta - a.delta).slice(0, 3)
}
