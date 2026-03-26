import { describe, it, expect } from 'vitest'
import {
  impliedDistribution,
  expectedMove,
  maxPain,
  percentileLevels,
  bullBearProbabilities,
  ivSmile,
} from '../analysis.js'

// ---------------------------------------------------------------------------
// Fixture: stock at $150, 30 DTE, realistic option chain
// ---------------------------------------------------------------------------

const spot = 150
const r = 0.05
const T = 30 / 365

function makeOption(strike, bid, ask, iv, oi, volume = Math.round(oi * 0.3)) {
  return {
    strike,
    bid,
    ask,
    mid: (bid + ask) / 2,
    impliedVolatility: iv,
    openInterest: oi,
    volume,
  }
}

const calls = [
  makeOption(130, 20.8, 21.2, 0.38, 1200),
  makeOption(133, 17.9, 18.3, 0.36, 800),
  makeOption(136, 15.1, 15.5, 0.34, 950),
  makeOption(139, 12.5, 12.9, 0.32, 1100),
  makeOption(142, 10.0, 10.4, 0.3, 1500),
  makeOption(145, 7.8, 8.2, 0.28, 2200),
  makeOption(147, 6.2, 6.6, 0.27, 1800),
  makeOption(148, 5.5, 5.9, 0.265, 2000),
  makeOption(150, 4.2, 4.6, 0.26, 3500),
  makeOption(152, 3.1, 3.5, 0.255, 2800),
  makeOption(155, 1.8, 2.2, 0.25, 2400),
  makeOption(158, 0.9, 1.3, 0.26, 1600),
  makeOption(160, 0.5, 0.9, 0.27, 1900),
  makeOption(165, 0.15, 0.35, 0.29, 1000),
  makeOption(170, 0.05, 0.15, 0.32, 600),
]

