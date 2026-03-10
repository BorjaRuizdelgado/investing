import React from "react";
import Tooltip from "./Tooltip.jsx";
import { fmt, fmtCompact, fmtPct, fmtRatio, fmtInt } from "../lib/format.js";

/* ── Tooltip descriptions ─────────────────────────────────── */

const TIPS = {
  // Valuation
  trailingPE: "Price-to-Earnings (trailing 12 months). Below 15 is generally considered cheap; above 30 expensive.",
  forwardPE: "Price-to-Earnings based on forward estimates. Lower values suggest cheaper valuation relative to expected earnings.",
  pegRatio: "P/E divided by earnings growth rate (5yr expected). Below 1 suggests undervaluation relative to growth.",
  priceToBook: "Price-to-Book value. Below 1.5 may indicate undervaluation; above 5 suggests premium pricing.",
  priceToSales: "Price-to-Sales ratio. Useful for companies with low or negative earnings. Lower is generally better.",
  marketCap: "Total market value of outstanding shares.",
  enterpriseValue: "Market cap + debt − cash. Represents the total cost to acquire the company.",
  enterpriseToRevenue: "Enterprise Value / Revenue. Measures what the market pays per dollar of revenue.",
  enterpriseToEbitda: "Enterprise Value / EBITDA. Common acquisition valuation metric; lower may signal value.",
  // Profitability
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
  // Balance sheet & cash flow
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
  // Dividends
  dividendYield: "Annual dividend / share price. Higher yields provide more income per dollar invested.",
  dividendRate: "Annual dividend payment per share in dollars.",
  trailingAnnualDividendRate: "Sum of dividends paid over the last 12 months per share.",
  fiveYearAvgDividendYield: "Average dividend yield over the past 5 years.",
  payoutRatio: "Dividends paid / net income. A very high ratio may be unsustainable.",
  exDividendDate: "Last ex-dividend date. Buy before this date to receive the next dividend.",
  lastDividendValue: "Most recent dividend payment per share.",
  // Trading
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
  // Short interest
  sharesShort: "Number of shares currently sold short.",
  shortRatio: "Days to cover: short interest / average daily volume.",
  shortPercentOfFloat: "Short interest as a percentage of float. High values may indicate bearish sentiment or squeeze potential.",
  sharesShortPriorMonth: "Short interest from the prior reporting month. Compare with current to spot trends.",
  // Price context
  dayRange: "Today's low and high trading prices.",
  previousClose: "Last session's closing price.",
  open: "Today's opening price.",
  volume: "Number of shares traded today.",
  marketChange: "Price change from previous close in dollars and percent.",
  // Analyst
  targetMeanPrice: "Average analyst price target.",
  targetMedianPrice: "Median analyst price target.",
  targetRange: "Range of analyst price targets from low to high.",
  recommendationKey: "Analyst consensus: strong buy, buy, hold, underperform, or sell.",
  numberOfAnalystOpinions: "Number of analysts providing estimates.",
  // Earnings
  earningsDate: "Upcoming or most recent earnings report date.",
  earningsQuarterlyGrowth: "Year-over-year quarterly earnings growth rate.",
};

/* ── Sentiment colouring ──────────────────────────────────── */

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

/* ── Card component ───────────────────────────────────────── */

function FundCard({ label, value, sentiment, tip }) {
  const cls = sentiment ? `kpi-value fund-${sentiment}` : "kpi-value";
  return (
    <div className="kpi-card">
      <div className="kpi-label">
        {label}
        {tip && <Tooltip text={tip} />}
      </div>
      <div className={cls}>{value}</div>
    </div>
  );
}

/* ── Section component ────────────────────────────────────── */

function Section({ title, children }) {
  const valid = React.Children.toArray(children).filter(Boolean);
  if (valid.length === 0) return null;
  return (
    <details className="fund-section">
      <summary className="fund-section-title">{title}</summary>
      <div className="kpi-row">{valid}</div>
    </details>
  );
}

/* ── Helpers ───────────────────────────────────────────────── */

function card(label, value, key, tip) {
  if (value === "N/A") return null;
  return <FundCard key={key} label={label} value={value} sentiment={null} tip={tip} />;
}

function cardSentiment(label, rawVal, formatted, key, tip) {
  if (rawVal == null || isNaN(rawVal)) return null;
  return <FundCard key={key} label={label} value={formatted} sentiment={metricSentiment(key, rawVal)} tip={tip} />;
}

