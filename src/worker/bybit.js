/**
 * Bybit public API helpers for crypto options.
 */

import { BYBIT_BASE } from './utils.js'

export async function fetchBybit(endpoint, params = {}) {
  const url = new URL(`${BYBIT_BASE}/${endpoint}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Bybit ${res.status}: ${res.statusText}`)
  const data = await res.json()
  if (data.retCode !== 0) throw new Error(`Bybit: ${data.retMsg}`)
  return data.result
}

/**
 * Parse Bybit symbol expiry string "5MAR26" → "2026-03-05".
 */
const MONTH_MAP = {
  JAN: '01',
  FEB: '02',
  MAR: '03',
  APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AUG: '08',
  SEP: '09',
  OCT: '10',
  NOV: '11',
  DEC: '12',
}

export function parseBybitExpiry(expStr) {
  const m = expStr.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/)
  if (!m) return null
  const day = m[1].padStart(2, '0')
  const mon = MONTH_MAP[m[2]]
  if (!mon) return null
  const year = `20${m[3]}`
  return `${year}-${mon}-${day}`
}
