/**
 * analysis.js — Ported from Python analysis.py
 *
 * Core maths: Breeden-Litzenberger implied distribution,
 * expected move, probabilities, percentiles, max pain,
 * IV smile, support/resistance, entry analysis, put/call ratio.
 */

import { cubicSpline } from './spline.js'
import {
  MIN_STRIKES_STRICT,
  MIN_STRIKES_RELAXED,
  OTM_CALL_FACTOR_RELAXED,
  OTM_PUT_FACTOR_RELAXED,
  STRIKE_RANGE_LO,
  STRIKE_RANGE_HI,
  STRADDLE_MOVE_FACTOR,
  ATM_BAND_LO,
  ATM_BAND_HI,
  DIST_POINTS,
  SR_LEVEL_COUNT,
} from './constants.js'

// ---------- helpers ----------

function linspace(lo, hi, n) {
  const arr = new Float64Array(n)
  const step = (hi - lo) / (n - 1)
  for (let i = 0; i < n; i++) arr[i] = lo + i * step
  return arr
}

function trapezoid(y, x) {
  let sum = 0
  for (let i = 1; i < x.length; i++) {
    sum += 0.5 * (y[i] + y[i - 1]) * (x[i] - x[i - 1])
  }
  return sum
}

function searchSorted(arr, val) {
  let lo = 0,
    hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid] < val) lo = mid + 1
    else hi = mid
  }
  return lo
}

function nearestStrike(options, target) {
  let best = options[0].strike
  let bestDist = Math.abs(best - target)
  for (const o of options) {
    const d = Math.abs(o.strike - target)
    if (d < bestDist) {
      best = o.strike
      bestDist = d
    }
  }
  return best
}

function enforceMonotoneDecreasing(prices) {
  const p = Float64Array.from(prices)
  for (let i = p.length - 2; i >= 0; i--) {
    if (p[i] < p[i + 1]) p[i] = p[i + 1]
  }
  return p
}

// =================================================================
// Breeden-Litzenberger implied distribution
// =================================================================

