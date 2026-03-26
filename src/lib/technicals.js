/**
 * technicals.js — Technical analysis indicators derived from OHLCV history.
 *
 * Computes RSI, MACD, Bollinger Bands, MA crossover, and volume trend,
 * then produces a composite TA score following the same pattern as
 * deriveValuation / deriveRisk / etc.
 */

import { averageScore, softenScore, labelFromScore, scoreRangeBetter } from './scoring.js'
import { METRIC_TIPS } from './metricTips.js'
import {
  TA_RSI_PERIOD,
  TA_RSI_OVERSOLD,
  TA_RSI_OVERBOUGHT,
  TA_MACD_FAST,
  TA_MACD_SLOW,
  TA_MACD_SIGNAL,
  TA_BB_PERIOD,
  TA_BB_STD_DEV,
  TA_VOLUME_SHORT,
  TA_VOLUME_LONG,
} from './constants.js'

// ---- helpers ----

function sma(values, period) {
  const result = new Array(values.length).fill(null)
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += values[j]
    result[i] = sum / period
  }
  return result
}

function ema(values, period) {
  const result = new Array(values.length).fill(null)
  const k = 2 / (period + 1)
  // seed with SMA
  let sum = 0
  for (let i = 0; i < period; i++) sum += values[i]
  result[period - 1] = sum / period
  for (let i = period; i < values.length; i++) {
    result[i] = values[i] * k + result[i - 1] * (1 - k)
  }
  return result
}

function stdDev(values, period) {
  const result = new Array(values.length).fill(null)
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += values[j]
    const mean = sum / period
    let sqSum = 0
    for (let j = i - period + 1; j <= i; j++) sqSum += (values[j] - mean) ** 2
    result[i] = Math.sqrt(sqSum / period)
  }
  return result
}

// ---- indicator computations ----

function computeRSI(closes, period = TA_RSI_PERIOD) {
  const rsi = new Array(closes.length).fill(null)
  if (closes.length < period + 1) return rsi

  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1]
    if (delta > 0) avgGain += delta
    else avgLoss -= delta
  }
  avgGain /= period
  avgLoss /= period

  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)

  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1]
    const gain = delta > 0 ? delta : 0
    const loss = delta < 0 ? -delta : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return rsi
}

function computeMACD(closes, fast = TA_MACD_FAST, slow = TA_MACD_SLOW, sig = TA_MACD_SIGNAL) {
  const emaFast = ema(closes, fast)
  const emaSlow = ema(closes, slow)
  const macdLine = new Array(closes.length).fill(null)

  for (let i = 0; i < closes.length; i++) {
    if (emaFast[i] != null && emaSlow[i] != null) {
      macdLine[i] = emaFast[i] - emaSlow[i]
    }
  }

  // Signal line = EMA of MACD values (only where MACD is defined)
  const validStart = macdLine.findIndex((v) => v != null)
  if (validStart < 0) return { macdLine, signalLine: macdLine, histogram: macdLine }

  const macdValues = macdLine.slice(validStart).map((v) => v ?? 0)
  const sigEma = ema(macdValues, sig)

  const signalLine = new Array(closes.length).fill(null)
  const histogram = new Array(closes.length).fill(null)
  for (let i = 0; i < sigEma.length; i++) {
    if (sigEma[i] != null) {
      signalLine[validStart + i] = sigEma[i]
      if (macdLine[validStart + i] != null) {
        histogram[validStart + i] = macdLine[validStart + i] - sigEma[i]
      }
    }
  }

  return { macdLine, signalLine, histogram }
}

function computeBollingerBands(closes, period = TA_BB_PERIOD, mult = TA_BB_STD_DEV) {
  const middle = sma(closes, period)
  const sd = stdDev(closes, period)
  const upper = new Array(closes.length).fill(null)
  const lower = new Array(closes.length).fill(null)
  const percentB = new Array(closes.length).fill(null)
  const bandwidth = new Array(closes.length).fill(null)

  for (let i = 0; i < closes.length; i++) {
    if (middle[i] != null && sd[i] != null) {
      upper[i] = middle[i] + mult * sd[i]
      lower[i] = middle[i] - mult * sd[i]
      const range = upper[i] - lower[i]
      percentB[i] = range > 0 ? (closes[i] - lower[i]) / range : 0.5
      bandwidth[i] = middle[i] > 0 ? range / middle[i] : 0
    }
  }

  return { upper, middle, lower, percentB, bandwidth }
}

// ---- scoring helpers ----

