import React, { useState } from 'react'
import Tooltip from './Tooltip.jsx'
import ScoreCard from './ScoreCard.jsx'
import { fmt, fmtCompact, fmtPct, fmtRatio, fmtInt } from '../lib/format.js'
import { metricSentiment, buildFundamentalsScore } from '../lib/scoring.js'
import { METRIC_TIPS, FUNDAMENTAL_TIPS as TIPS } from '../lib/metricTips.js'
import { buildSectorMedians, isLowerBetter } from '../lib/sectorMedians.js'

function tsToDate(ts) {
  if (!ts) return null
  return new Date(ts * 1000).toLocaleDateString()
}

function sectorCompare(key, rawValue, medians) {
  if (!medians || rawValue == null || !Number.isFinite(rawValue)) return null
  const median = medians[key]
  if (median == null || !Number.isFinite(median)) return null
  const lower = isLowerBetter(key)
  const better = lower ? rawValue < median : rawValue > median
  const worse = lower ? rawValue > median : rawValue < median
  return { median, better, worse }
}

function FundamentalsTableSection({ title, items, defaultOpen, medians }) {
  const visible = items.filter(Boolean)
  const [open, setOpen] = useState(!!defaultOpen)
  if (!visible.length) return null

  return (
    <div className={`fund-accordion${open ? ' fund-accordion--open' : ''}`}>
      <button
        className="fund-accordion__header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="fund-accordion__title">{title}</span>
        <span className="fund-accordion__count">{visible.length}</span>
        <svg className="fund-accordion__chevron" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="fund-accordion__body">
          <table className="data-table fundamentals-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const sentiment = metricSentiment(item.key, item.rawValue)
                const valueClass = sentiment
                  ? `fundamentals-table-value fund-${sentiment}`
                  : 'fundamentals-table-value'
                const cmp = sectorCompare(item.key, item.rawValue, medians)
                return (
                  <tr key={item.id}>
                    <td>
                      <span className="metric-table-label">
                        {item.label}
                        {item.tip && <Tooltip text={item.tip} />}
                      </span>
                    </td>
                    <td className={valueClass}>
                      {item.value}
                      {cmp && (
                        <span className={`fund-vs ${cmp.better ? 'fund-vs--better' : 'fund-vs--worse'}`}>
                          {cmp.better ? '▲' : '▼'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ item }) {
  const sentiment = metricSentiment(item.key, item.rawValue)
  const valueClass = sentiment ? `kpi-value fund-${sentiment}` : 'kpi-value'

  return (
    <div className="kpi-card">
      <div className="kpi-label">
        {item.label}
        {item.tip && <Tooltip text={item.tip} />}
      </div>
      <div className={valueClass}>{item.value}</div>
    </div>
  )
}

function buildMetric(id, label, value, rawValue, tip) {
  if (value == null || value === 'N/A') return null
  return { id, key: id, label, value, rawValue, tip }
}

export default function FundamentalsPanel({ fundamentals }) {
  if (!fundamentals) return null
  const f = fundamentals
  const score = buildFundamentalsScore(f)

  const fiftyTwoWeek =
    f.fiftyTwoWeekLow != null && f.fiftyTwoWeekHigh != null
      ? `${fmt(f.fiftyTwoWeekLow)} – ${fmt(f.fiftyTwoWeekHigh)}`
      : null
  const dayRange =
    f.dayLow != null && f.dayHigh != null ? `${fmt(f.dayLow)} – ${fmt(f.dayHigh)}` : null
  const targetRange =
    f.targetLowPrice != null && f.targetHighPrice != null
      ? `${fmt(f.targetLowPrice)} – ${fmt(f.targetHighPrice)}`
      : null
  const changeStr =
    f.marketChange != null && f.marketChangePct != null
      ? `${f.marketChange >= 0 ? '+' : ''}${fmt(f.marketChange)} (${f.marketChangePct >= 0 ? '+' : ''}${f.marketChangePct.toFixed(2)}%)`
      : null
  const earningsDate = f.earningsTimestamp
    ? tsToDate(f.earningsTimestamp)
    : f.earningsTimestampStart
      ? tsToDate(f.earningsTimestampStart)
      : null
  const recLabel = {
    strong_buy: 'Strong Buy',
    buy: 'Buy',
    hold: 'Hold',
    underperform: 'Underperform',
    sell: 'Sell',
  }

  const priceItems = [
    buildMetric(
      'previousClose',
      'Prev Close',
      fmt(f.previousClose),
      f.previousClose,
      TIPS.previousClose,
    ),
    buildMetric('open', 'Open', fmt(f.open), f.open, TIPS.open),
    buildMetric('dayRange', 'Day Range', dayRange, null, TIPS.dayRange),
    buildMetric('marketChange', 'Change', changeStr, f.marketChange, TIPS.marketChange),
    buildMetric(
      'volume',
      'Volume',
      f.volume != null ? fmtInt(f.volume) : null,
      f.volume,
      TIPS.volume,
    ),
  ]

  const valuationItems = [
    buildMetric('trailingPE', 'P/E (TTM)', fmtRatio(f.trailingPE), f.trailingPE, TIPS.trailingPE),
    buildMetric('forwardPE', 'P/E (Fwd)', fmtRatio(f.forwardPE), f.forwardPE, TIPS.forwardPE),
    buildMetric('priceToBook', 'P/B', fmtRatio(f.priceToBook), f.priceToBook, TIPS.priceToBook),
    buildMetric('priceToSales', 'P/S', fmtRatio(f.priceToSales), f.priceToSales, TIPS.priceToSales),
    buildMetric('marketCap', 'Market Cap', fmtCompact(f.marketCap), f.marketCap, TIPS.marketCap),
    buildMetric(
      'enterpriseValue',
      'Enterprise Value',
      fmtCompact(f.enterpriseValue),
      f.enterpriseValue,
      TIPS.enterpriseValue,
    ),
    buildMetric(
      'enterpriseToRevenue',
      'EV/Revenue',
      fmtRatio(f.enterpriseToRevenue),
      f.enterpriseToRevenue,
      TIPS.enterpriseToRevenue,
    ),
    buildMetric(
      'enterpriseToEbitda',
      'EV/EBITDA',
      fmtRatio(f.enterpriseToEbitda),
      f.enterpriseToEbitda,
      TIPS.enterpriseToEbitda,
    ),
  ]

  const profitabilityItems = [
    buildMetric('eps', 'EPS (TTM)', fmt(f.eps), f.eps, TIPS.eps),
    buildMetric('epsForward', 'EPS (Fwd)', fmt(f.epsForward), f.epsForward, TIPS.epsForward),
    buildMetric('ebitda', 'EBITDA', fmtCompact(f.ebitda), f.ebitda, TIPS.ebitda),
    buildMetric('netIncome', 'Net Income', fmtCompact(f.netIncome), f.netIncome, TIPS.netIncome),
    buildMetric(
      'grossProfit',
      'Gross Profit',
      f.grossProfit === 0 ? null : fmtCompact(f.grossProfit),
      f.grossProfit === 0 ? null : f.grossProfit,
      TIPS.grossProfit,
    ),
    buildMetric(
      'operatingIncome',
      'Op Income',
      fmtCompact(f.operatingIncome),
      f.operatingIncome,
      TIPS.operatingIncome,
    ),
    buildMetric(
      'totalRevenue',
      'Revenue',
      fmtCompact(f.totalRevenue),
      f.totalRevenue,
      TIPS.totalRevenue,
    ),
    buildMetric(
      'revenuePerShare',
      'Rev/Share',
      fmt(f.revenuePerShare),
      f.revenuePerShare,
      TIPS.revenuePerShare,
    ),
    buildMetric(
      'revenueGrowth',
      'Revenue Growth',
      fmtPct(f.revenueGrowth),
      f.revenueGrowth,
      TIPS.revenueGrowth,
    ),
    buildMetric(
      'earningsGrowth',
      'Earnings Growth',
      fmtPct(f.earningsGrowth),
      f.earningsGrowth,
      TIPS.earningsGrowth,
    ),
    buildMetric(
      'profitMargins',
      'Profit Margin',
      fmtPct(f.profitMargins),
      f.profitMargins,
      TIPS.profitMargins,
    ),
    buildMetric(
      'grossMargins',
      'Gross Margin',
      fmtPct(f.grossMargins),
      f.grossMargins,
      TIPS.grossMargins,
    ),
    buildMetric(
      'ebitdaMargins',
      'EBITDA Margin',
      f.ebitdaMargins === 0 ? null : fmtPct(f.ebitdaMargins),
      f.ebitdaMargins === 0 ? null : f.ebitdaMargins,
      TIPS.ebitdaMargins,
    ),
    buildMetric(
      'operatingMargins',
      'Op Margin',
      fmtPct(f.operatingMargins),
      f.operatingMargins,
      TIPS.operatingMargins,
    ),
    buildMetric(
      'returnOnEquity',
      'ROE',
      fmtPct(f.returnOnEquity),
      f.returnOnEquity,
      TIPS.returnOnEquity,
    ),
    buildMetric(
      'returnOnAssets',
      'ROA',
      fmtPct(f.returnOnAssets),
      f.returnOnAssets,
      TIPS.returnOnAssets,
    ),
  ]

  const balanceItems = [
    buildMetric('totalCash', 'Total Cash', fmtCompact(f.totalCash), f.totalCash, TIPS.totalCash),
    buildMetric(
      'totalCashPerShare',
      'Cash/Share',
      fmt(f.totalCashPerShare),
      f.totalCashPerShare,
      TIPS.totalCashPerShare,
    ),
    buildMetric('totalDebt', 'Total Debt', fmtCompact(f.totalDebt), f.totalDebt, TIPS.totalDebt),
    buildMetric(
      'debtToEquity',
      'Debt/Equity',
      f.debtToEquity != null ? `${fmtRatio(f.debtToEquity)}%` : null,
      f.debtToEquity,
      TIPS.debtToEquity,
    ),
    buildMetric(
      'currentRatio',
      'Current Ratio',
      fmtRatio(f.currentRatio),
      f.currentRatio,
      TIPS.currentRatio,
    ),
    buildMetric('quickRatio', 'Quick Ratio', fmtRatio(f.quickRatio), f.quickRatio, TIPS.quickRatio),
    buildMetric('bookValue', 'Book Value', fmt(f.bookValue), f.bookValue, TIPS.bookValue),
    buildMetric(
      'totalAssets',
      'Total Assets',
      fmtCompact(f.totalAssets),
      f.totalAssets,
      TIPS.totalAssets,
    ),
    buildMetric(
      'totalLiabilities',
      'Total Liabilities',
      fmtCompact(f.totalLiabilities),
      f.totalLiabilities,
      TIPS.totalLiabilities,
    ),
    buildMetric(
      'totalStockholderEquity',
      'Stockholder Equity',
      fmtCompact(f.totalStockholderEquity),
      f.totalStockholderEquity,
      TIPS.totalStockholderEquity,
    ),
    buildMetric(
      'operatingCashflow',
      'Op Cash Flow',
      fmtCompact(f.operatingCashflow),
      f.operatingCashflow,
      TIPS.operatingCashflow,
    ),
    buildMetric(
      'freeCashflow',
      'Free Cash Flow',
      fmtCompact(f.freeCashflow),
      f.freeCashflow,
      TIPS.freeCashflow,
    ),
    buildMetric(
      'capitalExpenditures',
      'CapEx',
      fmtCompact(f.capitalExpenditures),
      f.capitalExpenditures,
      TIPS.capitalExpenditures,
    ),
  ]

  const dividendItems = [
    buildMetric(
      'dividendYield',
      'Div Yield',
      f.dividendYield != null ? `${fmtRatio(f.dividendYield)}%` : null,
      f.dividendYield,
      TIPS.dividendYield,
    ),
    buildMetric('dividendRate', 'Div Rate', fmt(f.dividendRate), f.dividendRate, TIPS.dividendRate),
    buildMetric(
      'trailingAnnualDividendRate',
      'Trail Div Rate',
      fmt(f.trailingAnnualDividendRate),
      f.trailingAnnualDividendRate,
      TIPS.trailingAnnualDividendRate,
    ),
    buildMetric(
      'fiveYearAvgDividendYield',
      '5yr Avg Yield',
      f.fiveYearAvgDividendYield != null ? `${fmtRatio(f.fiveYearAvgDividendYield)}%` : null,
      f.fiveYearAvgDividendYield,
      TIPS.fiveYearAvgDividendYield,
    ),
    buildMetric(
      'payoutRatio',
      'Payout Ratio',
      fmtPct(f.payoutRatio),
      f.payoutRatio,
      TIPS.payoutRatio,
    ),
    buildMetric(
      'exDividendDate',
      'Ex-Div Date',
      f.exDividendDate ? tsToDate(f.exDividendDate) : null,
      null,
      TIPS.exDividendDate,
    ),
    buildMetric(
      'lastDividendValue',
      'Last Dividend',
      fmt(f.lastDividendValue),
      f.lastDividendValue,
      TIPS.lastDividendValue,
    ),
  ]

  const tradingItems = [
    buildMetric('beta', 'Beta', fmtRatio(f.beta), f.beta, TIPS.beta),
    buildMetric('fiftyTwoWeek', '52-Wk Range', fiftyTwoWeek, null, TIPS.fiftyTwoWeek),
    buildMetric(
      'fiftyTwoWeekChange',
      '52-Wk Change',
      fmtPct(f.fiftyTwoWeekChange),
      f.fiftyTwoWeekChange,
      TIPS.fiftyTwoWeekChange,
    ),
    buildMetric(
      'fiftyDayAverage',
      '50-Day Avg',
      fmt(f.fiftyDayAverage),
      f.fiftyDayAverage,
      TIPS.fiftyDayAverage,
    ),
    buildMetric(
      'twoHundredDayAverage',
      '200-Day Avg',
      fmt(f.twoHundredDayAverage),
      f.twoHundredDayAverage,
      TIPS.twoHundredDayAverage,
    ),
    buildMetric(
      'avgVolume',
      'Avg Volume',
      f.avgVolume != null ? fmtInt(f.avgVolume) : null,
      f.avgVolume,
      TIPS.avgVolume,
    ),
    buildMetric(
      'avgVolume10d',
      'Avg Vol (10d)',
      f.avgVolume10d != null ? fmtInt(f.avgVolume10d) : null,
      f.avgVolume10d,
      TIPS.avgVolume10d,
    ),
    buildMetric(
      'sharesOutstanding',
      'Shares Out',
      fmtCompact(f.sharesOutstanding),
      f.sharesOutstanding,
      TIPS.sharesOutstanding,
    ),
    buildMetric('floatShares', 'Float', fmtCompact(f.floatShares), f.floatShares, TIPS.floatShares),
    buildMetric(
      'heldPercentInsiders',
      'Insider Own',
      fmtPct(f.heldPercentInsiders),
      f.heldPercentInsiders,
      TIPS.heldPercentInsiders,
    ),
    buildMetric(
      'heldPercentInstitutions',
      'Inst Own',
      fmtPct(f.heldPercentInstitutions),
      f.heldPercentInstitutions,
      TIPS.heldPercentInstitutions,
    ),
  ]

  const shortInterestItems = [
    buildMetric(
      'sharesShort',
      'Shares Short',
      fmtCompact(f.sharesShort),
      f.sharesShort,
      TIPS.sharesShort,
    ),
    buildMetric(
      'sharesShortPriorMonth',
      'Short (Prior Mo)',
      fmtCompact(f.sharesShortPriorMonth),
      f.sharesShortPriorMonth,
      TIPS.sharesShortPriorMonth,
    ),
    buildMetric('shortRatio', 'Short Ratio', fmtRatio(f.shortRatio), f.shortRatio, TIPS.shortRatio),
    buildMetric(
      'shortPercentOfFloat',
      'Short % Float',
      f.shortPercentOfFloat != null ? `${fmtRatio(f.shortPercentOfFloat)}%` : null,
      f.shortPercentOfFloat,
      TIPS.shortPercentOfFloat,
    ),
  ]

  const analystItems = [
    buildMetric(
      'targetMeanPrice',
      'Target (Mean)',
      fmt(f.targetMeanPrice),
      f.targetMeanPrice,
      TIPS.targetMeanPrice,
    ),
    buildMetric(
      'targetMedianPrice',
      'Target (Median)',
      fmt(f.targetMedianPrice),
      f.targetMedianPrice,
      TIPS.targetMedianPrice,
    ),
    buildMetric('targetRange', 'Target Range', targetRange, null, TIPS.targetRange),
    buildMetric(
      'recommendationKey',
      'Consensus',
      f.recommendationKey ? recLabel[f.recommendationKey] || f.recommendationKey : null,
      null,
      TIPS.recommendationKey,
    ),
    buildMetric(
      'numberOfAnalystOpinions',
      '# Analysts',
      f.numberOfAnalystOpinions != null ? String(f.numberOfAnalystOpinions) : null,
      f.numberOfAnalystOpinions,
      TIPS.numberOfAnalystOpinions,
    ),
    buildMetric('earningsDate', 'Earnings Date', earningsDate, null, TIPS.earningsDate),
    buildMetric(
      'earningsQuarterlyGrowth',
      'Qtr Earnings Growth',
      fmtPct(f.earningsQuarterlyGrowth),
      f.earningsQuarterlyGrowth,
      TIPS.earningsQuarterlyGrowth,
    ),
  ]

  const summaryItems = [
    buildMetric('marketCap', 'Market Cap', fmtCompact(f.marketCap), f.marketCap, TIPS.marketCap),
    buildMetric('trailingPE', 'P/E (TTM)', fmtRatio(f.trailingPE), f.trailingPE, TIPS.trailingPE),
    buildMetric('forwardPE', 'P/E (Fwd)', fmtRatio(f.forwardPE), f.forwardPE, TIPS.forwardPE),
    buildMetric(
      'profitMargins',
      'Profit Margin',
      fmtPct(f.profitMargins),
      f.profitMargins,
      TIPS.profitMargins,
    ),
    buildMetric(
      'debtToEquity',
      'Debt / Equity',
      f.debtToEquity != null ? `${fmtRatio(f.debtToEquity)}%` : null,
      f.debtToEquity,
      TIPS.debtToEquity,
    ),
    buildMetric(
      'freeCashflow',
      'Free Cash Flow',
      fmtCompact(f.freeCashflow),
      f.freeCashflow,
      TIPS.freeCashflow,
    ),
  ].filter(Boolean)

  const medians = buildSectorMedians(f)

  return (
    <div className="fundamentals">
      <section className="terminal-section">
        <div className="section-heading">
          <h2>Fundamentals Analysis</h2>
          <p className="fundamentals-meta">
            {[f.sector, f.industry, f.exchange].filter(Boolean).join(' · ')}
          </p>
        </div>
        {score.hasData && (
          <div className="terminal-grid terminal-grid--2">
            <ScoreCard
              label="Fundamentals Score"
              score={score.score}
              tone={score.tone}
              detail={score.label}
              tooltip={METRIC_TIPS.fundamentalsScore}
            />
            <div className="terminal-card">
              <div className="terminal-eyebrow">Coverage</div>
              <p className="terminal-copy">
                This score is built only from raw fundamental fields that are actually available for
                the current ticker.
              </p>
            </div>
          </div>
        )}
        {summaryItems.length > 0 && (
          <div className="kpi-row fundamentals-summary-grid">
            {summaryItems.map((item) => (
              <SummaryCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      <div className="fund-accordion-group">
        <FundamentalsTableSection title="Price" items={priceItems} defaultOpen medians={medians} />
        <FundamentalsTableSection title="Valuation" items={valuationItems} medians={medians} />
        <FundamentalsTableSection
          title="Profitability & Income Statement"
          items={profitabilityItems}
          medians={medians}
        />
        <FundamentalsTableSection title="Trading" items={tradingItems} medians={medians} />
        <FundamentalsTableSection title="Balance Sheet & Cash Flow" items={balanceItems} medians={medians} />
        <FundamentalsTableSection title="Analyst Estimates" items={analystItems} medians={medians} />
        <FundamentalsTableSection title="Dividends" items={dividendItems} medians={medians} />
        <FundamentalsTableSection title="Short Interest" items={shortInterestItems} medians={medians} />
      </div>
    </div>
  )
}
