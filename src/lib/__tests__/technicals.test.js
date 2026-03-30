import { describe, it, expect } from 'vitest'
import { deriveTechnicals } from '../technicals.js'

// ---------------------------------------------------------------------------
// helpers: generate fake OHLCV bars
// ---------------------------------------------------------------------------

function makeBars(n, { baseClose = 100, trend = 0, volumeBase = 1e6 } = {}) {
  const bars = []
  for (let i = 0; i < n; i++) {
    const close = baseClose + trend * i + (Math.sin(i * 0.3) * 2)
    bars.push({
      date: new Date(2025, 0, 1 + i).toISOString().slice(0, 10),
      close,
      high: close + 2,
      low: close - 2,
      open: close - 0.5,
      volume: volumeBase + (i % 5) * 1e5,
    })
  }
  return bars
}

// ---------------------------------------------------------------------------
// deriveTechnicals
// ---------------------------------------------------------------------------

describe('deriveTechnicals', () => {
  it('returns unavailable for null analysis', () => {
    const r = deriveTechnicals(null, 100)
    expect(r.hasData).toBe(false)
    expect(r.score).toBeNull()
    expect(r.label).toBe('Unavailable')
    expect(r.indicators).toBeNull()
  })

  it('returns unavailable for empty history', () => {
    const r = deriveTechnicals({ history: [] }, 100)
    expect(r.hasData).toBe(false)
    expect(r.score).toBeNull()
  })

  it('returns unavailable for history with < 50 bars', () => {
    const r = deriveTechnicals({ history: makeBars(30) }, 100)
    expect(r.hasData).toBe(false)
  })

  it('produces a score with 200+ bars', () => {
    const r = deriveTechnicals({ history: makeBars(250) }, 100)
    expect(r.hasData).toBe(true)
    expect(r.score).toBeGreaterThan(0)
    expect(r.score).toBeLessThanOrEqual(100)
    expect(r.label).not.toBe('Unavailable')
  })

  it('includes indicators when enough data', () => {
    const r = deriveTechnicals({ history: makeBars(250) }, 100)
    expect(r.indicators).not.toBeNull()
    expect(r.indicators.dates.length).toBeGreaterThan(0)
    expect(r.indicators.closes.length).toBeGreaterThan(0)
    expect(r.indicators.rsi.length).toBeGreaterThan(0)
    expect(r.indicators.macdLine.length).toBeGreaterThan(0)
    expect(r.indicators.bbUpper.length).toBeGreaterThan(0)
  })

  it('generates metrics', () => {
    const r = deriveTechnicals({ history: makeBars(250) }, 100)
    expect(r.metrics.length).toBeGreaterThan(0)
    const rsiMetric = r.metrics.find((m) => m.key === 'rsi14')
    expect(rsiMetric).toBeDefined()
    expect(rsiMetric.value).toBeGreaterThanOrEqual(0)
    expect(rsiMetric.value).toBeLessThanOrEqual(100)
  })

  it('generates reasons', () => {
    const r = deriveTechnicals({ history: makeBars(250) }, 100)
    expect(r.reasons.length).toBeGreaterThan(0)
  })

  it('handles exactly 50 bars', () => {
    const r = deriveTechnicals({ history: makeBars(50) }, 100)
    expect(r.hasData).toBe(true)
    expect(r.score).not.toBeNull()
  })

  it('uptrend and downtrend produce different scores', () => {
    const up = deriveTechnicals({ history: makeBars(250, { trend: 0.5 }) }, 200)
    const down = deriveTechnicals({ history: makeBars(250, { trend: -0.5 }) }, 50)
    // Both should be valid and produce scores
    expect(up.hasData).toBe(true)
    expect(down.hasData).toBe(true)
    expect(up.score).not.toBeNull()
    expect(down.score).not.toBeNull()
    // Scores should differ based on trend direction
    expect(up.score).not.toBe(down.score)
  })

  it('score in softened range', () => {
    const r = deriveTechnicals({ history: makeBars(250) }, 100)
    if (r.hasData && r.score != null) {
      expect(r.score).toBeGreaterThanOrEqual(8)
      expect(r.score).toBeLessThanOrEqual(92)
    }
  })
})