export function impliedDistribution(calls, spot, r, T, puts = null, nPoints = DIST_POINTS) {
  const discount = Math.exp(-r * T)

  // Build synthetic call-price curve from OTM options
  const rowMap = new Map() // strike -> price (deduplicate)

  // OTM calls (strike >= 0.98 * spot)
  for (const c of calls) {
    if (c.strike >= spot * 0.98 && c.mid > 0) {
      rowMap.set(c.strike, c.mid)
    }
  }

  // OTM puts -> synthetic call via put-call parity
  if (puts) {
    for (const p of puts) {
      if (p.strike <= spot * 1.02 && p.mid > 0) {
        const syntheticC = p.mid + spot - p.strike * discount
        if (syntheticC > 0) {
          // Prefer OTM call data if we already have it
          if (!rowMap.has(p.strike) || p.strike < spot) {
            rowMap.set(p.strike, syntheticC)
          }
        }
      }
    }
  }

  if (rowMap.size < MIN_STRIKES_STRICT) {
    // Try a relaxed pass for sparse markets (crypto): expand OTM bounds
    for (const c of calls) {
      if (c.strike >= spot * OTM_CALL_FACTOR_RELAXED && c.mid > 0) {
        if (!rowMap.has(c.strike)) rowMap.set(c.strike, c.mid)
      }
    }
    if (puts) {
      for (const p of puts) {
        if (p.strike <= spot * OTM_PUT_FACTOR_RELAXED && p.mid > 0) {
          const syntheticC = p.mid + spot - p.strike * discount
          if (syntheticC > 0) {
            if (!rowMap.has(p.strike) || p.strike < spot) {
              rowMap.set(p.strike, syntheticC)
            }
          }
        }
      }
    }

    // If still too few, allow a lower threshold so we can still compute
    if (rowMap.size < MIN_STRIKES_RELAXED) {
      throw new Error('Too few liquid strikes to build a distribution')
    }
  }

  // Sort by strike
  const entries = [...rowMap.entries()].sort((a, b) => a[0] - b[0])
  const strikesRaw = new Float64Array(entries.map((e) => e[0]))
  let pricesRaw = new Float64Array(entries.map((e) => e[1]))

  // Enforce monotonically decreasing call prices
  pricesRaw = enforceMonotoneDecreasing(pricesRaw)

  // Build cubic spline
  const spline = cubicSpline(strikesRaw, pricesRaw)

  // Strike range
  const lo = Math.max(strikesRaw[0], spot * STRIKE_RANGE_LO)
  const hi = Math.min(strikesRaw[strikesRaw.length - 1], spot * STRIKE_RANGE_HI)
  const K = linspace(lo, hi, nPoints)

  // Second derivative -> PDF
  const pdf = new Float64Array(nPoints)
  for (let i = 0; i < nPoints; i++) {
    pdf[i] = Math.max(0, (1 / discount) * spline.derivative2(K[i]))
  }

  // Normalise
  const total = trapezoid(pdf, K)
  if (total > 0) {
    for (let i = 0; i < nPoints; i++) pdf[i] /= total
  }

  // CDF
  const dK = K[1] - K[0]
  const cdf = new Float64Array(nPoints)
  let cumSum = 0
  for (let i = 0; i < nPoints; i++) {
    cumSum += pdf[i] * dK
    cdf[i] = Math.min(cumSum, 1)
  }

  // Summary statistics
  const kPdf = new Float64Array(nPoints)
  for (let i = 0; i < nPoints; i++) kPdf[i] = K[i] * pdf[i]
  const mean = trapezoid(kPdf, K)

  const varArr = new Float64Array(nPoints)
  for (let i = 0; i < nPoints; i++) varArr[i] = (K[i] - mean) ** 2 * pdf[i]
  const variance = trapezoid(varArr, K)
  const std = Math.sqrt(Math.max(variance, 0))

  let skew = 0
  if (std > 0) {
    const skewArr = new Float64Array(nPoints)
    for (let i = 0; i < nPoints; i++) skewArr[i] = ((K[i] - mean) / std) ** 3 * pdf[i]
    skew = trapezoid(skewArr, K)
  }

  const idxMedian = Math.min(searchSorted(cdf, 0.5), nPoints - 1)
  const median = K[idxMedian]

  return { strikes: K, pdf, cdf, mean, median, std, skew }
}

// =================================================================
// Expected move from ATM straddle
// =================================================================

export function expectedMove(calls, puts, spot) {
  const atmK = nearestStrike(calls, spot)
  const callRow = calls.find((c) => c.strike === atmK)
  const putRow = puts.find((p) => p.strike === atmK)

  const cPrice = callRow?.mid || 0
  const pPrice = putRow?.mid || 0
  const straddle = cPrice + pPrice
  const move = straddle * STRADDLE_MOVE_FACTOR

  return {
    atmStrike: atmK,
    callPrice: cPrice,
    putPrice: pPrice,
    straddle,
    moveAbs: move,
    movePct: (move / spot) * 100,
    upper: spot + move,
    lower: spot - move,
  }
}

// =================================================================
// Probability of finishing above / below spot
// =================================================================

export function bullBearProbabilities(dist, spot) {
  const idx = Math.min(searchSorted(dist.strikes, spot), dist.cdf.length - 1)
  const probBelow = dist.cdf[idx]
  return { probAbove: 1 - probBelow, probBelow }
}

// =================================================================
// Percentile price levels
// =================================================================

export function percentileLevels(dist, percentiles = [10, 25, 50, 75, 90]) {
  const levels = {}
  for (const p of percentiles) {
    const idx = Math.min(searchSorted(dist.cdf, p / 100), dist.strikes.length - 1)
    levels[p] = dist.strikes[idx]
  }
  return levels
}

// =================================================================
// Max-pain calculation
// =================================================================

export function maxPain(calls, puts) {
  const callStrikes = new Set(calls.map((c) => c.strike))
  const putStrikes = new Set(puts.map((p) => p.strike))
  const common = [...callStrikes].filter((s) => putStrikes.has(s)).sort((a, b) => a - b)

  if (common.length === 0) return NaN

  let minPain = Infinity
  let mpStrike = common[0]

  for (const k of common) {
    let total = 0
    for (const s of common) {
      const cOi = calls.find((c) => c.strike === s)?.openInterest || 0
      const pOi = puts.find((p) => p.strike === s)?.openInterest || 0
      if (s < k) total += (k - s) * cOi
      if (s > k) total += (s - k) * pOi
    }
    if (total < minPain) {
      minPain = total
      mpStrike = k
    }
  }

  return mpStrike
}

