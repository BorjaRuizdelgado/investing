/**
 * Crypto options/chain handlers — Bybit + Deribit + Yahoo Finance fallback.
 */

import { fetchBybit, parseBybitExpiry } from '../bybit.js'
import { fetchDeribit } from '../deribit.js'
import { fetchYF } from '../yahoo.js'
import { jsonResp } from '../utils.js'
import { handleHistory } from './history.js'

// ======================================================================
// Bybit crypto options
// ======================================================================

export async function handleCryptoOptions(currency) {
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

export async function handleCryptoChain(currency, expDateStr) {
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

export async function handleCryptoHistory(currency, days) {
  // Use Yahoo Finance for crypto price history (BTC-USD etc.)
  return handleHistory(`${currency}-USD`, days)
}

// ======================================================================
// Deribit crypto options
// ======================================================================

export async function handleDeribitOptions(currency) {
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

export async function handleDeribitChain(currency, expDateStr) {
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
