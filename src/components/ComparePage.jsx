import React, { useEffect, useMemo, useState } from 'react'
import { fetchHistory, fetchOptions, fetchSentiment } from '../lib/fetcher.js'
import { deriveValuation } from '../lib/valuation.js'
import { deriveQuality } from '../lib/quality.js'
import { deriveRisk } from '../lib/risk.js'
import {
  COMPARE_CATEGORY_DEFS,
  COMPARE_METRIC_DEFS,
  buildGrowthBucket,
  buildMomentumBucket,
  computeCorrelation,
  formatCompareValue,
  getWinner,
  summarizeMatchup,
} from '../lib/compare.js'
import { COMPARE_PREFIX } from '../lib/routes.js'
import TickerSearch from './TickerSearch.jsx'
import Expander from './Expander.jsx'
import CompareHero from './compare/CompareHero.jsx'
import CompareScoreboard from './compare/CompareScoreboard.jsx'
import ComparePerformanceChart from './compare/ComparePerformanceChart.jsx'
import CompareMetricDumbbells from './compare/CompareMetricDumbbells.jsx'
import CompareInsights from './compare/CompareInsights.jsx'

const RAW_ROWS = [
  { key: 'price', label: 'Price', kind: 'money' },
  { key: 'marketCap', label: 'Market Cap', kind: 'compact' },
  { key: 'valuation', label: 'Valuation Score', kind: 'score' },
  { key: 'growth', label: 'Growth Score', kind: 'score' },
  { key: 'quality', label: 'Quality Score', kind: 'score' },
  { key: 'risk', label: 'Risk Score', kind: 'score' },
  { key: 'momentum', label: 'Momentum Score', kind: 'score' },
  ...COMPARE_METRIC_DEFS,
]

function metricValue(item, key) {
  if (key === 'price') return item?.spot
  if (key === 'marketCap') return item?.fundamentals?.marketCap
  if (COMPARE_CATEGORY_DEFS.some((row) => row.key === key)) return item?.categories?.[key]?.score
  return item?.fundamentals?.[key]
}

async function loadCompareTicker(ticker) {
  const [profile, historyData, sentiment] = await Promise.all([
    fetchOptions(ticker),
    fetchHistory(ticker, 365).catch(() => ({ bars: [] })),
    fetchSentiment(ticker).catch(() => null),
  ])

  const fundamentals = profile?.fundamentals || null
  const spot = Number.isFinite(profile?.price) ? profile.price : fundamentals?.previousClose ?? null
  const categories = {
    valuation: deriveValuation(fundamentals, spot),
    growth: buildGrowthBucket(fundamentals),
    quality: deriveQuality(fundamentals),
    risk: deriveRisk(fundamentals, null),
    momentum: buildMomentumBucket(sentiment),
  }

  return {
    ticker: profile?.ticker || ticker,
    name: fundamentals?.longName || fundamentals?.name || ticker,
    spot,
    fundamentals,
    history: historyData?.bars || [],
    sentiment,
    categories,
  }
}

const POPULAR_COMPARISONS = [
  ['AAPL', 'MSFT'],
  ['NVDA', 'AMD'],
  ['SPY', 'QQQ'],
  ['GOOGL', 'META'],
  ['TSLA', 'RIVN'],
  ['KO', 'PEP'],
]

