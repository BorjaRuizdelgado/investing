import { averageScore, countValidScores, opportunityLabel, softenScore } from './scoring.js'

export function deriveOptionsSentiment(analysis, spot) {
  if (!analysis || !Number.isFinite(spot)) {
    return { score: null, label: 'Unavailable', reasons: [] }
  }

  const upside = (analysis.dist.mean - spot) / spot
  const movePct = analysis.em?.movePct != null ? analysis.em.movePct / 100 : null
  const pcrSentiment = analysis.pcr?.sentiment || 'unknown'

  let pcrScore = 50
  if (pcrSentiment === 'bullish') pcrScore = 75
  else if (pcrSentiment === 'bearish') pcrScore = 25

  let probabilityScore = 50
  if (analysis.probs?.probAbove != null) probabilityScore = analysis.probs.probAbove * 100

  let meanScore = 50
  if (Number.isFinite(upside)) meanScore = Math.max(0, Math.min(100, 50 + upside * 250))

  let moveScore = 50
  if (Number.isFinite(movePct)) moveScore = Math.max(0, Math.min(100, 100 - movePct * 600))

  const score = averageScore([pcrScore, probabilityScore, meanScore, moveScore])
  const reasons = []

  reasons.push({
    tone: upside >= 0 ? 'positive' : 'negative',
    title: 'Implied mean vs spot',
    detail: `Options-implied expected price is ${((upside || 0) * 100).toFixed(1)}% from spot.`,
  })
  reasons.push({
    tone:
      pcrSentiment === 'bullish' ? 'positive' : pcrSentiment === 'bearish' ? 'negative' : 'neutral',
    title: 'Put/call positioning',
    detail: `Put/call sentiment reads ${pcrSentiment}.`,
  })
  if (Number.isFinite(movePct)) {
    reasons.push({
      tone: movePct > 0.08 ? 'negative' : 'neutral',
      title: 'Expected move',
      detail: `The market is pricing a ${((movePct || 0) * 100).toFixed(1)}% move into expiry.`,
    })
  }

  return {
    score: softenScore(score),
    label: score >= 60 ? 'Bullish' : score <= 40 ? 'Defensive' : 'Balanced',
    reasons,
  }
}

export function deriveSignals({ valuation, quality, risk, options, analystUpsidePct }) {
  const signals = []

  if (
    valuation.hasData &&
    quality.hasData &&
    risk.hasData &&
    valuation.score >= 65 &&
    quality.score >= 60 &&
    risk.score >= 50
  ) {
    signals.push({
      tone: 'positive',
      title: 'Undervalued quality setup',
      detail: 'Cheap valuation is backed by decent business quality and manageable risk.',
    })
  }
  if (valuation.hasData && quality.hasData && valuation.score >= 60 && quality.score < 45) {
    signals.push({
      tone: 'negative',
      title: 'Value trap risk',
      detail: 'The stock screens cheap, but the underlying business quality is weak.',
    })
  }
  if (risk.hasData && risk.score < 40) {
    signals.push({
      tone: 'negative',
      title: 'Financial fragility',
      detail: 'Balance-sheet or volatility inputs point to elevated downside risk.',
    })
  }
  if (
    options.score != null &&
    valuation.hasData &&
    options.score >= 60 &&
    analystUpsidePct >= 0.15
  ) {
    signals.push({
      tone: 'positive',
      title: 'Market and analysts aligned',
      detail: 'Options posture and analyst targets both point to upside.',
    })
  }
  if (valuation.hasData && options.score != null && valuation.score < 35 && options.score < 45) {
    signals.push({
      tone: 'negative',
      title: 'Optimism already priced in',
      detail: 'Valuation is stretched and options do not offer a favorable asymmetry.',
    })
  }

  return signals
}

export function deriveOpportunity(valuation, quality, risk, options, analystUpsidePct) {
  const upsideScore = Number.isFinite(analystUpsidePct)
    ? Math.max(0, Math.min(100, 50 + analystUpsidePct * 200))
    : null
  const scoreParts = [valuation.score, quality.score, risk.score, options.score, upsideScore]
  const score = averageScore(scoreParts)
  const coreCoverage = countValidScores([valuation.score, quality.score, risk.score])
  const totalCoverage = countValidScores(scoreParts)

  if (coreCoverage === 0 || totalCoverage < 2) {
    return {
      hasData: false,
      score: null,
      label: 'Unavailable',
    }
  }

  return {
    hasData: true,
    score: softenScore(score),
    label: opportunityLabel(softenScore(score)),
  }
}
