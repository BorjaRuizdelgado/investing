/**
 * /api/screener — dynamic stock discovery via Yahoo Finance screener API.
 */

import { fetchYF } from '../yahoo.js'
import { cachedJsonResp, logError } from '../utils.js'

let cachedScreener = null
let screenerExpiry = 0

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

  // ── Strategy A: predefined screener GET endpoints ───────────────────
  // Yahoo Finance's /v1/finance/screener/predefined/saved endpoint returns
  // up to 250 stocks per screener category. We fetch many categories in
  // batches of 4 to build a diverse universe.
  try {
    const predefined = [
      'most_actives', 'day_gainers', 'day_losers',
      'undervalued_large_caps', 'growth_technology_stocks',
      'undervalued_growth_stocks', 'small_cap_gainers',
      'aggressive_small_caps', 'most_shorted_stocks',
      'portfolio_anchors', 'top_mutual_funds',
      'high_yield_bond', 'conservative_foreign_funds',
      'solid_large_growth_funds', 'solid_midcap_growth_funds',
    ]
    for (let i = 0; i < predefined.length; i += 4) {
      const batch = predefined.slice(i, i + 4)
      const results = await Promise.all(
        batch.map((scrId) =>
          fetchYF(`/v1/finance/screener/predefined/saved?scrIds=${scrId}&count=250`)
            .then((d) => d?.finance?.result?.[0]?.quotes || [])
            .catch((e) => {
              console.error(`[Screener] Predefined "${scrId}" failed:`, e.message)
              return []
            }),
        ),
      )
      for (const quotes of results) for (const q of quotes) push(q)
    }
    console.log(`[Screener] Strategy A: ${allStocks.length} stocks from predefined screeners`)
  } catch (e) {
    logError('/api/screener', e, { upstreamStatus: e.message })
    console.error('[Screener] Strategy A (predefined screeners) failed:', e.message)
  }

  // ── Strategy B: batch quote for well-known tickers (always merge) ──
  {
    const coreTickers = [
      // Mega / Large Cap Tech
      'AAPL','MSFT','NVDA','AMZN','GOOGL','GOOG','META','TSLA','BRK-B','AVGO','JPM',
      'LLY','V','UNH','MA','XOM','COST','HD','PG','JNJ','ABBV',
      'NFLX','CRM','BAC','AMD','ORCL','ADBE','KO','PEP','TMO','MRK',
      'ACN','CSCO','WMT','ABT','LIN','PM','MCD','DIS','NOW','IBM',
      'GE','ISRG','INTU','QCOM','TXN','AMGN','HON','CAT','AMAT','BKNG',
      'GS','AXP','UBER','MS','BLK','SBUX','PFE','SYK','SCHW','LOW',
      'DE','GILD','MDLZ','REGN','PANW','CB','ADI','VRTX','SO','CME',
      'BX','LRCX','PYPL','MU','PLTR','COIN','SOFI','ARM','SNOW','CRWD',
      'DDOG','NET','ZS','MRVL','ABNB','DASH','RBLX','SHOP','SQ','ROKU',
      // Energy
      'CVX','COP','SLB','OXY','EOG','MPC','VLO','PSX','HES','HAL',
      // Utilities
      'NEE','DUK','AEP','D','SRE','XEL','WEC','ED','ES','ATO',
      // Telecom
      'T','VZ','CMCSA','TMUS','CHTR','LBRDK',
      // Aerospace & Defence
      'RTX','LMT','GD','NOC','BA','HII','TDG','HWM','TXT','ERJ',
      // Transport
      'UNP','FDX','UPS','CSX','NSC','DAL','UAL','LUV','JBLU','JBHT',
      // Consumer
      'NKE','LULU','TJX','CMG','YUM','MAR','HLT','RCL','CCL','EXPE',
      'SBUX','MCD','DPZ','WYNN','MGM','LVS','NCLH',
      // REITs
      'PLD','AMT','CCI','EQIX','SPG','O','PSA','DLR','WELL','AVB',
      'VTR','PEAK','ARE','UDR','ESS','MAA','IRM','CUBE','EXR','REG',
      // Insurance & Financials
      'CI','ELV','MCK','CVS','MMC','AIG','TRV','MET','PRU','PGR',
      'AFL','ALL','HIG','WRB','L','ACGL','RNR','FNF','AJG','BRO',
      'C','WFC','USB','PNC','TFC','FITB','MTB','HBAN','CFG','KEY',
      'ALLY','DFS','SYF','COF',
      // International
      'NVO','SAP','TM','SONY','MELI','BABA','NIO','NU','AZN','GSK',
      'TSM','ASML','UL','BHP','RIO','SHEL','BP','DEO','BTI','SNY',
      'LYG','ING','WBD','SPOT','SE','GRAB','CPNG',
      // Materials
      'FCX','NEM','APD','SHW','NUE','CL','KMB','MNST','GIS','HSY',
      'DD','DOW','ECL','PPG','VMC','MLM','CF','MOS','ALB','IP',
      // Semiconductors
      'ANET','FTNT','KLAC','SMCI','ON','MCHP','SNPS','CDNS','ANSS','SEDG',
      'MPWR','SWKS','QRVO','TER','LSCC','WOLF',
      // Clean Energy
      'ENPH','FSLR','CEG','VST','CARR','TT','IR','EMR','ROK','DOV',
      // Industrials
      'ETN','WM','RSG','ECL','ITW','ODFL','FAST','PAYX','ADP','CPRT',
      'ROL','SWK','GWW','NDSN','XYL','TRMB','AME','DOV','PH','IEX',
      'MMM','GPC','ROP','CTAS','BR','VRSK','LDOS','SAIC','KBR',
      // Healthcare
      'DHR','BMY','BIIB','MRNA','ILMN','ZTS','VEEV','CNC','HCA','GEHC',
      'DXCM','ALGN','PODD','HOLX','TECH','WAT','BIO','A','PKI','AZTA',
      'TDOC','HIMS','RMD','BSX','EW','MDT','ZBH','ISRG','ICLR','IQV',
      // Fintech & Data
      'MSCI','ICE','MCO','SPGI','FIS','FISV','GPN','WEX','PAYC','PCTY',
      'INTU','ADSK','ANSS','BILL','TOST','AFRM','UPST','HOOD','RIVN',
      // Auto
      'GM','F','RIVN','LCID','LI','XPEV','STLA','TM','HMC','RACE',
      // Retail
      'ORLY','AZO','POOL','IDXX','DLTR','DG','FIVE','ROST','BURL','WSM',
      'W','CHWY','ETSY','EBAY','BBY','KSS','M','JWN','GPS','ANF',
      // Media & Gaming
      'EA','TTWO','ATVI','PARA','FOX','NWSA','RBLX','U','DKNG','PENN',
      // Cloud & SaaS
      'ZM','DOCU','OKTA','MDB','TWLO','TTD','HUBS','PCOR','ESTC','CFLT',
      'GTLB','PATH','MNDY','APP','SNAP','PINS','RDDT','ROKU',
      // Biotech
      'AMGN','GILD','VRTX','REGN','ALNY','BMRN','SGEN','BNTX','MRNA',
      'RARE','SRPT','INCY','UTHR','BGNE','EXEL','PCVX','CYTK',
      // ETFs — broad
      'SPY','QQQ','IWM','DIA','VOO','VTI','ARKK','XLF','XLE','XLK',
      'GLD','SLV','TLT','HYG','SOXX','SMH','XBI','XLV','XLI','XLP',
      'KWEB','EEM','VWO','EFA','VEA','IEMG','VNQ','VNQI','LQD','BND',
      // ETFs — thematic / sector
      'XLC','XLY','XLRE','XLU','XLB','HACK','BOTZ','LIT','TAN','ICLN',
      'JETS','BITO','IBIT','MSOS','YOLO','AAXJ','FXI','EWZ','EWJ','RSX',
      'ARKF','ARKG','ARKQ','ARKW','SOXL','SOXS','TQQQ','SQQQ','SPXS','UPRO',
      'IYR','SCHD','VIG','DVY','VYM','DGRO','JEPI','JEPQ','DIVO','QYLD',
      'AGG','VCIT','VCSH','MBB','GOVT','SHY','IEF','TIPS','EMB','PCY',
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

  console.log(`[Screener] Final: ${allStocks.length} stocks (${seen.size} unique)`)
  cachedScreener = { stocks: allStocks, fetchedAt: new Date().toISOString() }
  screenerExpiry = now + 15 * 60_000
  return cachedJsonResp(cachedScreener, 900)
}