const puts = [
  makeOption(130, 0.05, 0.15, 0.35, 700),
  makeOption(133, 0.1, 0.2, 0.33, 850),
  makeOption(136, 0.2, 0.4, 0.31, 900),
  makeOption(139, 0.5, 0.7, 0.3, 1050),
  makeOption(142, 1.0, 1.3, 0.29, 1400),
  makeOption(145, 1.9, 2.3, 0.28, 2100),
  makeOption(147, 2.6, 3.0, 0.275, 1700),
  makeOption(148, 3.1, 3.5, 0.27, 1900),
  makeOption(150, 4.0, 4.4, 0.26, 3200),
  makeOption(152, 5.3, 5.7, 0.26, 2600),
  makeOption(155, 7.2, 7.6, 0.255, 2100),
  makeOption(158, 9.5, 9.9, 0.26, 1500),
  makeOption(160, 11.2, 11.6, 0.27, 1800),
  makeOption(165, 15.8, 16.2, 0.3, 900),
  makeOption(170, 20.5, 21.0, 0.33, 500),
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('impliedDistribution', () => {
  it('returns valid pdf and cdf arrays', () => {
    const dist = impliedDistribution(calls, spot, r, T, puts)

    expect(dist.strikes).toBeDefined()
    expect(dist.pdf).toBeDefined()
    expect(dist.cdf).toBeDefined()
    expect(dist.strikes.length).toBeGreaterThan(0)
    expect(dist.pdf.length).toBe(dist.strikes.length)
    expect(dist.cdf.length).toBe(dist.strikes.length)
  })

  it('pdf sums to approximately 1', () => {
    const dist = impliedDistribution(calls, spot, r, T, puts)
    const dK = dist.strikes[1] - dist.strikes[0]
    let sum = 0
    for (let i = 0; i < dist.pdf.length; i++) sum += dist.pdf[i] * dK
    expect(sum).toBeCloseTo(1, 1)
  })

  it('cdf ends near 1', () => {
    const dist = impliedDistribution(calls, spot, r, T, puts)
    const lastCdf = dist.cdf[dist.cdf.length - 1]
    expect(lastCdf).toBeGreaterThan(0.9)
    expect(lastCdf).toBeLessThanOrEqual(1.0)
  })

  it('mean is near spot', () => {
    const dist = impliedDistribution(calls, spot, r, T, puts)
    // Mean should be within ~10% of spot for a 30-DTE near-the-money chain
    expect(dist.mean).toBeGreaterThan(spot * 0.9)
    expect(dist.mean).toBeLessThan(spot * 1.1)
  })

  it('all pdf values are non-negative', () => {
    const dist = impliedDistribution(calls, spot, r, T, puts)
    for (let i = 0; i < dist.pdf.length; i++) {
      expect(dist.pdf[i]).toBeGreaterThanOrEqual(0)
    }
  })

  it('cdf is monotonically non-decreasing', () => {
    const dist = impliedDistribution(calls, spot, r, T, puts)
    for (let i = 1; i < dist.cdf.length; i++) {
      expect(dist.cdf[i]).toBeGreaterThanOrEqual(dist.cdf[i - 1] - 1e-12)
    }
  })
})

describe('expectedMove', () => {
  it('returns positive move values', () => {
    const em = expectedMove(calls, puts, spot)
    expect(em.moveAbs).toBeGreaterThan(0)
    expect(em.movePct).toBeGreaterThan(0)
  })

  it('moveAbs equals straddle * 0.85', () => {
    const em = expectedMove(calls, puts, spot)
    expect(em.moveAbs).toBeCloseTo(em.straddle * 0.85, 6)
  })

  it('upper > spot and lower < spot', () => {
    const em = expectedMove(calls, puts, spot)
    expect(em.upper).toBeGreaterThan(spot)
    expect(em.lower).toBeLessThan(spot)
  })

  it('straddle = callPrice + putPrice', () => {
    const em = expectedMove(calls, puts, spot)
    expect(em.straddle).toBeCloseTo(em.callPrice + em.putPrice, 6)
  })
})

describe('maxPain', () => {
  it('returns a number between min and max strike', () => {
    const mp = maxPain(calls, puts)
    const allStrikes = calls.map((c) => c.strike)
    expect(mp).toBeGreaterThanOrEqual(Math.min(...allStrikes))
    expect(mp).toBeLessThanOrEqual(Math.max(...allStrikes))
  })

  it('returns a strike that exists in both call and put chains', () => {
    const mp = maxPain(calls, puts)
    expect(calls.some((c) => c.strike === mp)).toBe(true)
    expect(puts.some((p) => p.strike === mp)).toBe(true)
  })

  it('returns NaN when no common strikes', () => {
    const disjointPuts = [makeOption(999, 1, 2, 0.3, 100)]
    expect(maxPain(calls, disjointPuts)).toBeNaN()
  })
})

describe('percentileLevels', () => {
  it('returns object with keys 10, 25, 50, 75, 90', () => {
    const dist = impliedDistribution(calls, spot, r, T, puts)
    const levels = percentileLevels(dist)
    for (const p of [10, 25, 50, 75, 90]) {
      expect(levels).toHaveProperty(String(p))
      expect(typeof levels[p]).toBe('number')
    }
  })

  it('values are in ascending order', () => {
    const dist = impliedDistribution(calls, spot, r, T, puts)
    const levels = percentileLevels(dist)
    expect(levels[10]).toBeLessThanOrEqual(levels[25])
    expect(levels[25]).toBeLessThanOrEqual(levels[50])
    expect(levels[50]).toBeLessThanOrEqual(levels[75])
    expect(levels[75]).toBeLessThanOrEqual(levels[90])
  })

  it('all values are within strike range', () => {
    const dist = impliedDistribution(calls, spot, r, T, puts)
    const levels = percentileLevels(dist)
    const lo = dist.strikes[0]
    const hi = dist.strikes[dist.strikes.length - 1]
    for (const p of [10, 25, 50, 75, 90]) {
      expect(levels[p]).toBeGreaterThanOrEqual(lo)
      expect(levels[p]).toBeLessThanOrEqual(hi)
    }
  })
})

describe('bullBearProbabilities', () => {
  it('probAbove + probBelow approximately equals 1', () => {
    const dist = impliedDistribution(calls, spot, r, T, puts)
    const probs = bullBearProbabilities(dist, spot)
    expect(probs.probAbove + probs.probBelow).toBeCloseTo(1, 2)
  })

  it('both probabilities are between 0 and 1', () => {
    const dist = impliedDistribution(calls, spot, r, T, puts)
    const probs = bullBearProbabilities(dist, spot)
    expect(probs.probAbove).toBeGreaterThanOrEqual(0)
    expect(probs.probAbove).toBeLessThanOrEqual(1)
    expect(probs.probBelow).toBeGreaterThanOrEqual(0)
    expect(probs.probBelow).toBeLessThanOrEqual(1)
  })
})

describe('ivSmile', () => {
  it('returns array of objects with strike/iv/moneyness/type', () => {
    const smile = ivSmile(calls, puts, spot)
    expect(Array.isArray(smile)).toBe(true)
    expect(smile.length).toBeGreaterThan(0)

    for (const row of smile) {
      expect(row).toHaveProperty('strike')
      expect(row).toHaveProperty('iv')
      expect(row).toHaveProperty('moneyness')
      expect(row).toHaveProperty('type')
      expect(typeof row.strike).toBe('number')
      expect(typeof row.iv).toBe('number')
      expect(typeof row.moneyness).toBe('number')
      expect(['call', 'put']).toContain(row.type)
    }
  })

  it('moneyness = strike / spot', () => {
    const smile = ivSmile(calls, puts, spot)
    for (const row of smile) {
      expect(row.moneyness).toBeCloseTo(row.strike / spot, 8)
    }
  })

  it('all IVs are positive', () => {
    const smile = ivSmile(calls, puts, spot)
    for (const row of smile) {
      expect(row.iv).toBeGreaterThan(0)
    }
  })

  it('calls have strike >= 0.98 * spot, puts have strike <= 1.02 * spot', () => {
    const smile = ivSmile(calls, puts, spot)
    for (const row of smile) {
      if (row.type === 'call') expect(row.strike).toBeGreaterThanOrEqual(spot * 0.98)
      if (row.type === 'put') expect(row.strike).toBeLessThanOrEqual(spot * 1.02)
    }
  })
})
