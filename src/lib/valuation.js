import {
  averageScore,
  countValidScores,
  labelFromScore,
  scoreHighBetter,
  scoreLowBetter,
  softenScore,
  valuationLabel,
} from "./scoring.js";
import { METRIC_TIPS } from "./metricTips.js";

function addReason(reasons, tone, title, detail) {
  reasons.push({ tone, title, detail });
}

export function deriveValuation(fundamentals, spot) {
  if (!fundamentals || !Number.isFinite(spot)) {
    return {
      score: null,
      label: "Unavailable",
      metrics: [],
      reasons: [],
      fairValue: null,
      analystUpsidePct: null,
    };
  }

  const f = fundamentals;
  const earningsYield = Number.isFinite(f.forwardPE) && f.forwardPE > 0 ? 1 / f.forwardPE : null;
  const fcfYield =
    Number.isFinite(f.freeCashflow) && Number.isFinite(f.marketCap) && f.marketCap > 0
      ? f.freeCashflow / f.marketCap
      : null;
  const analystUpsidePct =
    Number.isFinite(f.targetMeanPrice) && spot > 0 ? (f.targetMeanPrice - spot) / spot : null;

  const scoreParts = [
    scoreLowBetter(f.forwardPE, 12, 32),
    scoreLowBetter(f.trailingPE, 15, 35),
    scoreLowBetter(f.priceToBook, 1.5, 6),
    scoreLowBetter(f.enterpriseToRevenue, 2, 10),
    scoreLowBetter(f.enterpriseToEbitda, 8, 22),
    scoreHighBetter(earningsYield, 0.02, 0.08),
    scoreHighBetter(fcfYield, 0.01, 0.06),
  ];

  const score = averageScore(scoreParts);
  const availableMetricCount = countValidScores(scoreParts);
  const reasons = [];

  if (Number.isFinite(f.forwardPE)) {
    addReason(
      reasons,
      f.forwardPE <= 15 ? "positive" : f.forwardPE >= 28 ? "negative" : "neutral",
      "Forward earnings multiple",
      `Forward P/E is ${f.forwardPE.toFixed(1)}x.`
    );
  }
  if (Number.isFinite(fcfYield)) {
    addReason(
      reasons,
      fcfYield >= 0.05 ? "positive" : fcfYield <= 0.02 ? "negative" : "neutral",
      "Free cash flow yield",
      `FCF yield is ${(fcfYield * 100).toFixed(1)}%.`
    );
  }
  if (Number.isFinite(analystUpsidePct)) {
    addReason(
      reasons,
      analystUpsidePct >= 0.15 ? "positive" : analystUpsidePct <= -0.1 ? "negative" : "neutral",
      "Analyst gap",
      `Mean analyst target implies ${(analystUpsidePct * 100).toFixed(1)}% upside/downside.`
    );
  }

  const fairValueMethods = [];
  if (Number.isFinite(f.targetMeanPrice) && f.targetMeanPrice > 0) {
    fairValueMethods.push({ label: "Analyst mean", value: f.targetMeanPrice });
  }
  if (Number.isFinite(f.epsForward) && f.epsForward > 0) {
    fairValueMethods.push({ label: "Forward EPS x 18", value: f.epsForward * 18 });
  }
  if (Number.isFinite(f.freeCashflow) && Number.isFinite(f.sharesOutstanding) && f.freeCashflow > 0 && f.sharesOutstanding > 0) {
    fairValueMethods.push({
      label: "FCF yield 5%",
      value: (f.freeCashflow / f.sharesOutstanding) / 0.05,
    });
  }

  const fairBase = averageScore(fairValueMethods.map((method) => method.value));
  const fairValue = Number.isFinite(fairBase)
    ? {
        bear: fairBase * 0.85,
        base: fairBase,
        bull: fairBase * 1.2,
        methods: fairValueMethods,
      }
    : null;

  const metrics = [
    { key: "forwardPE", label: "Forward P/E", value: f.forwardPE, kind: "ratio", tip: METRIC_TIPS.forwardPE },
    { key: "trailingPE", label: "Trailing P/E", value: f.trailingPE, kind: "ratio", tip: METRIC_TIPS.trailingPE },
    { key: "enterpriseToEbitda", label: "EV / EBITDA", value: f.enterpriseToEbitda, kind: "ratio", tip: METRIC_TIPS.enterpriseToEbitda },
    { key: "enterpriseToRevenue", label: "EV / Revenue", value: f.enterpriseToRevenue, kind: "ratio", tip: METRIC_TIPS.enterpriseToRevenue },
    { key: "earningsYield", label: "Earnings Yield", value: earningsYield, kind: "pct", tip: METRIC_TIPS.earningsYield },
    { key: "fcfYield", label: "FCF Yield", value: fcfYield, kind: "pct", tip: METRIC_TIPS.fcfYield },
  ];

  const finalScore = availableMetricCount >= 2 ? softenScore(score) : null;

  return {
    hasData: availableMetricCount >= 2,
    availableMetricCount,
    score: finalScore,
    label: availableMetricCount >= 2 ? valuationLabel(finalScore) : "Unavailable",
    confidence: fairValueMethods.length >= 2 ? "Medium" : fairValueMethods.length === 1 ? "Low" : "Unavailable",
    metrics,
    reasons,
    fairValue: fairValueMethods.length > 0 ? fairValue : null,
    analystUpsidePct,
    summary: availableMetricCount >= 2 ? labelFromScore(finalScore) : "Unavailable",
  };
}