// =================================================================
// IV smile data
// =================================================================

export function ivSmile(calls, puts, spot) {
  const rows = []

  // Use OTM convention: calls for strikes >= spot, puts for strikes <= spot.
  // Allow a small overlap band (2%) near ATM so both sides appear around the money.
  const atmBandLo = spot * ATM_BAND_LO
  const atmBandHi = spot * ATM_BAND_HI

  for (const c of calls) {
    if (c.impliedVolatility > 0 && c.strike >= atmBandLo) {
      rows.push({
        strike: c.strike,
        iv: c.impliedVolatility,
        moneyness: c.strike / spot,
        type: 'call',
      })
    }
  }
  for (const p of puts) {
    if (p.impliedVolatility > 0 && p.strike <= atmBandHi) {
      rows.push({
        strike: p.strike,
        iv: p.impliedVolatility,
        moneyness: p.strike / spot,
        type: 'put',
      })
    }
  }
  return rows
}

// =================================================================
// Support & Resistance levels
// =================================================================

export function supportResistanceLevels(
  history,
  calls,
  puts,
  spot,
  nLevels = SR_LEVEL_COUNT,
  pivotWindow = 5,
) {
  const levels = []
  const movingAvgs = { 20: null, 50: null, 200: null }

  if (history && history.length > 0) {
    const closes = history.map((b) => b.close)

    // 1. Moving averages
    for (const period of [20, 50, 200]) {
      if (closes.length >= period) {
        const slice = closes.slice(-period)
        const ma = slice.reduce((a, b) => a + b, 0) / slice.length
        movingAvgs[period] = ma
        const srType = ma < spot ? 'support' : 'resistance'
        const strength = period === 20 ? 1 : period === 50 ? 2 : 3
        levels.push({ price: ma, type: srType, source: `MA${period}`, strength })
      }
    }

    // 2. Pivot highs/lows
    const highs = history.map((b) => b.high || b.close)
    const lows = history.map((b) => b.low || b.close)
    const n = closes.length
    const pw = Math.min(pivotWindow, Math.max(Math.floor(n / 10), 1))
    const pivotHighs = []
    const pivotLows = []

    for (let i = pw; i < n - pw; i++) {
      let isHigh = true
      let isLow = true
      for (let j = i - pw; j < i; j++) {
        if (highs[i] < highs[j]) isHigh = false
        if (lows[i] > lows[j]) isLow = false
      }
      for (let j = i + 1; j <= i + pw; j++) {
        if (highs[i] < highs[j]) isHigh = false
        if (lows[i] > lows[j]) isLow = false
      }
      if (isHigh) pivotHighs.push(highs[i])
      if (isLow) pivotLows.push(lows[i])
    }

    function cluster(prices, tol = 0.015) {
      if (!prices.length) return []
      const sorted = [...new Set(prices)].sort((a, b) => a - b)
      const clusters = []
      let current = [sorted[0]]
      for (let i = 1; i < sorted.length; i++) {
        if ((sorted[i] - current[0]) / current[0] < tol) {
          current.push(sorted[i])
        } else {
          clusters.push(current.reduce((a, b) => a + b, 0) / current.length)
          current = [sorted[i]]
        }
      }
      clusters.push(current.reduce((a, b) => a + b, 0) / current.length)
      return clusters
    }

    for (const ph of cluster(pivotHighs).sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot))) {
      if (Math.abs(ph - spot) / spot < 0.2) {
        levels.push({
          price: ph,
          type: ph >= spot ? 'resistance' : 'support',
          source: 'pivot',
          strength: 2,
        })
      }
    }

    for (const pl of cluster(pivotLows).sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot))) {
      if (Math.abs(pl - spot) / spot < 0.2) {
        levels.push({
          price: pl,
          type: pl <= spot ? 'support' : 'resistance',
          source: 'pivot',
          strength: 2,
        })
      }
    }
  }

  // 3. Gamma walls (high-OI strikes)
  const gammaWalls = []
  const oiMap = new Map()
  for (const c of calls) {
    const oi = c.openInterest || 0
    oiMap.set(c.strike, (oiMap.get(c.strike) || 0) + oi)
  }
  for (const p of puts) {
    const oi = p.openInterest || 0
    oiMap.set(p.strike, (oiMap.get(p.strike) || 0) + oi)
  }

  const topOi = [...oiMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)

  for (const [k] of topOi) {
    if (Math.abs(k - spot) / spot < 0.25) {
      gammaWalls.push(k)
      levels.push({
        price: k,
        type: k > spot ? 'resistance' : 'support',
        source: 'gamma_wall',
        strength: 3,
      })
    }
  }

  // Deduplicate: merge within 0.75%
  function mergeLevels(raw, tol = 0.0075) {
    if (!raw.length) return []
    const sorted = [...raw].sort((a, b) => a.price - b.price)
    const merged = []
    let i = 0
    while (i < sorted.length) {
      const group = [sorted[i]]
      let j = i + 1
      while (
        j < sorted.length &&
        Math.abs(sorted[j].price - sorted[i].price) / sorted[i].price < tol
      ) {
        group.push(sorted[j])
        j++
      }
      const best = group.reduce((a, b) => (a.strength >= b.strength ? a : b))
      const avgPrice = group.reduce((sum, g) => sum + g.price, 0) / group.length
      merged.push({ ...best, price: avgPrice })
      i = j
    }
    return merged
  }

  const merged = mergeLevels(levels)
  const below = merged
    .filter((l) => l.price < spot)
    .sort((a, b) => b.price - a.price)
    .slice(0, nLevels)
  const above = merged
    .filter((l) => l.price > spot)
    .sort((a, b) => a.price - b.price)
    .slice(0, nLevels)

  return {
    levels: [...below, ...above],
    movingAvgs,
    gammaWalls: gammaWalls.sort((a, b) => a - b),
  }
}

