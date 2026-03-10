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

const YF_BASE = "https://query2.finance.yahoo.com";
const BYBIT_BASE = "https://api.bybit.com/v5/market";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ---- Crypto detection ----

const LIKELY_CRYPTO = new Set([
  "BTC", "ETH", "SOL", "XRP", "BNB", "MATIC", "DOGE", "ADA", "AVAX",
  "DOT", "LINK", "LTC", "UNI", "ATOM", "FIL", "APT", "ARB", "OP",
  "NEAR", "PAXG", "USDC", "USDT", "USDE",
]);

/** Tickers with Bybit options support (verified coverage) */
const BYBIT_COINS = new Set(["BTC", "ETH", "SOL", "XRP", "DOGE"]);

/** Strip common fiat/stablecoin suffixes: BTC-USD → BTC */
function stripCryptoSuffix(ticker) {
  let t = ticker.toUpperCase().trim();
  for (const sfx of ["-USDT", "-USD", "-PERP", "USDT", "USD"]) {
    if (t.endsWith(sfx)) { t = t.slice(0, -sfx.length); break; }
  }
  return t;
}

function isCrypto(ticker) {
  return LIKELY_CRYPTO.has(stripCryptoSuffix(ticker));
}

/** Return the canonical base symbol for crypto, or uppercased ticker for stocks */
function normaliseTicker(raw) {
  const t = raw.toUpperCase().trim();
  if (isCrypto(t)) return stripCryptoSuffix(t);
  return t;
}

// ---- Common ----

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// ======================================================================
// Yahoo Finance (stocks/ETFs)
// ======================================================================

let cachedAuth = null;
let authExpiry = 0;

async function getAuth() {
  const now = Date.now();
  if (cachedAuth && now < authExpiry) return cachedAuth;

  const consentRes = await fetch("https://fc.yahoo.com/", {
    headers: { "User-Agent": UA },
    redirect: "manual",
  });
  const cookies = consentRes.headers.getAll
    ? consentRes.headers.getAll("set-cookie")
    : [consentRes.headers.get("set-cookie")].filter(Boolean);

  const cookieStr = cookies.map((c) => c.split(";")[0]).join("; ");

  const crumbRes = await fetch(`${YF_BASE}/v1/test/getcrumb`, {
    headers: { "User-Agent": UA, Cookie: cookieStr },
  });

  if (!crumbRes.ok) {
    cachedAuth = { cookie: "", crumb: "" };
    authExpiry = now + 60_000;
    return cachedAuth;
  }

  const crumb = await crumbRes.text();
  cachedAuth = { cookie: cookieStr, crumb: crumb.trim() };
  authExpiry = now + 30 * 60_000;
  return cachedAuth;
}

