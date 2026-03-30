import { describe, it, expect } from 'vitest'
import { deriveOptionsSentiment, deriveOpportunity, deriveSignals } from '../signals.js'

// ---------------------------------------------------------------------------
// deriveOptionsSentiment
// ---------------------------------------------------------------------------

describe('deriveOptionsSentiment', () => {
  it('returns unavailable for null analysis', () => {
    const r = deriveOptionsSentiment(null, 100)
    expect(r.score).toBeNull()
    expect(r.label).toBe('Unavailable')
    expect(r.reasons).toEqual([])
  })

  it('returns unavailable for non-finite spot', () => {
    const r = deriveOptionsSentiment({ dist: { mean: 110 } }, NaN)
    expect(r.score).toBeNull()
  })

  it('produces a score with full analysis', () => {
    const analysis = {
      dist: { mean: 115 },
      em: { movePct: 5 },
      pcr: { sentiment: 'bullish' },
      probs: { probAbove: 0.6 },
    }
    const r = deriveOptionsSentiment(analysis, 100)
    expect(r.score).not.toBeNull()
    expect(r.score).toBeGreaterThan(0)
    expect(r.score).toBeLessThanOrEqual(100)
    expect(r.label).not.toBe('Unavailable')
  })

  it('bullish analysis gives higher score', () => {
    const bullish = {
      dist: { mean: 130 },
      em: { movePct: 3 },
      pcr: { sentiment: 'bullish' },
      probs: { probAbove: 0.7 },
    }
    const bearish = {
      dist: { mean: 80 },
      em: { movePct: 15 },
      pcr: { sentiment: 'bearish' },
      probs: { probAbove: 0.3 },
    }
    const bull = deriveOptionsSentiment(bullish, 100)
    const bear = deriveOptionsSentiment(bearish, 100)
    if (bull.score != null && bear.score != null) {
      expect(bull.score).toBeGreaterThan(bear.score)
    }
  })
})

// ---------------------------------------------------------------------------
// deriveSignals
// ---------------------------------------------------------------------------

describe('deriveSignals', () => {
  it('returns empty array with no data', () => {
    const r = deriveSignals({
      valuation: { hasData: false, score: null },
      quality: { hasData: false, score: null },
      risk: { hasData: false, score: null },
      options: { score: null },
      analystUpsidePct: null,
    })
    expect(Array.isArray(r)).toBe(true)
    expect(r.length).toBe(0)
  })

  it('detects undervalued quality setup', () => {
    const r = deriveSignals({
      valuation: { hasData: true, score: 70 },
      quality: { hasData: true, score: 65 },
      risk: { hasData: true, score: 55 },
      options: { score: null },
      analystUpsidePct: null,
    })
    const signal = r.find((s) => s.title.toLowerCase().includes('undervalued'))
    expect(signal).toBeDefined()
    expect(signal.tone).toBe('positive')
  })

  it('detects value trap risk', () => {
    const r = deriveSignals({
      valuation: { hasData: true, score: 65 },
      quality: { hasData: true, score: 30 },
      risk: { hasData: false, score: null },
      options: { score: null },
      analystUpsidePct: null,
    })
    const signal = r.find((s) => s.title.toLowerCase().includes('value trap'))
    expect(signal).toBeDefined()
    expect(signal.tone).toBe('negative')
  })

  it('detects financial fragility', () => {
    const r = deriveSignals({
      valuation: { hasData: false, score: null },
      quality: { hasData: false, score: null },
      risk: { hasData: true, score: 30 },
      options: { score: null },
      analystUpsidePct: null,
    })
    const signal = r.find((s) => s.title.toLowerCase().includes('fragility'))
    expect(signal).toBeDefined()
    expect(signal.tone).toBe('negative')
  })

  it('detects market and analysts aligned', () => {
    const r = deriveSignals({
      valuation: { hasData: true, score: 60 },
      quality: { hasData: false, score: null },
      risk: { hasData: false, score: null },
      options: { score: 65 },
      analystUpsidePct: 0.2,
    })
    const signal = r.find((s) => s.title.toLowerCase().includes('aligned'))
    expect(signal).toBeDefined()
    expect(signal.tone).toBe('positive')
  })

  it('detects optimism priced in', () => {
    const r = deriveSignals({
      valuation: { hasData: true, score: 30 },
      quality: { hasData: false, score: null },
      risk: { hasData: false, score: null },
      options: { score: 40 },
      analystUpsidePct: null,
    })
    const signal = r.find((s) => s.title.toLowerCase().includes('priced in'))
    expect(signal).toBeDefined()
    expect(signal.tone).toBe('negative')
  })
})

// ---------------------------------------------------------------------------
// deriveOpportunity
// ---------------------------------------------------------------------------

describe('deriveOpportunity', () => {
  it('returns unavailable with no data', () => {
    const r = deriveOpportunity(
      { hasData: false, score: null },
      { hasData: false, score: null },
      { hasData: false, score: null },
      { score: null },
      null,
    )
    expect(r.hasData).toBe(false)
    expect(r.score).toBeNull()
    expect(r.label).toBe('Unavailable')
  })

  it('returns unavailable when only 1 input', () => {
    const r = deriveOpportunity(
      { hasData: true, score: 70 },
      { hasData: false, score: null },
      { hasData: false, score: null },
      { score: null },
      null,
    )
    expect(r.hasData).toBe(false)
  })

  it('produces a score with sufficient data', () => {
    const r = deriveOpportunity(
      { hasData: true, score: 70 },
      { hasData: true, score: 60 },
      { hasData: true, score: 50 },
      { score: 55 },
      0.1,
    )
    expect(r.hasData).toBe(true)
    expect(r.score).toBeGreaterThan(0)
    expect(r.score).toBeLessThanOrEqual(100)
  })

  it('strong inputs produce high-conviction', () => {
    const r = deriveOpportunity(
      { hasData: true, score: 90 },
      { hasData: true, score: 85 },
      { hasData: true, score: 80 },
      { score: 80 },
      0.3,
    )
    expect(r.label).toBe('High-conviction')
  })

  it('weak inputs produce unattractive', () => {
    const r = deriveOpportunity(
      { hasData: true, score: 15 },
      { hasData: true, score: 20 },
      { hasData: true, score: 10 },
      { score: 15 },
      -0.2,
    )
    expect(r.label).toBe('Unattractive')
  })
})
