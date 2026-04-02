/**
 * /api/rate — risk-free rate from ^IRX.
 */

import { fetchYF } from '../yahoo.js'
import { jsonResp, cachedJsonResp } from '../utils.js'

export async function handleRate() {
  try {
    const data = await fetchYF(`/v8/finance/chart/%5EIRX?range=5d&interval=1d`)
    const closes = data.chart.result[0].indicators.quote[0].close.filter((v) => v != null)
    const rate = closes.length > 0 ? closes[closes.length - 1] / 100 : 0.05
    return cachedJsonResp({ rate }, 3600) // interest rate barely changes; 1-hour cache
  } catch {
    return jsonResp({ rate: 0.05 })
  }
}
