function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(value) {
  return Number.isFinite(value) ? value : null;
}

export function averageScore(parts) {
  const valid = parts.map(safeNumber).filter((value) => value != null);
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

export function countValidScores(parts) {
  return parts.map(safeNumber).filter((value) => value != null).length;
}

export function softenScore(score, floor = 8, ceiling = 92) {
  if (!Number.isFinite(score)) return null;
  return floor + (score / 100) * (ceiling - floor);
}

export function scoreLowBetter(value, good, bad) {
  if (!Number.isFinite(value)) return null;
  if (value <= good) return 100;
  if (value >= bad) return 0;
  return clamp(100 * ((bad - value) / (bad - good)));
}

export function scoreHighBetter(value, bad, good) {
  if (!Number.isFinite(value)) return null;
  if (value <= bad) return 0;
  if (value >= good) return 100;
  return clamp(100 * ((value - bad) / (good - bad)));
}

export function scoreRangeBetter(value, lowGood, highGood, lowBad, highBad) {
  if (!Number.isFinite(value)) return null;
  if (value >= lowGood && value <= highGood) return 100;
  if (value < lowGood) {
    if (value <= lowBad) return 0;
    return clamp(100 * ((value - lowBad) / (lowGood - lowBad)));
  }
  if (value >= highBad) return 0;
  return clamp(100 * ((highBad - value) / (highBad - highGood)));
}

export function labelFromScore(score, bands = [35, 55, 75]) {
  if (!Number.isFinite(score)) return "Unavailable";
  if (score < bands[0]) return "Weak";
  if (score < bands[1]) return "Mixed";
  if (score < bands[2]) return "Good";
  return "Strong";
}

export function opportunityLabel(score) {
  if (!Number.isFinite(score)) return "Unavailable";
  if (score < 35) return "Unattractive";
  if (score < 55) return "Watchlist";
  if (score < 75) return "Interesting";
  return "High-conviction";
}

export function valuationLabel(score) {
  if (!Number.isFinite(score)) return "Unavailable";
  if (score < 35) return "Expensive";
  if (score < 60) return "Fair";
  return "Undervalued";
}

export function metricSentiment(key, val) {
  if (val == null || isNaN(val)) return null;
  switch (key) {
    case "trailingPE":
    case "forwardPE":
      if (val < 15) return "positive";
      if (val > 30) return "negative";
      return null;
    case "priceToBook":
      if (val < 1.5) return "positive";
      if (val > 5) return "negative";
      return null;
    case "priceToSales":
      if (val < 2) return "positive";
      if (val > 10) return "negative";
      return null;
    case "eps":
    case "epsForward":
    case "ebitda":
    case "netIncome":
    case "grossProfit":
    case "operatingIncome":
    case "operatingCashflow":
    case "freeCashflow":
      return val > 0 ? "positive" : "negative";
    case "revenueGrowth":
    case "earningsGrowth":
    case "earningsQuarterlyGrowth":
      return val > 0 ? "positive" : "negative";
    case "profitMargins":
    case "grossMargins":
    case "ebitdaMargins":
    case "operatingMargins":
      return val > 0.15 ? "positive" : val < 0 ? "negative" : null;
    case "returnOnEquity":
      return val > 0.15 ? "positive" : val < 0 ? "negative" : null;
    case "returnOnAssets":
      return val > 0.05 ? "positive" : val < 0 ? "negative" : null;
    case "debtToEquity":
      if (val < 50) return "positive";
      if (val > 150) return "negative";
      return null;
    case "currentRatio":
    case "quickRatio":
      if (val > 1.5) return "positive";
      if (val < 1) return "negative";
      return null;
    case "dividendYield":
      if (val > 2) return "positive";
      return null;
    case "payoutRatio":
      if (val > 0 && val < 0.6) return "positive";
      if (val > 0.9) return "negative";
      return null;
    case "beta":
      if (val >= 0.8 && val <= 1.2) return "positive";
      if (val > 1.5 || val < 0.5) return "negative";
      return null;
    case "shortPercentOfFloat":
      if (val > 20) return "negative";
      if (val < 5) return "positive";
      return null;
    case "fiftyTwoWeekChange":
      return val > 0 ? "positive" : "negative";
    default:
      return null;
  }
}

export function buildFundamentalsScore(f) {
  const candidates = [
    ["forwardPE", f.forwardPE],
    ["trailingPE", f.trailingPE],
    ["priceToBook", f.priceToBook],
    ["priceToSales", f.priceToSales],
    ["eps", f.eps],
    ["epsForward", f.epsForward],
    ["revenueGrowth", f.revenueGrowth],
    ["earningsGrowth", f.earningsGrowth],
    ["profitMargins", f.profitMargins],
    ["grossMargins", f.grossMargins],
    ["operatingMargins", f.operatingMargins],
    ["returnOnEquity", f.returnOnEquity],
    ["returnOnAssets", f.returnOnAssets],
    ["debtToEquity", f.debtToEquity],
    ["currentRatio", f.currentRatio],
    ["quickRatio", f.quickRatio],
    ["dividendYield", f.dividendYield],
    ["payoutRatio", f.payoutRatio],
    ["beta", f.beta],
    ["shortPercentOfFloat", f.shortPercentOfFloat],
  ];

  const scores = candidates.map(([key, value]) => {
    const sentiment = metricSentiment(key, value);
    if (sentiment === "positive") return 75;
    if (sentiment === "negative") return 25;
    return null;
  });

  const coverage = countValidScores(scores);
  if (coverage < 3) {
    return { hasData: false, score: null, label: "Unavailable", tone: "neutral" };
  }

  const score = softenScore(averageScore(scores));
  return {
    hasData: true,
    score,
    label: score >= 70 ? "Strong" : score < 45 ? "Weak" : "Mixed",
    tone: score >= 70 ? "positive" : score < 45 ? "negative" : "neutral",
  };
}
