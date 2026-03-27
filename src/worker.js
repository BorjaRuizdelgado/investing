/**
 * Cloudflare Worker — API proxy for Yahoo Finance + Bybit (crypto options).
 *
 * Routing:
 *   - Crypto tickers (BTC, ETH, SOL, XRP, DOGE …) → Bybit public API (no auth)
 *   - Everything else                              → Yahoo Finance (cookie+crumb auth)
 *
 * Routes:
 *   GET /api/options?ticker=AAPL        → expirations + spot price
 *   GET /api/chain?ticker=AAPL&exp=…    → option chain for one expiry
 *   GET /api/history?ticker=AAPL&days=60 → OHLCV history
 *   GET /api/rate                        → risk-free rate (^IRX)
 *   Everything else                      → static assets (SPA)
 */

import { isCrypto, isBybitSupported, isDeribitSupported, normalizeTicker, stripCryptoSuffix } from './lib/tickers.js'

const YF_BASE = 'https://query2.finance.yahoo.com'
const BYBIT_BASE = 'https://api.bybit.com/v5/market'
const DERIBIT_BASE = 'https://www.deribit.com/api/v2/public'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// ---- Input validation ----

const TICKER_RE = /^[A-Z0-9.\-^]{1,10}$/

/** Validate and normalise a ticker param. Returns null if invalid. */
function validateTicker(raw) {
  if (!raw) return null
  const t = raw.toUpperCase().trim()
  return TICKER_RE.test(t) ? t : null
}

/** Validate days param. Returns a positive integer <= 365, or null. */
function validateDays(raw) {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1 || n > 365) return null
  return n
}

// ---- Structured error logging ----

/**
 * Log a structured JSON error for observability.
 * Plug in Sentry, Logpush, or any external logger here later.
 */
function logError(route, error, context = {}) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      route,
      error: error?.message || String(error),
      ticker: context.ticker || null,
      upstreamStatus: context.upstreamStatus || null,
    }),
  )
}

// ---- Common ----

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

/**
 * Like jsonResp but adds a Cache-Control header so browsers (and Cloudflare's
 * edge cache) serve repeated requests without hitting Yahoo / Bybit again.
 * Use only for responses where a few minutes of staleness is acceptable.
 */
function cachedJsonResp(data, maxAgeSeconds) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      'Cache-Control': `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${Math.floor(maxAgeSeconds / 2)}`,
    },
  })
}

// ======================================================================
// Yahoo Finance (stocks/ETFs)
// ======================================================================

let cachedAuth = null
let authExpiry = 0

async function getAuth() {
  const now = Date.now()
  if (cachedAuth && now < authExpiry) return cachedAuth

  const consentRes = await fetch('https://fc.yahoo.com/', {
    headers: { 'User-Agent': UA },
    redirect: 'manual',
  })
  const cookies = consentRes.headers.getAll
    ? consentRes.headers.getAll('set-cookie')
    : [consentRes.headers.get('set-cookie')].filter(Boolean)

  const cookieStr = cookies.map((c) => c.split(';')[0]).join('; ')

  const crumbRes = await fetch(`${YF_BASE}/v1/test/getcrumb`, {
    headers: { 'User-Agent': UA, Cookie: cookieStr },
  })

  if (!crumbRes.ok) {
    cachedAuth = { cookie: '', crumb: '' }
    authExpiry = now + 60_000
    return cachedAuth
  }

  const crumb = await crumbRes.text()
  cachedAuth = { cookie: cookieStr, crumb: crumb.trim() }
  authExpiry = now + 30 * 60_000
  return cachedAuth
}

async function fetchYF(path) {
  const auth = await getAuth()
  const sep = path.includes('?') ? '&' : '?'
  const url = auth.crumb
    ? `${YF_BASE}${path}${sep}crumb=${encodeURIComponent(auth.crumb)}`
    : `${YF_BASE}${path}`

  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Cookie: auth.cookie, Accept: 'application/json' },
  })

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      cachedAuth = null
      authExpiry = 0
      const retry = await getAuth()
      const retryUrl = retry.crumb
        ? `${YF_BASE}${path}${sep}crumb=${encodeURIComponent(retry.crumb)}`
        : `${YF_BASE}${path}`
      const res2 = await fetch(retryUrl, {
        headers: { 'User-Agent': UA, Cookie: retry.cookie, Accept: 'application/json' },
      })
      if (!res2.ok) throw new Error(`Yahoo Finance ${res2.status}: ${res2.statusText}`)
      return res2.json()
    }
    throw new Error(`Yahoo Finance ${res.status}: ${res.statusText}`)
  }

  return res.json()
}

// ======================================================================
// Bybit (crypto options)
// ======================================================================

async function fetchBybit(endpoint, params = {}) {
  const url = new URL(`${BYBIT_BASE}/${endpoint}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Bybit ${res.status}: ${res.statusText}`)
  const data = await res.json()
  if (data.retCode !== 0) throw new Error(`Bybit: ${data.retMsg}`)
  return data.result
}

async function fetchDeribit(endpoint, params = {}) {
  const url = new URL(`${DERIBIT_BASE}/${endpoint}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Deribit ${res.status}: ${res.statusText}`)
  const data = await res.json()
  if (data.error) throw new Error(`Deribit: ${data.error.message || JSON.stringify(data.error)}`)
  return data.result
}

/**
 * Parse Bybit symbol expiry string "5MAR26" → "2026-03-05".
 */
const MONTH_MAP = {
  JAN: '01',
  FEB: '02',
  MAR: '03',
  APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AUG: '08',
  SEP: '09',
  OCT: '10',
  NOV: '11',
  DEC: '12',
}

function parseBybitExpiry(expStr) {
  const m = expStr.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/)
  if (!m) return null
  const day = m[1].padStart(2, '0')
  const mon = MONTH_MAP[m[2]]
  if (!mon) return null
  const year = `20${m[3]}`
  return `${year}-${mon}-${day}`
}

// ======================================================================
// Route handlers — Yahoo Finance (stocks)
// ======================================================================

