/**
 * Build plain-English TL;DR summaries for each analysis tab.
 * Every function returns { text, tone } or null if insufficient data.
 */

export function valuationTldr(research, fundamentals) {
  const v = research?.valuation
  if (!v?.hasData) return null
  const score = v.score
  const label = v.label
  const ticker = fundamentals?.symbol || ''

  if (score >= 70) {
    return {
      tone: 'positive',
      text: `${ticker || 'This stock'} looks undervalued compared to sector peers. Most valuation metrics sit below the sector median.`,
    }
  }
  if (score >= 50) {
    return {
      tone: 'neutral',
      text: `${ticker || 'This stock'} appears roughly fairly valued — not an obvious bargain, but not overpriced either.`,
    }
  }
  return {
    tone: 'negative',
    text: `${ticker || 'This stock'} looks expensive relative to the sector. You're paying a premium here — make sure the quality justifies it.`,
  }
}

export function qualityTldr(research, fundamentals) {
  const q = research?.quality
  if (!q?.hasData) return null
  const score = q.score
  const ticker = fundamentals?.symbol || ''

  if (score >= 70) {
    return {
      tone: 'positive',
      text: `${ticker || 'This company'} shows strong fundamentals — healthy margins, solid growth, and consistent cash generation.`,
    }
  }
  if (score >= 45) {
    return {
      tone: 'neutral',
      text: `${ticker || 'This company'} has mixed business quality — some metrics are solid, others need watching.`,
    }
  }
  return {
    tone: 'negative',
    text: `${ticker || 'This company'} has weak business fundamentals. Margins, growth, or cash generation are lagging behind peers.`,
  }
}

export function riskTldr(research, fundamentals) {
  const r = research?.risk
  if (!r?.hasData) return null
  const safety = r.safetyScore
  const ticker = fundamentals?.symbol || ''

  if (safety >= 65) {
    return {
      tone: 'positive',
      text: `${ticker || 'This stock'} has a relatively safe profile — manageable debt, lower volatility, and limited short interest.`,
    }
  }
  if (safety >= 40) {
    return {
      tone: 'neutral',
      text: `${ticker || 'This stock'} carries moderate risk. Some caution is warranted around leverage or volatility.`,
    }
  }
  return {
    tone: 'negative',
    text: `${ticker || 'This stock'} carries elevated risk — watch the debt levels, volatility, or short interest before committing.`,
  }
}

export function technicalsTldr(research) {
  const t = research?.technicals
  if (!t?.hasData) return null
  const score = t.score

  if (score >= 70) {
    return {
      tone: 'positive',
      text: 'Price momentum is bullish — RSI, moving averages, and volume are all pointing upward.',
    }
  }
  if (score >= 40) {
    return {
      tone: 'neutral',
      text: 'Technical signals are mixed — no clear trend. Wait for confirmation before acting.',
    }
  }
  return {
    tone: 'negative',
    text: 'Momentum is bearish — price is under pressure with weak technical signals across the board.',
  }
}
