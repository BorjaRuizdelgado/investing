import { describe, it, expect } from 'vitest'
import {
  scoreHighBetter,
  scoreLowBetter,
  scoreRangeBetter,
  averageScore,
  softenScore,
  labelFromScore,
} from '../scoring.js'

// ---------------------------------------------------------------------------
// scoreHighBetter
// ---------------------------------------------------------------------------

describe('scoreHighBetter', () => {
  it('returns null for non-finite values', () => {
    expect(scoreHighBetter(NaN, 0, 100)).toBeNull()
    expect(scoreHighBetter(Infinity, 0, 100)).toBeNull()
    expect(scoreHighBetter(-Infinity, 0, 100)).toBeNull()
    expect(scoreHighBetter(undefined, 0, 100)).toBeNull()
    expect(scoreHighBetter(null, 0, 100)).toBeNull()
  })

  it('returns 0 at or below bad threshold', () => {
    expect(scoreHighBetter(10, 10, 50)).toBe(0)
    expect(scoreHighBetter(5, 10, 50)).toBe(0)
  })

  it('returns 100 at or above good threshold', () => {
    expect(scoreHighBetter(50, 10, 50)).toBe(100)
    expect(scoreHighBetter(80, 10, 50)).toBe(100)
  })

  it('returns linear value between bad and good', () => {
    // midpoint of 10..50 -> 50
    expect(scoreHighBetter(30, 10, 50)).toBe(50)
    // quarter way -> 25
    expect(scoreHighBetter(20, 10, 50)).toBe(25)
  })
})

// ---------------------------------------------------------------------------
// scoreLowBetter
// ---------------------------------------------------------------------------

describe('scoreLowBetter', () => {
  it('returns null for non-finite values', () => {
    expect(scoreLowBetter(NaN, 10, 50)).toBeNull()
    expect(scoreLowBetter(Infinity, 10, 50)).toBeNull()
    expect(scoreLowBetter(undefined, 10, 50)).toBeNull()
  })

  it('returns 100 at or below good threshold', () => {
    expect(scoreLowBetter(10, 10, 50)).toBe(100)
    expect(scoreLowBetter(5, 10, 50)).toBe(100)
  })

  it('returns 0 at or above bad threshold', () => {
    expect(scoreLowBetter(50, 10, 50)).toBe(0)
    expect(scoreLowBetter(60, 10, 50)).toBe(0)
  })

  it('returns linear value between good and bad', () => {
    // midpoint of 10..50 -> 50
    expect(scoreLowBetter(30, 10, 50)).toBe(50)
  })
})

// ---------------------------------------------------------------------------
// scoreRangeBetter
// ---------------------------------------------------------------------------

