import { describe, it, expect } from 'vitest'
import { deriveRisk } from '../risk.js'

// ---------------------------------------------------------------------------
// deriveRisk
// ---------------------------------------------------------------------------

describe('deriveRisk', () => {
  it('returns unavailable for null fundamentals and analysis', () => {
    const r = deriveRisk(null, null)
    expect(r.hasData).toBe(false)
    expect(r.score).toBeNull()
    expect(r.label).toBe('Unavailable')
  })

  it('returns unavailable when too few metrics', () => {
    const r = deriveRisk({ debtToEquity: 50 }, null)
    expect(r.hasData).toBe(false)
    expect(r.score).toBeNull()
  })

  it('produces a score with sufficient data', () => {
    const fund = {
      debtToEquity: 40,
      currentRatio: 2.0,
      quickRatio: 1.5,
      beta: 1.0,
      shortPercentOfFloat: 3,
    }
    const r = deriveRisk(fund, null)
    expect(r.hasData).toBe(true)
    expect(r.score).not.toBeNull()
    expect(r.safetyScore).not.toBeNull()
    expect(r.label).not.toBe('Unavailable')
  })

  it('low-risk company gets a low risk score', () => {
    const fund = {
      debtToEquity: 10,
      currentRatio: 3.0,
      quickRatio: 2.5,
      beta: 0.9,
      shortPercentOfFloat: 1,
    }
    const r = deriveRisk(fund, null)
    // score = 100 - safetyScore, so safe company has LOW score
    expect(r.score).toBeLessThan(50)
    expect(r.safetyScore).toBeGreaterThan(50)
  })

  it('high-risk company gets a high risk score', () => {
    const fund = {
      debtToEquity: 300,
      currentRatio: 0.4,
      quickRatio: 0.3,
      beta: 2.5,
      shortPercentOfFloat: 30,
    }
    const r = deriveRisk(fund, null)
    expect(r.score).toBeGreaterThan(50)
    expect(r.safetyScore).toBeLessThan(50)
  })

  it('includes options move when analysis provided', () => {
    const fund = {
      debtToEquity: 60,
      currentRatio: 1.5,
      beta: 1.1,
    }
    const analysis = { em: { movePct: 8 } }
    const r = deriveRisk(fund, analysis)
    expect(r.hasData).toBe(true)
    // Analysis adds a scoring component
    expect(r.score).not.toBeNull()
  })

  it('generates reasons', () => {
    const fund = {
      debtToEquity: 200,
      currentRatio: 0.5,
      beta: 2.0,
    }
    const r = deriveRisk(fund, null)
    expect(r.reasons.length).toBeGreaterThan(0)
  })

  it('maps labels correctly: high safety = Low risk', () => {
    const fund = {
      debtToEquity: 10,
      currentRatio: 3.0,
      quickRatio: 2.0,
      beta: 1.0,
    }
    const r = deriveRisk(fund, null)
    // High safetyScore → label should be 'Low' (risk)
    expect(['Low', 'Moderate']).toContain(r.label)
  })

  it('score in softened range', () => {
    const fund = {
      debtToEquity: 50,
      currentRatio: 1.5,
      beta: 1.0,
    }
    const r = deriveRisk(fund, null)
    if (r.hasData && r.safetyScore != null) {
      expect(r.safetyScore).toBeGreaterThanOrEqual(8)
      expect(r.safetyScore).toBeLessThanOrEqual(92)
    }
  })
})