// =================================================================
// Entry analysis
// =================================================================

export function entryAnalysis(dist, em, probs, pctiles, sr, spot) {
  const notes = []
  const meanPct = ((dist.mean - spot) / spot) * 100
  const probAbove = probs.probAbove
  const skew = dist.skew

  let raw = (probAbove - 0.5) * 2
  raw += Math.max(-0.3, Math.min(0.3, meanPct / 5))
  raw += skew * 0.05
  const biasScore = Math.max(-1, Math.min(1, raw))

  let bias
  if (biasScore > 0.12) bias = 'bullish'
  else if (biasScore < -0.12) bias = 'bearish'
  else bias = 'neutral'

  notes.push(`Implied probability above spot: ${(probAbove * 100).toFixed(1)}%`)
  notes.push(
    `Options-implied mean: $${dist.mean.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} (${meanPct >= 0 ? '+' : ''}${meanPct.toFixed(1)}% vs spot)`,
  )

  if (skew < -0.3) notes.push('Negative skew — market pricing left-tail / downside risk')
  else if (skew > 0.3) notes.push('Positive skew — market pricing in upside potential')

  const lvls = sr.levels || []
  const supports = lvls
    .filter((l) => l.price < spot)
    .map((l) => l.price)
    .sort((a, b) => b - a)
  const resistances = lvls
    .filter((l) => l.price > spot)
    .map((l) => l.price)
    .sort((a, b) => a - b)

  const nearestSup = supports[0] || spot * 0.97
  const nextSup = supports[1] || spot * 0.94
  const nearestRes = resistances[0] || spot * 1.03
  const nextRes = resistances[1] || spot * 1.06

  let entry, stop, target

  if (bias === 'bullish') {
    entry = nearestSup
    stop = nextSup * 0.995
    target = pctiles[75] || nearestRes
    notes.push(`Bullish setup — enter near support $${nearestSup.toFixed(2)}`)
    notes.push(`Stop just below next support: $${stop.toFixed(2)}`)
    notes.push(`Target (75th pct / resistance): $${target.toFixed(2)}`)
  } else if (bias === 'bearish') {
    entry = nearestRes
    stop = nextRes * 1.005
    target = pctiles[25] || nearestSup
    notes.push(`Bearish setup — enter at resistance $${nearestRes.toFixed(2)}`)
    notes.push(`Stop just above next resistance: $${stop.toFixed(2)}`)
    notes.push(`Target (25th pct / support): $${target.toFixed(2)}`)
  } else {
    entry = spot
    stop = nearestSup * 0.99
    target = nearestRes
    notes.push('Neutral — no strong directional signal from options market')
    notes.push(
      `Key levels — support: $${nearestSup.toFixed(2)}, resistance: $${nearestRes.toFixed(2)}`,
    )
  }

  const reward = Math.abs(target - entry)
  const risk = Math.abs(entry - stop)
  const rr = risk > 0 ? Math.round((reward / risk) * 100) / 100 : NaN
  if (!isNaN(rr)) notes.push(`Risk/reward: ${rr.toFixed(1)}x`)

  notes.push(
    `Expected move (+-${em.movePct.toFixed(1)}%): $${em.lower.toFixed(2)} – $${em.upper.toFixed(2)}`,
  )

  return { bias, biasScore, entry, stop, target, riskReward: rr, notes }
}