describe('scoreRangeBetter', () => {
  // Range: lowBad=0, lowGood=20, highGood=80, highBad=100
  it('returns 100 inside ideal range', () => {
    expect(scoreRangeBetter(50, 20, 80, 0, 100)).toBe(100)
    expect(scoreRangeBetter(20, 20, 80, 0, 100)).toBe(100)
    expect(scoreRangeBetter(80, 20, 80, 0, 100)).toBe(100)
  })

  it('returns 0 outside extreme bounds', () => {
    expect(scoreRangeBetter(0, 20, 80, 0, 100)).toBe(0)
    expect(scoreRangeBetter(-5, 20, 80, 0, 100)).toBe(0)
    expect(scoreRangeBetter(100, 20, 80, 0, 100)).toBe(0)
    expect(scoreRangeBetter(110, 20, 80, 0, 100)).toBe(0)
  })

  it('returns linear value between boundaries', () => {
    // midpoint between lowBad=0 and lowGood=20 -> 10 -> 50%
    expect(scoreRangeBetter(10, 20, 80, 0, 100)).toBe(50)
    // midpoint between highGood=80 and highBad=100 -> 90 -> 50%
    expect(scoreRangeBetter(90, 20, 80, 0, 100)).toBe(50)
  })

  it('returns null for non-finite', () => {
    expect(scoreRangeBetter(NaN, 20, 80, 0, 100)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// averageScore
// ---------------------------------------------------------------------------

describe('averageScore', () => {
  it('handles mixed null/number arrays', () => {
    expect(averageScore([80, null, 60])).toBe(70)
    expect(averageScore([100, null, null, 50])).toBe(75)
  })

  it('returns null for all-null array', () => {
    expect(averageScore([null, null, null])).toBeNull()
  })

  it('returns null for empty array', () => {
    expect(averageScore([])).toBeNull()
  })

  it('returns value for single-element array', () => {
    expect(averageScore([42])).toBe(42)
  })

  it('filters out NaN and Infinity', () => {
    expect(averageScore([NaN, 60, Infinity])).toBe(60)
  })
})

// ---------------------------------------------------------------------------
// softenScore
// ---------------------------------------------------------------------------

describe('softenScore', () => {
  it('compresses 0 to floor (8)', () => {
    expect(softenScore(0)).toBe(8)
  })

  it('compresses 100 to ceiling (92)', () => {
    expect(softenScore(100)).toBe(92)
  })

  it('compresses 50 to midpoint of [8, 92]', () => {
    expect(softenScore(50)).toBe(50)
  })

  it('output is always within [8, 92] for valid input', () => {
    for (const v of [0, 10, 25, 50, 75, 90, 100]) {
      const s = softenScore(v)
      expect(s).toBeGreaterThanOrEqual(8)
      expect(s).toBeLessThanOrEqual(92)
    }
  })

  it('returns null for non-finite input', () => {
    expect(softenScore(NaN)).toBeNull()
    expect(softenScore(Infinity)).toBeNull()
    expect(softenScore(-Infinity)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// labelFromScore
// ---------------------------------------------------------------------------

describe('labelFromScore', () => {
  it('returns "Weak" for score < 35', () => {
    expect(labelFromScore(0)).toBe('Weak')
    expect(labelFromScore(34)).toBe('Weak')
    expect(labelFromScore(34.9)).toBe('Weak')
  })

  it('returns "Mixed" for 35 <= score < 55', () => {
    expect(labelFromScore(35)).toBe('Mixed')
    expect(labelFromScore(45)).toBe('Mixed')
    expect(labelFromScore(54.9)).toBe('Mixed')
  })

  it('returns "Good" for 55 <= score < 75', () => {
    expect(labelFromScore(55)).toBe('Good')
    expect(labelFromScore(65)).toBe('Good')
    expect(labelFromScore(74.9)).toBe('Good')
  })

  it('returns "Strong" for score >= 75', () => {
    expect(labelFromScore(75)).toBe('Strong')
    expect(labelFromScore(100)).toBe('Strong')
  })

  it('returns "Unavailable" for non-finite', () => {
    expect(labelFromScore(NaN)).toBe('Unavailable')
    expect(labelFromScore(Infinity)).toBe('Unavailable')
    expect(labelFromScore(null)).toBe('Unavailable')
    expect(labelFromScore(undefined)).toBe('Unavailable')
  })
})

// ---------------------------------------------------------------------------
// No NaN in any output
// ---------------------------------------------------------------------------

describe('no NaN propagation', () => {
  it('scoring functions never return NaN', () => {
    const inputs = [0, 50, 100, -10, 200, NaN, null, undefined, Infinity, -Infinity]
    for (const v of inputs) {
      const sh = scoreHighBetter(v, 10, 90)
      const sl = scoreLowBetter(v, 10, 90)
      const sr = scoreRangeBetter(v, 20, 80, 0, 100)
      const sf = softenScore(v)

      for (const result of [sh, sl, sr, sf]) {
        if (result !== null) {
          expect(Number.isNaN(result)).toBe(false)
        }
      }
    }
  })

  it('averageScore never returns NaN', () => {
    expect(Number.isNaN(averageScore([NaN, NaN]))).toBe(false)
    const result = averageScore([NaN, NaN])
    expect(result).toBeNull()
  })
})
