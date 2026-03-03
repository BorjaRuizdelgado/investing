/**
 * Cloudflare Worker — API proxy for Yahoo Finance + Deribit (crypto).
 *
 * Routing:
 *   - Crypto tickers (BTC, ETH, SOL …) → Deribit public API (no auth)
 *   - Everything else                   → Yahoo Finance (cookie+crumb auth)
 *
 * Routes:
 *   GET /api/options?ticker=AAPL        → expirations + spot price
 *   GET /api/chain?ticker=AAPL&exp=…    → option chain for one expiry
 *   GET /api/history?ticker=AAPL&days=60 → OHLCV history
 *   GET /api/rate                        → risk-free rate (^IRX)
 *   Everything else                      → static assets (SPA)
 */

const YF_BASE = "https://query2.finance.yahoo.com";
const DERIBIT_BASE = "https://www.deribit.com/api/v2/public";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ---- Crypto detection ----

const LIKELY_CRYPTO = new Set([
  "BTC", "ETH", "SOL", "XRP", "BNB", "MATIC", "DOGE", "ADA", "AVAX",
  "DOT", "LINK", "LTC", "UNI", "ATOM", "FIL", "APT", "ARB", "OP",
  "NEAR", "PAXG", "USDC", "USDT", "USDE",
]);

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
// Deribit (crypto options)
// ======================================================================

async function fetchDeribit(endpoint, params = {}) {
  const url = new URL(`${DERIBIT_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Deribit ${res.status}: ${res.statusText}`);
  const data = await res.json();
  if (data.error) throw new Error(`Deribit: ${data.error.message || JSON.stringify(data.error)}`);
  return data.result;
}

// ======================================================================
// Route handlers — Yahoo Finance (stocks)
// ======================================================================

async function handleOptions(ticker) {
  const data = await fetchYF(`/v7/finance/options/${ticker}`);
  const result = data.optionChain.result[0];
  const rawTimestamps = result.expirationDates || [];
  const expirations = rawTimestamps.map((ts) => ({
    date: new Date(ts * 1000).toISOString().slice(0, 10),
    timestamp: ts,
  }));
  const quote = result.quote || {};
  return jsonResp({
    ticker: quote.symbol || ticker,
    price: quote.regularMarketPrice || 0,
    expirations,
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
// Route handlers — Deribit (crypto)
// ======================================================================

async function handleCryptoOptions(currency) {
  // Spot price
  const indexResult = await fetchDeribit("get_index_price", {
    index_name: `${currency.toLowerCase()}_usd`,
  });
  const price = indexResult.index_price;

  // Instruments → unique expiry dates
  const instruments = await fetchDeribit("get_instruments", {
    currency,
    kind: "option",
    expired: "false",
  });

  const expirySet = new Map();
  for (const inst of instruments) {
    const ts = Math.floor(inst.expiration_timestamp / 1000);
    const date = new Date(inst.expiration_timestamp).toISOString().slice(0, 10);
    expirySet.set(date, ts);
  }

  const expirations = Array.from(expirySet.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([date, timestamp]) => ({ date, timestamp }));

  return jsonResp({
    ticker: `${currency}-USD`,
    price,
    expirations,
  });
}

async function handleCryptoChain(currency, expDateStr) {
  // Spot price
  const indexResult = await fetchDeribit("get_index_price", {
    index_name: `${currency.toLowerCase()}_usd`,
  });
  const spot = indexResult.index_price;

  // All instruments for this currency
  const instruments = await fetchDeribit("get_instruments", {
    currency,
    kind: "option",
    expired: "false",
  });

  // Filter to matching expiry date
  const matchingInsts = instruments.filter((inst) => {
    const d = new Date(inst.expiration_timestamp).toISOString().slice(0, 10);
    return d === expDateStr;
  });

  if (matchingInsts.length === 0) {
    return jsonResp({
      ticker: `${currency}-USD`,
      price: spot,
      expiry: expDateStr,
      calls: [],
      puts: [],
    });
  }

  // Book summaries for pricing
  const bookSummaries = await fetchDeribit("get_book_summary_by_currency", {
    currency,
    kind: "option",
  });
  const bookMap = {};
  for (const b of bookSummaries) bookMap[b.instrument_name] = b;

  const calls = [];
  const puts = [];

  for (const inst of matchingInsts) {
    const name = inst.instrument_name;
    const strike = inst.strike;
    const optType = inst.option_type; // "call" or "put"

    const book = bookMap[name] || {};

    // Deribit quotes prices as fraction of underlying → convert to USD
    const bidFrac = book.bid_price || 0;
    const askFrac = book.ask_price || 0;
    const markFrac = book.mark_price || 0;
    const lastFrac = book.last || markFrac;

    const bid = bidFrac > 0 ? bidFrac * spot : 0;
    const ask = askFrac > 0 ? askFrac * spot : 0;
    const lastPrice = lastFrac > 0 ? lastFrac * spot : 0;
    let mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : lastPrice;
    if (mid <= 0) mid = markFrac > 0 ? markFrac * spot : 0;

    const iv = (book.mark_iv || 0) / 100; // Deribit IV is in %
    const oi = book.open_interest || 0;
    const vol = book.volume || 0;

    const itm =
      (optType === "call" && strike < spot) ||
      (optType === "put" && strike > spot);

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

    if (optType === "call") calls.push(row);
    else puts.push(row);
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
  // Use Yahoo Finance for crypto history (BTC-USD etc.)
  const yfTicker = `${currency}-USD`;
  return handleHistory(yfTicker, days);
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
          // Try Deribit first; fall back to Yahoo Finance (e.g. SOL, XRP)
          try {
            const resp = await handleCryptoOptions(norm);
            const body = await resp.clone().json();
            if (body.expirations && body.expirations.length > 0) return resp;
          } catch { /* Deribit failed, fall through */ }
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
          // If exp looks like a unix timestamp, it came from Yahoo Finance path
          // If it looks like a date string, it came from Deribit path
          if (/^\d+$/.test(exp)) {
            // Could be either Deribit timestamp or YF timestamp — try Deribit date first
            const expDate = new Date(Number(exp) * 1000).toISOString().slice(0, 10);
            try {
              const resp = await handleCryptoChain(norm, expDate);
              const body = await resp.clone().json();
              if ((body.calls && body.calls.length > 0) || (body.puts && body.puts.length > 0)) return resp;
            } catch { /* fall through */ }
            // Fall back to Yahoo Finance
            return await handleChain(`${norm}-USD`, exp);
          }
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

      return env.ASSETS.fetch(request);
    } catch (err) {
      return jsonResp({ error: err.message }, 500);
    }
  },
};
