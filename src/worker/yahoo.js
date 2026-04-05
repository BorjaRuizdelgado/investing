/**
 * Yahoo Finance — cookie+crumb auth and fetchYF.
 */

import { YF_BASE, UA } from './utils.js'

let cachedAuth = null
let authExpiry = 0

/**
 * Extract set-cookie headers from a Response, handling CF Workers quirks.
 * Priority: getSetCookie() (standard) → getAll() (CF legacy) → get() fallback.
 */
function extractSetCookies(headers) {
  // Standard method (available in modern CF Workers)
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie()
  }
  // Legacy CF Workers method
  if (typeof headers.getAll === 'function') {
    return headers.getAll('set-cookie')
  }
  // Last resort: get() joins with ', ' which can corrupt cookie values,
  // so split carefully on ', ' followed by a cookie name pattern.
  const raw = headers.get('set-cookie')
  if (!raw) return []
  return raw.split(/,\s*(?=[A-Za-z0-9_]+=)/)
}

/**
 * Attempt to acquire Yahoo Finance consent cookies.
 * Tries fc.yahoo.com (redirect) first, then finance.yahoo.com as fallback.
 */
async function acquireCookies() {
  // Method 1: fc.yahoo.com consent redirect (fastest)
  try {
    const res = await fetch('https://fc.yahoo.com/', {
      headers: { 'User-Agent': UA },
      redirect: 'manual',
    })
    const cookies = extractSetCookies(res.headers)
    const str = cookies.map((c) => c.split(';')[0]).join('; ')
    if (str) return str
    console.error('[YF Auth] fc.yahoo.com returned no cookies, status:', res.status)
  } catch (e) {
    console.error('[YF Auth] fc.yahoo.com failed:', e.message)
  }

  // Method 2: finance.yahoo.com page (slower, but more reliable from cloud IPs)
  try {
    const res = await fetch('https://finance.yahoo.com/', {
      headers: { 'User-Agent': UA },
      redirect: 'manual',
    })
    const cookies = extractSetCookies(res.headers)
    const str = cookies.map((c) => c.split(';')[0]).join('; ')
    if (str) return str
    console.error('[YF Auth] finance.yahoo.com returned no cookies, status:', res.status)
  } catch (e) {
    console.error('[YF Auth] finance.yahoo.com failed:', e.message)
  }

  return ''
}

export async function getAuth() {
  const now = Date.now()
  if (cachedAuth && now < authExpiry) return cachedAuth

  const cookieStr = await acquireCookies()

  if (!cookieStr) {
    console.error('[YF Auth] All cookie methods failed — auth will be empty')
    cachedAuth = { cookie: '', crumb: '' }
    authExpiry = now + 60_000
    return cachedAuth
  }

  const crumbRes = await fetch(`${YF_BASE}/v1/test/getcrumb`, {
    headers: { 'User-Agent': UA, Cookie: cookieStr },
  })

  if (!crumbRes.ok) {
    const body = await crumbRes.text().catch(() => '')
    console.error(`[YF Auth] Crumb fetch failed: ${crumbRes.status} ${crumbRes.statusText}`, body.slice(0, 200))
    cachedAuth = { cookie: '', crumb: '' }
    authExpiry = now + 60_000
    return cachedAuth
  }

  const crumb = await crumbRes.text()
  if (!crumb || crumb.includes('<') || crumb.length > 50) {
    console.error('[YF Auth] Crumb looks invalid:', crumb.slice(0, 100))
    cachedAuth = { cookie: '', crumb: '' }
    authExpiry = now + 60_000
    return cachedAuth
  }

  cachedAuth = { cookie: cookieStr, crumb: crumb.trim() }
  authExpiry = now + 30 * 60_000
  console.log('[YF Auth] ✓ Authenticated — crumb obtained')
  return cachedAuth
}

export async function fetchYF(path) {
  const auth = await getAuth()
  const sep = path.includes('?') ? '&' : '?'
  const url = auth.crumb
    ? `${YF_BASE}${path}${sep}crumb=${encodeURIComponent(auth.crumb)}`
    : `${YF_BASE}${path}`

  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Cookie: auth.cookie, Accept: 'application/json' },
  })

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      cachedAuth = null
      authExpiry = 0
      const retry = await getAuth()
      const retryUrl = retry.crumb
        ? `${YF_BASE}${path}${sep}crumb=${encodeURIComponent(retry.crumb)}`
        : `${YF_BASE}${path}`
      const res2 = await fetch(retryUrl, {
        headers: { 'User-Agent': UA, Cookie: retry.cookie, Accept: 'application/json' },
      })
      if (!res2.ok) throw new Error(`Yahoo Finance ${res2.status}: ${res2.statusText}`)
      return res2.json()
    }
    throw new Error(`Yahoo Finance ${res.status}: ${res.statusText}`)
  }

  return res.json()
}
