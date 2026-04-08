import { describe, it, expect } from 'vitest'
import {
  overviewTldr,
  valuationTldr,
  qualityTldr,
  riskTldr,
  technicalsTldr,
  businessTldr,
  optionsTldr,
  fundamentalsTldr,
  tabTldr,
} from '../tldr.js'

// ---------------------------------------------------------------------------
// overviewTldr
// ---------------------------------------------------------------------------

describe('overviewTldr', () => {
  it('returns positive when opportunity score >= 70', () => {
    const res = overviewTldr(
      { opportunity: { hasData: true, score: 80 } },
      { symbol: 'AAPL' },
      {},
    )
    expect(res.tone).toBe('positive')
    expect(res.text).toContain('AAPL')
  })

  it('returns neutral when opportunity score is between 45 and 69', () => {
    const res = overviewTldr(
      { opportunity: { hasData: true, score: 55 } },
      { symbol: 'MSFT' },
      {},
    )
    expect(res.tone).toBe('neutral')
    expect(res.text).toContain('MSFT')
  })

  it('returns negative when opportunity score < 45', () => {
    const res = overviewTldr(
      { opportunity: { hasData: true, score: 20 } },
      { symbol: 'XYZ' },
      {},
    )
    expect(res.tone).toBe('negative')
  })

  it('falls back to valuation+quality+risk check when no opportunity', () => {
    const res = overviewTldr(
      { valuation: { hasData: true }, quality: { hasData: true }, risk: { hasData: true } },
      { symbol: 'GOOG' },
      {},
    )
    expect(res.tone).toBe('neutral')
    expect(res.text).toContain('GOOG')
  })

  it('falls back to partial coverage when only spot is present', () => {
    const res = overviewTldr({}, { symbol: 'TSLA' }, { spot: 250 })
    expect(res.tone).toBe('neutral')
    expect(res.text).toContain('partial coverage')
  })

  it('returns null when no data at all', () => {
    expect(overviewTldr({}, {}, {})).toBeNull()
    expect(overviewTldr(null, null, null)).toBeNull()
  })

  it('uses shortName as fallback when symbol is missing', () => {
    const res = overviewTldr(
      { opportunity: { hasData: true, score: 80 } },
      { shortName: 'Apple Inc.' },
      {},
    )
    expect(res.text).toContain('Apple Inc.')
  })

  it('uses "This stock" when no identifier available', () => {
    const res = overviewTldr(
      { opportunity: { hasData: true, score: 80 } },
      {},
      {},
    )
    expect(res.text).toContain('This stock')
  })
})

// ---------------------------------------------------------------------------
// valuationTldr
// ---------------------------------------------------------------------------

describe('valuationTldr', () => {
  it('returns positive for high score', () => {
    const res = valuationTldr({ valuation: { hasData: true, score: 75 } }, { symbol: 'AAPL' })
    expect(res.tone).toBe('positive')
    expect(res.text).toContain('AAPL')
  })

  it('returns neutral for mid score', () => {
    const res = valuationTldr({ valuation: { hasData: true, score: 55 } }, { symbol: 'MSFT' })
    expect(res.tone).toBe('neutral')
  })

  it('returns negative for low score', () => {
    const res = valuationTldr({ valuation: { hasData: true, score: 30 } }, { symbol: 'XYZ' })
    expect(res.tone).toBe('negative')
  })

  it('returns null when no valuation data', () => {
    expect(valuationTldr({}, {})).toBeNull()
    expect(valuationTldr({ valuation: { hasData: false } }, {})).toBeNull()
  })

  it('uses fallback name when symbol missing', () => {
    const res = valuationTldr({ valuation: { hasData: true, score: 75 } }, {})
    expect(res.text).toContain('This stock')
  })
})

// ---------------------------------------------------------------------------
// qualityTldr
// ---------------------------------------------------------------------------

