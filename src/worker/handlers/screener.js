/**
 * /api/screener — dynamic stock discovery via Yahoo Finance screener API.
 */

import { fetchYF, fetchYFScreener } from '../yahoo.js'
import { cachedJsonResp } from '../utils.js'

let cachedScreener = null
let screenerExpiry = 0

/** Build a screener POST body for a given quoteType and market-cap floor. */
function screenerBody(quoteType, minMarketCap, offset, size = 250) {
  return {
    size,
    offset,
    sortField: 'intradaymarketcap',
    sortType: 'DESC',
    quoteType,
    query: {
      operator: 'AND',
      operands: [
        { operator: 'EQ', operand: ['region', 'us'] },
        { operator: 'GT', operand: ['intradaymarketcap', minMarketCap] },
      ],
    },
    userId: '',
    userIdType: 'guid',
  }
}

/** Map a raw Yahoo quote object to our screener shape. */
function mapQuote(q) {
  return {
    ticker: q.symbol,
    name: q.shortName || q.longName || q.symbol,
    price: q.regularMarketPrice ?? null,
    change: q.regularMarketChange ?? null,
    changePct: q.regularMarketChangePercent ?? null,
    marketCap: q.marketCap ?? null,
    trailingPE: q.trailingPE ?? null,
    forwardPE: q.forwardPE ?? null,
    priceToBook: q.priceToBook ?? null,
    dividendYield: q.dividendYield ?? null,
    profitMargins: q.profitMargins ?? null,
    sector: q.sector || null,
    industry: q.industry || null,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
    beta: q.beta ?? null,
    eps: q.epsTrailingTwelveMonths ?? null,
    avgVolume: q.averageDailyVolume3Month ?? null,
    returnOnEquity: q.returnOnEquity ?? null,
    debtToEquity: q.debtToEquity ?? null,
    quoteType: q.quoteType || null,
  }
}

export async function handleScreener() {
  const now = Date.now()
  if (cachedScreener && now < screenerExpiry) return cachedJsonResp(cachedScreener, 900)

  const seen = new Set()
  const allStocks = []
  const push = (q) => {
    if (q.symbol && !seen.has(q.symbol)) {
      seen.add(q.symbol)
      allStocks.push(mapQuote(q))
    }
  }

  // ── Strategy A: Yahoo screener POST API (equities + ETFs) ──────────
  try {
    // Equities: up to 2500 stocks (10 pages × 250), market cap > $300 M
    for (let offset = 0; offset < 2500; offset += 250) {
      const data = await fetchYFScreener(screenerBody('EQUITY', 300_000_000, offset))
      const quotes = data?.finance?.result?.[0]?.quotes || []
      for (const q of quotes) push(q)
      if (quotes.length < 250) break
    }
    // ETFs: up to 500 by AUM (> $500 M)
    for (let offset = 0; offset < 500; offset += 250) {
      const data = await fetchYFScreener(screenerBody('ETF', 500_000_000, offset))
      const quotes = data?.finance?.result?.[0]?.quotes || []
      for (const q of quotes) push(q)
      if (quotes.length < 250) break
    }
  } catch { /* continue to next strategies */ }

  // ── Strategy B: predefined screener GET endpoints (always merge) ────
  try {
    const predefined = [
      'most_actives', 'day_gainers', 'day_losers',
      'undervalued_large_caps', 'growth_technology_stocks',
      'undervalued_growth_stocks', 'small_cap_gainers',
      'aggressive_small_caps',
    ]
    for (let i = 0; i < predefined.length; i += 3) {
      const batch = predefined.slice(i, i + 3)
      const results = await Promise.all(
        batch.map((name) =>
          fetchYF(`/v1/finance/screener/predefined/${name}?count=250`)
            .then((d) => d?.finance?.result?.[0]?.quotes || [])
            .catch(() => []),
        ),
      )
      for (const quotes of results) for (const q of quotes) push(q)
    }
  } catch { /* continue */ }

  // ── Strategy C: batch quote for well-known tickers (always merge) ──
  {
    const coreTickers = [
      'AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','BRK-B','AVGO','JPM',
      'LLY','V','UNH','MA','XOM','COST','HD','PG','JNJ','ABBV',
      'NFLX','CRM','BAC','AMD','ORCL','ADBE','KO','PEP','TMO','MRK',
      'ACN','CSCO','WMT','ABT','LIN','PM','MCD','DIS','NOW','IBM',
      'GE','ISRG','INTU','QCOM','TXN','AMGN','HON','CAT','AMAT','BKNG',
      'GS','AXP','UBER','MS','BLK','SBUX','PFE','SYK','SCHW','LOW',
      'DE','GILD','MDLZ','REGN','PANW','CB','ADI','VRTX','SO','CME',
      'BX','LRCX','PYPL','MU','PLTR','COIN','SOFI','ARM','SNOW','CRWD',
      'DDOG','NET','ZS','MRVL','ABNB','DASH','RBLX','SHOP','SQ','ROKU',
      'CVX','COP','SLB','OXY','EOG','NEE','DUK','AEP','D','SRE',
      'T','VZ','CMCSA','TMUS','RTX','LMT','GD','NOC','BA','UNP',
      'FDX','UPS','NKE','LULU','TJX','CMG','YUM','MAR','HLT','RCL',
      'PLD','AMT','CCI','EQIX','SPG','O','PSA','DLR','WELL','AVB',
      'CI','ELV','MCK','CVS','MMC','AIG','TRV','MET','PRU','PGR',
      'NVO','SAP','TM','SONY','MELI','BABA','NIO','NU','AZN','GSK',
      'FCX','NEM','APD','SHW','NUE','CL','KMB','MNST','GIS','HSY',
      'ANET','FTNT','KLAC','SMCI','ON','MCHP','SNPS','CDNS','ANSS','SEDG',
      'ENPH','FSLR','CEG','VST','CARR','TT','IR','EMR','ROK','DOV',
      'ETN','WM','RSG','ECL','ITW','ODFL','FAST','PAYX','ADP','CPRT',
      'ORLY','AZO','POOL','IDXX','DXCM','ALGN','PODD','HOLX','TECH','WAT',
      'MSCI','ICE','MCO','SPGI','FIS','FISV','GPN','WEX','PAYC','PCTY',
      'DHR','BMY','BIIB','MRNA','ILMN','ZTS','VEEV','CNC','HCA','GEHC',
      'SPY','QQQ','IWM','DIA','VOO','VTI','ARKK','XLF','XLE','XLK',
      'GLD','SLV','TLT','HYG','SOXX','SMH','XBI','XLV','XLI','XLP',
      'KWEB','EEM','VWO','EFA','VEA','IEMG','VNQ','VNQI','LQD','BND',
    ]
    // Only fetch tickers we haven't seen yet
    const missing = coreTickers.filter((t) => !seen.has(t))
    const CHUNK = 50
    const chunks = []
    for (let i = 0; i < missing.length; i += CHUNK) {
      chunks.push(missing.slice(i, i + CHUNK))
    }
    for (let w = 0; w < chunks.length; w += 3) {
      const wave = chunks.slice(w, w + 3)
      const results = await Promise.all(
        wave.map((chunk) =>
          fetchYF(`/v7/finance/quote?symbols=${encodeURIComponent(chunk.join(','))}`)
            .then((d) => d?.quoteResponse?.result || [])
            .catch(() => []),
        ),
      )
      for (const batch of results) for (const q of batch) push(q)
    }
  }

  cachedScreener = { stocks: allStocks, fetchedAt: new Date().toISOString() }
  screenerExpiry = now + 15 * 60_000
  return cachedJsonResp(cachedScreener, 900)
}
