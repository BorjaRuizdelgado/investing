/**
 * /api/history — OHLCV price history.
 */

import { fetchYF } from '../yahoo.js'
import { cachedJsonResp } from '../utils.js'

export async function handleHistory(ticker, days) {
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
