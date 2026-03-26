/**
 * chainRunner.js — Pure async functions for fetching and analysing
 * single or multi-expiry option chains.
 *
 * Extracted from useResearchTerminal / useOptionsAnalysis to avoid
 * duplicating ~120 lines of identical logic.
 */

import { fetchChain, fetchHistory, daysToExpiry } from './fetcher.js'
import {
  impliedDistribution,
  expectedMove,
  bullBearProbabilities,
  percentileLevels,
  maxPain,
  ivSmile,
  supportResistanceLevels,
  entryAnalysis,
  putCallRatio,
  expiryWeights,
  mergeDistributions,
  mergeExpectedMoves,
  mergeMaxPain,
  mergeIvSmiles,
  mergePutCallRatios,
} from './analysis.js'

const HIST_DAYS = 300

export async function runSingleChain(tickerVal, expiry, spotVal, r) {
  const dte = daysToExpiry(expiry.date)

  const [chainData, histData] = await Promise.all([
    fetchChain(tickerVal, expiry.timestamp),
    fetchHistory(tickerVal, HIST_DAYS),
  ])

  const { calls, puts } = chainData
  const T = dte / 365

  const dist = impliedDistribution(calls, spotVal, r, T, puts)
  const em = expectedMove(calls, puts, spotVal)
  const probs = bullBearProbabilities(dist, spotVal)
  const pctiles = percentileLevels(dist)
  const mp = maxPain(calls, puts)
  const ivData = ivSmile(calls, puts, spotVal)
  const sr = supportResistanceLevels(histData.bars, calls, puts, spotVal)
  const entry = entryAnalysis(dist, em, probs, pctiles, sr, spotVal)
  const pcr = putCallRatio(calls, puts)

  return {
    dist,
    em,
    probs,
    pctiles,
    mp,
    ivData,
    calls,
    puts,
    history: histData.bars,
    sr,
    entry,
    pcr,
    dte,
    expiry: expiry.date,
    r,
    spot: spotVal,
    chainsUsed: 1,
    chainDtes: [dte],
    chainWeights: [1],
  }
}

export async function runWeightedChains(tickerVal, expiry, spotVal, r, allExpirations) {
  const targetDte = daysToExpiry(expiry.date)

  const eligibleExps = allExpirations.filter(
    (e) => daysToExpiry(e.date) <= targetDte + 0.01 && daysToExpiry(e.date) >= 1,
  )

  let chainsToFetch
  if (eligibleExps.length <= 8) {
    chainsToFetch = eligibleExps
  } else {
    const first = eligibleExps[0]
    const last = eligibleExps[eligibleExps.length - 1]
    const middle = eligibleExps.slice(1, -1)
    const step = Math.ceil(middle.length / 6)
    const sampled = middle.filter((_, i) => i % step === 0).slice(0, 6)
    chainsToFetch = [first, ...sampled, last]
  }

  const [histData, ...chainResults] = await Promise.all([
    fetchHistory(tickerVal, HIST_DAYS),
    ...chainsToFetch.map((e) => fetchChain(tickerVal, e.timestamp)),
  ])

  const perChain = []
  const dtes = []

  for (let i = 0; i < chainResults.length; i++) {
    const { calls, puts } = chainResults[i]
    const dte = daysToExpiry(chainsToFetch[i].date)
    const T = dte / 365

    try {
      const dist = impliedDistribution(calls, spotVal, r, T, puts)
      const em = expectedMove(calls, puts, spotVal)
      const mp = maxPain(calls, puts)
      const ivData = ivSmile(calls, puts, spotVal)
      const pcr = putCallRatio(calls, puts)
      perChain.push({ dist, em, mp, ivData, pcr, calls, puts, dte })
      dtes.push(dte)
    } catch {
      // Skip chains with too few strikes
    }
  }

  if (perChain.length === 0) {
    throw new Error('No expiration chains had enough data for analysis')
  }

  const weights = expiryWeights(dtes)
  const dist = mergeDistributions(
    perChain.map((c) => c.dist),
    weights,
  )
  const em = mergeExpectedMoves(
    perChain.map((c) => c.em),
    weights,
    spotVal,
  )
  const mp = mergeMaxPain(
    perChain.map((c) => c.mp),
    weights,
  )
  const ivData = mergeIvSmiles(perChain.map((c) => c.ivData))
  const pcr = mergePutCallRatios(
    perChain.map((c) => c.pcr),
    weights,
  )

  const probs = bullBearProbabilities(dist, spotVal)
  const pctiles = percentileLevels(dist)

  const allCalls = perChain.flatMap((c) => c.calls)
  const allPuts = perChain.flatMap((c) => c.puts)
  const sr = supportResistanceLevels(histData.bars, allCalls, allPuts, spotVal)
  const entry = entryAnalysis(dist, em, probs, pctiles, sr, spotVal)

  return {
    dist,
    em,
    probs,
    pctiles,
    mp,
    ivData,
    calls: allCalls,
    puts: allPuts,
    history: histData.bars,
    sr,
    entry,
    pcr,
    dte: targetDte,
    expiry: expiry.date,
    r,
    spot: spotVal,
    chainsUsed: perChain.length,
    chainDtes: dtes,
    chainWeights: weights,
  }
}
