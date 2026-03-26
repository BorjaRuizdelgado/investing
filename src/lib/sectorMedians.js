/**
 * Build sector median comparisons from Yahoo Finance fundamentals data.
 * Many fields may not exist — returns null for missing data.
 */

// Which metrics are "lower is better" (for coloring comparison)
const LOWER_IS_BETTER = new Set([
  'forwardPE',
  'trailingPE',
  'priceToBook',
  'enterpriseToRevenue',
  'enterpriseToEbitda',
  'debtToEquity',
  'shortPercentOfFloat',
  'impliedMove',
  'beta',
])

export function isLowerBetter(key) {
  return LOWER_IS_BETTER.has(key)
}

/**
 * Extract sector-level comparison data from fundamentals.
 * Yahoo Finance provides limited sector data — we use what's available.
 */
export function buildSectorMedians(fundamentals) {
  if (!fundamentals) return null

  const medians = {}

  // Yahoo Finance sometimes provides industry/sector comparison fields
  // These are rare but when present are very useful
  if (Number.isFinite(fundamentals.sectorPE)) {
    medians.forwardPE = fundamentals.sectorPE
    medians.trailingPE = fundamentals.sectorPE
  }
  if (Number.isFinite(fundamentals.industryPE)) {
    medians.forwardPE = fundamentals.industryPE
    medians.trailingPE = fundamentals.industryPE
  }

  // Use well-known market-wide medians as fallbacks when sector data isn't available
  // These are approximate S&P 500 medians — not perfect but useful context
  const MARKET_MEDIANS = {
    forwardPE: 18,
    trailingPE: 22,
    priceToBook: 3.5,
    enterpriseToRevenue: 3.0,
    enterpriseToEbitda: 14,
    earningsYield: 0.045,
    fcfYield: 0.035,
    revenueGrowth: 0.06,
    earningsGrowth: 0.08,
    grossMargins: 0.4,
    operatingMargins: 0.12,
    profitMargins: 0.09,
    returnOnEquity: 0.15,
    returnOnAssets: 0.05,
    fcfMargin: 0.08,
    debtToEquity: 80,
    currentRatio: 1.5,
    quickRatio: 1.1,
    beta: 1.0,
    shortPercentOfFloat: 4,
  }

  // Merge market medians as defaults, sector-specific data overrides
  for (const [key, value] of Object.entries(MARKET_MEDIANS)) {
    if (!(key in medians)) {
      medians[key] = value
    }
  }

  return medians
}