function scoreRSI(rsi) {
  if (!Number.isFinite(rsi)) return null
  // 30-70 range is neutral-to-good; extremes penalised
  if (rsi <= TA_RSI_OVERSOLD) return 85 // oversold = bullish
  if (rsi >= TA_RSI_OVERBOUGHT) return 15 // overbought = bearish
  // Linear between 30-50 (bullish bias) and 50-70 (bearish bias)
  if (rsi <= 50) return 50 + ((50 - rsi) / 20) * 35
  return 50 - ((rsi - 50) / 20) * 35
}

function scoreMACDMomentum(histogram, macdLine, signalLine) {
  if (!Number.isFinite(histogram)) return null
  let score = 50
  // Positive histogram = bullish
  if (histogram > 0) score += 20
  else score -= 20
  // Bullish crossover (MACD above signal)
  if (Number.isFinite(macdLine) && Number.isFinite(signalLine)) {
    if (macdLine > signalLine) score += 10
    else score -= 10
  }
  return Math.max(0, Math.min(100, score))
}

function scoreBB(percentB) {
  if (!Number.isFinite(percentB)) return null
  // %B around 0.5 is neutral; near 0 = oversold (bullish), near 1 = overbought
  return scoreRangeBetter(percentB, 0.3, 0.7, -0.1, 1.1)
}

function scoreMACrossover(sma50Val, sma200Val) {
  if (!Number.isFinite(sma50Val) || !Number.isFinite(sma200Val)) return null
  const ratio = sma50Val / sma200Val
  // Golden cross territory = bullish, death cross = bearish
  if (ratio >= 1.02) return 85
  if (ratio >= 1.0) return 65
  if (ratio >= 0.98) return 35
  return 15
}

function scoreVolumeTrend(ratio, priceUp) {
  if (!Number.isFinite(ratio)) return null
  // High volume + price up = bullish; high volume + price down = bearish
  if (ratio > 1.3 && priceUp) return 80
  if (ratio > 1.3 && !priceUp) return 20
  if (ratio < 0.7) return 40 // Low volume = lack of conviction
  return 50
}

// ---- main derive function ----

function addReason(reasons, tone, title, detail) {
  reasons.push({ tone, title, detail })
}

