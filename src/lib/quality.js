import {
  averageScore,
  countValidScores,
  labelFromScore,
  scoreHighBetter,
  softenScore,
} from './scoring.js'
import { METRIC_TIPS } from './metricTips.js'
import {
  QUAL_REV_GROWTH_BAD,
  QUAL_REV_GROWTH_GOOD,
  QUAL_EARN_GROWTH_BAD,
  QUAL_EARN_GROWTH_GOOD,
  QUAL_GROSS_MARGIN_BAD,
  QUAL_GROSS_MARGIN_GOOD,
  QUAL_OP_MARGIN_BAD,
  QUAL_OP_MARGIN_GOOD,
  QUAL_NET_MARGIN_BAD,
  QUAL_NET_MARGIN_GOOD,
  QUAL_ROE_BAD,
  QUAL_ROE_GOOD,
  QUAL_ROA_BAD,
  QUAL_ROA_GOOD,
  QUAL_FCF_MARGIN_BAD,
  QUAL_FCF_MARGIN_GOOD,
} from './constants.js'
import { addReason } from './reasons.js'

export function deriveQuality(fundamentals) {
  if (!fundamentals) {
    return { score: null, label: 'Unavailable', metrics: [], reasons: [] }
  }

  const f = fundamentals
  const fcfMargin =
    Number.isFinite(f.freeCashflow) && Number.isFinite(f.totalRevenue) && f.totalRevenue > 0
      ? f.freeCashflow / f.totalRevenue
      : null

  const metricScores = [
    scoreHighBetter(f.revenueGrowth, QUAL_REV_GROWTH_BAD, QUAL_REV_GROWTH_GOOD),
    scoreHighBetter(f.earningsGrowth, QUAL_EARN_GROWTH_BAD, QUAL_EARN_GROWTH_GOOD),
    scoreHighBetter(f.grossMargins, QUAL_GROSS_MARGIN_BAD, QUAL_GROSS_MARGIN_GOOD),
    scoreHighBetter(f.operatingMargins, QUAL_OP_MARGIN_BAD, QUAL_OP_MARGIN_GOOD),
    scoreHighBetter(f.profitMargins, QUAL_NET_MARGIN_BAD, QUAL_NET_MARGIN_GOOD),
    scoreHighBetter(f.returnOnEquity, QUAL_ROE_BAD, QUAL_ROE_GOOD),
    scoreHighBetter(f.returnOnAssets, QUAL_ROA_BAD, QUAL_ROA_GOOD),
    scoreHighBetter(fcfMargin, QUAL_FCF_MARGIN_BAD, QUAL_FCF_MARGIN_GOOD),
  ]
  const score = averageScore(metricScores)
  const availableMetricCount = countValidScores(metricScores)

  const reasons = []
  if (Number.isFinite(f.revenueGrowth)) {
    addReason(
      reasons,
      f.revenueGrowth >= 0.1 ? 'positive' : f.revenueGrowth < 0 ? 'negative' : 'neutral',
      'Top-line growth',
      `Revenue growth is ${(f.revenueGrowth * 100).toFixed(1)}%.`,
    )
  }
  if (Number.isFinite(f.operatingMargins)) {
    addReason(
      reasons,
      f.operatingMargins >= 0.15 ? 'positive' : f.operatingMargins < 0.05 ? 'negative' : 'neutral',
      'Operating margin',
      `Operating margin is ${(f.operatingMargins * 100).toFixed(1)}%.`,
    )
  }
  if (Number.isFinite(f.returnOnEquity)) {
    addReason(
      reasons,
      f.returnOnEquity >= 0.15 ? 'positive' : f.returnOnEquity < 0.08 ? 'negative' : 'neutral',
      'Return on equity',
      `ROE is ${(f.returnOnEquity * 100).toFixed(1)}%.`,
    )
  }
  if (Number.isFinite(f.freeCashflow)) {
    addReason(
      reasons,
      f.freeCashflow > 0 ? 'positive' : 'negative',
      'Cash generation',
      `${f.freeCashflow > 0 ? 'Positive' : 'Negative'} free cash flow.`,
    )
  }

  const metrics = [
    {
      key: 'revenueGrowth',
      label: 'Revenue Growth',
      value: f.revenueGrowth,
      kind: 'pct',
      tip: METRIC_TIPS.revenueGrowth,
    },
    {
      key: 'earningsGrowth',
      label: 'Earnings Growth',
      value: f.earningsGrowth,
      kind: 'pct',
      tip: METRIC_TIPS.earningsGrowth,
    },
    {
      key: 'grossMargins',
      label: 'Gross Margin',
      value: f.grossMargins,
      kind: 'pct',
      tip: METRIC_TIPS.grossMargins,
    },
    {
      key: 'operatingMargins',
      label: 'Operating Margin',
      value: f.operatingMargins,
      kind: 'pct',
      tip: METRIC_TIPS.operatingMargins,
    },
    {
      key: 'profitMargins',
      label: 'Net Margin',
      value: f.profitMargins,
      kind: 'pct',
      tip: METRIC_TIPS.profitMargins,
    },
    {
      key: 'returnOnEquity',
      label: 'ROE',
      value: f.returnOnEquity,
      kind: 'pct',
      tip: METRIC_TIPS.returnOnEquity,
    },
    {
      key: 'returnOnAssets',
      label: 'ROA',
      value: f.returnOnAssets,
      kind: 'pct',
      tip: METRIC_TIPS.returnOnAssets,
    },
    {
      key: 'fcfMargin',
      label: 'FCF Margin',
      value: fcfMargin,
      kind: 'pct',
      tip: METRIC_TIPS.fcfMargin,
    },
  ]

  const finalScore = availableMetricCount >= 2 ? softenScore(score) : null

  return {
    hasData: availableMetricCount >= 2,
    availableMetricCount,
    score: finalScore,
    label: availableMetricCount >= 2 ? labelFromScore(finalScore) : 'Unavailable',
    metrics,
    reasons,
  }
}
