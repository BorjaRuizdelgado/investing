import { describe, it, expect } from 'vitest'
import { deriveValuation } from '../valuation.js'
import { deriveQuality } from '../quality.js'
import { deriveRisk } from '../risk.js'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const fullFundamentals = {
  forwardPE: 18,
  trailingPE: 22,
  priceToBook: 3.5,
  enterpriseToRevenue: 5,
  enterpriseToEbitda: 14,
  freeCashflow: 5e9,
  marketCap: 100e9,
  totalRevenue: 20e9,
  revenueGrowth: 0.12,
  earningsGrowth: 0.15,
  grossMargins: 0.45,
  operatingMargins: 0.18,
  profitMargins: 0.14,
  returnOnEquity: 0.22,
  returnOnAssets: 0.09,
  debtToEquity: 80,
  currentRatio: 1.8,
  quickRatio: 1.4,
  beta: 1.05,
  shortPercentOfFloat: 3,
  targetMeanPrice: 180,
  epsForward: 8,
  sharesOutstanding: 1e9,
}

const emptyFundamentals = {
  forwardPE: undefined,
  trailingPE: undefined,
  priceToBook: undefined,
  enterpriseToRevenue: undefined,
  enterpriseToEbitda: undefined,
  freeCashflow: undefined,
  marketCap: undefined,
  totalRevenue: undefined,
  revenueGrowth: undefined,
  earningsGrowth: undefined,
  grossMargins: undefined,
  operatingMargins: undefined,
  profitMargins: undefined,
  returnOnEquity: undefined,
  returnOnAssets: undefined,
  debtToEquity: undefined,
  currentRatio: undefined,
  quickRatio: undefined,
  beta: undefined,
  shortPercentOfFloat: undefined,
  targetMeanPrice: undefined,
  epsForward: undefined,
  sharesOutstanding: undefined,
}

const negativeEarnings = {
  ...fullFundamentals,
  forwardPE: -5,
  trailingPE: -10,
  earningsGrowth: -0.3,
  profitMargins: -0.08,
  returnOnEquity: -0.15,
  freeCashflow: -2e9,
}

const zeroRevenue = {
  ...fullFundamentals,
  totalRevenue: 0,
  revenueGrowth: 0,
  grossMargins: 0,
  operatingMargins: 0,
  profitMargins: 0,
}

const spot = 150

// Helper: recursively check no NaN in any numeric field
function assertNoNaN(obj, path = '') {
  if (obj === null || obj === undefined) return
  if (typeof obj === 'number') {
    expect(Number.isNaN(obj), `NaN found at ${path}`).toBe(false)
    return
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => assertNoNaN(item, `${path}[${i}]`))
    return
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      assertNoNaN(v, `${path}.${k}`)
    }
  }
}

// ---------------------------------------------------------------------------
// deriveValuation
// ---------------------------------------------------------------------------