export function deriveTechnicals(analysis, spot) {
  const history = analysis?.history
  if (!history || history.length < 50) {
    return { hasData: false, score: null, label: 'Unavailable', metrics: [], reasons: [], indicators: null }
  }

  const closes = history.map((b) => b.close)
  const volumes = history.map((b) => b.volume)
  const dates = history.map((b) => b.date)

  // Compute indicators
  const rsiSeries = computeRSI(closes)
  const { macdLine, signalLine, histogram } = computeMACD(closes)
  const bb = computeBollingerBands(closes)
  const sma50 = sma(closes, 50)
  const sma200 = sma(closes, 200)
  const sma20 = bb.middle

  // Latest values
  const last = closes.length - 1
  const rsiVal = rsiSeries[last]
  const macdVal = macdLine[last]
  const signalVal = signalLine[last]
  const histVal = histogram[last]
  const bbPercentB = bb.percentB[last]
  const bbBandwidth = bb.bandwidth[last]
  const sma50Val = sma50[last]
  const sma200Val = sma200[last]

  // Volume ratio
  const shortVol = volumes.slice(-TA_VOLUME_SHORT)
  const longVol = volumes.slice(-TA_VOLUME_LONG)
  const avgShortVol = shortVol.reduce((a, b) => a + b, 0) / shortVol.length
  const avgLongVol = longVol.reduce((a, b) => a + b, 0) / longVol.length
  const volRatio = avgLongVol > 0 ? avgShortVol / avgLongVol : null

  // Price direction (5-day)
  const priceUp = closes[last] > closes[Math.max(0, last - 5)]

  // MA crossover detection
  let crossoverSignal = 'None'
  if (Number.isFinite(sma50Val) && Number.isFinite(sma200Val)) {
    if (sma50Val > sma200Val) crossoverSignal = 'Golden cross'
    else crossoverSignal = 'Death cross'
    // Check for recent crossover (within 10 bars)
    for (let i = Math.max(0, last - 10); i < last; i++) {
      if (Number.isFinite(sma50[i]) && Number.isFinite(sma200[i])) {
        const wasBullish = sma50[i] > sma200[i]
        const isBullish = sma50Val > sma200Val
        if (wasBullish !== isBullish) {
          crossoverSignal = isBullish ? 'Golden cross (recent)' : 'Death cross (recent)'
          break
        }
      }
    }
  }

  // MACD crossover detection
  let macdCrossover = null
  if (Number.isFinite(macdVal) && Number.isFinite(signalVal)) {
    for (let i = Math.max(0, last - 5); i < last; i++) {
      if (Number.isFinite(macdLine[i]) && Number.isFinite(signalLine[i])) {
        const wasBullish = macdLine[i] > signalLine[i]
        const isBullish = macdVal > signalVal
        if (wasBullish !== isBullish) {
          macdCrossover = isBullish ? 'bullish' : 'bearish'
          break
        }
      }
    }
  }

  // Scoring
  const subScores = [
    scoreRSI(rsiVal),
    scoreMACDMomentum(histVal, macdVal, signalVal),
    scoreBB(bbPercentB),
    scoreMACrossover(sma50Val, sma200Val),
    scoreVolumeTrend(volRatio, priceUp),
  ]

  const raw = averageScore(subScores)
  const validCount = subScores.filter((s) => Number.isFinite(s)).length
  const finalScore = validCount >= 2 ? softenScore(raw) : null
  const label = validCount >= 2 ? labelFromScore(finalScore) : 'Unavailable'

  // Reasons
  const reasons = []
  if (Number.isFinite(rsiVal)) {
    if (rsiVal <= TA_RSI_OVERSOLD)
      addReason(reasons, 'positive', 'RSI oversold', `RSI(14) at ${rsiVal.toFixed(1)} suggests potential bounce.`)
    else if (rsiVal >= TA_RSI_OVERBOUGHT)
      addReason(reasons, 'negative', 'RSI overbought', `RSI(14) at ${rsiVal.toFixed(1)} suggests potential pullback.`)
    else
      addReason(reasons, 'neutral', 'RSI neutral', `RSI(14) at ${rsiVal.toFixed(1)} is in neutral territory.`)
  }
  if (macdCrossover === 'bullish')
    addReason(reasons, 'positive', 'MACD bullish crossover', 'MACD crossed above signal line recently.')
  else if (macdCrossover === 'bearish')
    addReason(reasons, 'negative', 'MACD bearish crossover', 'MACD crossed below signal line recently.')
  else if (Number.isFinite(histVal))
    addReason(
      reasons,
      histVal > 0 ? 'positive' : 'negative',
      histVal > 0 ? 'MACD positive' : 'MACD negative',
      `Histogram at ${histVal.toFixed(3)}.`,
    )

  if (Number.isFinite(bbBandwidth) && bbBandwidth < 0.04)
    addReason(reasons, 'neutral', 'Bollinger squeeze', 'Narrow bandwidth suggests a breakout is building.')
  else if (Number.isFinite(bbPercentB)) {
    if (bbPercentB > 1)
      addReason(reasons, 'negative', 'Above upper Bollinger Band', 'Price is extended above the upper band.')
    else if (bbPercentB < 0)
      addReason(reasons, 'positive', 'Below lower Bollinger Band', 'Price is extended below the lower band.')
  }

  if (crossoverSignal.includes('Golden'))
    addReason(reasons, 'positive', crossoverSignal, '50-day SMA is above 200-day SMA.')
  else if (crossoverSignal.includes('Death'))
    addReason(reasons, 'negative', crossoverSignal, '50-day SMA is below 200-day SMA.')

  if (Number.isFinite(volRatio)) {
    if (volRatio > 1.5 && priceUp)
      addReason(reasons, 'positive', 'High volume rally', `Volume ratio ${volRatio.toFixed(2)}x confirms upward move.`)
    else if (volRatio > 1.5 && !priceUp)
      addReason(reasons, 'negative', 'High volume decline', `Volume ratio ${volRatio.toFixed(2)}x confirms selling pressure.`)
  }

  const metrics = [
    { key: 'rsi14', label: 'RSI (14)', value: rsiVal, kind: 'ratio', tip: METRIC_TIPS.rsi14 },
    { key: 'macd', label: 'MACD', value: macdVal, kind: 'ratio', tip: METRIC_TIPS.macd },
    { key: 'macdSignal', label: 'Signal', value: signalVal, kind: 'ratio', tip: METRIC_TIPS.macdSignal },
    { key: 'bollingerPosition', label: '%B', value: bbPercentB, kind: 'ratio', tip: METRIC_TIPS.bollingerPosition },
    { key: 'bollingerBandwidth', label: 'BB Width', value: bbBandwidth, kind: 'ratio', tip: METRIC_TIPS.bollingerBandwidth },
    { key: 'maCrossover', label: 'MA Cross', value: crossoverSignal, kind: 'text', tip: METRIC_TIPS.maCrossover },
    { key: 'volumeTrend', label: 'Vol Ratio (5d/20d)', value: volRatio, kind: 'ratio', tip: METRIC_TIPS.volumeTrend },
  ]

  return {
    hasData: validCount >= 2,
    score: finalScore,
    label,
    metrics,
    reasons,
    indicators: {
      dates,
      closes,
      rsi: rsiSeries,
      macdLine,
      signalLine,
      histogram,
      bbUpper: bb.upper,
      bbMiddle: bb.middle,
      bbLower: bb.lower,
      sma50,
      sma200,
    },
  }
}