async function handleOptions(ticker) {
  // Fetch options data and detailed summary in parallel.
  // The options endpoint may return no result for tickers without listed options —
  // in that case we still return fundamentals with an empty expirations array.
  // A direct quote fetch runs in parallel as a price/name fallback (e.g. for crypto).
  const [data, summaryData, quoteData] = await Promise.all([
    fetchYF(`/v7/finance/options/${ticker}`).catch(() => null),
    fetchYF(
      `/v10/finance/quoteSummary/${ticker}?modules=defaultKeyStatistics,financialData,incomeStatementHistory,balanceSheetHistory,cashflowStatementHistory,earningsHistory`,
    ).catch(() => null),
    fetchYF(`/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`).catch(() => null),
  ])
  const result = data?.optionChain?.result?.[0] || null
  const rawTimestamps = result?.expirationDates || []
  const expirations = rawTimestamps.map((ts) => ({
    date: new Date(ts * 1000).toISOString().slice(0, 10),
    timestamp: ts,
  }))
  // Use quote from options endpoint; fall back to direct quote (covers crypto without options)
  const fallbackQuote = quoteData?.quoteResponse?.result?.[0] || {}
  const quote = result?.quote || fallbackQuote

  // Extract detailed stats from quoteSummary modules
  const summaryResult = summaryData?.quoteSummary?.result?.[0] || {}
  const keyStats = summaryResult.defaultKeyStatistics || {}
  const finData = summaryResult.financialData || {}
  const incomeHist = summaryResult.incomeStatementHistory?.incomeStatementHistory?.[0] || {}
  const balanceHist = summaryResult.balanceSheetHistory?.balanceSheetStatements?.[0] || {}
  const cashflowHist = summaryResult.cashflowStatementHistory?.cashflowStatements?.[0] || {}
  const earningsHistRaw = summaryResult.earningsHistory?.history || []
  const incomeHistory = summaryResult.incomeStatementHistory?.incomeStatementHistory || []
  const balanceHistory = summaryResult.balanceSheetHistory?.balanceSheetStatements || []
  const cashflowHistory = summaryResult.cashflowStatementHistory?.cashflowStatements || []

  // Helper: extract raw value from Yahoo's {raw, fmt} objects
  const rv = (obj) => obj?.raw ?? obj ?? null
  const fundamentals = {
    // Identity
    name: quote.shortName || quote.longName || null,
    longName: quote.longName || null,
    sector: quote.sector || null,
    industry: quote.industry || null,
    exchange: quote.fullExchangeName || quote.exchange || null,
    currency: quote.currency || null,
    quoteType: quote.quoteType || null,
    // Valuation
    marketCap: quote.marketCap ?? null,
    enterpriseValue: rv(keyStats.enterpriseValue) ?? quote.enterpriseValue ?? null,
    trailingPE: quote.trailingPE ?? null,
    forwardPE: quote.forwardPE ?? rv(keyStats.forwardPE) ?? null,
    priceToBook: quote.priceToBook ?? rv(keyStats.priceToBook) ?? null,
    priceToSales: quote.priceToSalesTrailing12Months ?? null,
    enterpriseToRevenue: rv(keyStats.enterpriseToRevenue) ?? quote.enterpriseToRevenue ?? null,
    enterpriseToEbitda: rv(keyStats.enterpriseToEbitda) ?? quote.enterpriseToEbitda ?? null,
    // Profitability & income
    eps: quote.epsTrailingTwelveMonths ?? rv(keyStats.trailingEps) ?? null,
    epsForward: quote.epsForward ?? rv(keyStats.forwardEps) ?? null,
    ebitda: rv(finData.ebitda) ?? quote.ebitda ?? null,
    totalRevenue: rv(finData.totalRevenue) ?? quote.totalRevenue ?? null,
    revenuePerShare: rv(finData.revenuePerShare) ?? quote.revenuePerShare ?? null,
    revenueGrowth: rv(finData.revenueGrowth) ?? null,
    earningsGrowth: rv(finData.earningsGrowth) ?? null,
    profitMargins: rv(finData.profitMargins) ?? quote.profitMargins ?? null,
    grossMargins: rv(finData.grossMargins) ?? quote.grossMargins ?? null,
    ebitdaMargins: rv(finData.ebitdaMargins) ?? null,
    operatingMargins: rv(finData.operatingMargins) ?? quote.operatingMargins ?? null,
    returnOnEquity: rv(finData.returnOnEquity) ?? quote.returnOnEquity ?? null,
    returnOnAssets: rv(finData.returnOnAssets) ?? quote.returnOnAssets ?? null,
    netIncome: rv(incomeHist.netIncome) ?? null,
    grossProfit: rv(incomeHist.grossProfit) ?? null,
    operatingIncome:
      rv(finData.operatingCashflow) != null ? null : (rv(incomeHist.operatingIncome) ?? null),
    // Balance sheet & cash flow
    totalCash: rv(finData.totalCash) ?? quote.totalCash ?? null,
    totalCashPerShare: rv(finData.totalCashPerShare) ?? null,
    totalDebt: rv(finData.totalDebt) ?? quote.totalDebt ?? null,
    debtToEquity: rv(finData.debtToEquity) ?? quote.debtToEquity ?? null,
    currentRatio: rv(finData.currentRatio) ?? quote.currentRatio ?? null,
    quickRatio: rv(finData.quickRatio) ?? null,
    bookValue: rv(keyStats.bookValue) ?? quote.bookValue ?? null,
    totalAssets: rv(balanceHist.totalAssets) ?? null,
    totalLiabilities: rv(balanceHist.totalLiab) ?? null,
    totalStockholderEquity: rv(balanceHist.totalStockholderEquity) ?? null,
    operatingCashflow:
      rv(finData.operatingCashflow) ?? rv(cashflowHist.totalCashFromOperatingActivities) ?? null,
    freeCashflow: rv(finData.freeCashflow) ?? null,
    capitalExpenditures: rv(cashflowHist.capitalExpenditures) ?? null,
    // Dividends & income
    dividendYield: quote.dividendYield ?? rv(keyStats.dividendYield) ?? null,
    dividendRate: quote.dividendRate ?? rv(keyStats.dividendRate) ?? null,
    trailingAnnualDividendRate:
      quote.trailingAnnualDividendRate ?? rv(keyStats.trailingAnnualDividendRate) ?? null,
    fiveYearAvgDividendYield: rv(keyStats.fiveYearAvgDividendYield) ?? null,
    payoutRatio: rv(keyStats.payoutRatio) ?? quote.payoutRatio ?? null,
    exDividendDate: rv(keyStats.exDividendDate) ?? null,
    lastDividendDate: rv(keyStats.lastDividendDate) ?? null,
    lastDividendValue: rv(keyStats.lastDividendValue) ?? null,
    // Trading
    beta: rv(keyStats.beta) ?? quote.beta ?? null,
    fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? null,
    fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekChange: rv(keyStats['52WeekChange']) ?? null,
    fiftyDayAverage: quote.fiftyDayAverage ?? null,
    twoHundredDayAverage: quote.twoHundredDayAverage ?? null,
    avgVolume: quote.averageDailyVolume3Month ?? null,
    avgVolume10d: quote.averageDailyVolume10Day ?? null,
    sharesOutstanding: rv(keyStats.sharesOutstanding) ?? quote.sharesOutstanding ?? null,
    floatShares: rv(keyStats.floatShares) ?? null,
    heldPercentInsiders: rv(keyStats.heldPercentInsiders) ?? null,
    heldPercentInstitutions: rv(keyStats.heldPercentInstitutions) ?? null,
    sharesShort: rv(keyStats.sharesShort) ?? quote.sharesShort ?? null,
    shortRatio: rv(keyStats.shortRatio) ?? quote.shortRatio ?? null,
    shortPercentOfFloat: rv(keyStats.shortPercentOfFloat) ?? quote.shortPercentOfFloat ?? null,
    sharesShortPriorMonth: rv(keyStats.sharesShortPriorMonth) ?? null,
    // Price context
    dayHigh: quote.regularMarketDayHigh ?? null,
    dayLow: quote.regularMarketDayLow ?? null,
    previousClose: quote.regularMarketPreviousClose ?? null,
    open: quote.regularMarketOpen ?? null,
    volume: quote.regularMarketVolume ?? null,
    marketChange: quote.regularMarketChange ?? null,
    marketChangePct: quote.regularMarketChangePercent ?? null,
    // Analyst
    targetMeanPrice: rv(finData.targetMeanPrice) ?? quote.targetMeanPrice ?? null,
    targetHighPrice: rv(finData.targetHighPrice) ?? quote.targetHighPrice ?? null,
    targetLowPrice: rv(finData.targetLowPrice) ?? quote.targetLowPrice ?? null,
    targetMedianPrice: rv(finData.targetMedianPrice) ?? null,
    recommendationMean: rv(finData.recommendationMean) ?? quote.recommendationMean ?? null,
    recommendationKey: rv(finData.recommendationKey) ?? quote.recommendationKey ?? null,
    numberOfAnalystOpinions:
      rv(finData.numberOfAnalystOpinions) ?? quote.numberOfAnalystOpinions ?? null,
    // Earnings
    earningsTimestamp: quote.earningsTimestamp ?? null,
    earningsTimestampStart: quote.earningsTimestampStart ?? null,
    earningsTimestampEnd: quote.earningsTimestampEnd ?? null,
    earningsQuarterlyGrowth: rv(keyStats.earningsQuarterlyGrowth) ?? null,
    mostRecentQuarter: rv(keyStats.mostRecentQuarter) ?? null,
    lastFiscalYearEnd: rv(keyStats.lastFiscalYearEnd) ?? null,
    nextFiscalYearEnd: rv(keyStats.nextFiscalYearEnd) ?? null,
    statements: {
      income: incomeHistory
        .map((row) => ({
          endDate: row?.endDate?.fmt || null,
          totalRevenue: rv(row?.totalRevenue),
          grossProfit: rv(row?.grossProfit),
          operatingIncome: rv(row?.operatingIncome),
          netIncome: rv(row?.netIncome),
        }))
        .filter((row) => row.endDate),
      balance: balanceHistory
        .map((row) => ({
          endDate: row?.endDate?.fmt || null,
          totalAssets: rv(row?.totalAssets),
          totalLiabilities: rv(row?.totalLiab),
          totalStockholderEquity: rv(row?.totalStockholderEquity),
          cash: rv(row?.cash),
          shortLongTermDebt: rv(row?.shortLongTermDebt),
          longTermDebt: rv(row?.longTermDebt),
        }))
        .filter((row) => row.endDate),
      cashflow: cashflowHistory
        .map((row) => ({
          endDate: row?.endDate?.fmt || null,
          operatingCashflow: rv(row?.totalCashFromOperatingActivities),
          capitalExpenditures: rv(row?.capitalExpenditures),
          freeCashflow:
            rv(row?.totalCashFromOperatingActivities) != null &&
            rv(row?.capitalExpenditures) != null
              ? rv(row?.totalCashFromOperatingActivities) + rv(row?.capitalExpenditures)
              : null,
        }))
        .filter((row) => row.endDate),
    },
    earningsHistory: earningsHistRaw
      .map((e) => ({
        quarter: e?.quarter?.fmt || null,
        period: e?.period || null,
        epsEstimate: rv(e?.epsEstimate),
        epsActual: rv(e?.epsActual),
        epsDifference: rv(e?.epsDifference),
        surprisePercent: rv(e?.surprisePercent),
      }))
      .filter((e) => e.epsActual != null),
  }

  return jsonResp({
    ticker: quote.symbol || ticker,
    price: quote.regularMarketPrice || rv(finData.currentPrice) || 0,
    expirations,
    fundamentals,
  })
}

