import { buildFundamentalsScore } from './scoring.js'

/**
 * Build plain-English TL;DR summaries for each analysis tab.
 * Every function returns { text, tone } or null if insufficient data.
 */

export function overviewTldr(research, fundamentals, analysis) {
  const ticker = fundamentals?.symbol || fundamentals?.shortName || 'This stock'
  const opportunity = research?.opportunity
  const valuation = research?.valuation
  const quality = research?.quality
  const risk = research?.risk

  if (opportunity?.hasData && Number.isFinite(opportunity.score)) {
    if (opportunity.score >= 70) {
      return {
        tone: 'positive',
        text: `${ticker} has an attractive overall setup right now, with the strongest support coming from the available valuation, quality, and risk signals.`,
      }
    }
    if (opportunity.score >= 45) {
      return {
        tone: 'neutral',
        text: `${ticker} is a mixed setup overall. There is enough here to keep watching, but the case is not clean across valuation, quality, and risk.`,
      }
    }
    return {
      tone: 'negative',
      text: `${ticker} does not screen as a strong overall setup right now. One or more of valuation, business quality, or downside risk look weak.`,
    }
  }

  if (valuation?.hasData && quality?.hasData && risk?.hasData) {
    return {
      tone: 'neutral',
      text: `${ticker} has enough data to compare value, quality, and risk side by side. Start here to see the broad picture before drilling into any single tab.`,
    }
  }

  if (analysis?.spot != null) {
    return {
      tone: 'neutral',
      text: `${ticker} has partial coverage. Use this page as the quick read on what data is available before going deeper into the visible tabs.`,
    }
  }

  return null
}

export function valuationTldr(research, fundamentals) {
  const v = research?.valuation
  if (!v?.hasData) return null
  const score = v.score
  const ticker = fundamentals?.symbol || ''

  if (score >= 70) {
    return {
      tone: 'positive',
      text: `${ticker || 'This stock'} looks undervalued — the available valuation metrics suggest the price is cheap relative to earnings, cash flow, or book value.`,
    }
  }
  if (score >= 50) {
    return {
      tone: 'neutral',
      text: `${ticker || 'This stock'} appears roughly fairly valued — not an obvious bargain, but not stretched either.`,
    }
  }
  return {
    tone: 'negative',
    text: `${ticker || 'This stock'} looks expensive on the available metrics. You are paying a premium — make sure the business quality justifies it.`,
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
      text: `${ticker || 'This company'} shows strong business quality — healthy margins, solid returns on capital, and consistent cash generation.`,
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
    text: `${ticker || 'This company'} has weak business quality. Margins, returns, or cash generation are lagging.`,
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
      text: 'Price momentum leans bullish — the weight of RSI, moving averages, and volume signals is positive.',
    }
  }
  if (score >= 40) {
    return {
      tone: 'neutral',
      text: 'Technical signals are mixed — no clear trend direction. Wait for confirmation before acting on momentum alone.',
    }
  }
  return {
    tone: 'negative',
    text: 'Momentum leans bearish — price is under pressure with most technical signals pointing down.',
  }
}

export function businessTldr(research, fundamentals, ticker) {
  const business = research?.business
  const name = fundamentals?.symbol || ticker || 'This business'
  if (!business?.hasData) return null

  if (business?.hasFinancialSeries) {
    return {
      tone: 'neutral',
      text: `${name} has enough operating history to review revenue, cash flow, and business direction in one place. Focus on whether the trend is strengthening or flattening.`,
    }
  }

  return {
    tone: 'neutral',
    text: `${name} has limited business history available here, but this tab still gives the quickest view of company profile, earnings timing, and cash flow structure.`,
  }
}

export function optionsTldr(analysis, fundamentals, ticker) {
  const name = fundamentals?.symbol || ticker || 'This stock'
  if (!analysis) {
    return {
      tone: 'neutral',
      text: `${name} does not have listed options data available. This tab requires actively traded options to generate forecasts.`,
    }
  }

  if (analysis?.em?.movePct != null) {
    return {
      tone: 'neutral',
      text: `${name} options imply about a ${analysis.em.movePct.toFixed(1)}% move into expiry. Use this tab to judge market expectations, not business quality or fair value.`,
    }
  }

  return {
    tone: 'neutral',
    text: `${name} has options data available. This tab is best used to read expected move, positioning, and trade structure rather than long-term fundamentals.`,
  }
}

export function fundamentalsTldr(fundamentals) {
  const name = fundamentals?.symbol || fundamentals?.shortName || 'This company'
  if (!fundamentals) return null

  const { score } = buildFundamentalsScore(fundamentals)

  if (Number.isFinite(score) && score >= 70) {
    return {
      tone: 'positive',
      text: `${name} raw fundamentals look strong overall — most metrics sit in healthy territory relative to standard thresholds.`,
    }
  }
  if (Number.isFinite(score) && score < 45) {
    return {
      tone: 'negative',
      text: `${name} raw fundamentals flag some concerns. Review the sections below to see which specific metrics are lagging.`,
    }
  }

  return {
    tone: 'neutral',
    text: `${name} raw fundamentals are mixed or average. Use the sections below to see the reference numbers behind the value, quality, and risk summaries.`,
  }
}

export function tabTldr({ activeTab, research, fundamentals, analysis, ticker }) {
  switch (activeTab) {
    case 'overview':
      return overviewTldr(research, fundamentals, analysis)
    case 'value':
      return valuationTldr(research, fundamentals)
    case 'quality':
      return qualityTldr(research, fundamentals)
    case 'risk':
      return riskTldr(research, fundamentals)
    case 'technicals':
      return technicalsTldr(research)
    case 'business':
      return businessTldr(research, fundamentals, ticker)
    case 'options':
      return optionsTldr(analysis, fundamentals, ticker)
    case 'fundamentals':
      return fundamentalsTldr(fundamentals)
    default:
      return null
  }
}
