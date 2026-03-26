export const DISCLAIMER_PATH = '/disclaimer'
export const DONATE_PATH = '/donate'
export const WATCHLIST_PATH = '/watchlist'
export const COMPARE_PREFIX = '/compare/'

export function currentPath() {
  return window.location.pathname.replace(/\/$/, '') || '/'
}

export function isReservedPath(pathname) {
  const p = pathname.replace(/\/$/, '')
  return (
    p === DISCLAIMER_PATH ||
    p === DONATE_PATH ||
    p === WATCHLIST_PATH ||
    p === '/compare' ||
    p.startsWith(COMPARE_PREFIX)
  )
}

export function isComparePath(pathname) {
  const p = pathname.replace(/\/$/, '')
  return p === '/compare' || p.startsWith(COMPARE_PREFIX)
}

export function compareTickersFromPath(pathname) {
  const p = pathname.replace(/\/$/, '')
  if (!p.startsWith(COMPARE_PREFIX)) return []
  const rest = p.slice(COMPARE_PREFIX.length)
  const parts = rest.split('/').filter(Boolean)
  return parts.map((part) => decodeURIComponent(part).toUpperCase())
}

export function tickerFromPath(pathname) {
  const cleaned = pathname.replace(/^\//, '').replace(/\/$/, '')
  if (!cleaned) return null
  const parts = cleaned.split('/')
  const first = parts[0]
  if (!first) return null
  if (isReservedPath(`/${first}`)) return null
  if (first.toLowerCase() === 'compare') return null
  return decodeURIComponent(first).toUpperCase()
}

export function tabFromPath(pathname) {
  const cleaned = pathname.replace(/^\//, '').replace(/\/$/, '')
  if (!cleaned) return null
  const parts = cleaned.split('/')
  if (parts.length < 2) return null
  return decodeURIComponent(parts[1])
}