async function handleChain(ticker, expTimestamp) {
  const data = await fetchYF(`/v7/finance/options/${ticker}?date=${expTimestamp}`)
  const result = data.optionChain.result[0]
  const quote = result.quote || {}

  function cleanOption(o) {
    return {
      strike: o.strike,
      bid: o.bid || 0,
      ask: o.ask || 0,
      lastPrice: o.lastPrice || 0,
      mid: o.bid && o.ask ? (o.bid + o.ask) / 2 : o.lastPrice || 0,
      impliedVolatility: o.impliedVolatility || 0,
      volume: o.volume || 0,
      openInterest: o.openInterest || 0,
      inTheMoney: o.inTheMoney || false,
    }
  }

  const calls = (result.options[0]?.calls || []).map(cleanOption)
  const puts = (result.options[0]?.puts || []).map(cleanOption)

  return jsonResp({
    ticker: quote.symbol || ticker,
    price: quote.regularMarketPrice || 0,
    expiry: new Date(Number(expTimestamp) * 1000).toISOString().slice(0, 10),
    calls,
    puts,
  })
}

async function handleHistory(ticker, days) {
  const range = `${days}d`
  const data = await fetchYF(`/v8/finance/chart/${ticker}?range=${range}&interval=1d`)
  const result = data.chart.result[0]
  const timestamps = result.timestamp || []
  const q = result.indicators.quote[0]

  const bars = timestamps
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      open: q.open[i],
      high: q.high[i],
      low: q.low[i],
      close: q.close[i],
      volume: q.volume[i],
    }))
    .filter((b) => b.close != null)

  return cachedJsonResp({ ticker: result.meta.symbol, bars }, 300) // 5-minute browser cache
}

async function handleRate() {
  try {
    const data = await fetchYF(`/v8/finance/chart/%5EIRX?range=5d&interval=1d`)
    const closes = data.chart.result[0].indicators.quote[0].close.filter((v) => v != null)
    const rate = closes.length > 0 ? closes[closes.length - 1] / 100 : 0.05
    return cachedJsonResp({ rate }, 3600) // interest rate barely changes; 1-hour cache
  } catch {
    return jsonResp({ rate: 0.05 })
  }
}

// ======================================================================
// Route handlers — SEC EDGAR (cash flow breakdown)
// ======================================================================

const SEC_UA = 'investing-tools contact@example.com'
let cachedCikMap = null
let cikMapExpiry = 0

async function getCikMap() {
  const now = Date.now()
  if (cachedCikMap && now < cikMapExpiry) return cachedCikMap
  const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': SEC_UA, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`SEC tickers ${res.status}`)
  const data = await res.json()
  // Build ticker → CIK map
  const map = {}
  for (const entry of Object.values(data)) {
    map[entry.ticker] = String(entry.cik_str).padStart(10, '0')
  }
  cachedCikMap = map
  cikMapExpiry = now + 24 * 60 * 60 * 1000 // 24h cache
  return map
}

