import { describe, expect, it } from 'vitest'
import {
  annualizedVolatility,
  buildEdgeItems,
  buildGrowthBucket,
  buildMomentumBucket,
  computeCorrelation,
  correlationLabel,
  formatCompareValue,
  getHistoryWindow,
  getWinner,
  indexHistory,
  maxDrawdown,
  summarizeMatchup,
  trailingReturn,
} from '../compare.js'

function buildHistory(closes) {
  return closes.map((close, index) => ({
    date: `2025-01-${String(index + 1).padStart(2, '0')}`,
    close,
  }))
}

// ── formatCompareValue ──────────────────────────────────────────────

describe('formatCompareValue', () => {
  it('returns N/A for non-finite values', () => {
    expect(formatCompareValue(null, 'money')).toBe('N/A')
    expect(formatCompareValue(undefined, 'pct')).toBe('N/A')
    expect(formatCompareValue(NaN, 'ratio')).toBe('N/A')
  })

  it('formats money values', () => {
    expect(formatCompareValue(1234.5, 'money')).toMatch(/\$.*1,234\.50/)
  })

  it('formats compact values', () => {
    expect(formatCompareValue(2.4e12, 'compact')).toMatch(/\$2\.40T/)
  })

  it('formats pct values', () => {
    const result = formatCompareValue(0.15, 'pct')
    expect(result).toMatch(/15/)
  })

  it('formats score values as rounded integers', () => {
    expect(formatCompareValue(72.6, 'score')).toBe('73')
  })

  it('falls back to ratio formatting', () => {
    const result = formatCompareValue(18.93, 'ratio')
    expect(result).toMatch(/18\.9/)
  })
})

// ── getHistoryWindow ────────────────────────────────────────────────

describe('getHistoryWindow', () => {
  it('returns the last N bars when history is longer', () => {
    const history = buildHistory([10, 20, 30, 40, 50])
    const window = getHistoryWindow(history, 3)
    expect(window).toHaveLength(3)
    expect(window[0].close).toBe(30)
    expect(window[2].close).toBe(50)
  })

  it('returns all bars when history is shorter than requested', () => {
    const history = buildHistory([10, 20])
    expect(getHistoryWindow(history, 10)).toHaveLength(2)
  })

  it('filters out bars with missing close', () => {
    const history = [
      { date: '2025-01-01', close: 10 },
      { date: '2025-01-02', close: null },
      { date: '2025-01-03', close: 30 },
    ]
    expect(getHistoryWindow(history)).toHaveLength(2)
  })

  it('handles null/undefined input', () => {
    expect(getHistoryWindow(null)).toEqual([])
    expect(getHistoryWindow(undefined)).toEqual([])
  })
})

// ── indexHistory ─────────────────────────────────────────────────────

describe('indexHistory', () => {
  it('rebases the first point to 100', () => {
    const indexed = indexHistory(buildHistory([10, 12, 11]))
    expect(indexed.map((row) => Number(row.indexedClose.toFixed(2)))).toEqual([100, 120, 110])
  })

  it('returns empty array for empty input', () => {
    expect(indexHistory([])).toEqual([])
  })
})

// ── trailingReturn ──────────────────────────────────────────────────

describe('trailingReturn', () => {
  it('computes return over the selected window', () => {
    expect(trailingReturn(buildHistory([100, 105, 110]), 3)).toBeCloseTo(0.1)
  })

  it('returns null for insufficient data', () => {
    expect(trailingReturn(buildHistory([100]), 3)).toBeNull()
  })
})

// ── computeCorrelation ──────────────────────────────────────────────

describe('computeCorrelation', () => {
  it('returns strong positive correlation for matching return series', () => {
    const historyA = buildHistory(Array.from({ length: 30 }, (_, index) => 100 + index * 2))
    const historyB = buildHistory(Array.from({ length: 30 }, (_, index) => 50 + index * 1.5))
    const result = computeCorrelation(historyA, historyB)

    expect(result?.r).toBeGreaterThan(0.99)
    expect(result?.days).toBeGreaterThan(15)
  })

  it('returns null for too few data points', () => {
    expect(computeCorrelation(buildHistory([1, 2]), buildHistory([1, 2]))).toBeNull()
  })
})

// ── correlationLabel ────────────────────────────────────────────────

describe('correlationLabel', () => {
  it('flags low correlation as positive diversification', () => {
    expect(correlationLabel(0.12)).toEqual({ text: 'Low correlation', tone: 'positive' })
  })

  it('flags strong positive as negative', () => {
    expect(correlationLabel(0.85)).toEqual({ text: 'Strongly correlated', tone: 'negative' })
  })

  it('handles null', () => {
    expect(correlationLabel(null)).toEqual({ text: 'Insufficient data', tone: 'neutral' })
  })
})

// ── getWinner ───────────────────────────────────────────────────────

describe('getWinner', () => {
  it('returns "a" when a is higher (higher-better)', () => {
    expect(getWinner(80, 60)).toBe('a')
  })

  it('returns "b" when b is higher (higher-better)', () => {
    expect(getWinner(40, 70)).toBe('b')
  })

  it('returns "a" when a is lower and lowerBetter', () => {
    expect(getWinner(10, 30, { lowerBetter: true })).toBe('a')
  })

  it('returns "tie" within threshold', () => {
    expect(getWinner(50, 51, { tieThreshold: 2 })).toBe('tie')
  })

  it('returns null when either value is non-finite', () => {
    expect(getWinner(null, 10)).toBeNull()
    expect(getWinner(10, undefined)).toBeNull()
  })
})