function CompareInput({ onCompare, initialTickers }) {
  const [t1, setT1] = useState(initialTickers?.[0] || '')
  const [t2, setT2] = useState(initialTickers?.[1] || '')

  const ticker0 = initialTickers?.[0]
  const ticker1 = initialTickers?.[1]
  useEffect(() => {
    if (ticker0 && !t1) setT1(ticker0)
    if (ticker1 && !t2) setT2(ticker1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker0, ticker1])

  function handleSubmit(e) {
    e.preventDefault()
    const a = t1.trim().toUpperCase()
    const b = t2.trim().toUpperCase()
    if (a && b) onCompare(a, b)
  }

  return (
    <div className="compare-input-section">
      <form className="compare-form" onSubmit={handleSubmit}>
        <div className="compare-form__inputs">
          <TickerSearch
            value={t1}
            onChange={setT1}
            onSelect={(sym) => { setT1(sym); if (t2.trim()) onCompare(sym, t2.trim().toUpperCase()) }}
            placeholder="First — e.g. AAPL"
            ariaLabel="First ticker"
            className="compare-form__search"
          />
          <span className="compare-form__vs">vs</span>
          <TickerSearch
            value={t2}
            onChange={setT2}
            onSelect={(sym) => { setT2(sym); if (t1.trim()) onCompare(t1.trim().toUpperCase(), sym) }}
            placeholder="Second — e.g. MSFT"
            ariaLabel="Second ticker"
            className="compare-form__search"
          />
        </div>
        <button className="compare-form__btn" type="submit" disabled={!t1.trim() || !t2.trim()}>
          Compare
        </button>
      </form>
    </div>
  )
}

export default function ComparePage({ tickers = [] }) {
  const [activeTickers, setActiveTickers] = useState(tickers.length >= 2 ? tickers.slice(0, 2) : [])
  const [results, setResults] = useState([null, null])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [range, setRange] = useState('6M')

  function handleCompare(a, b) {
    setActiveTickers([a, b])
    const path = `${COMPARE_PREFIX}${encodeURIComponent(a)}/${encodeURIComponent(b)}`
    if (window.location.pathname !== path) window.history.pushState(null, '', path)
  }

  const activeA = activeTickers[0]
  const activeB = activeTickers[1]

  useEffect(() => {
    if (!activeA || !activeB) return

    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset UI before async fetch
    setLoading(true)
    setError(null)
    setResults([null, null])

    Promise.all([
      loadCompareTicker(activeA).catch((err) => ({ error: err.message, ticker: activeA })),
      loadCompareTicker(activeB).catch((err) => ({ error: err.message, ticker: activeB })),
    ])
      .then((next) => {
        if (!cancelled) setResults(next)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeA, activeB])

  const left = results[0]
  const right = results[1]
  const ready =
    !loading &&
    activeTickers.length >= 2 &&
    left &&
    right &&
    !left.error &&
    !right.error

  const matchup = useMemo(() => {
    if (!ready) return null
    return summarizeMatchup(left, right)
  }, [left, right, ready])

  const corrResult = useMemo(() => {
    if (!ready) return null
    return computeCorrelation(left.history, right.history)
  }, [left, right, ready])

  return (
    <div className="compare-page">
      <div className="compare-hero-header">
        <h1>Stock Compare</h1>
        <p className="compare-hero-header__sub">
          Visual head-to-head built for decisions, not spreadsheet fatigue.
        </p>

        <CompareInput onCompare={handleCompare} initialTickers={tickers} />
      </div>

      {!activeTickers.length && (
        <section className="compare-empty-state">
          <div className="compare-empty-state__label">Popular Comparisons</div>
          <p className="compare-empty-state__text">
            Pick two tickers above, or try one of these popular matchups:
          </p>
          <div className="compare-suggestions">
            {POPULAR_COMPARISONS.map(([a, b]) => (
              <button
                key={`${a}-${b}`}
                className="compare-suggestion"
                onClick={() => handleCompare(a, b)}
              >
                {a} vs {b}
              </button>
            ))}
          </div>
        </section>
      )}

      {loading && (
        <div className="compare-loading">
          <div className="spinner" />
          <span>
            Comparing {activeTickers[0]} and {activeTickers[1]}&hellip;
          </span>
        </div>
      )}

      {error && <div className="error-box">{error}</div>}
      {!error && !loading && (left?.error || right?.error) && (
        <div className="error-box">{left?.error || right?.error}</div>
      )}

      {ready && matchup && (
        <div className="compare-results">
          <CompareHero left={left} right={right} summary={matchup} />

          <CompareScoreboard left={left} right={right} rows={matchup.rows} />
          <ComparePerformanceChart left={left} right={right} range={range} onRangeChange={setRange} />

          <CompareMetricDumbbells left={left} right={right} />
          <CompareInsights left={left} right={right} corrResult={corrResult} />

          <section className="terminal-section">
            <Expander title="Raw Comparison Table">
              <div className="terminal-card">
                <table className="data-table compare-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>{left.ticker}</th>
                      <th>{right.ticker}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RAW_ROWS.map((row) => {
                      const leftValue = metricValue(left, row.key)
                      const rightValue = metricValue(right, row.key)
                      const winner = getWinner(leftValue, rightValue, {
                        lowerBetter: row.lowerBetter,
                        tieThreshold: row.kind === 'score' ? 2 : 0,
                      })

                      return (
                        <tr key={row.key}>
                          <td>{row.label}</td>
                          <td className={winner === 'a' ? 'metric-better' : winner === 'b' ? 'metric-worse' : ''}>
                            {formatCompareValue(leftValue, row.kind)}
                          </td>
                          <td className={winner === 'b' ? 'metric-better' : winner === 'a' ? 'metric-worse' : ''}>
                            {formatCompareValue(rightValue, row.kind)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Expander>
          </section>
        </div>
      )}
    </div>
  )
}