// XBRL field → our field name. Multiple XBRL tags can map to the same field (first match wins).
const CF_FIELDS = [
  // Operating
  ['NetIncomeLoss', 'netIncome'],
  ['DepreciationDepletionAndAmortization', 'depreciation'],
  ['DepreciationAndAmortization', 'depreciation'],
  ['ShareBasedCompensation', 'stockBasedComp'],
  ['DeferredIncomeTaxExpenseBenefit', 'deferredTax'],
  ['DeferredIncomeTaxesAndTaxCredits', 'deferredTax'],
  ['OtherNoncashIncomeExpense', 'otherNonCash'],
  ['IncreaseDecreaseInAccountsReceivable', 'changeReceivables'],
  ['IncreaseDecreaseInInventories', 'changeInventory'],
  ['IncreaseDecreaseInAccountsPayable', 'changePayables'],
  ['IncreaseDecreaseInOtherOperatingLiabilities', 'changeOtherLiabilities'],
  ['IncreaseDecreaseInOtherReceivables', 'changeOtherReceivables'],
  ['IncreaseDecreaseInContractWithCustomerLiability', 'changeDeferredRevenue'],
  ['NetCashProvidedByUsedInOperatingActivities', 'operatingCashflow'],
  // Investing
  ['PaymentsToAcquirePropertyPlantAndEquipment', 'capitalExpenditures'],
  ['PaymentsToAcquireMarketableSecurities', 'purchaseInvestments'],
  ['PaymentsToAcquireAvailableForSaleSecuritiesDebt', 'purchaseInvestments'],
  ['PaymentsToAcquireInvestments', 'purchaseInvestments'],
  ['ProceedsFromMaturitiesPrepaymentsAndCallsOfAvailableForSaleSecurities', 'maturitiesInvestments'],
  ['ProceedsFromSaleOfAvailableForSaleSecuritiesDebt', 'saleInvestments'],
  ['ProceedsFromSaleAndMaturityOfMarketableSecurities', 'saleInvestments'],
  ['PaymentsToAcquireBusinessesNetOfCashAcquired', 'acquisitions'],
  ['PaymentsForProceedsFromOtherInvestingActivities', 'otherInvesting'],
  ['NetCashProvidedByUsedInInvestingActivities', 'investingCashflow'],
  // Financing
  ['ProceedsFromIssuanceOfLongTermDebt', 'debtIssuance'],
  ['ProceedsFromIssuanceOfDebt', 'debtIssuance'],
  ['RepaymentsOfLongTermDebt', 'debtRepayment'],
  ['RepaymentsOfDebt', 'debtRepayment'],
  ['PaymentsForRepurchaseOfCommonStock', 'stockBuybacks'],
  ['ProceedsFromIssuanceOfCommonStock', 'stockIssuance'],
  ['ProceedsFromStockOptionsExercised', 'stockIssuance'],
  ['PaymentsOfDividends', 'dividendsPaid'],
  ['PaymentsOfDividendsCommonStock', 'dividendsPaid'],
  ['PaymentsRelatedToTaxWithholdingForShareBasedCompensation', 'taxWithholdingSBC'],
  ['NetCashProvidedByUsedInFinancingActivities', 'financingCashflow'],
  // Net change
  ['CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect', 'netChangeInCash'],
  ['CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents', 'endingCash'],
]

/** Extract the latest 10-K entry for a given XBRL field matching a specific fiscal end date. */
function getAnnualValue(gaap, xbrlField, targetEnd) {
  if (!(xbrlField in gaap)) return undefined
  const units = gaap[xbrlField].units || {}
  const unitKey = Object.keys(units)[0]
  if (!unitKey) return undefined
  const entries = units[unitKey]
  // Find entries from 10-K matching target end date
  if (targetEnd) {
    const match = entries.filter((e) => e.form === '10-K' && e.end === targetEnd)
    if (match.length) return match[match.length - 1].val
  }
  // Fallback: latest 10-K entry
  const annual = entries.filter((e) => e.form === '10-K')
  return annual.length ? annual[annual.length - 1].val : undefined
}

async function handleCashflow(ticker) {
  try {
    const cikMap = await getCikMap()
    const cik = cikMap[ticker]
    if (!cik) return jsonResp({ error: 'Ticker not found in SEC filings' }, 404)

    const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
      headers: { 'User-Agent': SEC_UA, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`SEC EDGAR ${res.status}`)
    const data = await res.json()
    const gaap = data?.facts?.['us-gaap'] || {}

    // Step 1: Find the most recent fiscal year end from the Operating CF total
    const ocfField = 'NetCashProvidedByUsedInOperatingActivities'
    let fiscalEnd = null
    if (ocfField in gaap) {
      const units = gaap[ocfField].units || {}
      const unitKey = Object.keys(units)[0]
      if (unitKey) {
        const annual = units[unitKey].filter((e) => e.form === '10-K')
        if (annual.length) fiscalEnd = annual[annual.length - 1].end
      }
    }
    if (!fiscalEnd) return jsonResp({ error: 'No annual cash flow data found' }, 404)

    // Step 2: Extract all fields aligned to the same fiscal period
    const result = {}
    for (const [xbrlField, ourField] of CF_FIELDS) {
      if (result[ourField] != null) continue // first XBRL match wins
      const val = getAnnualValue(gaap, xbrlField, fiscalEnd)
      if (val !== undefined) result[ourField] = val
    }

    // Step 3: Negate spending fields (SEC reports "Payments..." as positive values)
    const negateFields = [
      'capitalExpenditures', 'purchaseInvestments', 'acquisitions',
      'debtRepayment', 'stockBuybacks', 'dividendsPaid', 'taxWithholdingSBC',
    ]
    for (const f of negateFields) {
      if (result[f] > 0) result[f] = -result[f]
    }

    result.endDate = fiscalEnd
    result.ticker = ticker
    return cachedJsonResp(result, 86400) // 24h cache — annual data barely changes
  } catch (err) {
    logError('/api/cashflow', err, { ticker })
    return jsonResp({ error: err.message }, 500)
  }
}

// ======================================================================
// Route handlers — Bybit (crypto options)
// ======================================================================

async function handleCryptoOptions(currency) {
  const yfTicker = `${currency}-USD`

  // Fetch Bybit options data + Yahoo Finance fundamentals in parallel
  const [instrumentsResult, tickersResult, yfData] = await Promise.all([
    fetchBybit('instruments-info', {
      category: 'option',
      baseCoin: currency,
      limit: '1000',
    }),
    fetchBybit('tickers', {
      category: 'option',
      baseCoin: currency,
    }),
    fetchYF(`/v7/finance/options/${yfTicker}`)
      .then((d) => d.optionChain?.result?.[0]?.quote || {})
      .catch(() => ({})),
  ])

  const instruments = instrumentsResult.list || []
  if (instruments.length === 0) throw new Error(`No Bybit options for ${currency}`)

  // Extract unique expiry dates from deliveryTime (ms timestamp)
  const expiryMap = new Map()
  for (const inst of instruments) {
    const msTs = Number(inst.deliveryTime)
    const ts = Math.floor(msTs / 1000)
    const date = new Date(msTs).toISOString().slice(0, 10)
    expiryMap.set(date, ts)
  }

  // Spot price from first ticker's underlyingPrice
  const tickers = tickersResult.list || []
  let spot = 0
  for (const t of tickers) {
    const p = parseFloat(t.underlyingPrice)
    if (p > 0) {
      spot = p
      break
    }
  }

  const expirations = Array.from(expiryMap.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([date, timestamp]) => ({ date, timestamp }))

  // Build fundamentals from Yahoo Finance quote data (market cap, name, etc.)
  const q = yfData
  const fundamentals =
    Object.keys(q).length > 0
      ? {
          name: q.shortName || q.longName || null,
          longName: q.longName || null,
          sector: null,
          industry: null,
          exchange: q.fullExchangeName || q.exchange || null,
          currency: q.currency || null,
          quoteType: q.quoteType || null,
          marketCap: q.marketCap ?? null,
          fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
          fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
          fiftyDayAverage: q.fiftyDayAverage ?? null,
          twoHundredDayAverage: q.twoHundredDayAverage ?? null,
          avgVolume: q.averageDailyVolume3Month ?? null,
          avgVolume10d: q.averageDailyVolume10Day ?? null,
        }
      : null

  return jsonResp({
    ticker: yfTicker,
    price: spot,
    expirations,
    fundamentals,
  })
}

