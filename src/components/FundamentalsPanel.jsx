import React from "react";
import Tooltip from "./Tooltip.jsx";
import ScoreCard from "./ScoreCard.jsx";
import { fmt, fmtCompact, fmtPct, fmtRatio, fmtInt } from "../lib/format.js";
import { averageScore, countValidScores, softenScore } from "../lib/scoring.js";
import { METRIC_TIPS } from "../lib/metricTips.js";

const TIPS = {
  trailingPE: "Price-to-Earnings (trailing 12 months). Below 15 is generally considered cheap; above 30 expensive.",
  forwardPE: "Price-to-Earnings based on forward estimates. Lower values suggest cheaper valuation relative to expected earnings.",
  pegRatio: "P/E divided by earnings growth rate (5yr expected). Below 1 suggests undervaluation relative to growth.",
  priceToBook: "Price-to-Book value. Below 1.5 may indicate undervaluation; above 5 suggests premium pricing.",
  priceToSales: "Price-to-Sales ratio. Useful for companies with low or negative earnings. Lower is generally better.",
  marketCap: "Total market value of outstanding shares.",
  enterpriseValue: "Market cap + debt − cash. Represents the total cost to acquire the company.",
  enterpriseToRevenue: "Enterprise Value / Revenue. Measures what the market pays per dollar of revenue.",
  enterpriseToEbitda: "Enterprise Value / EBITDA. Common acquisition valuation metric; lower may signal value.",
  eps: "Earnings Per Share (trailing 12 months). Positive means the company is profitable.",
  epsForward: "Expected Earnings Per Share for the next fiscal year based on analyst estimates.",
  ebitda: "Earnings Before Interest, Taxes, Depreciation & Amortisation. A proxy for operating cash flow.",
  totalRevenue: "Total revenue (trailing 12 months). The company's top-line income.",
  revenuePerShare: "Revenue divided by shares outstanding.",
  revenueGrowth: "Year-over-year revenue growth rate. Positive indicates expanding top-line.",
  earningsGrowth: "Year-over-year earnings growth rate.",
  profitMargins: "Net income / revenue. Higher margins indicate better profitability.",
  grossMargins: "Gross profit / revenue. Shows production efficiency before operating costs.",
  ebitdaMargins: "EBITDA / revenue. Measures operational profitability before non-cash charges.",
  operatingMargins: "Operating income / revenue. Measures core business profitability.",
  returnOnEquity: "Net income / shareholder equity. Measures how efficiently equity capital generates profit.",
  returnOnAssets: "Net income / total assets. How efficiently assets generate earnings.",
  netIncome: "Bottom-line profit after all expenses, taxes, and costs (most recent annual).",
  grossProfit: "Revenue minus cost of goods sold (most recent annual).",
  operatingIncome: "Profit from core operations before interest and taxes (most recent annual).",
  totalCash: "Total cash and cash equivalents on the balance sheet.",
  totalCashPerShare: "Cash per share — total cash divided by shares outstanding.",
  totalDebt: "Total debt obligations.",
  debtToEquity: "Total debt / shareholder equity. Lower values suggest less leverage risk.",
  currentRatio: "Current assets / current liabilities. Above 1 means the company can cover short-term debts.",
  quickRatio: "Quick assets / current liabilities. Like current ratio but excludes inventory — stricter test of liquidity.",
  bookValue: "Net asset value per share (total assets minus liabilities, divided by shares).",
  totalAssets: "Total assets on the balance sheet.",
  totalLiabilities: "Total liabilities on the balance sheet.",
  totalStockholderEquity: "Total shareholder equity — assets minus liabilities.",
  operatingCashflow: "Cash generated from operations. Positive is healthy.",
  freeCashflow: "Operating cash flow minus capital expenditures. Cash available for dividends, buybacks, or reinvestment.",
  capitalExpenditures: "Spending on fixed assets (property, equipment, etc.).",
  dividendYield: "Annual dividend / share price. Higher yields provide more income per dollar invested.",
  dividendRate: "Annual dividend payment per share in dollars.",
  trailingAnnualDividendRate: "Sum of dividends paid over the last 12 months per share.",
  fiveYearAvgDividendYield: "Average dividend yield over the past 5 years.",
  payoutRatio: "Dividends paid / net income. A very high ratio may be unsustainable.",
  exDividendDate: "Last ex-dividend date. Buy before this date to receive the next dividend.",
  lastDividendValue: "Most recent dividend payment per share.",
  beta: "Volatility relative to the market (S&P 500). 1.0 = same volatility; >1.5 = high; <0.5 = low.",
  fiftyTwoWeek: "Lowest and highest price over the past 52 weeks.",
  fiftyTwoWeekChange: "Price change over the past 52 weeks as a percentage.",
  fiftyDayAverage: "Average closing price over the last 50 trading days.",
  twoHundredDayAverage: "Average closing price over the last 200 trading days. Key long-term trend indicator.",
  avgVolume: "Average daily trading volume over the last 3 months.",
  avgVolume10d: "Average daily trading volume over the last 10 days.",
  sharesOutstanding: "Total number of shares currently held by all shareholders.",
  floatShares: "Shares available for public trading (excludes insider and restricted shares).",
  heldPercentInsiders: "Percentage of shares held by company insiders.",
  heldPercentInstitutions: "Percentage of shares held by institutional investors.",
  sharesShort: "Number of shares currently sold short.",
  shortRatio: "Days to cover: short interest / average daily volume.",
  shortPercentOfFloat: "Short interest as a percentage of float. High values may indicate bearish sentiment or squeeze potential.",
  sharesShortPriorMonth: "Short interest from the prior reporting month. Compare with current to spot trends.",
  dayRange: "Today's low and high trading prices.",
  previousClose: "Last session's closing price.",
  open: "Today's opening price.",
  volume: "Number of shares traded today.",
  marketChange: "Price change from previous close in dollars and percent.",
  targetMeanPrice: "Average analyst price target.",
  targetMedianPrice: "Median analyst price target.",
  targetRange: "Range of analyst price targets from low to high.",
  recommendationKey: "Analyst consensus: strong buy, buy, hold, underperform, or sell.",
  numberOfAnalystOpinions: "Number of analysts providing estimates.",
  earningsDate: "Upcoming or most recent earnings report date.",
  earningsQuarterlyGrowth: "Year-over-year quarterly earnings growth rate.",
};

