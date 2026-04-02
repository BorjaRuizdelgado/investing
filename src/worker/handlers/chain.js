/**
 * /api/chain — option chain for one expiry (stocks).
 */

import { fetchYF } from '../yahoo.js'
import { jsonResp } from '../utils.js'

export async function handleChain(ticker, expTimestamp) {
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