async function handleCryptoChain(currency, expDateStr) {
  // Fetch all tickers for this base coin (single call has everything)
  const result = await fetchBybit('tickers', {
    category: 'option',
    baseCoin: currency,
  })

  const allTickers = result.list || []
  let spot = 0
  for (const t of allTickers) {
    const p = parseFloat(t.underlyingPrice)
    if (p > 0) {
      spot = p
      break
    }
  }

  const calls = []
  const puts = []

  for (const t of allTickers) {
    // Symbol format: "BTC-5MAR26-68500-C-USDT"
    const parts = t.symbol.split('-')
    if (parts.length < 4) continue

    const expDate = parseBybitExpiry(parts[1])
    if (expDate !== expDateStr) continue

    const strike = parseFloat(parts[2])
    const optType = parts[3] // "C" or "P"

    const bid = parseFloat(t.bid1Price) || 0
    const ask = parseFloat(t.ask1Price) || 0
    const lastPrice = parseFloat(t.lastPrice) || 0
    const markPrice = parseFloat(t.markPrice) || 0
    let mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : lastPrice
    if (mid <= 0) mid = markPrice

    const iv = parseFloat(t.markIv) || 0 // Already decimal (e.g. 0.6145)
    const oi = parseFloat(t.openInterest) || 0
    const vol = parseFloat(t.volume24h) || 0

    const itm = (optType === 'C' && strike < spot) || (optType === 'P' && strike > spot)

    const row = {
      strike,
      bid,
      ask,
      lastPrice,
      mid,
      impliedVolatility: iv,
      volume: vol,
      openInterest: oi,
      inTheMoney: itm,
    }

    if (optType === 'C') calls.push(row)
    else if (optType === 'P') puts.push(row)
  }

  calls.sort((a, b) => a.strike - b.strike)
  puts.sort((a, b) => a.strike - b.strike)

  return jsonResp({
    ticker: `${currency}-USD`,
    price: spot,
    expiry: expDateStr,
    calls,
    puts,
  })
}

async function handleCryptoHistory(currency, days) {
  // Use Yahoo Finance for crypto price history (BTC-USD etc.)
  return handleHistory(`${currency}-USD`, days)
}

// ======================================================================
// Route handlers — Deribit (crypto options fallback)
// ======================================================================

async function handleDeribitOptions(currency) {
  const yfTicker = `${currency}-USD`

  const [summaryItems, yfData] = await Promise.all([
    fetchDeribit('get_book_summary_by_currency', { currency, kind: 'option' }),
    fetchYF(`/v7/finance/options/${yfTicker}`)
      .then((d) => d.optionChain?.result?.[0]?.quote || {})
      .catch(() => ({})),
  ])

  const items = summaryItems || []
  if (items.length === 0) throw new Error(`No Deribit options for ${currency}`)

  let spot = 0
  const expiryMap = new Map() // ISO date → unix timestamp

  for (const item of items) {
    // instrument_name format: "BTC-27DEC24-100000-C"
    const parts = item.instrument_name.split('-')
    if (parts.length < 4) continue

    const expDate = parseBybitExpiry(parts[1]) // Same DDMMMYY format as Bybit
    if (!expDate) continue

    if (!expiryMap.has(expDate)) {
      // Deribit options expire at 08:00 UTC on the delivery day
      const ts = Math.floor(new Date(`${expDate}T08:00:00Z`).getTime() / 1000)
      expiryMap.set(expDate, ts)
    }

    if (!spot && item.underlying_price > 0) spot = item.underlying_price
  }

  if (!spot) spot = yfData.regularMarketPrice || 0

  const expirations = Array.from(expiryMap.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([date, timestamp]) => ({ date, timestamp }))

  const q = yfData
  const fundamentals =
    Object.keys(q).length > 0
      ? {
          name: q.shortName || q.longName || null,
          longName: q.longName || null,
          sector: null,
          industry: null,
          exchange: q.fullExchangeName || q.exchange || null,
          currency: q.currency || null,
          quoteType: q.quoteType || null,
          marketCap: q.marketCap ?? null,
          fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
          fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
          fiftyDayAverage: q.fiftyDayAverage ?? null,
          twoHundredDayAverage: q.twoHundredDayAverage ?? null,
          avgVolume: q.averageDailyVolume3Month ?? null,
          avgVolume10d: q.averageDailyVolume10Day ?? null,
        }
      : null

  return jsonResp({
    ticker: yfTicker,
    price: spot,
    expirations,
    fundamentals,
  })
}

async function handleDeribitChain(currency, expDateStr) {
  const summaryItems = await fetchDeribit('get_book_summary_by_currency', {
    currency,
    kind: 'option',
  })

  const allItems = summaryItems || []
  let spot = 0
  for (const item of allItems) {
    if (!spot && item.underlying_price > 0) {
      spot = item.underlying_price
      break
    }
  }

  const calls = []
  const puts = []

  for (const item of allItems) {
    // instrument_name: "BTC-27DEC24-100000-C"
    const parts = item.instrument_name.split('-')
    if (parts.length < 4) continue

    const expDate = parseBybitExpiry(parts[1])
    if (expDate !== expDateStr) continue

    const strike = parseFloat(parts[2])
    const optType = parts[3].toUpperCase() // "C" or "P"

    // Deribit prices are in coin units — multiply by spot to get USD
    const bid = (parseFloat(item.bid_price) || 0) * spot
    const ask = (parseFloat(item.ask_price) || 0) * spot
    const lastPrice = (parseFloat(item.last) || 0) * spot
    const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : lastPrice
    const iv = (parseFloat(item.mark_iv) || 0) / 100 // Deribit gives % (e.g. 60.5 → 0.605)
    const oi = parseFloat(item.open_interest) || 0
    const vol = parseFloat(item.volume) || 0
    const itm = (optType === 'C' && strike < spot) || (optType === 'P' && strike > spot)

    const row = { strike, bid, ask, lastPrice, mid, impliedVolatility: iv, volume: vol, openInterest: oi, inTheMoney: itm }

    if (optType === 'C') calls.push(row)
    else if (optType === 'P') puts.push(row)
  }

  calls.sort((a, b) => a.strike - b.strike)
  puts.sort((a, b) => a.strike - b.strike)

  return jsonResp({
    ticker: `${currency}-USD`,
    price: spot,
    expiry: expDateStr,
    calls,
    puts,
  })
}

// ======================================================================
// Trending tickers (landing page)
// ======================================================================

let cachedTrending = null
let trendingExpiry = 0

