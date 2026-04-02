/**
 * Deribit public API helper for crypto options.
 */

import { DERIBIT_BASE } from './utils.js'

export async function fetchDeribit(endpoint, params = {}) {
  const url = new URL(`${DERIBIT_BASE}/${endpoint}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Deribit ${res.status}: ${res.statusText}`)
  const data = await res.json()
  if (data.error) throw new Error(`Deribit: ${data.error.message || JSON.stringify(data.error)}`)
  return data.result
}