describe('qualityTldr', () => {
  it('returns positive for high score', () => {
    const res = qualityTldr({ quality: { hasData: true, score: 80 } }, { symbol: 'NVDA' })
    expect(res.tone).toBe('positive')
    expect(res.text).toContain('NVDA')
  })

  it('returns neutral for mid score', () => {
    const res = qualityTldr({ quality: { hasData: true, score: 50 } }, { symbol: 'INTC' })
    expect(res.tone).toBe('neutral')
  })

  it('returns negative for low score', () => {
    const res = qualityTldr({ quality: { hasData: true, score: 20 } }, { symbol: 'BAD' })
    expect(res.tone).toBe('negative')
  })

  it('returns null when no quality data', () => {
    expect(qualityTldr({}, {})).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// riskTldr
// ---------------------------------------------------------------------------

describe('riskTldr', () => {
  it('returns positive for high safety score', () => {
    const res = riskTldr({ risk: { hasData: true, safetyScore: 70 } }, { symbol: 'JNJ' })
    expect(res.tone).toBe('positive')
    expect(res.text).toContain('JNJ')
  })

  it('returns neutral for moderate safety score', () => {
    const res = riskTldr({ risk: { hasData: true, safetyScore: 50 } }, { symbol: 'TSLA' })
    expect(res.tone).toBe('neutral')
  })

  it('returns negative for low safety score', () => {
    const res = riskTldr({ risk: { hasData: true, safetyScore: 20 } }, { symbol: 'MEME' })
    expect(res.tone).toBe('negative')
  })

  it('returns null when no risk data', () => {
    expect(riskTldr({}, {})).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// technicalsTldr
// ---------------------------------------------------------------------------

describe('technicalsTldr', () => {
  it('returns positive for bullish score', () => {
    const res = technicalsTldr({ technicals: { hasData: true, score: 80 } })
    expect(res.tone).toBe('positive')
    expect(res.text).toContain('bullish')
  })

  it('returns neutral for mixed score', () => {
    const res = technicalsTldr({ technicals: { hasData: true, score: 50 } })
    expect(res.tone).toBe('neutral')
  })

  it('returns negative for bearish score', () => {
    const res = technicalsTldr({ technicals: { hasData: true, score: 20 } })
    expect(res.tone).toBe('negative')
    expect(res.text).toContain('bearish')
  })

  it('returns null when no technicals data', () => {
    expect(technicalsTldr({})).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// businessTldr
// ---------------------------------------------------------------------------

describe('businessTldr', () => {
  it('returns neutral with financial series', () => {
    const res = businessTldr(
      { business: { hasData: true, hasFinancialSeries: true } },
      { symbol: 'AAPL' },
      'AAPL',
    )
    expect(res.tone).toBe('neutral')
    expect(res.text).toContain('AAPL')
  })

  it('returns neutral without financial series', () => {
    const res = businessTldr(
      { business: { hasData: true, hasFinancialSeries: false } },
      { symbol: 'NEW' },
      'NEW',
    )
    expect(res.tone).toBe('neutral')
    expect(res.text).toContain('limited')
  })

  it('returns null when no business data', () => {
    expect(businessTldr({}, {}, 'X')).toBeNull()
  })

  it('uses ticker arg as fallback', () => {
    const res = businessTldr(
      { business: { hasData: true, hasFinancialSeries: true } },
      {},
      'FALLBACK',
    )
    expect(res.text).toContain('FALLBACK')
  })
})

// ---------------------------------------------------------------------------
// optionsTldr
// ---------------------------------------------------------------------------

describe('optionsTldr', () => {
  it('returns neutral when no analysis', () => {
    const res = optionsTldr(null, { symbol: 'AAPL' }, 'AAPL')
    expect(res.tone).toBe('neutral')
    expect(res.text).toContain('does not have listed options data')
  })

  it('returns neutral with expected move', () => {
    const res = optionsTldr({ em: { movePct: 5.3 } }, { symbol: 'TSLA' }, 'TSLA')
    expect(res.tone).toBe('neutral')
    expect(res.text).toContain('5.3%')
  })

  it('returns neutral with options data but no expected move', () => {
    const res = optionsTldr({}, { symbol: 'SPY' }, 'SPY')
    expect(res.tone).toBe('neutral')
    expect(res.text).toContain('options data')
  })
})

// ---------------------------------------------------------------------------
// fundamentalsTldr
// ---------------------------------------------------------------------------

describe('fundamentalsTldr', () => {
  it('returns neutral with fundamentals', () => {
    const res = fundamentalsTldr({ symbol: 'AAPL' })
    expect(res.tone).toBe('neutral')
    expect(res.text).toContain('AAPL')
  })

  it('returns null for null input', () => {
    expect(fundamentalsTldr(null)).toBeNull()
  })

  it('falls back to shortName', () => {
    const res = fundamentalsTldr({ shortName: 'Apple Inc.' })
    expect(res.text).toContain('Apple Inc.')
  })
})

// ---------------------------------------------------------------------------
// tabTldr — router
// ---------------------------------------------------------------------------

describe('tabTldr', () => {
  const research = {
    opportunity: { hasData: true, score: 80 },
    valuation: { hasData: true, score: 75 },
    quality: { hasData: true, score: 80 },
    risk: { hasData: true, safetyScore: 70 },
    technicals: { hasData: true, score: 80 },
    business: { hasData: true, hasFinancialSeries: true },
  }
  const fundamentals = { symbol: 'AAPL' }
  const analysis = { spot: 150, em: { movePct: 3.0 } }

  it('routes overview tab', () => {
    const res = tabTldr({ activeTab: 'overview', research, fundamentals, analysis })
    expect(res).not.toBeNull()
    expect(res.tone).toBe('positive')
  })

  it('routes value tab', () => {
    const res = tabTldr({ activeTab: 'value', research, fundamentals })
    expect(res).not.toBeNull()
  })

  it('routes quality tab', () => {
    const res = tabTldr({ activeTab: 'quality', research, fundamentals })
    expect(res).not.toBeNull()
  })

  it('routes risk tab', () => {
    const res = tabTldr({ activeTab: 'risk', research, fundamentals })
    expect(res).not.toBeNull()
  })

  it('routes technicals tab', () => {
    const res = tabTldr({ activeTab: 'technicals', research })
    expect(res).not.toBeNull()
  })

  it('routes business tab', () => {
    const res = tabTldr({ activeTab: 'business', research, fundamentals, ticker: 'AAPL' })
    expect(res).not.toBeNull()
  })

  it('routes options tab', () => {
    const res = tabTldr({ activeTab: 'options', analysis, fundamentals, ticker: 'AAPL' })
    expect(res).not.toBeNull()
  })

  it('routes fundamentals tab', () => {
    const res = tabTldr({ activeTab: 'fundamentals', fundamentals })
    expect(res).not.toBeNull()
  })

  it('returns null for unknown tab', () => {
    expect(tabTldr({ activeTab: 'unknown' })).toBeNull()
  })
})