// =================================================================
// Multi-expiry weighted merge
// =================================================================

/**
 * Compute inverse-DTE weights for a list of expiry analyses.
 * Closer expirations get exponentially more weight.
 * @param {number[]} dtes - Days-to-expiry for each chain
 * @returns {number[]} normalised weights summing to 1
 */
export function expiryWeights(dtes) {
  // Use 1/sqrt(DTE) for a balanced decay — gives near-term more weight
  // without completely ignoring longer-dated chains.
  const raw = dtes.map((d) => 1 / Math.sqrt(Math.max(d, 0.5)))
  const total = raw.reduce((a, b) => a + b, 0)
  return raw.map((w) => w / total)
}

/**
 * Merge multiple implied distributions onto a common strike grid.
 * Re-samples each PDF onto the union range, then blends with weights.
 */
export function mergeDistributions(dists, weights, nPoints = 500) {
  if (dists.length === 1) return dists[0]

  // Union strike range
  let lo = Infinity,
    hi = -Infinity
  for (const d of dists) {
    lo = Math.min(lo, d.strikes[0])
    hi = Math.max(hi, d.strikes[d.strikes.length - 1])
  }
  const K = linspace(lo, hi, nPoints)
  const dK = K[1] - K[0]

  // Resample each PDF onto K via linear interpolation, then weight
  const pdf = new Float64Array(nPoints)

  for (let di = 0; di < dists.length; di++) {
    const d = dists[di]
    const w = weights[di]
    for (let i = 0; i < nPoints; i++) {
      const val = K[i]
      // linear interp in source PDF
      if (val <= d.strikes[0]) {
        pdf[i] += w * d.pdf[0]
      } else if (val >= d.strikes[d.strikes.length - 1]) {
        pdf[i] += w * d.pdf[d.pdf.length - 1]
      } else {
        const idx = searchSorted(d.strikes, val)
        const x0 = d.strikes[idx - 1],
          x1 = d.strikes[idx]
        const y0 = d.pdf[idx - 1],
          y1 = d.pdf[idx]
        const t = (val - x0) / (x1 - x0)
        pdf[i] += w * (y0 + t * (y1 - y0))
      }
    }
  }

  // Re-normalise blended PDF
  const pdfTotal = trapezoid(pdf, K)
  if (pdfTotal > 0) {
    for (let i = 0; i < nPoints; i++) pdf[i] /= pdfTotal
  }

  // Rebuild CDF
  const cdf = new Float64Array(nPoints)
  let cumSum = 0
  for (let i = 0; i < nPoints; i++) {
    cumSum += pdf[i] * dK
    cdf[i] = Math.min(cumSum, 1)
  }

  // Summary stats
  const kPdf = new Float64Array(nPoints)
  for (let i = 0; i < nPoints; i++) kPdf[i] = K[i] * pdf[i]
  const mean = trapezoid(kPdf, K)

  const varArr = new Float64Array(nPoints)
  for (let i = 0; i < nPoints; i++) varArr[i] = (K[i] - mean) ** 2 * pdf[i]
  const variance = trapezoid(varArr, K)
  const std = Math.sqrt(Math.max(variance, 0))

  let skew = 0
  if (std > 0) {
    const skewArr = new Float64Array(nPoints)
    for (let i = 0; i < nPoints; i++) skewArr[i] = ((K[i] - mean) / std) ** 3 * pdf[i]
    skew = trapezoid(skewArr, K)
  }

  const idxMedian = Math.min(searchSorted(cdf, 0.5), nPoints - 1)
  const median = K[idxMedian]

  return { strikes: K, pdf, cdf, mean, median, std, skew }
}