function metricSentiment(key, val) {
  if (val == null || isNaN(val)) return null;
  switch (key) {
    case "trailingPE":
    case "forwardPE":
      if (val < 15) return "positive";
      if (val > 30) return "negative";
      return null;
    case "pegRatio":
      if (val > 0 && val < 1) return "positive";
      if (val > 2) return "negative";
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

function tsToDate(ts) {
  if (!ts) return null;
  return new Date(ts * 1000).toLocaleDateString();
}

function toneFromSentiment(sentiment) {
  if (sentiment === "positive") return "positive";
  if (sentiment === "negative") return "negative";
  return "neutral";
}

function FundamentalsTableSection({ title, items }) {
  const visible = items.filter(Boolean);
  if (!visible.length) return null;

  return (
    <section className="terminal-section">
      <div className="fundamentals-section-block">
        <div className="section-heading">
          <h2>{title}</h2>
        </div>
        <div className="terminal-card fundamentals-table-card">
          <table className="data-table fundamentals-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const sentiment = metricSentiment(item.key, item.rawValue);
                const valueClass = sentiment ? `fundamentals-table-value fund-${sentiment}` : "fundamentals-table-value";
                return (
                  <tr key={item.id}>
                    <td>
                      <span className="metric-table-label">
                        {item.label}
                        {item.tip && <Tooltip text={item.tip} />}
                      </span>
                    </td>
                    <td className={valueClass}>{item.value}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function SummaryCard({ item }) {
  const sentiment = metricSentiment(item.key, item.rawValue);
  const valueClass = sentiment ? `kpi-value fund-${sentiment}` : "kpi-value";

  return (
    <div className="kpi-card">
      <div className="kpi-label">
        {item.label}
        {item.tip && <Tooltip text={item.tip} />}
      </div>
      <div className={valueClass}>{item.value}</div>
    </div>
  );
}

function buildMetric(id, label, value, rawValue, tip) {
  if (value == null || value === "N/A") return null;
  return { id, key: id, label, value, rawValue, tip };
}

function buildFundamentalsScore(f) {
  const candidates = [
    ["forwardPE", f.forwardPE],
    ["trailingPE", f.trailingPE],
    ["pegRatio", f.pegRatio],
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

  const scores = candidates
    .map(([key, value]) => {
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

export default function FundamentalsPanel({ fundamentals }) {
  if (!fundamentals) return null;
  const f = fundamentals;
  const title = f.longName || f.name || "Analysis";
  const score = buildFundamentalsScore(f);

  const fiftyTwoWeek =
    f.fiftyTwoWeekLow != null && f.fiftyTwoWeekHigh != null
      ? `${fmt(f.fiftyTwoWeekLow)} – ${fmt(f.fiftyTwoWeekHigh)}`
      : null;
  const dayRange =
    f.dayLow != null && f.dayHigh != null
      ? `${fmt(f.dayLow)} – ${fmt(f.dayHigh)}`
      : null;
  const targetRange =
    f.targetLowPrice != null && f.targetHighPrice != null
      ? `${fmt(f.targetLowPrice)} – ${fmt(f.targetHighPrice)}`
      : null;
  const changeStr =
    f.marketChange != null && f.marketChangePct != null
      ? `${f.marketChange >= 0 ? "+" : ""}${fmt(f.marketChange)} (${f.marketChangePct >= 0 ? "+" : ""}${f.marketChangePct.toFixed(2)}%)`
      : null;
  const earningsDate = f.earningsTimestamp
    ? tsToDate(f.earningsTimestamp)
    : f.earningsTimestampStart
      ? tsToDate(f.earningsTimestampStart)
      : null;
  const recLabel = { strong_buy: "Strong Buy", buy: "Buy", hold: "Hold", underperform: "Underperform", sell: "Sell" };

  const priceItems = [
    buildMetric("previousClose", "Prev Close", fmt(f.previousClose), f.previousClose, TIPS.previousClose),
    buildMetric("open", "Open", fmt(f.open), f.open, TIPS.open),
    buildMetric("dayRange", "Day Range", dayRange, null, TIPS.dayRange),
    buildMetric("marketChange", "Change", changeStr, f.marketChange, TIPS.marketChange),
    buildMetric("volume", "Volume", f.volume != null ? fmtInt(f.volume) : null, f.volume, TIPS.volume),
  ];

  const valuationItems = [
    buildMetric("trailingPE", "P/E (TTM)", fmtRatio(f.trailingPE), f.trailingPE, TIPS.trailingPE),
    buildMetric("forwardPE", "P/E (Fwd)", fmtRatio(f.forwardPE), f.forwardPE, TIPS.forwardPE),
    buildMetric("pegRatio", "PEG Ratio", fmtRatio(f.pegRatio), f.pegRatio, TIPS.pegRatio),
    buildMetric("priceToBook", "P/B", fmtRatio(f.priceToBook), f.priceToBook, TIPS.priceToBook),
    buildMetric("priceToSales", "P/S", fmtRatio(f.priceToSales), f.priceToSales, TIPS.priceToSales),
    buildMetric("marketCap", "Market Cap", fmtCompact(f.marketCap), f.marketCap, TIPS.marketCap),
    buildMetric("enterpriseValue", "Enterprise Value", fmtCompact(f.enterpriseValue), f.enterpriseValue, TIPS.enterpriseValue),
    buildMetric("enterpriseToRevenue", "EV/Revenue", fmtRatio(f.enterpriseToRevenue), f.enterpriseToRevenue, TIPS.enterpriseToRevenue),
    buildMetric("enterpriseToEbitda", "EV/EBITDA", fmtRatio(f.enterpriseToEbitda), f.enterpriseToEbitda, TIPS.enterpriseToEbitda),
  ];

  const profitabilityItems = [
    buildMetric("eps", "EPS (TTM)", fmt(f.eps), f.eps, TIPS.eps),
    buildMetric("epsForward", "EPS (Fwd)", fmt(f.epsForward), f.epsForward, TIPS.epsForward),
    buildMetric("ebitda", "EBITDA", fmtCompact(f.ebitda), f.ebitda, TIPS.ebitda),
    buildMetric("netIncome", "Net Income", fmtCompact(f.netIncome), f.netIncome, TIPS.netIncome),
    buildMetric(
      "grossProfit",
      "Gross Profit",
      f.grossProfit === 0 ? null : fmtCompact(f.grossProfit),
      f.grossProfit === 0 ? null : f.grossProfit,
      TIPS.grossProfit
    ),
    buildMetric("operatingIncome", "Op Income", fmtCompact(f.operatingIncome), f.operatingIncome, TIPS.operatingIncome),
    buildMetric("totalRevenue", "Revenue", fmtCompact(f.totalRevenue), f.totalRevenue, TIPS.totalRevenue),
    buildMetric("revenuePerShare", "Rev/Share", fmt(f.revenuePerShare), f.revenuePerShare, TIPS.revenuePerShare),
    buildMetric("revenueGrowth", "Revenue Growth", fmtPct(f.revenueGrowth), f.revenueGrowth, TIPS.revenueGrowth),
    buildMetric("earningsGrowth", "Earnings Growth", fmtPct(f.earningsGrowth), f.earningsGrowth, TIPS.earningsGrowth),
    buildMetric("profitMargins", "Profit Margin", fmtPct(f.profitMargins), f.profitMargins, TIPS.profitMargins),
    buildMetric("grossMargins", "Gross Margin", fmtPct(f.grossMargins), f.grossMargins, TIPS.grossMargins),
    buildMetric(
      "ebitdaMargins",
      "EBITDA Margin",
      f.ebitdaMargins === 0 ? null : fmtPct(f.ebitdaMargins),
      f.ebitdaMargins === 0 ? null : f.ebitdaMargins,
      TIPS.ebitdaMargins
    ),
    buildMetric("operatingMargins", "Op Margin", fmtPct(f.operatingMargins), f.operatingMargins, TIPS.operatingMargins),
    buildMetric("returnOnEquity", "ROE", fmtPct(f.returnOnEquity), f.returnOnEquity, TIPS.returnOnEquity),
    buildMetric("returnOnAssets", "ROA", fmtPct(f.returnOnAssets), f.returnOnAssets, TIPS.returnOnAssets),
  ];

  const balanceItems = [
    buildMetric("totalCash", "Total Cash", fmtCompact(f.totalCash), f.totalCash, TIPS.totalCash),
    buildMetric("totalCashPerShare", "Cash/Share", fmt(f.totalCashPerShare), f.totalCashPerShare, TIPS.totalCashPerShare),
    buildMetric("totalDebt", "Total Debt", fmtCompact(f.totalDebt), f.totalDebt, TIPS.totalDebt),
    buildMetric("debtToEquity", "Debt/Equity", f.debtToEquity != null ? `${fmtRatio(f.debtToEquity)}%` : null, f.debtToEquity, TIPS.debtToEquity),
    buildMetric("currentRatio", "Current Ratio", fmtRatio(f.currentRatio), f.currentRatio, TIPS.currentRatio),
    buildMetric("quickRatio", "Quick Ratio", fmtRatio(f.quickRatio), f.quickRatio, TIPS.quickRatio),
    buildMetric("bookValue", "Book Value", fmt(f.bookValue), f.bookValue, TIPS.bookValue),
    buildMetric("totalAssets", "Total Assets", fmtCompact(f.totalAssets), f.totalAssets, TIPS.totalAssets),
    buildMetric("totalLiabilities", "Total Liabilities", fmtCompact(f.totalLiabilities), f.totalLiabilities, TIPS.totalLiabilities),
    buildMetric("totalStockholderEquity", "Stockholder Equity", fmtCompact(f.totalStockholderEquity), f.totalStockholderEquity, TIPS.totalStockholderEquity),
    buildMetric("operatingCashflow", "Op Cash Flow", fmtCompact(f.operatingCashflow), f.operatingCashflow, TIPS.operatingCashflow),
    buildMetric("freeCashflow", "Free Cash Flow", fmtCompact(f.freeCashflow), f.freeCashflow, TIPS.freeCashflow),
    buildMetric("capitalExpenditures", "CapEx", fmtCompact(f.capitalExpenditures), f.capitalExpenditures, TIPS.capitalExpenditures),
  ];

  const dividendItems = [
    buildMetric("dividendYield", "Div Yield", f.dividendYield != null ? `${fmtRatio(f.dividendYield)}%` : null, f.dividendYield, TIPS.dividendYield),
    buildMetric("dividendRate", "Div Rate", fmt(f.dividendRate), f.dividendRate, TIPS.dividendRate),
    buildMetric("trailingAnnualDividendRate", "Trail Div Rate", fmt(f.trailingAnnualDividendRate), f.trailingAnnualDividendRate, TIPS.trailingAnnualDividendRate),
    buildMetric("fiveYearAvgDividendYield", "5yr Avg Yield", f.fiveYearAvgDividendYield != null ? `${fmtRatio(f.fiveYearAvgDividendYield)}%` : null, f.fiveYearAvgDividendYield, TIPS.fiveYearAvgDividendYield),
    buildMetric("payoutRatio", "Payout Ratio", fmtPct(f.payoutRatio), f.payoutRatio, TIPS.payoutRatio),
    buildMetric("exDividendDate", "Ex-Div Date", f.exDividendDate ? tsToDate(f.exDividendDate) : null, null, TIPS.exDividendDate),
    buildMetric("lastDividendValue", "Last Dividend", fmt(f.lastDividendValue), f.lastDividendValue, TIPS.lastDividendValue),
  ];

  const tradingItems = [
    buildMetric("beta", "Beta", fmtRatio(f.beta), f.beta, TIPS.beta),
    buildMetric("fiftyTwoWeek", "52-Wk Range", fiftyTwoWeek, null, TIPS.fiftyTwoWeek),
    buildMetric("fiftyTwoWeekChange", "52-Wk Change", fmtPct(f.fiftyTwoWeekChange), f.fiftyTwoWeekChange, TIPS.fiftyTwoWeekChange),
    buildMetric("fiftyDayAverage", "50-Day Avg", fmt(f.fiftyDayAverage), f.fiftyDayAverage, TIPS.fiftyDayAverage),
    buildMetric("twoHundredDayAverage", "200-Day Avg", fmt(f.twoHundredDayAverage), f.twoHundredDayAverage, TIPS.twoHundredDayAverage),
    buildMetric("avgVolume", "Avg Volume", f.avgVolume != null ? fmtInt(f.avgVolume) : null, f.avgVolume, TIPS.avgVolume),
    buildMetric("avgVolume10d", "Avg Vol (10d)", f.avgVolume10d != null ? fmtInt(f.avgVolume10d) : null, f.avgVolume10d, TIPS.avgVolume10d),
    buildMetric("sharesOutstanding", "Shares Out", fmtCompact(f.sharesOutstanding), f.sharesOutstanding, TIPS.sharesOutstanding),
    buildMetric("floatShares", "Float", fmtCompact(f.floatShares), f.floatShares, TIPS.floatShares),
    buildMetric("heldPercentInsiders", "Insider Own", fmtPct(f.heldPercentInsiders), f.heldPercentInsiders, TIPS.heldPercentInsiders),
    buildMetric("heldPercentInstitutions", "Inst Own", fmtPct(f.heldPercentInstitutions), f.heldPercentInstitutions, TIPS.heldPercentInstitutions),
  ];

  const shortInterestItems = [
    buildMetric("sharesShort", "Shares Short", fmtCompact(f.sharesShort), f.sharesShort, TIPS.sharesShort),
    buildMetric("sharesShortPriorMonth", "Short (Prior Mo)", fmtCompact(f.sharesShortPriorMonth), f.sharesShortPriorMonth, TIPS.sharesShortPriorMonth),
    buildMetric("shortRatio", "Short Ratio", fmtRatio(f.shortRatio), f.shortRatio, TIPS.shortRatio),
    buildMetric("shortPercentOfFloat", "Short % Float", f.shortPercentOfFloat != null ? `${fmtRatio(f.shortPercentOfFloat)}%` : null, f.shortPercentOfFloat, TIPS.shortPercentOfFloat),
  ];

  const analystItems = [
    buildMetric("targetMeanPrice", "Target (Mean)", fmt(f.targetMeanPrice), f.targetMeanPrice, TIPS.targetMeanPrice),
    buildMetric("targetMedianPrice", "Target (Median)", fmt(f.targetMedianPrice), f.targetMedianPrice, TIPS.targetMedianPrice),
    buildMetric("targetRange", "Target Range", targetRange, null, TIPS.targetRange),
    buildMetric("recommendationKey", "Consensus", f.recommendationKey ? (recLabel[f.recommendationKey] || f.recommendationKey) : null, null, TIPS.recommendationKey),
    buildMetric("numberOfAnalystOpinions", "# Analysts", f.numberOfAnalystOpinions != null ? String(f.numberOfAnalystOpinions) : null, f.numberOfAnalystOpinions, TIPS.numberOfAnalystOpinions),
    buildMetric("earningsDate", "Earnings Date", earningsDate, null, TIPS.earningsDate),
    buildMetric("earningsQuarterlyGrowth", "Qtr Earnings Growth", fmtPct(f.earningsQuarterlyGrowth), f.earningsQuarterlyGrowth, TIPS.earningsQuarterlyGrowth),
  ];

  const summaryItems = [
    buildMetric("marketCap", "Market Cap", fmtCompact(f.marketCap), f.marketCap, TIPS.marketCap),
    buildMetric("trailingPE", "P/E (TTM)", fmtRatio(f.trailingPE), f.trailingPE, TIPS.trailingPE),
    buildMetric("forwardPE", "P/E (Fwd)", fmtRatio(f.forwardPE), f.forwardPE, TIPS.forwardPE),
    buildMetric("profitMargins", "Profit Margin", fmtPct(f.profitMargins), f.profitMargins, TIPS.profitMargins),
    buildMetric("debtToEquity", "Debt / Equity", f.debtToEquity != null ? `${fmtRatio(f.debtToEquity)}%` : null, f.debtToEquity, TIPS.debtToEquity),
    buildMetric("freeCashflow", "Free Cash Flow", fmtCompact(f.freeCashflow), f.freeCashflow, TIPS.freeCashflow),
  ].filter(Boolean);

  return (
    <div className="fundamentals">
      <section className="terminal-section">
        <div className="section-heading">
          <h2>{title} Fundamentals</h2>
          <p className="fundamentals-meta">
            {[f.sector, f.industry, f.exchange].filter(Boolean).join(" · ")}
          </p>
        </div>
        {score.hasData && (
          <div className="terminal-grid terminal-grid--2">
            <ScoreCard label="Fundamentals Score" score={score.score} tone={score.tone} detail={score.label} tooltip={METRIC_TIPS.fundamentalsScore} />
            <div className="terminal-card">
              <div className="terminal-eyebrow">Coverage</div>
              <p className="terminal-copy">
                This score is built only from raw fundamental fields that are actually available for the current ticker.
              </p>
            </div>
          </div>
        )}
        {summaryItems.length > 0 && (
          <div className="kpi-row fundamentals-summary-grid">
            {summaryItems.map((item) => <SummaryCard key={item.id} item={item} />)}
          </div>
        )}
      </section>

      <div className="fundamentals-grid">
        <FundamentalsTableSection title="Price" items={priceItems} />
        <FundamentalsTableSection title="Valuation" items={valuationItems} />
        <FundamentalsTableSection title="Profitability & Income Statement" items={profitabilityItems} />
        <FundamentalsTableSection title="Trading" items={tradingItems} />
        <FundamentalsTableSection title="Balance Sheet & Cash Flow" items={balanceItems} />
        <FundamentalsTableSection title="Analyst Estimates" items={analystItems} />
        <FundamentalsTableSection title="Dividends" items={dividendItems} />
        <FundamentalsTableSection title="Short Interest" items={shortInterestItems} />
      </div>
    </div>
  );
}
