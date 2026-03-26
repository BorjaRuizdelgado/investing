/**
 * analysis.ts — TypeScript version of analysis.js
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

// ---- Interfaces ----

export interface OptionLeg {
  strike: number
  lastPrice: number
  bid: number
  ask: number
  mid: number
  openInterest: number
  volume: number
  impliedVolatility: number
  inTheMoney?: boolean
}

export type Call = OptionLeg
export type Put = OptionLeg

export interface OptionChain {
  calls: Call[]
  puts: Put[]
  expirationDate: number
}

export interface Distribution {
  strikes: Float64Array
  pdf: Float64Array
  cdf: Float64Array
  mean: number
  median: number
  std: number
  skew: number
}

export interface ExpectedMoveResult {
  atmStrike: number
  callPrice: number
  putPrice: number
  straddle: number
  moveAbs: number
  movePct: number
  upper: number
  lower: number
}

export interface Probabilities {
  probAbove: number
  probBelow: number
}

export interface PercentileLevels {
  [percentile: number]: number
}

export interface IvSmileRow {
  strike: number
  iv: number
  moneyness: number
  type: 'call' | 'put'
}

export interface SRLevel {
  price: number
  type: 'support' | 'resistance'
  source: string
  strength: number
}

export interface SRResult {
  levels: SRLevel[]
  movingAvgs: Record<number, number | null>
  gammaWalls: number[]
}

export interface EntryResult {
  bias: 'bullish' | 'bearish' | 'neutral'
  biasScore: number
  entry: number
  stop: number
  target: number
  riskReward: number
  notes: string[]
}

export interface PutCallRatioResult {
  pcrVol: number
  pcrOi: number
  putVolume: number
  callVolume: number
  putOi: number
  callOi: number
  sentiment: string
}

export interface HistoryBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// ---- Helpers ----

function linspace(lo: number, hi: number, n: number): Float64Array {
  const arr = new Float64Array(n)
  const step = (hi - lo) / (n - 1)
  for (let i = 0; i < n; i++) arr[i] = lo + i * step
  return arr
}

function trapezoid(y: Float64Array, x: Float64Array): number {
  let sum = 0
  for (let i = 1; i < x.length; i++) {
    sum += 0.5 * (y[i] + y[i - 1]) * (x[i] - x[i - 1])
  }
  return sum
}

function searchSorted(arr: Float64Array, val: number): number {
  let lo = 0,
    hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid] < val) lo = mid + 1
    else hi = mid
  }
  return lo
}

function nearestStrike(options: OptionLeg[], target: number): number {
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

function enforceMonotoneDecreasing(prices: Float64Array): Float64Array {
  const p = Float64Array.from(prices)
  for (let i = p.length - 2; i >= 0; i--) {
    if (p[i] < p[i + 1]) p[i] = p[i + 1]
  }
  return p
}

// ---- Breeden-Litzenberger implied distribution ----

export function impliedDistribution(
  calls: Call[],
  spot: number,
  r: number,
  T: number,
  puts: Put[] | null = null,
  nPoints: number = DIST_POINTS,
): Distribution {
  const discount = Math.exp(-r * T)
  const rowMap = new Map<number, number>()

  for (const c of calls) {
    if (c.strike >= spot * 0.98 && c.mid > 0) {
      rowMap.set(c.strike, c.mid)
    }
  }

  if (puts) {
    for (const p of puts) {
      if (p.strike <= spot * 1.02 && p.mid > 0) {
        const syntheticC = p.mid + spot - p.strike * discount
        if (syntheticC > 0) {
          if (!rowMap.has(p.strike) || p.strike < spot) {
            rowMap.set(p.strike, syntheticC)
          }
        }
      }
    }
  }

  if (rowMap.size < MIN_STRIKES_STRICT) {
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
    if (rowMap.size < MIN_STRIKES_RELAXED) {
      throw new Error('Too few liquid strikes to build a distribution')
    }
  }

  const entries = [...rowMap.entries()].sort((a, b) => a[0] - b[0])
  const strikesRaw = new Float64Array(entries.map((e) => e[0]))
  let pricesRaw = new Float64Array(entries.map((e) => e[1]))
  pricesRaw = enforceMonotoneDecreasing(pricesRaw)

  const spline = cubicSpline(strikesRaw, pricesRaw)
  const lo = Math.max(strikesRaw[0], spot * STRIKE_RANGE_LO)
  const hi = Math.min(strikesRaw[strikesRaw.length - 1], spot * STRIKE_RANGE_HI)
  const K = linspace(lo, hi, nPoints)

  const pdf = new Float64Array(nPoints)
  for (let i = 0; i < nPoints; i++) {
    pdf[i] = Math.max(0, (1 / discount) * spline.derivative2(K[i]))
  }

  const total = trapezoid(pdf, K)
  if (total > 0) {
    for (let i = 0; i < nPoints; i++) pdf[i] /= total
  }

  const dK = K[1] - K[0]
  const cdf = new Float64Array(nPoints)
  let cumSum = 0
  for (let i = 0; i < nPoints; i++) {
    cumSum += pdf[i] * dK
    cdf[i] = Math.min(cumSum, 1)
  }

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

// ---- Expected move ----

export function expectedMove(calls: Call[], puts: Put[], spot: number): ExpectedMoveResult {
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

// ---- Probabilities ----

export function bullBearProbabilities(dist: Distribution, spot: number): Probabilities {
  const idx = Math.min(searchSorted(dist.strikes, spot), dist.cdf.length - 1)
  const probBelow = dist.cdf[idx]
  return { probAbove: 1 - probBelow, probBelow }
}

// ---- Percentile levels ----

export function percentileLevels(
  dist: Distribution,
  percentiles: number[] = [10, 25, 50, 75, 90],
): PercentileLevels {
  const levels: PercentileLevels = {}
  for (const p of percentiles) {
    const idx = Math.min(searchSorted(dist.cdf, p / 100), dist.strikes.length - 1)
    levels[p] = dist.strikes[idx]
  }
  return levels
}

// ---- Max pain ----

export function maxPain(calls: Call[], puts: Put[]): number {
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

// ---- IV smile ----

export function ivSmile(calls: Call[], puts: Put[], spot: number): IvSmileRow[] {
  const rows: IvSmileRow[] = []
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

// ---- Put/Call ratio ----

export function putCallRatio(calls: Call[], puts: Put[]): PutCallRatioResult {
  const sum = (arr: OptionLeg[], key: keyof OptionLeg) =>
    arr.reduce((s, o) => s + (Number(o[key]) || 0), 0)

  const cVol = sum(calls, 'volume')
  const pVol = sum(puts, 'volume')
  const cOi = sum(calls, 'openInterest')
  const pOi = sum(puts, 'openInterest')

  const pcrVol = cVol > 0 ? pVol / cVol : NaN
  const pcrOi = cOi > 0 ? pOi / cOi : NaN

  let sentiment: string
  if (!isNaN(pcrVol)) {
    sentiment = pcrVol > 1.2 ? 'bearish' : pcrVol < 0.7 ? 'bullish' : 'neutral'
  } else {
    sentiment = 'unknown'
  }

  return { pcrVol, pcrOi, putVolume: pVol, callVolume: cVol, putOi: pOi, callOi: cOi, sentiment }
}

// ---- Multi-expiry helpers ----

export function expiryWeights(dtes: number[]): number[] {
  const raw = dtes.map((d) => 1 / Math.sqrt(Math.max(d, 0.5)))
  const total = raw.reduce((a, b) => a + b, 0)
  return raw.map((w) => w / total)
}

export function mergeDistributions(
  dists: Distribution[],
  weights: number[],
  nPoints: number = DIST_POINTS,
): Distribution {
  if (dists.length === 1) return dists[0]

  let lo = Infinity,
    hi = -Infinity
  for (const d of dists) {
    lo = Math.min(lo, d.strikes[0])
    hi = Math.max(hi, d.strikes[d.strikes.length - 1])
  }
  const K = linspace(lo, hi, nPoints)
  const dK = K[1] - K[0]
  const pdf = new Float64Array(nPoints)

  for (let di = 0; di < dists.length; di++) {
    const d = dists[di]
    const w = weights[di]
    for (let i = 0; i < nPoints; i++) {
      const val = K[i]
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

  const pdfTotal = trapezoid(pdf, K)
  if (pdfTotal > 0) {
    for (let i = 0; i < nPoints; i++) pdf[i] /= pdfTotal
  }

  const cdf = new Float64Array(nPoints)
  let cumSum = 0
  for (let i = 0; i < nPoints; i++) {
    cumSum += pdf[i] * dK
    cdf[i] = Math.min(cumSum, 1)
  }

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

export function mergeExpectedMoves(
  ems: ExpectedMoveResult[],
  weights: number[],
  spot: number,
): ExpectedMoveResult {
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

export function mergeMaxPain(mps: number[], weights: number[]): number {
  if (mps.length === 1) return mps[0]
  let val = 0
  for (let i = 0; i < mps.length; i++) {
    if (!isNaN(mps[i])) val += weights[i] * mps[i]
  }
  return val
}

export function mergeIvSmiles(smiles: IvSmileRow[][]): IvSmileRow[] {
  return smiles.flat()
}

export function mergePutCallRatios(
  pcrs: PutCallRatioResult[],
  weights: number[],
): PutCallRatioResult {
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
  let sentiment: string
  if (!isNaN(pcrVol)) {
    sentiment = pcrVol > 1.2 ? 'bearish' : pcrVol < 0.7 ? 'bullish' : 'neutral'
  } else {
    sentiment = 'unknown'
  }
  return { pcrVol, pcrOi, putVolume: pVol, callVolume: cVol, putOi: pOi, callOi: cOi, sentiment }
}