/**
 * Weighted-average merge of expected-move objects.
 */
export function mergeExpectedMoves(ems, weights, spot) {
  if (ems.length === 1) return ems[0]

  let movePct = 0
  for (let i = 0; i < ems.length; i++) movePct += weights[i] * ems[i].movePct

  const moveAbs = (movePct / 100) * spot
  return {
    atmStrike: ems[0].atmStrike,
    callPrice: ems[0].callPrice,
    putPrice: ems[0].putPrice,
    straddle: ems[0].straddle,
    moveAbs,
    movePct,
    upper: spot + moveAbs,
    lower: spot - moveAbs,
  }
}

/**
 * Merge max-pain values (weighted average).
 */
export function mergeMaxPain(mps, weights) {
  if (mps.length === 1) return mps[0]
  let val = 0
  for (let i = 0; i < mps.length; i++) {
    if (!isNaN(mps[i])) val += weights[i] * mps[i]
  }
  return val
}

/**
 * Merge IV smile data from multiple chains.
 * Keeps all rows, tagged with their expiry weight for potential use.
 */
export function mergeIvSmiles(smiles) {
  // Flatten all rows — charts can display all of them
  return smiles.flat()
}

/**
 * Merge put/call ratio across chains (weighted by OI contribution).
 */
export function mergePutCallRatios(pcrs, weights) {
  if (pcrs.length === 1) return pcrs[0]

  let pVol = 0,
    cVol = 0,
    pOi = 0,
    cOi = 0
  for (let i = 0; i < pcrs.length; i++) {
    const w = weights[i]
    pVol += w * pcrs[i].putVolume
    cVol += w * pcrs[i].callVolume
    pOi += w * pcrs[i].putOi
    cOi += w * pcrs[i].callOi
  }

  const pcrVol = cVol > 0 ? pVol / cVol : NaN
  const pcrOi = cOi > 0 ? pOi / cOi : NaN

  let sentiment
  if (!isNaN(pcrVol)) {
    sentiment = pcrVol > 1.2 ? 'bearish' : pcrVol < 0.7 ? 'bullish' : 'neutral'
  } else {
    sentiment = 'unknown'
  }

  return { pcrVol, pcrOi, putVolume: pVol, callVolume: cVol, putOi: pOi, callOi: cOi, sentiment }
}

// =================================================================
// Put/Call ratio
// =================================================================

export function putCallRatio(calls, puts) {
  const sum = (arr, key) => arr.reduce((s, o) => s + (Number(o[key]) || 0), 0)

  const cVol = sum(calls, 'volume')
  const pVol = sum(puts, 'volume')
  const cOi = sum(calls, 'openInterest')
  const pOi = sum(puts, 'openInterest')

  const pcrVol = cVol > 0 ? pVol / cVol : NaN
  const pcrOi = cOi > 0 ? pOi / cOi : NaN

  let sentiment
  if (!isNaN(pcrVol)) {
    sentiment = pcrVol > 1.2 ? 'bearish' : pcrVol < 0.7 ? 'bullish' : 'neutral'
  } else {
    sentiment = 'unknown'
  }

  return {
    pcrVol,
    pcrOi,
    putVolume: pVol,
    callVolume: cVol,
    putOi: pOi,
    callOi: cOi,
    sentiment,
  }
}
