/**
 * prefetch.js — Trigger dynamic imports during browser idle time so that
 * lazy-loaded page chunks are already cached when the user navigates.
 */

const chunks = [
  () => import('../components/TechnicalsPage.jsx'),
  () => import('../components/BusinessPage.jsx'),
  () => import('../components/OptionsPage.jsx'),
  () => import('../components/FundamentalsPanel.jsx'),
  () => import('../components/EarningsCalendar.jsx'),
  () => import('../components/NewsPage.jsx'),
  () => import('../components/ComparePage.jsx'),
  () => import('../components/WatchlistPage.jsx'),
]

let prefetched = false

export function prefetchLazyChunks() {
  if (prefetched) return
  prefetched = true

  const schedule =
    typeof requestIdleCallback === 'function'
      ? (fn) => requestIdleCallback(fn, { timeout: 3000 })
      : (fn) => setTimeout(fn, 2000)

  chunks.forEach((load) => {
    schedule(() => {
      load().catch(() => {
        /* chunk may already be cached or offline — ignore */
      })
    })
  })
}
