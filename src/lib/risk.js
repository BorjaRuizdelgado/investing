import {
  averageScore,
  countValidScores,
  labelFromScore,
  scoreHighBetter,
  scoreLowBetter,
  scoreRangeBetter,
  softenScore,
} from './scoring.js'
import { METRIC_TIPS } from './metricTips.js'
import {
  RISK_DE_GOOD,
  RISK_DE_BAD,
  RISK_CR_BAD,
  RISK_CR_GOOD,
  RISK_QR_BAD,
  RISK_QR_GOOD,
  RISK_BETA_LO_GOOD,
  RISK_BETA_HI_GOOD,
  RISK_BETA_LO_BAD,
  RISK_BETA_HI_BAD,
  RISK_SHORT_GOOD,
  RISK_SHORT_BAD,
  RISK_MOVE_GOOD,
  RISK_MOVE_BAD,
} from './constants.js'
import { addReason } from './reasons.js'

export function deriveRisk(fundamentals, analysis) {
  const f = fundamentals || {}
  const optionsMove = analysis?.em?.movePct != null ? analysis.em.movePct / 100 : null

  const metricScores = [
    scoreLowBetter(f.debtToEquity, RISK_DE_GOOD, RISK_DE_BAD),
    scoreHighBetter(f.currentRatio, RISK_CR_BAD, RISK_CR_GOOD),
    scoreHighBetter(f.quickRatio, RISK_QR_BAD, RISK_QR_GOOD),
    scoreRangeBetter(
      f.beta,
      RISK_BETA_LO_GOOD,
      RISK_BETA_HI_GOOD,
      RISK_BETA_LO_BAD,
      RISK_BETA_HI_BAD,
    ),
    scoreLowBetter(f.shortPercentOfFloat, RISK_SHORT_GOOD, RISK_SHORT_BAD),
    scoreLowBetter(optionsMove, RISK_MOVE_GOOD, RISK_MOVE_BAD),
  ]
  const score = averageScore(metricScores)
  const availableMetricCount = countValidScores(metricScores)

  const reasons = []
  if (Number.isFinite(f.debtToEquity)) {
    addReason(
      reasons,
      f.debtToEquity <= 60 ? 'positive' : f.debtToEquity >= 150 ? 'negative' : 'neutral',
      'Leverage',
      `Debt to equity is ${f.debtToEquity.toFixed(1)}.`,
    )
  }
  if (Number.isFinite(f.currentRatio)) {
    addReason(
      reasons,
      f.currentRatio >= 1.5 ? 'positive' : f.currentRatio < 1 ? 'negative' : 'neutral',
      'Liquidity',
      `Current ratio is ${f.currentRatio.toFixed(2)}.`,
    )
  }
  if (Number.isFinite(f.beta)) {
    addReason(
      reasons,
      f.beta <= 1.2 ? 'positive' : f.beta >= 1.6 ? 'negative' : 'neutral',
      'Market volatility',
      `Beta is ${f.beta.toFixed(2)}.`,
    )
  }
  if (Number.isFinite(optionsMove)) {
    addReason(
      reasons,
      optionsMove <= 0.05 ? 'positive' : optionsMove >= 0.1 ? 'negative' : 'neutral',
      'Near-term event risk',
      `Options imply a ${((optionsMove || 0) * 100).toFixed(1)}% move.`,
    )
  }

  const metrics = [
    {
      key: 'debtToEquity',
      label: 'Debt / Equity',
      value: f.debtToEquity,
      kind: 'ratio',
      tip: METRIC_TIPS.debtToEquity,
    },
    {
      key: 'currentRatio',
      label: 'Current Ratio',
      value: f.currentRatio,
      kind: 'ratio',
      tip: METRIC_TIPS.currentRatio,
    },
    {
      key: 'quickRatio',
      label: 'Quick Ratio',
      value: f.quickRatio,
      kind: 'ratio',
      tip: METRIC_TIPS.quickRatio,
    },
    { key: 'beta', label: 'Beta', value: f.beta, kind: 'ratio', tip: METRIC_TIPS.beta },
    {
      key: 'shortPercentOfFloat',
      label: 'Short % Float',
      value: f.shortPercentOfFloat,
      kind: 'pct-whole',
      tip: METRIC_TIPS.shortPercentOfFloat,
    },
    {
      key: 'impliedMove',
      label: 'Implied Move',
      value: optionsMove,
      kind: 'pct',
      tip: METRIC_TIPS.impliedMove,
    },
  ]

  const finalScore = availableMetricCount >= 2 ? softenScore(score) : null

  // Map generic positive/negative labels to risk-oriented wording so the
  // risk card reads intuitively (e.g. "Low" risk instead of "Strong").
  const baseLabel = availableMetricCount >= 2 ? labelFromScore(finalScore) : 'Unavailable'
  const riskLabelMap = {
    Strong: 'Low',
    Good: 'Moderate',
    Mixed: 'Medium',
    Weak: 'High',
    Unavailable: 'Unavailable',
  }

  return {
    hasData: availableMetricCount >= 2,
    availableMetricCount,
    score: Number.isFinite(finalScore) ? 100 - finalScore : null,
    safetyScore: finalScore,
    label: riskLabelMap[baseLabel] || baseLabel,
    metrics,
    reasons,
  }
}
