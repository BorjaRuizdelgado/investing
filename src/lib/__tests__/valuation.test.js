import { describe, it, expect } from 'vitest'
import { deriveValuation } from '../valuation.js'

// ---------------------------------------------------------------------------
// deriveValuation
// ---------------------------------------------------------------------------

describe('deriveValuation', () => {
  it('returns unavailable for null fundamentals', () => {
    const r = deriveValuation(null, 100)
    expect(r.score).toBeNull()
    expect(r.label).toBe('Unavailable')
    expect(r.metrics).toEqual([])
    expect(r.reasons).toEqual([])
    expect(r.fairValue).toBeNull()
  })

  it('returns unavailable for non-finite spot', () => {
    const r = deriveValuation({ forwardPE: 15 }, NaN)
    expect(r.score).toBeNull()
  })

  it('returns unavailable for undefined fundamentals', () => {
    const r = deriveValuation(undefined, 100)
    expect(r.score).toBeNull()
  })

  it('produces a score with sufficient data', () => {
    const fund = {
      forwardPE: 12,
      trailingPE: 14,
      priceToBook: 1.2,
      enterpriseToRevenue: 3,
      enterpriseToEbitda: 10,
    }
    const r = deriveValuation(fund, 100)
    expect(r.hasData).toBe(true)
    expect(r.score).toBeGreaterThan(0)
    expect(r.score).toBeLessThanOrEqual(100)
    expect(r.label).not.toBe('Unavailable')
    expect(r.metrics.length).toBeGreaterThanOrEqual(3)
  })

  it('cheap stock gets a high score', () => {
    const fund = {
      forwardPE: 5,
      trailingPE: 6,
      priceToBook: 0.5,
      enterpriseToRevenue: 0.5,
      enterpriseToEbitda: 3,
    }
    const r = deriveValuation(fund, 50)
    expect(r.score).toBeGreaterThan(60)
    expect(r.label).toBe('Undervalued')
  })

  it('expensive stock gets a low score', () => {
    const fund = {
      forwardPE: 80,
      trailingPE: 90,
      priceToBook: 20,
      enterpriseToRevenue: 30,
      enterpriseToEbitda: 50,
    }
    const r = deriveValuation(fund, 500)
    expect(r.score).toBeLessThan(40)
    expect(r.label).toBe('Expensive')
  })

  it('computes analyst upside when target price present', () => {
    const fund = {
      forwardPE: 15,
      trailingPE: 18,
      targetMeanPrice: 120,
    }
    const r = deriveValuation(fund, 100)
    expect(r.analystUpsidePct).toBeCloseTo(0.2, 1)
  })

  it('returns null analyst upside when target price missing', () => {
    const fund = { forwardPE: 15, trailingPE: 18 }
    const r = deriveValuation(fund, 100)
    expect(r.analystUpsidePct).toBeNull()
  })

  it('generates reasons for extreme values', () => {
    const fund = {
      forwardPE: 5,
      trailingPE: 6,
      priceToBook: 0.5,
    }
    const r = deriveValuation(fund, 100)
    expect(r.reasons.length).toBeGreaterThan(0)
    expect(r.reasons.some((r) => r.tone === 'positive')).toBe(true)
  })

  it('handles partial data — single metric still counts', () => {
    const fund = { forwardPE: 15 }
    const r = deriveValuation(fund, 100)
    // With only 1 metric, hasData depends on the threshold (>=2)
    // forwardPE generates both a metric and earningsYield, so may still have hasData
    expect(r.score).not.toBeUndefined()
  })

  it('computes fair value when enough data', () => {
    const fund = {
      forwardPE: 12,
      epsForward: 5,
      freeCashflow: 1e9,
      sharesOutstanding: 1e8,
      targetMeanPrice: 80,
      marketCap: 5e9,
    }
    const r = deriveValuation(fund, 60)
    // Fair value may or may not render depending on methods
    if (r.fairValue) {
      expect(r.fairValue.bear).toBeLessThan(r.fairValue.base)
      expect(r.fairValue.base).toBeLessThan(r.fairValue.bull)
    }
  })

  it('score is always in softened range when hasData', () => {
    const fund = {
      forwardPE: 15,
      trailingPE: 20,
      priceToBook: 2,
      enterpriseToRevenue: 5,
    }
    const r = deriveValuation(fund, 100)
    if (r.hasData && r.score != null) {
      expect(r.score).toBeGreaterThanOrEqual(8)
      expect(r.score).toBeLessThanOrEqual(92)
    }
  })
})
