/**
 * screener.js — Collections, filtering, and formatting for the stock screener.
 */

export const COLLECTIONS = [
  {
    id: 'all',
    label: 'All',
    tagline: 'Full universe',
    icon: '◎',
    filter: () => true,
  },
  {
    id: 'value',
    label: 'Value Picks',
    tagline: 'Low P/E, positive earnings',
    icon: '◈',
    filter: (s) => s.trailingPE != null && s.trailingPE > 0 && s.trailingPE < 15 && s.eps > 0,
  },
  {
    id: 'growth',
    label: 'Growth Stars',
    tagline: 'Earnings expected to grow 15 %+',
    icon: '△',
    filter: (s) =>
      s.forwardPE != null && s.trailingPE != null &&
      s.forwardPE > 0 && s.trailingPE > 0 &&
      s.forwardPE < s.trailingPE * 0.85,
  },
  {
    id: 'dividend',
    label: 'Dividend Payers',
    tagline: 'Yield above 2 %',
    icon: '⬡',
    filter: (s) => s.dividendYield != null && s.dividendYield > 2,
  },
  {
    id: 'momentum',
    label: 'Momentum',
    tagline: 'Near 52-week highs',
    icon: '▲',
    filter: (s) => {
      if (s.fiftyTwoWeekHigh == null || s.fiftyTwoWeekLow == null || s.price == null) return false
      const range = s.fiftyTwoWeekHigh - s.fiftyTwoWeekLow
      if (range <= 0) return false
      return (s.price - s.fiftyTwoWeekLow) / range >= 0.85
    },
  },
  {
    id: 'largecap',
    label: 'Large Caps',
    tagline: 'Market cap > $200 B',
    icon: '●',
    filter: (s) => s.marketCap != null && s.marketCap >= 200e9,
  },
  {
    id: 'smallcap',
    label: 'Small Caps',
    tagline: '$100 M – $10 B',
    icon: '○',
    filter: (s) => s.marketCap != null && s.marketCap >= 100e6 && s.marketCap < 10e9,
  },
  {
    id: 'etf',
    label: 'ETFs',
    tagline: 'Index & thematic funds',
    icon: '⊞',
    filter: (s) => s.quoteType === 'ETF',
  },
]

const SORT_FNS = {
  marketCap: (a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0),
  changePct: (a, b) => (b.changePct ?? 0) - (a.changePct ?? 0),
  pe: (a, b) => (a.trailingPE ?? 9999) - (b.trailingPE ?? 9999),
  dividend: (a, b) => (b.dividendYield ?? 0) - (a.dividendYield ?? 0),
  name: (a, b) => (a.ticker || '').localeCompare(b.ticker || ''),
}

export const SORT_OPTIONS = [
  { id: 'marketCap', label: 'Market Cap' },
  { id: 'changePct', label: 'Change %' },
  { id: 'pe', label: 'P / E' },
  { id: 'dividend', label: 'Dividend' },
  { id: 'name', label: 'Name' },
]

/**
 * Filter and sort the screener stock list.
 */
export function filterStocks(stocks, { collection = 'all', sectors = null, sortBy = 'marketCap', sortDir = 'desc' } = {}) {
  const col = COLLECTIONS.find((c) => c.id === collection) || COLLECTIONS[0]
  let result = stocks.filter(col.filter)

  if (sectors && sectors.size > 0) {
    result = result.filter((s) => s.sector && sectors.has(s.sector))
  }

  const sortFn = SORT_FNS[sortBy] || SORT_FNS.marketCap
  result.sort(sortFn)
  if (sortDir === 'asc') result.reverse()
  return result
}

/**
 * Extract unique sectors from stock data.
 */
export function extractSectors(stocks) {
  const set = new Set()
  for (const s of stocks) {
    if (s.sector) set.add(s.sector)
  }
  return [...set].sort()
}

/**
 * Compute where the current price sits in the 52-week range (0–100).
 */
export function rangePosition(price, low, high) {
  if (low == null || high == null || price == null) return null
  const range = high - low
  if (range <= 0) return 50
  return Math.max(0, Math.min(100, ((price - low) / range) * 100))
}

/**
 * Format market cap to human-readable label.
 */
export function marketCapLabel(cap) {
  if (cap == null || !Number.isFinite(cap)) return '—'
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`
  return `$${cap.toLocaleString()}`
}