describe('deriveValuation', () => {
  it('normal case: full fundamentals produce valid score and label', () => {
    const result = deriveValuation(fullFundamentals, spot)
    expect(result.hasData).toBe(true)
    expect(typeof result.score).toBe('number')
    expect(result.score).toBeGreaterThanOrEqual(8)
    expect(result.score).toBeLessThanOrEqual(92)
    expect(['Expensive', 'Fair', 'Undervalued']).toContain(result.label)
    expect(result.metrics.length).toBeGreaterThan(0)
    expect(result.fairValue).not.toBeNull()
  })

  it('empty fundamentals: graceful fallback', () => {
    const result = deriveValuation(emptyFundamentals, spot)
    // Not enough metrics -> score null
    expect(result.score).toBeNull()
    expect(result.label).toBe('Unavailable')
  })

  it('null fundamentals: returns unavailable', () => {
    const result = deriveValuation(null, spot)
    expect(result.score).toBeNull()
    expect(result.label).toBe('Unavailable')
  })

  it('negative earnings: still computes without errors', () => {
    const result = deriveValuation(negativeEarnings, spot)
    // Negative PE is non-finite for scoring purposes (scoreLowBetter handles it)
    expect(result).toBeDefined()
    expect(result.metrics).toBeDefined()
  })

  it('zero revenue: does not crash', () => {
    const result = deriveValuation(zeroRevenue, spot)
    expect(result).toBeDefined()
  })

  it('no NaN in any field of the result', () => {
    assertNoNaN(deriveValuation(fullFundamentals, spot))
    assertNoNaN(deriveValuation(emptyFundamentals, spot))
    assertNoNaN(deriveValuation(negativeEarnings, spot))
    assertNoNaN(deriveValuation(zeroRevenue, spot))
    assertNoNaN(deriveValuation(null, spot))
  })

  it('boundary: score near threshold produces correct label', () => {
    // Force a specific score range by using extreme valuation metrics
    const cheap = {
      ...emptyFundamentals,
      forwardPE: 10, // very cheap -> scoreLowBetter(10, 12, 32) -> 100
      trailingPE: 12, // scoreLowBetter(12, 15, 35) -> 100
      priceToBook: 1.0, // scoreLowBetter(1, 1.5, 6) -> 100
    }
    const result = deriveValuation(cheap, spot)
    if (result.hasData && result.score !== null) {
      // Very cheap stock should score well
      expect(result.score).toBeGreaterThan(50)
    }
  })
})

// ---------------------------------------------------------------------------
// deriveQuality
// ---------------------------------------------------------------------------