function tsToDate(ts) {
  if (!ts) return null;
  return new Date(ts * 1000).toLocaleDateString();
}

/* ── Main component ───────────────────────────────────────── */

export default function FundamentalsPanel({ fundamentals }) {
  if (!fundamentals) return null;
  const f = fundamentals;

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

  const changeSentiment =
    f.marketChange != null ? (f.marketChange >= 0 ? "positive" : "negative") : null;

  const earningsDate = f.earningsTimestamp
    ? tsToDate(f.earningsTimestamp)
    : f.earningsTimestampStart
      ? tsToDate(f.earningsTimestampStart)
      : null;

  const recLabel = { strong_buy: "Strong Buy", buy: "Buy", hold: "Hold", underperform: "Underperform", sell: "Sell" };
  const recSentiment = { strong_buy: "positive", buy: "positive", hold: null, underperform: "negative", sell: "negative" };

  const title = f.longName || f.name || "Analysis";

  return (
    <div className="fundamentals">
      <h2 className="fundamentals-title">{title} - Fundamentals</h2>
      <p className="fundamentals-meta">
        {f.sector && f.industry && `${f.sector} · ${f.industry}`}
        {f.sector && !f.industry && f.sector}
        {!f.sector && f.industry && f.industry}
        {f.exchange && <>{(f.sector || f.industry) && " · "}{f.exchange}</>}
      </p>

      {/* Price Context */}
      <Section title="Price">
        {f.previousClose != null && card("Prev Close", fmt(f.previousClose), "previousClose", TIPS.previousClose)}
        {f.open != null && card("Open", fmt(f.open), "open", TIPS.open)}
        {dayRange && card("Day Range", dayRange, "dayRange", TIPS.dayRange)}
        {changeStr && <FundCard key="change" label="Change" value={changeStr} sentiment={changeSentiment} tip={TIPS.marketChange} />}
        {f.volume != null && card("Volume", fmtInt(f.volume), "volume", TIPS.volume)}
      </Section>

      {/* Valuation */}
      <Section title="Valuation">
        {cardSentiment("P/E (TTM)", f.trailingPE, fmtRatio(f.trailingPE), "trailingPE", TIPS.trailingPE)}
        {cardSentiment("P/E (Fwd)", f.forwardPE, fmtRatio(f.forwardPE), "forwardPE", TIPS.forwardPE)}
        {cardSentiment("PEG Ratio", f.pegRatio, fmtRatio(f.pegRatio), "pegRatio", TIPS.pegRatio)}
        {cardSentiment("P/B", f.priceToBook, fmtRatio(f.priceToBook), "priceToBook", TIPS.priceToBook)}
        {cardSentiment("P/S", f.priceToSales, fmtRatio(f.priceToSales), "priceToSales", TIPS.priceToSales)}
        {f.marketCap != null && card("Market Cap", fmtCompact(f.marketCap), "marketCap", TIPS.marketCap)}
        {f.enterpriseValue != null && card("Enterprise Value", fmtCompact(f.enterpriseValue), "enterpriseValue", TIPS.enterpriseValue)}
        {f.enterpriseToRevenue != null && card("EV/Revenue", fmtRatio(f.enterpriseToRevenue), "enterpriseToRevenue", TIPS.enterpriseToRevenue)}
        {f.enterpriseToEbitda != null && card("EV/EBITDA", fmtRatio(f.enterpriseToEbitda), "enterpriseToEbitda", TIPS.enterpriseToEbitda)}
      </Section>

      {/* Profitability & Income Statement */}
      <Section title="Profitability & Income Statement">
        {cardSentiment("EPS (TTM)", f.eps, fmt(f.eps), "eps", TIPS.eps)}
        {cardSentiment("EPS (Fwd)", f.epsForward, fmt(f.epsForward), "epsForward", TIPS.epsForward)}
        {cardSentiment("EBITDA", f.ebitda, fmtCompact(f.ebitda), "ebitda", TIPS.ebitda)}
        {cardSentiment("Net Income", f.netIncome, fmtCompact(f.netIncome), "netIncome", TIPS.netIncome)}
        {cardSentiment("Gross Profit", f.grossProfit, fmtCompact(f.grossProfit), "grossProfit", TIPS.grossProfit)}
        {cardSentiment("Op Income", f.operatingIncome, fmtCompact(f.operatingIncome), "operatingIncome", TIPS.operatingIncome)}
        {f.totalRevenue != null && card("Revenue", fmtCompact(f.totalRevenue), "totalRevenue", TIPS.totalRevenue)}
        {f.revenuePerShare != null && card("Rev/Share", fmt(f.revenuePerShare), "revenuePerShare", TIPS.revenuePerShare)}
        {cardSentiment("Revenue Growth", f.revenueGrowth, fmtPct(f.revenueGrowth), "revenueGrowth", TIPS.revenueGrowth)}
        {cardSentiment("Earnings Growth", f.earningsGrowth, fmtPct(f.earningsGrowth), "earningsGrowth", TIPS.earningsGrowth)}
        {cardSentiment("Profit Margin", f.profitMargins, fmtPct(f.profitMargins), "profitMargins", TIPS.profitMargins)}
        {cardSentiment("Gross Margin", f.grossMargins, fmtPct(f.grossMargins), "grossMargins", TIPS.grossMargins)}
        {cardSentiment("EBITDA Margin", f.ebitdaMargins, fmtPct(f.ebitdaMargins), "ebitdaMargins", TIPS.ebitdaMargins)}
        {cardSentiment("Op Margin", f.operatingMargins, fmtPct(f.operatingMargins), "operatingMargins", TIPS.operatingMargins)}
        {cardSentiment("ROE", f.returnOnEquity, fmtPct(f.returnOnEquity), "returnOnEquity", TIPS.returnOnEquity)}
        {cardSentiment("ROA", f.returnOnAssets, fmtPct(f.returnOnAssets), "returnOnAssets", TIPS.returnOnAssets)}
      </Section>

      {/* Balance Sheet & Cash Flow */}
      <Section title="Balance Sheet & Cash Flow">
        {f.totalCash != null && card("Total Cash", fmtCompact(f.totalCash), "totalCash", TIPS.totalCash)}
        {f.totalCashPerShare != null && card("Cash/Share", fmt(f.totalCashPerShare), "totalCashPerShare", TIPS.totalCashPerShare)}
        {f.totalDebt != null && card("Total Debt", fmtCompact(f.totalDebt), "totalDebt", TIPS.totalDebt)}
        {cardSentiment("Debt/Equity", f.debtToEquity, `${fmtRatio(f.debtToEquity)}%`, "debtToEquity", TIPS.debtToEquity)}
        {cardSentiment("Current Ratio", f.currentRatio, fmtRatio(f.currentRatio), "currentRatio", TIPS.currentRatio)}
        {cardSentiment("Quick Ratio", f.quickRatio, fmtRatio(f.quickRatio), "quickRatio", TIPS.quickRatio)}
        {f.bookValue != null && card("Book Value", fmt(f.bookValue), "bookValue", TIPS.bookValue)}
        {f.totalAssets != null && card("Total Assets", fmtCompact(f.totalAssets), "totalAssets", TIPS.totalAssets)}
        {f.totalLiabilities != null && card("Total Liabilities", fmtCompact(f.totalLiabilities), "totalLiabilities", TIPS.totalLiabilities)}
        {f.totalStockholderEquity != null && card("Stockholder Equity", fmtCompact(f.totalStockholderEquity), "totalStockholderEquity", TIPS.totalStockholderEquity)}
        {cardSentiment("Op Cash Flow", f.operatingCashflow, fmtCompact(f.operatingCashflow), "operatingCashflow", TIPS.operatingCashflow)}
        {cardSentiment("Free Cash Flow", f.freeCashflow, fmtCompact(f.freeCashflow), "freeCashflow", TIPS.freeCashflow)}
        {f.capitalExpenditures != null && card("CapEx", fmtCompact(f.capitalExpenditures), "capitalExpenditures", TIPS.capitalExpenditures)}
      </Section>

      {/* Dividends */}
      <Section title="Dividends">
        {cardSentiment("Div Yield", f.dividendYield, f.dividendYield != null ? `${fmtRatio(f.dividendYield)}%` : "N/A", "dividendYield", TIPS.dividendYield)}
        {f.dividendRate != null && card("Div Rate", fmt(f.dividendRate), "dividendRate", TIPS.dividendRate)}
        {f.trailingAnnualDividendRate != null && card("Trail Div Rate", fmt(f.trailingAnnualDividendRate), "trailingAnnualDividendRate", TIPS.trailingAnnualDividendRate)}
        {f.fiveYearAvgDividendYield != null && card("5yr Avg Yield", `${fmtRatio(f.fiveYearAvgDividendYield)}%`, "fiveYearAvgDividendYield", TIPS.fiveYearAvgDividendYield)}
        {cardSentiment("Payout Ratio", f.payoutRatio, fmtPct(f.payoutRatio), "payoutRatio", TIPS.payoutRatio)}
        {f.exDividendDate && card("Ex-Div Date", tsToDate(f.exDividendDate), "exDividendDate", TIPS.exDividendDate)}
        {f.lastDividendValue != null && card("Last Dividend", fmt(f.lastDividendValue), "lastDividendValue", TIPS.lastDividendValue)}
      </Section>

      {/* Trading */}
      <Section title="Trading">
        {cardSentiment("Beta", f.beta, fmtRatio(f.beta), "beta", TIPS.beta)}
        {fiftyTwoWeek && card("52-Wk Range", fiftyTwoWeek, "fiftyTwoWeek", TIPS.fiftyTwoWeek)}
        {cardSentiment("52-Wk Change", f.fiftyTwoWeekChange, fmtPct(f.fiftyTwoWeekChange), "fiftyTwoWeekChange", TIPS.fiftyTwoWeekChange)}
        {f.fiftyDayAverage != null && card("50-Day Avg", fmt(f.fiftyDayAverage), "fiftyDayAverage", TIPS.fiftyDayAverage)}
        {f.twoHundredDayAverage != null && card("200-Day Avg", fmt(f.twoHundredDayAverage), "twoHundredDayAverage", TIPS.twoHundredDayAverage)}
        {f.avgVolume != null && card("Avg Volume", fmtInt(f.avgVolume), "avgVolume", TIPS.avgVolume)}
        {f.avgVolume10d != null && card("Avg Vol (10d)", fmtInt(f.avgVolume10d), "avgVolume10d", TIPS.avgVolume10d)}
        {f.sharesOutstanding != null && card("Shares Out", fmtCompact(f.sharesOutstanding), "sharesOutstanding", TIPS.sharesOutstanding)}
        {f.floatShares != null && card("Float", fmtCompact(f.floatShares), "floatShares", TIPS.floatShares)}
        {f.heldPercentInsiders != null && card("Insider Own", fmtPct(f.heldPercentInsiders), "heldPercentInsiders", TIPS.heldPercentInsiders)}
        {f.heldPercentInstitutions != null && card("Inst Own", fmtPct(f.heldPercentInstitutions), "heldPercentInstitutions", TIPS.heldPercentInstitutions)}
      </Section>

      {/* Short Interest */}
      <Section title="Short Interest">
        {f.sharesShort != null && card("Shares Short", fmtCompact(f.sharesShort), "sharesShort", TIPS.sharesShort)}
        {f.sharesShortPriorMonth != null && card("Short (Prior Mo)", fmtCompact(f.sharesShortPriorMonth), "sharesShortPriorMonth", TIPS.sharesShortPriorMonth)}
        {f.shortRatio != null && card("Short Ratio", fmtRatio(f.shortRatio), "shortRatio", TIPS.shortRatio)}
        {cardSentiment("Short % Float", f.shortPercentOfFloat, f.shortPercentOfFloat != null ? `${fmtRatio(f.shortPercentOfFloat)}%` : "N/A", "shortPercentOfFloat", TIPS.shortPercentOfFloat)}
      </Section>

      {/* Analyst */}
      <Section title="Analyst Estimates">
        {f.targetMeanPrice != null && card("Target (Mean)", fmt(f.targetMeanPrice), "targetMeanPrice", TIPS.targetMeanPrice)}
        {f.targetMedianPrice != null && card("Target (Median)", fmt(f.targetMedianPrice), "targetMedianPrice", TIPS.targetMedianPrice)}
        {targetRange && card("Target Range", targetRange, "targetRange", TIPS.targetRange)}
        {f.recommendationKey && (
          <FundCard
            key="rec"
            label="Consensus"
            value={recLabel[f.recommendationKey] || f.recommendationKey}
            sentiment={recSentiment[f.recommendationKey] || null}
            tip={TIPS.recommendationKey}
          />
        )}
        {f.numberOfAnalystOpinions != null && card("# Analysts", String(f.numberOfAnalystOpinions), "numberOfAnalystOpinions", TIPS.numberOfAnalystOpinions)}
        {earningsDate && card("Earnings Date", earningsDate, "earningsDate", TIPS.earningsDate)}
        {cardSentiment("Qtr Earnings Growth", f.earningsQuarterlyGrowth, fmtPct(f.earningsQuarterlyGrowth), "earningsQuarterlyGrowth", TIPS.earningsQuarterlyGrowth)}
      </Section>
    </div>
  );
}
