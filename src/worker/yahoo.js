/**
 * Yahoo Finance — cookie+crumb auth, fetchYF, fetchYFScreener.
 */

import { YF_BASE, UA } from './utils.js'

let cachedAuth = null
let authExpiry = 0

export async function getAuth() {
  const now = Date.now()
  if (cachedAuth && now < authExpiry) return cachedAuth

  const consentRes = await fetch('https://fc.yahoo.com/', {
    headers: { 'User-Agent': UA },
    redirect: 'manual',
  })
  const cookies = consentRes.headers.getAll
    ? consentRes.headers.getAll('set-cookie')
    : [consentRes.headers.get('set-cookie')].filter(Boolean)

  const cookieStr = cookies.map((c) => c.split(';')[0]).join('; ')

  const crumbRes = await fetch(`${YF_BASE}/v1/test/getcrumb`, {
    headers: { 'User-Agent': UA, Cookie: cookieStr },
  })

  if (!crumbRes.ok) {
    cachedAuth = { cookie: '', crumb: '' }
    authExpiry = now + 60_000
    return cachedAuth
  }

  const crumb = await crumbRes.text()
  cachedAuth = { cookie: cookieStr, crumb: crumb.trim() }
  authExpiry = now + 30 * 60_000
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

/**
 * POST to Yahoo Finance screener API with auth + retry.
 */
export async function fetchYFScreener(body) {
  const auth = await getAuth()
  const path = '/v1/finance/screener'
  const url = auth.crumb
    ? `${YF_BASE}${path}?crumb=${encodeURIComponent(auth.crumb)}`
    : `${YF_BASE}${path}`
  const opts = {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      Cookie: auth.cookie,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }
  const res = await fetch(url, opts)
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      cachedAuth = null
      authExpiry = 0
      const retry = await getAuth()
      const retryUrl = retry.crumb
        ? `${YF_BASE}${path}?crumb=${encodeURIComponent(retry.crumb)}`
        : `${YF_BASE}${path}`
      opts.headers.Cookie = retry.cookie
      const res2 = await fetch(retryUrl, opts)
      if (!res2.ok) throw new Error(`Yahoo Finance ${res2.status}: ${res2.statusText}`)
      return res2.json()
    }
    throw new Error(`Yahoo Finance ${res.status}: ${res.statusText}`)
  }
  return res.json()
}