// ── annualizedVolatility ────────────────────────────────────────────

describe('annualizedVolatility', () => {
  it('returns a positive number for a series with variance', () => {
    // Alternating up/down creates variance
    const closes = Array.from({ length: 30 }, (_, i) => 100 + (i % 2 === 0 ? 2 : -2))
    const vol = annualizedVolatility(buildHistory(closes), 30)
    expect(vol).toBeGreaterThan(0)
  })

  it('returns near-zero volatility for a flat series', () => {
    const closes = Array.from({ length: 30 }, () => 100)
    const vol = annualizedVolatility(buildHistory(closes), 30)
    expect(vol).toBeCloseTo(0)
  })

  it('returns null for too few data points', () => {
    expect(annualizedVolatility(buildHistory([100, 101]), 5)).toBeNull()
  })
})

// ── maxDrawdown ─────────────────────────────────────────────────────

describe('maxDrawdown', () => {
  it('computes the worst peak-to-trough decline', () => {
    // Peak at 200, drops to 100 → -50%
    const history = buildHistory([100, 150, 200, 120, 100, 130])
    expect(maxDrawdown(history, 10)).toBeCloseTo(-0.5)
  })

  it('returns 0 for a monotonically increasing series', () => {
    expect(maxDrawdown(buildHistory([10, 20, 30, 40]), 10)).toBe(0)
  })

  it('returns null for insufficient data', () => {
    expect(maxDrawdown(buildHistory([100]), 10)).toBeNull()
  })
})

// ── buildGrowthBucket ───────────────────────────────────────────────

describe('buildGrowthBucket', () => {
  it('scores strong growth profiles positively', () => {
    const bucket = buildGrowthBucket({
      revenueGrowth: 0.22,
      earningsGrowth: 0.18,
    })

    expect(bucket.hasData).toBe(true)
    expect(bucket.score).toBeGreaterThan(70)
    expect(bucket.label).toBe('Strong')
  })

  it('handles missing fundamentals', () => {
    const bucket = buildGrowthBucket(null)
    expect(bucket.hasData).toBe(false)
  })
})

// ── buildMomentumBucket ─────────────────────────────────────────────

describe('buildMomentumBucket', () => {
  it('builds bucket from sentiment data', () => {
    const bucket = buildMomentumBucket({
      score: 75,
      classification: 'Bullish',
      components: [{ label: 'RSI', detail: 'RSI oversold', score: 80 }],
    })

    expect(bucket.hasData).toBe(true)
    expect(bucket.score).toBe(75)
    expect(bucket.label).toBe('Bullish')
    expect(bucket.reasons).toHaveLength(1)
  })

  it('handles null sentiment', () => {
    const bucket = buildMomentumBucket(null)
    expect(bucket.hasData).toBe(false)
    expect(bucket.reasons).toEqual([])
  })
})

// ── summarizeMatchup ────────────────────────────────────────────────

describe('summarizeMatchup', () => {
  it('counts category wins across both sides', () => {
    const summary = summarizeMatchup(
      {
        categories: {
          valuation: { score: 70 },
          growth: { score: 65 },
          quality: { score: 50 },
          risk: { score: 40 },
          momentum: { score: 80 },
        },
      },
      {
        categories: {
          valuation: { score: 50 },
          growth: { score: 60 },
          quality: { score: 70 },
          risk: { score: 55 },
          momentum: { score: 30 },
        },
      },
    )

    expect(summary.leftWins).toBe(3)
    expect(summary.rightWins).toBe(2)
    expect(summary.rows).toHaveLength(5)
  })
})

// ── buildEdgeItems ──────────────────────────────────────────────────

describe('buildEdgeItems', () => {
  it('returns categories where subject leads', () => {
    const subject = {
      categories: {
        valuation: { score: 80, reasons: [{ detail: 'Cheap on P/E' }] },
        growth: { score: 30 },
        quality: { score: 90, reasons: [{ detail: 'High margins' }] },
        risk: { score: 50 },
        momentum: { score: 60 },
      },
    }
    const opponent = {
      categories: {
        valuation: { score: 40 },
        growth: { score: 70 },
        quality: { score: 50 },
        risk: { score: 50 },
        momentum: { score: 55 },
      },
    }

    const edges = buildEdgeItems(subject, opponent)
    expect(edges.length).toBeGreaterThanOrEqual(2)
    const labels = edges.map((e) => e.label)
    expect(labels).toContain('Quality')
    expect(labels).toContain('Valuation')
  })

  it('returns at most 3 items', () => {
    const subject = {
      categories: {
        valuation: { score: 90 },
        growth: { score: 90 },
        quality: { score: 90 },
        risk: { score: 90 },
        momentum: { score: 90 },
      },
    }
    const opponent = {
      categories: {
        valuation: { score: 10 },
        growth: { score: 10 },
        quality: { score: 10 },
        risk: { score: 10 },
        momentum: { score: 10 },
      },
    }

    expect(buildEdgeItems(subject, opponent)).toHaveLength(3)
  })

  it('returns empty array when subject leads nowhere', () => {
    const subject = { categories: { valuation: { score: 30 } } }
    const opponent = { categories: { valuation: { score: 80 } } }
    expect(buildEdgeItems(subject, opponent)).toEqual([])
  })
})