async function fetchYF(path) {
  const auth = await getAuth();
  const sep = path.includes("?") ? "&" : "?";
  const url = auth.crumb
    ? `${YF_BASE}${path}${sep}crumb=${encodeURIComponent(auth.crumb)}`
    : `${YF_BASE}${path}`;

  const res = await fetch(url, {
    headers: { "User-Agent": UA, Cookie: auth.cookie, Accept: "application/json" },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      cachedAuth = null;
      authExpiry = 0;
      const retry = await getAuth();
      const retryUrl = retry.crumb
        ? `${YF_BASE}${path}${sep}crumb=${encodeURIComponent(retry.crumb)}`
        : `${YF_BASE}${path}`;
      const res2 = await fetch(retryUrl, {
        headers: { "User-Agent": UA, Cookie: retry.cookie, Accept: "application/json" },
      });
      if (!res2.ok) throw new Error(`Yahoo Finance ${res2.status}: ${res2.statusText}`);
      return res2.json();
    }
    throw new Error(`Yahoo Finance ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

// ======================================================================
// Bybit (crypto options)
// ======================================================================

async function fetchBybit(endpoint, params = {}) {
  const url = new URL(`${BYBIT_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Bybit ${res.status}: ${res.statusText}`);
  const data = await res.json();
  if (data.retCode !== 0) throw new Error(`Bybit: ${data.retMsg}`);
  return data.result;
}

/**
 * Parse Bybit symbol expiry string "5MAR26" → "2026-03-05".
 */
const MONTH_MAP = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

function parseBybitExpiry(expStr) {
  const m = expStr.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/);
  if (!m) return null;
  const day = m[1].padStart(2, "0");
  const mon = MONTH_MAP[m[2]];
  if (!mon) return null;
  const year = `20${m[3]}`;
  return `${year}-${mon}-${day}`;
}

// ======================================================================
// Route handlers — Yahoo Finance (stocks)
// ======================================================================

async function handleOptions(ticker) {
  // Fetch options data and detailed summary in parallel
  const [data, summaryData] = await Promise.all([
    fetchYF(`/v7/finance/options/${ticker}`),
    fetchYF(`/v10/finance/quoteSummary/${ticker}?modules=defaultKeyStatistics,financialData,incomeStatementHistory,balanceSheetHistory,cashflowStatementHistory`).catch(() => null),
  ]);
  const result = data.optionChain.result[0];
  const rawTimestamps = result.expirationDates || [];
  const expirations = rawTimestamps.map((ts) => ({
    date: new Date(ts * 1000).toISOString().slice(0, 10),
    timestamp: ts,
  }));
  const quote = result.quote || {};

  // Extract detailed stats from quoteSummary modules
  const summaryResult = summaryData?.quoteSummary?.result?.[0] || {};
  const keyStats = summaryResult.defaultKeyStatistics || {};
  const finData = summaryResult.financialData || {};
  const incomeHist = summaryResult.incomeStatementHistory?.incomeStatementHistory?.[0] || {};
  const balanceHist = summaryResult.balanceSheetHistory?.balanceSheetStatements?.[0] || {};
  const cashflowHist = summaryResult.cashflowStatementHistory?.cashflowStatements?.[0] || {};

  // Helper: extract raw value from Yahoo's {raw, fmt} objects
  const rv = (obj) => obj?.raw ?? obj ?? null;

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
    pegRatio: rv(keyStats.pegRatio) ?? null,
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
    operatingIncome: rv(finData.operatingCashflow) != null ? null : rv(incomeHist.operatingIncome) ?? null,
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
    operatingCashflow: rv(finData.operatingCashflow) ?? rv(cashflowHist.totalCashFromOperatingActivities) ?? null,
    freeCashflow: rv(finData.freeCashflow) ?? null,
    capitalExpenditures: rv(cashflowHist.capitalExpenditures) ?? null,
    // Dividends & income
    dividendYield: quote.dividendYield ?? rv(keyStats.dividendYield) ?? null,
    dividendRate: quote.dividendRate ?? rv(keyStats.dividendRate) ?? null,
    trailingAnnualDividendRate: quote.trailingAnnualDividendRate ?? rv(keyStats.trailingAnnualDividendRate) ?? null,
    fiveYearAvgDividendYield: rv(keyStats.fiveYearAvgDividendYield) ?? null,
    payoutRatio: rv(keyStats.payoutRatio) ?? quote.payoutRatio ?? null,
    exDividendDate: rv(keyStats.exDividendDate) ?? null,
    lastDividendDate: rv(keyStats.lastDividendDate) ?? null,
    lastDividendValue: rv(keyStats.lastDividendValue) ?? null,
    // Trading
    beta: rv(keyStats.beta) ?? quote.beta ?? null,
    fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? null,
    fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekChange: rv(keyStats["52WeekChange"]) ?? null,
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
    numberOfAnalystOpinions: rv(finData.numberOfAnalystOpinions) ?? quote.numberOfAnalystOpinions ?? null,
    // Earnings
    earningsTimestamp: quote.earningsTimestamp ?? null,
    earningsTimestampStart: quote.earningsTimestampStart ?? null,
    earningsTimestampEnd: quote.earningsTimestampEnd ?? null,
    earningsQuarterlyGrowth: rv(keyStats.earningsQuarterlyGrowth) ?? null,
    mostRecentQuarter: rv(keyStats.mostRecentQuarter) ?? null,
    lastFiscalYearEnd: rv(keyStats.lastFiscalYearEnd) ?? null,
    nextFiscalYearEnd: rv(keyStats.nextFiscalYearEnd) ?? null,
  };

  return jsonResp({
    ticker: quote.symbol || ticker,
    price: quote.regularMarketPrice || 0,
    expirations,
    fundamentals,
  });
}

async function handleChain(ticker, expTimestamp) {
  const data = await fetchYF(`/v7/finance/options/${ticker}?date=${expTimestamp}`);
  const result = data.optionChain.result[0];
  const quote = result.quote || {};

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
    };
  }

  const calls = (result.options[0]?.calls || []).map(cleanOption);
  const puts = (result.options[0]?.puts || []).map(cleanOption);

  return jsonResp({
    ticker: quote.symbol || ticker,
    price: quote.regularMarketPrice || 0,
    expiry: new Date(Number(expTimestamp) * 1000).toISOString().slice(0, 10),
    calls,
    puts,
  });
}

async function handleHistory(ticker, days) {
  const range = `${days}d`;
  const data = await fetchYF(`/v8/finance/chart/${ticker}?range=${range}&interval=1d`);
  const result = data.chart.result[0];
  const timestamps = result.timestamp || [];
  const q = result.indicators.quote[0];

  const bars = timestamps
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      open: q.open[i],
      high: q.high[i],
      low: q.low[i],
      close: q.close[i],
      volume: q.volume[i],
    }))
    .filter((b) => b.close != null);

  return jsonResp({ ticker: result.meta.symbol, bars });
}

async function handleRate() {
  try {
    const data = await fetchYF(`/v8/finance/chart/%5EIRX?range=5d&interval=1d`);
    const closes = data.chart.result[0].indicators.quote[0].close.filter((v) => v != null);
    const rate = closes.length > 0 ? closes[closes.length - 1] / 100 : 0.05;
    return jsonResp({ rate });
  } catch {
    return jsonResp({ rate: 0.05 });
  }
}

// ======================================================================
// Route handlers — Bybit (crypto options)
// ======================================================================

async function handleCryptoOptions(currency) {
  // Fetch instruments and one page of tickers in parallel
  const [instrumentsResult, tickersResult] = await Promise.all([
    fetchBybit("instruments-info", {
      category: "option",
      baseCoin: currency,
      limit: "1000",
    }),
    fetchBybit("tickers", {
      category: "option",
      baseCoin: currency,
    }),
  ]);

  const instruments = instrumentsResult.list || [];
  if (instruments.length === 0) throw new Error(`No Bybit options for ${currency}`);

  // Extract unique expiry dates from deliveryTime (ms timestamp)
  const expiryMap = new Map();
  for (const inst of instruments) {
    const msTs = Number(inst.deliveryTime);
    const ts = Math.floor(msTs / 1000);
    const date = new Date(msTs).toISOString().slice(0, 10);
    expiryMap.set(date, ts);
  }

  // Spot price from first ticker's underlyingPrice
  const tickers = tickersResult.list || [];
  let spot = 0;
  for (const t of tickers) {
    const p = parseFloat(t.underlyingPrice);
    if (p > 0) { spot = p; break; }
  }

  const expirations = Array.from(expiryMap.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([date, timestamp]) => ({ date, timestamp }));

  return jsonResp({
    ticker: `${currency}-USD`,
    price: spot,
    expirations,
    fundamentals: null,
  });
}

async function handleCryptoChain(currency, expDateStr) {
  // Fetch all tickers for this base coin (single call has everything)
  const result = await fetchBybit("tickers", {
    category: "option",
    baseCoin: currency,
  });

  const allTickers = result.list || [];
  let spot = 0;
  for (const t of allTickers) {
    const p = parseFloat(t.underlyingPrice);
    if (p > 0) { spot = p; break; }
  }

  const calls = [];
  const puts = [];

  for (const t of allTickers) {
    // Symbol format: "BTC-5MAR26-68500-C-USDT"
    const parts = t.symbol.split("-");
    if (parts.length < 4) continue;

    const expDate = parseBybitExpiry(parts[1]);
    if (expDate !== expDateStr) continue;

    const strike = parseFloat(parts[2]);
    const optType = parts[3]; // "C" or "P"

    const bid = parseFloat(t.bid1Price) || 0;
    const ask = parseFloat(t.ask1Price) || 0;
    const lastPrice = parseFloat(t.lastPrice) || 0;
    const markPrice = parseFloat(t.markPrice) || 0;
    let mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : lastPrice;
    if (mid <= 0) mid = markPrice;

    const iv = parseFloat(t.markIv) || 0; // Already decimal (e.g. 0.6145)
    const oi = parseFloat(t.openInterest) || 0;
    const vol = parseFloat(t.volume24h) || 0;

    const itm =
      (optType === "C" && strike < spot) ||
      (optType === "P" && strike > spot);

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
    };

    if (optType === "C") calls.push(row);
    else if (optType === "P") puts.push(row);
  }

  calls.sort((a, b) => a.strike - b.strike);
  puts.sort((a, b) => a.strike - b.strike);

  return jsonResp({
    ticker: `${currency}-USD`,
    price: spot,
    expiry: expDateStr,
    calls,
    puts,
  });
}

async function handleCryptoHistory(currency, days) {
  // Use Yahoo Finance for crypto price history (BTC-USD etc.)
  return handleHistory(`${currency}-USD`, days);
}

// ======================================================================
// Trending tickers (landing page)
// ======================================================================

let cachedTrending = null;
let trendingExpiry = 0;

const FALLBACK_STOCKS = ["SPY", "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOGL"];
const CRYPTO_SYMBOLS = [
  "BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "DOGE-USD",
  "BNB-USD", "ADA-USD", "AVAX-USD",
];

/** Check if a stock ticker has options on Yahoo Finance. */
async function checkStockOptions(symbol) {
  try {
    const data = await fetchYF(`/v7/finance/options/${symbol}`);
    const exps = data?.optionChain?.result?.[0]?.expirationDates || [];
    return exps.length > 0;
  } catch { return false; }
}

async function handleTrending() {
  const now = Date.now();
  if (cachedTrending && now < trendingExpiry) return jsonResp(cachedTrending);

  // 1. Get candidate stock symbols (trending or fallback)
  let stockSymbols = FALLBACK_STOCKS;
  try {
    const trending = await fetchYF("/v1/finance/trending/US?count=20");
    const symbols = trending?.finance?.result?.[0]?.quotes?.map((q) => q.symbol) || [];
    if (symbols.length > 0) stockSymbols = symbols.slice(0, 20);
  } catch { /* use fallback */ }

  // 2. Batch-fetch quotes for all candidates
  const allSymbols = [...stockSymbols, ...CRYPTO_SYMBOLS].join(",");
  const quoteData = await fetchYF(`/v7/finance/quote?symbols=${encodeURIComponent(allSymbols)}`);
  const quotes = quoteData?.quoteResponse?.result || [];

  const cryptoSet = new Set(CRYPTO_SYMBOLS);
  const cryptoBaseSet = new Set(CRYPTO_SYMBOLS.map((s) => s.replace("-USD", "")));
  const stockCandidates = [];
  const crypto = [];

  for (const q of quotes) {
    const item = {
      symbol: q.symbol,
      name: q.shortName || q.longName || q.symbol,
      price: q.regularMarketPrice ?? 0,
      change: q.regularMarketChange ?? 0,
      changePct: q.regularMarketChangePercent ?? 0,
      marketCap: q.marketCap ?? null,
    };
    if (cryptoSet.has(q.symbol)) {
      crypto.push({ ...item, symbol: q.symbol.replace("-USD", "") });
    } else if (!cryptoBaseSet.has(q.symbol)) {
      // Skip tickers that collide with crypto base symbols (e.g. BTC, ETH)
      stockCandidates.push(item);
    }
  }

  // 3. Verify options availability for stock candidates (check in parallel, take first 8 that pass)
  const optChecks = await Promise.all(
    stockCandidates.map((s) => checkStockOptions(s.symbol).then((ok) => ({ ...s, ok }))),
  );
  const stocks = optChecks.filter((s) => s.ok).slice(0, 8).map(({ ok, ...s }) => s);

  // If none passed (unlikely), use fallback symbols that always have options
  if (stocks.length === 0) {
    for (const sym of FALLBACK_STOCKS) {
      const q = stockCandidates.find((s) => s.symbol === sym);
      if (q) stocks.push(q);
    }
  }

  const result = { stocks, crypto };
  cachedTrending = result;
  trendingExpiry = now + 5 * 60_000; // 5-minute cache
  return jsonResp(result);
}

// ======================================================================
// Main handler
// ======================================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      if (url.pathname === "/api/options") {
        const ticker = url.searchParams.get("ticker");
        if (!ticker) return jsonResp({ error: "ticker required" }, 400);
        const norm = normaliseTicker(ticker);
        if (isCrypto(ticker)) {
          // Try Bybit first for coins with known options support
          if (BYBIT_COINS.has(norm)) {
            try {
              const resp = await handleCryptoOptions(norm);
              const body = await resp.clone().json();
              if (body.expirations && body.expirations.length > 0) return resp;
            } catch { /* Bybit failed, fall through */ }
          }
          // Fall back to Yahoo Finance (e.g. BNB, ADA, etc.)
          return await handleOptions(`${norm}-USD`);
        }
        return await handleOptions(norm);
      }

      if (url.pathname === "/api/chain") {
        const ticker = url.searchParams.get("ticker");
        const exp = url.searchParams.get("exp");
        if (!ticker || !exp) return jsonResp({ error: "ticker and exp required" }, 400);
        const norm = normaliseTicker(ticker);
        if (isCrypto(ticker)) {
          if (/^\d+$/.test(exp)) {
            // Unix timestamp — convert to ISO date, try Bybit, fall back to YF
            const expDate = new Date(Number(exp) * 1000).toISOString().slice(0, 10);
            if (BYBIT_COINS.has(norm)) {
              try {
                const resp = await handleCryptoChain(norm, expDate);
                const body = await resp.clone().json();
                if ((body.calls && body.calls.length > 0) || (body.puts && body.puts.length > 0)) return resp;
              } catch { /* fall through */ }
            }
            return await handleChain(`${norm}-USD`, exp);
          }
          // Date string from Bybit path
          return await handleCryptoChain(norm, exp);
        }
        return await handleChain(norm, exp);
      }

      if (url.pathname === "/api/history") {
        const ticker = url.searchParams.get("ticker");
        const days = parseInt(url.searchParams.get("days") || "60", 10);
        if (!ticker) return jsonResp({ error: "ticker required" }, 400);
        const norm = normaliseTicker(ticker);
        if (isCrypto(ticker)) {
          return await handleCryptoHistory(norm, days);
        }
        return await handleHistory(norm, days);
      }

      if (url.pathname === "/api/rate") {
        return await handleRate();
      }

      if (url.pathname === "/api/trending") {
        return await handleTrending();
      }

      // Serve important social/static assets with permissive headers so
      // crawlers and social scrapers reliably fetch images from the edge.
      if (url.pathname === "/og-image.svg" || url.pathname === "/favicon.png") {
        const assetRes = await env.ASSETS.fetch(request);
        const headers = new Headers(assetRes.headers);
        // Ensure CORS and a friendly cache policy for social scrapers
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
        headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
        if (!headers.get("content-type")) {
          headers.set("content-type", url.pathname.endsWith(".svg") ? "image/svg+xml" : "image/png");
        }
        return new Response(assetRes.body, { status: assetRes.status, headers });
      }

      // SPA fallback: serve index.html for any non-API, non-asset path
      // (e.g. /BTC, /SPY) so client-side routing can handle it.
      const assetRes = await env.ASSETS.fetch(request);
      if (assetRes.status === 404 && !url.pathname.startsWith("/api/")) {
        const indexReq = new Request(new URL("/", url.origin), request);
        return env.ASSETS.fetch(indexReq);
      }
      return assetRes;
    } catch (err) {
      return jsonResp({ error: err.message }, 500);
    }
  },
};
