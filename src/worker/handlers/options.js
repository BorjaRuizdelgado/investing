/**
 * /api/options — stock options expirations + spot price + fundamentals.
 */

import { fetchYF } from '../yahoo.js'
import { jsonResp } from '../utils.js'

export async function handleOptions(ticker) {
  // Fetch options data and detailed summary in parallel.
  // The options endpoint may return no result for tickers without listed options —
  // in that case we still return fundamentals with an empty expirations array.
  // A direct quote fetch runs in parallel as a price/name fallback (e.g. for crypto).
  const [data, summaryData, quoteData] = await Promise.all([
    fetchYF(`/v7/finance/options/${ticker}`).catch(() => null),
    fetchYF(
      `/v10/finance/quoteSummary/${ticker}?modules=assetProfile,defaultKeyStatistics,financialData,incomeStatementHistory,balanceSheetHistory,cashflowStatementHistory,earningsHistory`,

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
  const assetProfile = summaryResult.assetProfile || {}
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
    description: assetProfile.longBusinessSummary || null,
    sector: quote.sector || assetProfile.sector || null,
    industry: quote.industry || assetProfile.industry || null,
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
