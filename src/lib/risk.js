import { averageScore, countValidScores, labelFromScore, scoreHighBetter, scoreLowBetter, scoreRangeBetter, softenScore } from "./scoring.js";
import { METRIC_TIPS } from "./metricTips.js";

function addReason(reasons, tone, title, detail) {
  reasons.push({ tone, title, detail });
}

export function deriveRisk(fundamentals, analysis) {
  const f = fundamentals || {};
  const optionsMove = analysis?.em?.movePct != null ? analysis.em.movePct / 100 : null;

  const metricScores = [
    scoreLowBetter(f.debtToEquity, 40, 180),
    scoreHighBetter(f.currentRatio, 0.9, 2),
    scoreHighBetter(f.quickRatio, 0.8, 1.8),
    scoreRangeBetter(f.beta, 0.8, 1.2, 0.3, 2.2),
    scoreLowBetter(f.shortPercentOfFloat, 5, 25),
    scoreLowBetter(optionsMove, 0.03, 0.12),
  ];
  const score = averageScore(metricScores);
  const availableMetricCount = countValidScores(metricScores);

  const reasons = [];
  if (Number.isFinite(f.debtToEquity)) {
    addReason(
      reasons,
      f.debtToEquity <= 60 ? "positive" : f.debtToEquity >= 150 ? "negative" : "neutral",
      "Leverage",
      `Debt to equity is ${f.debtToEquity.toFixed(1)}.`
    );
  }
  if (Number.isFinite(f.currentRatio)) {
    addReason(
      reasons,
      f.currentRatio >= 1.5 ? "positive" : f.currentRatio < 1 ? "negative" : "neutral",
      "Liquidity",
      `Current ratio is ${f.currentRatio.toFixed(2)}.`
    );
  }
  if (Number.isFinite(f.beta)) {
    addReason(
      reasons,
      f.beta <= 1.2 ? "positive" : f.beta >= 1.6 ? "negative" : "neutral",
      "Market volatility",
      `Beta is ${f.beta.toFixed(2)}.`
    );
  }
  if (Number.isFinite(optionsMove)) {
    addReason(
      reasons,
      optionsMove <= 0.05 ? "positive" : optionsMove >= 0.1 ? "negative" : "neutral",
      "Near-term event risk",
      `Options imply a ${((optionsMove || 0) * 100).toFixed(1)}% move.`
    );
  }

  const metrics = [
    { label: "Debt / Equity", value: f.debtToEquity, kind: "ratio", tip: METRIC_TIPS.debtToEquity },
    { label: "Current Ratio", value: f.currentRatio, kind: "ratio", tip: METRIC_TIPS.currentRatio },
    { label: "Quick Ratio", value: f.quickRatio, kind: "ratio", tip: METRIC_TIPS.quickRatio },
    { label: "Beta", value: f.beta, kind: "ratio", tip: METRIC_TIPS.beta },
    { label: "Short % Float", value: f.shortPercentOfFloat, kind: "pct-whole", tip: METRIC_TIPS.shortPercentOfFloat },
    { label: "Implied Move", value: optionsMove, kind: "pct", tip: METRIC_TIPS.impliedMove },
  ];

  const finalScore = availableMetricCount >= 2 ? softenScore(score) : null;

  // Map generic positive/negative labels to risk-oriented wording so the
  // risk card reads intuitively (e.g. "Low" risk instead of "Strong").
  const baseLabel = availableMetricCount >= 2 ? labelFromScore(finalScore) : "Unavailable";
  const riskLabelMap = {
    Strong: "Low",
    Good: "Moderate",
    Mixed: "Medium",
    Weak: "High",
    Unavailable: "Unavailable",
  };

  return {
    hasData: availableMetricCount >= 2,
    availableMetricCount,
    score: Number.isFinite(finalScore) ? 100 - finalScore : null,
    safetyScore: finalScore,
    label: riskLabelMap[baseLabel] || baseLabel,
    metrics,
    reasons,
  };
}
