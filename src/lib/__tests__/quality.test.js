import { describe, it, expect } from 'vitest'
import { deriveQuality } from '../quality.js'

// ---------------------------------------------------------------------------
// deriveQuality
// ---------------------------------------------------------------------------

describe('deriveQuality', () => {
  it('returns unavailable for null fundamentals', () => {
    const r = deriveQuality(null)
    expect(r.score).toBeNull()
    expect(r.label).toBe('Unavailable')
    expect(r.metrics).toEqual([])
    expect(r.reasons).toEqual([])
  })

  it('returns unavailable for undefined fundamentals', () => {
    const r = deriveQuality(undefined)
    expect(r.score).toBeNull()
  })

  it('returns unavailable when too few metrics', () => {
    const r = deriveQuality({ revenueGrowth: 0.1 })
    expect(r.hasData).toBe(false)
    expect(r.score).toBeNull()
    expect(r.label).toBe('Unavailable')
  })

  it('produces a score with sufficient data', () => {
    const fund = {
      revenueGrowth: 0.15,
      earningsGrowth: 0.2,
      grossMargins: 0.45,
      operatingMargins: 0.25,
      profitMargins: 0.15,
      returnOnEquity: 0.2,
    }
    const r = deriveQuality(fund)
    expect(r.hasData).toBe(true)
    expect(r.score).toBeGreaterThan(0)
    expect(r.score).toBeLessThanOrEqual(100)
    expect(r.label).not.toBe('Unavailable')
  })

  it('strong company scores high', () => {
    const fund = {
      revenueGrowth: 0.3,
      earningsGrowth: 0.35,
      grossMargins: 0.7,
      operatingMargins: 0.4,
      profitMargins: 0.25,
      returnOnEquity: 0.3,
      returnOnAssets: 0.15,
      freeCashflow: 5e9,
      totalRevenue: 20e9,
    }
    const r = deriveQuality(fund)
    expect(r.score).toBeGreaterThan(60)
  })

  it('weak company scores low', () => {
    const fund = {
      revenueGrowth: -0.2,
      earningsGrowth: -0.3,
      grossMargins: 0.1,
      operatingMargins: -0.05,
      profitMargins: -0.1,
      returnOnEquity: -0.1,
      returnOnAssets: -0.05,
    }
    const r = deriveQuality(fund)
    expect(r.score).toBeLessThan(40)
  })

  it('generates reasons', () => {
    const fund = {
      revenueGrowth: 0.2,
      earningsGrowth: 0.25,
      grossMargins: 0.5,
      operatingMargins: 0.3,
    }
    const r = deriveQuality(fund)
    expect(r.reasons.length).toBeGreaterThan(0)
  })

  it('computes fcfMargin when revenue > 0', () => {
    const fund = {
      freeCashflow: 1e9,
      totalRevenue: 10e9,
      grossMargins: 0.4,
      operatingMargins: 0.2,
    }
    const r = deriveQuality(fund)
    const fcfMetric = r.metrics.find((m) => m.key === 'fcfMargin')
    if (fcfMetric) {
      expect(fcfMetric.value).toBeCloseTo(0.1, 2)
    }
  })

  it('score always in softened range', () => {
    const fund = {
      revenueGrowth: 0.15,
      earningsGrowth: 0.2,
      grossMargins: 0.5,
    }
    const r = deriveQuality(fund)
    if (r.hasData && r.score != null) {
      expect(r.score).toBeGreaterThanOrEqual(8)
      expect(r.score).toBeLessThanOrEqual(92)
    }
  })
})