describe('deriveQuality', () => {
  it('normal case: full fundamentals produce valid score and label', () => {
    const result = deriveQuality(fullFundamentals)
    expect(result.hasData).toBe(true)
    expect(typeof result.score).toBe('number')
    expect(result.score).toBeGreaterThanOrEqual(8)
    expect(result.score).toBeLessThanOrEqual(92)
    expect(['Weak', 'Mixed', 'Good', 'Strong']).toContain(result.label)
    expect(result.metrics.length).toBeGreaterThan(0)
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  it('empty fundamentals: graceful fallback', () => {
    const result = deriveQuality(emptyFundamentals)
    expect(result.score).toBeNull()
    expect(result.label).toBe('Unavailable')
  })

  it('null fundamentals: returns unavailable', () => {
    const result = deriveQuality(null)
    expect(result.score).toBeNull()
    expect(result.label).toBe('Unavailable')
  })

  it('negative earnings: computes without errors', () => {
    const result = deriveQuality(negativeEarnings)
    expect(result).toBeDefined()
    if (result.hasData) {
      // Negative margins/growth -> lower quality score
      expect(result.score).toBeLessThan(70)
    }
  })

  it('zero revenue: fcfMargin handled gracefully', () => {
    const result = deriveQuality(zeroRevenue)
    expect(result).toBeDefined()
    // fcfMargin = freeCashflow / 0 => null, should not crash
  })

  it('no NaN in any field of the result', () => {
    assertNoNaN(deriveQuality(fullFundamentals))
    assertNoNaN(deriveQuality(emptyFundamentals))
    assertNoNaN(deriveQuality(negativeEarnings))
    assertNoNaN(deriveQuality(zeroRevenue))
    assertNoNaN(deriveQuality(null))
  })

  it('boundary: high-quality stock scores Strong', () => {
    const excellent = {
      ...emptyFundamentals,
      revenueGrowth: 0.25,
      earningsGrowth: 0.3,
      grossMargins: 0.7,
      operatingMargins: 0.35,
      profitMargins: 0.28,
      returnOnEquity: 0.35,
      returnOnAssets: 0.15,
      freeCashflow: 10e9,
      totalRevenue: 40e9,
    }
    const result = deriveQuality(excellent)
    expect(result.hasData).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(75)
    expect(result.label).toBe('Strong')
  })

  it('boundary: poor-quality stock scores Weak', () => {
    const poor = {
      ...emptyFundamentals,
      revenueGrowth: -0.1,
      earningsGrowth: -0.2,
      grossMargins: 0.15,
      operatingMargins: 0.01,
      profitMargins: -0.05,
      returnOnEquity: 0.02,
      returnOnAssets: 0.005,
      freeCashflow: -1e9,
      totalRevenue: 10e9,
    }
    const result = deriveQuality(poor)
    expect(result.hasData).toBe(true)
    expect(result.score).toBeLessThan(35)
    expect(result.label).toBe('Weak')
  })
})

// ---------------------------------------------------------------------------
// deriveRisk
// ---------------------------------------------------------------------------

describe('deriveRisk', () => {
  const analysis = { em: { movePct: 6 } }

  it('normal case: full fundamentals produce valid score and label', () => {
    const result = deriveRisk(fullFundamentals, analysis)
    expect(result.hasData).toBe(true)
    expect(typeof result.score).toBe('number')
    // Risk score is inverted: 100 - safetyScore
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(typeof result.safetyScore).toBe('number')
    expect(['Low', 'Moderate', 'Medium', 'High', 'Unavailable']).toContain(result.label)
    expect(result.metrics.length).toBeGreaterThan(0)
  })

  it('empty fundamentals: graceful fallback', () => {
    const result = deriveRisk(emptyFundamentals, null)
    expect(result.score).toBeNull()
    expect(result.label).toBe('Unavailable')
  })

  it('null fundamentals with no analysis: returns unavailable', () => {
    const result = deriveRisk(null, null)
    expect(result.score).toBeNull()
    expect(result.label).toBe('Unavailable')
  })

  it('negative earnings: risk calculation still works', () => {
    const result = deriveRisk(negativeEarnings, analysis)
    expect(result).toBeDefined()
    expect(result.metrics).toBeDefined()
  })

  it('zero revenue: does not crash', () => {
    const result = deriveRisk(zeroRevenue, analysis)
    expect(result).toBeDefined()
  })

  it('no NaN in any field of the result', () => {
    assertNoNaN(deriveRisk(fullFundamentals, analysis))
    assertNoNaN(deriveRisk(emptyFundamentals, null))
    assertNoNaN(deriveRisk(negativeEarnings, analysis))
    assertNoNaN(deriveRisk(zeroRevenue, analysis))
    assertNoNaN(deriveRisk(null, null))
  })

  it('score is inverted: low risk score = high safety score', () => {
    const result = deriveRisk(fullFundamentals, analysis)
    if (result.score !== null && result.safetyScore !== null) {
      expect(result.score + result.safetyScore).toBeCloseTo(100, 4)
    }
  })

  it('boundary: safe stock gets Low risk label', () => {
    const safe = {
      ...emptyFundamentals,
      debtToEquity: 20,
      currentRatio: 3.0,
      quickRatio: 2.5,
      beta: 1.0,
      shortPercentOfFloat: 1,
    }
    const safeAnalysis = { em: { movePct: 2 } }
    const result = deriveRisk(safe, safeAnalysis)
    expect(result.hasData).toBe(true)
    expect(result.label).toBe('Low')
    // Safety score should be high
    expect(result.safetyScore).toBeGreaterThanOrEqual(75)
  })

  it('boundary: risky stock gets High risk label', () => {
    const risky = {
      ...emptyFundamentals,
      debtToEquity: 250,
      currentRatio: 0.6,
      quickRatio: 0.4,
      beta: 2.5,
      shortPercentOfFloat: 30,
    }
    const riskyAnalysis = { em: { movePct: 15 } }
    const result = deriveRisk(risky, riskyAnalysis)
    expect(result.hasData).toBe(true)
    expect(result.label).toBe('High')
    expect(result.safetyScore).toBeLessThan(35)
  })

  it('beta in ideal range (0.8-1.2) scores higher than extreme beta', () => {
    const idealBeta = { ...emptyFundamentals, beta: 1.0, debtToEquity: 80, currentRatio: 1.5 }
    const extremeBeta = { ...emptyFundamentals, beta: 2.5, debtToEquity: 80, currentRatio: 1.5 }
    const r1 = deriveRisk(idealBeta, null)
    const r2 = deriveRisk(extremeBeta, null)
    if (r1.safetyScore !== null && r2.safetyScore !== null) {
      expect(r1.safetyScore).toBeGreaterThan(r2.safetyScore)
    }
  })
})
