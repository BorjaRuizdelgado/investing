/**
 * Suggest options strategies based on analysis data and research scores.
 */

function findNearDeltaStrike(chain, spot, targetDelta, type) {
  // Approximate delta by OTM distance — pick strike ~targetDelta away from spot
  if (!chain?.length || !spot) return null

  const otmFactor = type === 'put' ? 1 - targetDelta : 1 + targetDelta
  const targetStrike = spot * (type === 'put' ? 1 - targetDelta * 0.5 : 1 + targetDelta * 0.5)

  let best = null
  let bestDist = Infinity

  for (const opt of chain) {
    const dist = Math.abs(opt.strike - targetStrike)
    if (dist < bestDist && opt.mid > 0) {
      bestDist = dist
      best = opt
    }
  }

  return best
}

export function suggestStrategies(analysis, research) {
  if (!analysis?.ivData?.length || !analysis?.spot) return []

  const strategies = []
  const spot = analysis.spot
  const puts = analysis.puts || []
  const calls = analysis.calls || []

  // Compute average IV
  const ivValues = analysis.ivData.filter((d) => d.iv > 0).map((d) => d.iv)
  const avgIV = ivValues.length > 0 ? ivValues.reduce((a, b) => a + b, 0) / ivValues.length : 0

  // Compute skew (put IV vs call IV)
  const putIVs = analysis.ivData.filter((d) => d.type === 'put' && d.iv > 0).map((d) => d.iv)
  const callIVs = analysis.ivData.filter((d) => d.type === 'call' && d.iv > 0).map((d) => d.iv)
  const avgPutIV = putIVs.length ? putIVs.reduce((a, b) => a + b, 0) / putIVs.length : 0
  const avgCallIV = callIVs.length ? callIVs.reduce((a, b) => a + b, 0) / callIVs.length : 0
  const skew = avgCallIV > 0 ? (avgPutIV - avgCallIV) / avgCallIV : 0

  const valScore = research?.valuation?.score ?? 50

  // Iron Condor: High IV + symmetric skew
  if (avgIV > 0.3 && Math.abs(skew) < 0.15) {
    const shortPut = findNearDeltaStrike(puts, spot, 0.25, 'put')
    const shortCall = findNearDeltaStrike(calls, spot, 0.25, 'call')

    if (shortPut && shortCall) {
      const premium = (shortPut.mid + shortCall.mid).toFixed(2)
      strategies.push({
        name: 'Iron Condor',
        description: 'Sell OTM put + OTM call, buy further OTM wings. Profits from low volatility.',
        legs: [
          { type: 'Put', strike: shortPut.strike, action: 'Sell' },
          { type: 'Call', strike: shortCall.strike, action: 'Sell' },
        ],
        premium: `$${premium}`,
        maxRisk: 'Width of wings minus premium',
        rationale: `Average IV is ${(avgIV * 100).toFixed(0)}% (elevated) with symmetric skew (${(skew * 100).toFixed(1)}%). Range-bound conditions favor premium selling.`,
      })
    }
  }

  // Cash-Secured Put: Bullish skew + decent valuation
  if (skew > -0.15 && valScore >= 45) {
    const cspPut = findNearDeltaStrike(puts, spot, 0.25, 'put')
    if (cspPut) {
      strategies.push({
        name: 'Cash-Secured Put',
        description: 'Sell an OTM put to collect premium or buy shares at a discount.',
        legs: [{ type: 'Put', strike: cspPut.strike, action: 'Sell' }],
        premium: `$${cspPut.mid.toFixed(2)}`,
        maxRisk: `$${(cspPut.strike - cspPut.mid).toFixed(2)} per share`,
        rationale: `Valuation score is ${Math.round(valScore)}/100. Put skew at ${(skew * 100).toFixed(1)}% suggests limited downside concern. Willing to own at ${cspPut.strike}.`,
      })
    }
  }

  // Protective Put: Bearish signals
  if (skew > 0.05 || (research?.risk?.score != null && research.risk.score >= 60)) {
    const protPut = findNearDeltaStrike(puts, spot, 0.2, 'put')
    if (protPut) {
      strategies.push({
        name: 'Protective Put',
        description: 'Buy an OTM put to hedge downside risk on an existing position.',
        legs: [{ type: 'Put', strike: protPut.strike, action: 'Buy' }],
        premium: `$${protPut.mid.toFixed(2)} (cost)`,
        maxRisk: `Limited to premium paid`,
        rationale: `${skew > 0.05 ? `Put skew is elevated (${(skew * 100).toFixed(1)}%), suggesting demand for downside protection.` : `Risk score is ${Math.round(research.risk.score)}/100, indicating elevated fragility.`}`,
      })
    }
  }

  // Covered Call: Low IV + high quality
  if (avgIV < 0.35 && (research?.quality?.score ?? 0) >= 55) {
    const ccCall = findNearDeltaStrike(calls, spot, 0.3, 'call')
    if (ccCall) {
      strategies.push({
        name: 'Covered Call',
        description: 'Sell an OTM call against existing shares to generate income.',
        legs: [{ type: 'Call', strike: ccCall.strike, action: 'Sell' }],
        premium: `$${ccCall.mid.toFixed(2)}`,
        maxRisk: `Capped upside at $${ccCall.strike}`,
        rationale: `Quality score is ${Math.round(research.quality.score)}/100 with moderate IV (${(avgIV * 100).toFixed(0)}%). Good candidate for income generation on a quality holding.`,
      })
    }
  }

  return strategies
}