const FALLBACK_STOCKS = ['SPY', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOGL']
const CRYPTO_SYMBOLS = [
  'BTC-USD',
  'ETH-USD',
  'SOL-USD',
  'XRP-USD',
  'DOGE-USD',
  'BNB-USD',
  'ADA-USD',
  'AVAX-USD',
]

/** Check if a stock ticker has options on Yahoo Finance. */
async function checkStockOptions(symbol) {
  try {
    const data = await fetchYF(`/v7/finance/options/${symbol}`)
    const exps = data?.optionChain?.result?.[0]?.expirationDates || []
    return exps.length > 0
  } catch {
    return false
  }
}

async function handleTrending() {
  const now = Date.now()
  if (cachedTrending && now < trendingExpiry) return cachedJsonResp(cachedTrending, 300)

  // 1. Get candidate stock symbols (trending or fallback)
  let stockSymbols = FALLBACK_STOCKS
  try {
    const trending = await fetchYF('/v1/finance/trending/US?count=20')
    const symbols = trending?.finance?.result?.[0]?.quotes?.map((q) => q.symbol) || []
    if (symbols.length > 0) stockSymbols = symbols.slice(0, 20)
  } catch {
    /* use fallback */
  }

  // 2. Batch-fetch quotes for all candidates
  const allSymbols = [...stockSymbols, ...CRYPTO_SYMBOLS].join(',')
  const quoteData = await fetchYF(`/v7/finance/quote?symbols=${encodeURIComponent(allSymbols)}`)
  const quotes = quoteData?.quoteResponse?.result || []

  const cryptoSet = new Set(CRYPTO_SYMBOLS)
  const cryptoBaseSet = new Set(CRYPTO_SYMBOLS.map((s) => s.replace('-USD', '')))
  const stockCandidates = []
  const crypto = []

  for (const q of quotes) {
    const item = {
      symbol: q.symbol,
      name: q.shortName || q.longName || q.symbol,
      price: q.regularMarketPrice ?? 0,
      change: q.regularMarketChange ?? 0,
      changePct: q.regularMarketChangePercent ?? 0,
      marketCap: q.marketCap ?? null,
    }
    if (cryptoSet.has(q.symbol)) {
      crypto.push({ ...item, symbol: q.symbol.replace('-USD', '') })
    } else if (!cryptoBaseSet.has(q.symbol)) {
      // Skip tickers that collide with crypto base symbols (e.g. BTC, ETH)
      stockCandidates.push(item)
    }
  }

  // 3. Verify options availability for stock candidates (check in parallel, take first 8 that pass)
  const optChecks = await Promise.all(
    stockCandidates.map((s) => checkStockOptions(s.symbol).then((ok) => ({ ...s, ok }))),
  )
  const stocks = optChecks
    .filter((s) => s.ok)
    .slice(0, 8)
    .map(({ ok: _ok, ...s }) => s)

  // If none passed (unlikely), use fallback symbols that always have options
  if (stocks.length === 0) {
    for (const sym of FALLBACK_STOCKS) {
      const q = stockCandidates.find((s) => s.symbol === sym)
      if (q) stocks.push(q)
    }
  }

  const result = { stocks, crypto }
  cachedTrending = result
  trendingExpiry = now + 5 * 60_000 // 5-minute cache
  return cachedJsonResp(result, 300)
}

// ======================================================================
// SEO: Crawler detection & dynamic meta tags
// ======================================================================

const CRAWLER_RE =
  /googlebot|bingbot|yandexbot|duckduckbot|slurp|baiduspider|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegram|discord|applebot|ia_archiver|semrushbot|ahrefsbot|mj12bot/i

function isCrawler(request) {
  const ua = request.headers.get('user-agent') || ''
  return CRAWLER_RE.test(ua)
}

/**
 * Fetch a lightweight quote for social card enrichment.
 * Returns { name, price, changePct } or null on failure.
 */
async function fetchQuickQuote(ticker) {
  try {
    const data = await fetchYF(`/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`)
    const q = data?.quoteResponse?.result?.[0]
    if (!q) return null
    return {
      name: q.shortName || q.longName || ticker,
      price: q.regularMarketPrice ?? null,
      changePct: q.regularMarketChangePercent ?? null,
    }
  } catch {
    return null
  }
}

/**
 * Build an HTML page with dynamic meta tags for a specific ticker,
 * so crawlers index meaningful content for each route.
 */
function buildCrawlerHtml(url, ticker, quote) {
  const origin = url.origin
  const qName = quote?.name || ticker
  const qPrice = quote?.price != null ? `$${quote.price.toFixed(2)}` : null
  const title = ticker
    ? `${ticker} Options & Stock Analysis — Borja Ruizdelgado Investing Tools`
    : 'Borja Ruizdelgado — Free Options & Stock Analysis Tools'
  const description = ticker
    ? qPrice
      ? `${qName} (${ticker}) trading at ${qPrice}. Free options-implied valuation analysis by Borja Ruizdelgado: price forecast, probability distribution, expected move, IV smile, fundamentals, and support/resistance levels.`
      : `Free ${ticker} analysis by Borja Ruizdelgado: options-implied price forecast, probability distribution, expected move, IV smile, fundamentals (P/E, EBITDA, margins), analyst targets, and support/resistance levels.`
    : 'Free investing tools by Borja Ruizdelgado: options-implied price forecasts, probability distributions, IV smile, stock fundamentals, and crypto options analysis.'
  const canonical = ticker ? `${origin}/${ticker}` : `${origin}/`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${title}</title>
  <meta name="description" content="${description}"/>
  <meta name="author" content="Borja Ruizdelgado"/>
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large"/>
  <link rel="canonical" href="${canonical}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${canonical}"/>
  <meta property="og:title" content="${title}"/>
  <meta property="og:description" content="${description}"/>
  <meta property="og:image" content="${origin}/og-image.jpg"/>
  <meta property="og:site_name" content="Borja Ruizdelgado — Investing Tools"/>
  <meta name="twitter:card" content="${ticker ? 'summary' : 'summary_large_image'}"/>
  <meta name="twitter:title" content="${title}"/>
  <meta name="twitter:description" content="${description}"/>
  ${ticker ? '' : `<meta name="twitter:image" content="${origin}/og-image.jpg"/>`}
  <script type="application/ld+json">
  {
    "@context":"https://schema.org",
    "@type":"WebApplication",
    "name":"Borja Ruizdelgado — Investing Tools",
    "url":"${origin}/",
    "description":"${description}",
    "applicationCategory":"FinanceApplication",
    "operatingSystem":"Web",
    "author":{"@type":"Person","name":"Borja Ruizdelgado","url":"https://borjaruizdelgado.com"}
  }
  </script>
  ${
    ticker
      ? `<script type="application/ld+json">
  {
    "@context":"https://schema.org",
    "@type":"WebPage",
    "name":"${title}",
    "url":"${canonical}",
    "description":"${description}",
    "isPartOf":{"@type":"WebSite","name":"Borja Ruizdelgado — Investing Tools","url":"${origin}/"},
    "about":{"@type":"FinancialProduct","name":"${ticker}","url":"${canonical}"},
    "breadcrumb":{"@type":"BreadcrumbList","itemListElement":[
      {"@type":"ListItem","position":1,"name":"Home","item":"${origin}/"},
      {"@type":"ListItem","position":2,"name":"${ticker}","item":"${canonical}"}
    ]}
  }
  </script>`
      : ''
  }
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
  ${
    ticker
      ? `<p>Analyse <strong>${ticker}</strong> with free tools by Borja Ruizdelgado: options forecasting, fundamental analysis, value scoring, quality metrics, risk assessment, and more.</p>
  <h2>${ticker} Analysis Tools</h2>
  <ul>
    <li><a href="${origin}/${ticker}/overview">${ticker} Overview — Decision snapshot</a></li>
    <li><a href="${origin}/${ticker}/value">${ticker} Valuation — Cheap or expensive</a></li>
    <li><a href="${origin}/${ticker}/quality">${ticker} Quality — Business strength</a></li>
    <li><a href="${origin}/${ticker}/risk">${ticker} Risk — Fragility and downside</a></li>
    <li><a href="${origin}/${ticker}/business">${ticker} Business — Financial trends</a></li>
    <li><a href="${origin}/${ticker}/options">${ticker} Options Forecasting — Market pricing</a></li>
    <li><a href="${origin}/${ticker}/fundamentals">${ticker} Fundamentals — Raw reference data</a></li>
  </ul>`
      : `<h2>Features</h2>
  <ul>
    <li>Options Forecasting — Implied probability distributions, expected move ranges, IV smile</li>
    <li>Stock Fundamentals — P/E, EBITDA, EPS, margins, ROE, analyst price targets</li>
    <li>Support & Resistance — Automatic levels with entry/stop/target suggestions</li>
    <li>Value Analysis — Multiple valuation models</li>
    <li>Quality Scoring — Profitability, growth, financial health</li>
    <li>Risk Analysis — Beta, short interest, volatility</li>
    <li>Crypto Options — BTC, ETH, SOL, XRP, DOGE</li>
  </ul>
  <h2>Popular Tickers</h2>
  <p>
    <a href="${origin}/AAPL">AAPL</a> · <a href="${origin}/TSLA">TSLA</a> ·
    <a href="${origin}/SPY">SPY</a> · <a href="${origin}/MSFT">MSFT</a> ·
    <a href="${origin}/NVDA">NVDA</a> · <a href="${origin}/AMZN">AMZN</a> ·
    <a href="${origin}/BTC">BTC</a> · <a href="${origin}/ETH">ETH</a>
  </p>`
  }
  <p>Created by <a href="https://borjaruizdelgado.com">Borja Ruizdelgado</a></p>
</body>
</html>`
}

// ======================================================================
// Main handler
// ======================================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    try {
      if (url.pathname === '/api/options') {
        const raw = url.searchParams.get('ticker')
        if (!raw) return jsonResp({ error: 'ticker required' }, 400)
        const ticker = validateTicker(raw)
        if (!ticker) return jsonResp({ error: 'Invalid ticker' }, 400)
        const norm = normalizeTicker(ticker)
        if (isCrypto(ticker)) {
          // Try Bybit first for coins with known options support
          if (isBybitSupported(norm)) {
            try {
              const resp = await handleCryptoOptions(norm)
              const body = await resp.clone().json()
              if (body.expirations && body.expirations.length > 0) return resp
            } catch {
              /* Bybit failed, fall through */
            }
          }
          // Try Deribit as second source (BTC, ETH, SOL)
          if (isDeribitSupported(norm)) {
            try {
              const resp = await handleDeribitOptions(norm)
              const body = await resp.clone().json()
              if (body.expirations && body.expirations.length > 0) return resp
            } catch {
              /* Deribit failed, fall through */
            }
          }
          // Fall back to Yahoo Finance (fundamentals + spot price; no options for most crypto)
          return await handleOptions(`${norm}-USD`)
        }
        return await handleOptions(norm)
      }

      if (url.pathname === '/api/chain') {
        const rawT = url.searchParams.get('ticker')
        const exp = url.searchParams.get('exp')
        if (!rawT || !exp) return jsonResp({ error: 'ticker and exp required' }, 400)
        const ticker = validateTicker(rawT)
        if (!ticker) return jsonResp({ error: 'Invalid ticker' }, 400)
        const norm = normalizeTicker(ticker)
        if (isCrypto(ticker)) {
          if (/^\d+$/.test(exp)) {
            // Unix timestamp — convert to ISO date, try Bybit → Deribit → YF
            const expDate = new Date(Number(exp) * 1000).toISOString().slice(0, 10)
            if (isBybitSupported(norm)) {
              try {
                const resp = await handleCryptoChain(norm, expDate)
                const body = await resp.clone().json()
                if ((body.calls && body.calls.length > 0) || (body.puts && body.puts.length > 0))
                  return resp
              } catch {
                /* fall through */
              }
            }
            if (isDeribitSupported(norm)) {
              try {
                const resp = await handleDeribitChain(norm, expDate)
                const body = await resp.clone().json()
                if ((body.calls && body.calls.length > 0) || (body.puts && body.puts.length > 0))
                  return resp
              } catch {
                /* fall through */
              }
            }
            return await handleChain(`${norm}-USD`, exp)
          }
          // Date string — try Bybit first, then Deribit
          if (isBybitSupported(norm)) {
            try {
              const resp = await handleCryptoChain(norm, exp)
              const body = await resp.clone().json()
              if ((body.calls && body.calls.length > 0) || (body.puts && body.puts.length > 0))
                return resp
            } catch {
              /* fall through */
            }
          }
          if (isDeribitSupported(norm)) {
            return await handleDeribitChain(norm, exp)
          }
          return await handleCryptoChain(norm, exp)
        }
        return await handleChain(norm, exp)
      }

      if (url.pathname === '/api/history') {
        const rawH = url.searchParams.get('ticker')
        if (!rawH) return jsonResp({ error: 'ticker required' }, 400)
        const ticker = validateTicker(rawH)
        if (!ticker) return jsonResp({ error: 'Invalid ticker' }, 400)
        const days = validateDays(url.searchParams.get('days') || '60')
        if (!days) return jsonResp({ error: 'Invalid days parameter (must be 1-365)' }, 400)
        const norm = normalizeTicker(ticker)
        if (isCrypto(ticker)) {
          return await handleCryptoHistory(norm, days)
        }
        return await handleHistory(norm, days)
      }

      if (url.pathname === '/api/rate') {
        return await handleRate()
      }

      if (url.pathname === '/api/cashflow') {
        const rawCf = url.searchParams.get('ticker')
        if (!rawCf) return jsonResp({ error: 'ticker required' }, 400)
        const cfTicker = validateTicker(rawCf)
        if (!cfTicker) return jsonResp({ error: 'Invalid ticker' }, 400)
        if (isCrypto(cfTicker)) return jsonResp({ error: 'Not available for crypto' }, 400)
        return await handleCashflow(cfTicker)
      }

      if (url.pathname === '/api/quotes') {
        const tickers = url.searchParams.get('tickers')
        if (!tickers) return jsonResp({ error: 'tickers required' }, 400)
        const symbols = tickers
          .split(',')
          .slice(0, 20)
          .map((t) => t.trim().toUpperCase())
        // Map crypto tickers to Yahoo format
        const yfSymbols = symbols.map((s) => (isCrypto(s) ? `${stripCryptoSuffix(s)}-USD` : s))
        try {
          const data = await fetchYF(
            `/v7/finance/quote?symbols=${encodeURIComponent(yfSymbols.join(','))}`,
          )
          const results = (data?.quoteResponse?.result || []).map((q) => {
            const sym = q.symbol
            // Map back to original ticker for crypto
            const origTicker =
              sym.endsWith('-USD') && isCrypto(sym.replace('-USD', ''))
                ? sym.replace('-USD', '')
                : sym
            return {
              ticker: origTicker,
              symbol: sym,
              name: q.shortName || q.longName || sym,
              price: q.regularMarketPrice ?? null,
              change: q.regularMarketChange ?? null,
              changePct: q.regularMarketChangePercent ?? null,
            }
          })
          return jsonResp({ quotes: results })
        } catch (err) {
          logError('/api/quotes', err, { ticker: tickers })
          return jsonResp({ error: err.message, quotes: [] }, 500)
        }
      }

      if (url.pathname === '/api/trending') {
        return await handleTrending()
      }

      // Dynamic sitemap with popular tickers so Google discovers more pages
      if (url.pathname === '/sitemap.xml') {
        const today = new Date().toISOString().slice(0, 10)
        const origin = url.origin
        const tickers = [
          // Mega-cap & popular stocks
          'AAPL',
          'MSFT',
          'NVDA',
          'AMZN',
          'GOOGL',
          'META',
          'TSLA',
          'BRK-B',
          'AVGO',
          'JPM',
          'LLY',
          'V',
          'UNH',
          'MA',
          'XOM',
          'COST',
          'HD',
          'PG',
          'JNJ',
          'ABBV',
          'NFLX',
          'CRM',
          'BAC',
          'AMD',
          'ORCL',
          'ADBE',
          'KO',
          'PEP',
          'TMO',
          'MRK',
          'ACN',
          'CSCO',
          'WMT',
          'ABT',
          'LIN',
          'PM',
          'MCD',
          'DIS',
          'NOW',
          'IBM',
          'GE',
          'ISRG',
          'INTU',
          'QCOM',
          'TXN',
          'AMGN',
          'HON',
          'CAT',
          'AMAT',
          'BKNG',
          'GS',
          'AXP',
          'UBER',
          'MS',
          'BLK',
          'SBUX',
          'PFE',
          'SYK',
          'SCHW',
          'LOW',
          'DE',
          'GILD',
          'MDLZ',
          'REGN',
          'PANW',
          'CB',
          'ADI',
          'VRTX',
          'SO',
          'CME',
          'BX',
          'LRCX',
          'PYPL',
          'MU',
          'PLTR',
          'COIN',
          'SOFI',
          'RIVN',
          'LCID',
          'ARM',
          'SNOW',
          'CRWD',
          'DDOG',
          'NET',
          'ZS',
          'MRVL',
          'ABNB',
          'DASH',
          'RBLX',
          'U',
          'SHOP',
          'SQ',
          'ROKU',
          'SNAP',
          'PINS',
          'HOOD',
          'MARA',
          'RIOT',
          'SMCI',
          'AI',
          // ETFs
          'SPY',
          'QQQ',
          'IWM',
          'DIA',
          'VOO',
          'VTI',
          'ARKK',
          'XLF',
          'XLE',
          'XLK',
          'SOXL',
          'TQQQ',
          'SQQQ',
          'VXX',
          'UVXY',
          'GLD',
          'SLV',
          'TLT',
          'HYG',
          'EEM',
          // Crypto
          'BTC',
          'ETH',
          'SOL',
          'XRP',
          'DOGE',
          'ADA',
          'AVAX',
          'DOT',
          'LINK',
          'MATIC',
        ]
        const urls = [
          `<url><loc>${origin}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
          `<url><loc>${origin}/disclaimer</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.3</priority></url>`,
          `<url><loc>${origin}/donate</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.3</priority></url>`,
          ...tickers.map(
            (t) =>
              `<url><loc>${origin}/${t}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`,
          ),
        ]
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`
        return new Response(xml, {
          headers: {
            'Content-Type': 'application/xml; charset=UTF-8',
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          },
        })
      }

      // Serve important social/static assets with permissive headers so
      // crawlers and social scrapers reliably fetch images from the edge.
      if (
        url.pathname === '/og-image.jpg' ||
        url.pathname === '/og-image.svg' ||
        url.pathname === '/favicon.png'
      ) {
        const assetRes = await env.ASSETS.fetch(request)
        const headers = new Headers(assetRes.headers)
        // Ensure CORS and a friendly cache policy for social scrapers
        headers.set('Access-Control-Allow-Origin', '*')
        headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
        headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
        if (!headers.get('content-type')) {
          headers.set('content-type', url.pathname.endsWith('.svg') ? 'image/svg+xml' : 'image/png')
        }
        return new Response(assetRes.body, { status: assetRes.status, headers })
      }

      // SPA fallback: serve index.html for any non-API, non-asset path
      // (e.g. /BTC, /SPY) so client-side routing can handle it.
      //
      // For crawlers (Googlebot, etc.), serve dynamic HTML with proper meta
      // tags and content so each ticker page is individually indexable.
      const assetRes = await env.ASSETS.fetch(request)
      if (assetRes.status === 404 && !url.pathname.startsWith('/api/')) {
        // Extract potential ticker from path
        const pathClean = url.pathname.replace(/^\//, '').replace(/\/$/, '')
        const parts = pathClean.split('/')
        const maybeTicker = parts[0] ? decodeURIComponent(parts[0]).toUpperCase() : null
        const reserved = new Set(['DISCLAIMER', 'DONATE'])

        if (isCrawler(request) && maybeTicker && !reserved.has(maybeTicker)) {
          // Fetch live quote for enriched social card meta tags
          const quote = await fetchQuickQuote(maybeTicker).catch(() => null)
          const html = buildCrawlerHtml(url, maybeTicker, quote)
          return new Response(html, {
            status: 200,
            headers: { 'Content-Type': 'text/html;charset=UTF-8' },
          })
        }

        if (isCrawler(request) && (!maybeTicker || reserved.has(maybeTicker))) {
          const html = buildCrawlerHtml(url, null, null)
          return new Response(html, {
            status: 200,
            headers: { 'Content-Type': 'text/html;charset=UTF-8' },
          })
        }

        const indexReq = new Request(new URL('/', url.origin), request)
        const indexRes = await env.ASSETS.fetch(indexReq)

        // Rewrite canonical, title, and meta description so Google's renderer
        // (which fetches as a normal user) sees the correct values for each ticker page.
        if (maybeTicker && !reserved.has(maybeTicker)) {
          const canonical = `${url.origin}/${maybeTicker}`
          const title = `${maybeTicker} Options & Stock Analysis — Borja Ruizdelgado Investing Tools`
          const desc = `Free ${maybeTicker} analysis: options-implied price forecast, probability distribution, expected move, IV smile, fundamentals (P/E, EBITDA, margins), analyst targets, and support/resistance levels.`
          let html = await indexRes.text()
          html = html
            .replace(
              /<link rel="canonical"[^>]*>/,
              `<link rel="canonical" href="${canonical}" id="canonical"/>`,
            )
            .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
            .replace(
              /<meta name="description"[^>]*>/,
              `<meta name="description" content="${desc}"/>`,
            )
            .replace(
              /<meta property="og:url"[^>]*>/,
              `<meta property="og:url" content="${canonical}"/>`,
            )
            .replace(
              /<meta property="og:title"[^>]*>/,
              `<meta property="og:title" content="${title}"/>`,
            )
            .replace(
              /<meta property="og:description"[^>]*>/,
              `<meta property="og:description" content="${desc}"/>`,
            )
            .replace(
              /<meta name="twitter:title"[^>]*>/,
              `<meta name="twitter:title" content="${title}"/>`,
            )
            .replace(
              /<meta name="twitter:description"[^>]*>/,
              `<meta name="twitter:description" content="${desc}"/>`,
            )
          return new Response(html, {
            status: 200,
            headers: { 'Content-Type': 'text/html;charset=UTF-8' },
          })
        }

        return indexRes
      }
      return assetRes
    } catch (err) {
      logError(url.pathname, err, { ticker: url.searchParams.get('ticker') })
      return jsonResp({ error: err.message }, 500)
    }
  },
}
