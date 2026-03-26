import React, { useState, useEffect } from 'react'
import Plot from 'react-plotly.js'
import { fetchOptions, fetchRate } from '../lib/fetcher.js'
import { runWeightedChains } from '../lib/chainRunner.js'
import { deriveValuation } from '../lib/valuation.js'
import { deriveQuality } from '../lib/quality.js'
import { deriveRisk } from '../lib/risk.js'
import { deriveOpportunity, deriveOptionsSentiment } from '../lib/signals.js'
import { daysToExpiry } from '../lib/fetcher.js'
import { getColors, mobileMargin } from '../lib/theme.js'
import { COMPARE_PREFIX } from '../lib/routes.js'
import { fmt, fmtPct, fmtRatio, fmtCompact } from '../lib/format.js'

/**
 * Compute Pearson correlation of daily returns, joining on matching dates.
 * Crypto trades 7 days/week while stocks trade 5 — we must align by date
 * to avoid comparing mismatched days.
 */
function computeCorrelation(historyA, historyB) {
  // Build date→close map for B
  const mapB = new Map()
  for (const bar of historyB) {
    if (bar.date && Number.isFinite(bar.close)) mapB.set(bar.date, bar.close)
  }

  // Collect aligned closing prices (only dates present in both)
  const aligned = []
  for (const bar of historyA) {
    if (bar.date && Number.isFinite(bar.close) && mapB.has(bar.date)) {
      aligned.push({ a: bar.close, b: mapB.get(bar.date) })
    }
  }

  if (aligned.length < 20) return null

  // Compute daily returns on aligned pairs
  const ra = [],
    rb = []
  for (let i = 1; i < aligned.length; i++) {
    if (aligned[i - 1].a > 0 && aligned[i - 1].b > 0) {
      ra.push((aligned[i].a - aligned[i - 1].a) / aligned[i - 1].a)
      rb.push((aligned[i].b - aligned[i - 1].b) / aligned[i - 1].b)
    }
  }

  if (ra.length < 15) return null

  const len = ra.length
  const ma = ra.reduce((s, v) => s + v, 0) / len
  const mb = rb.reduce((s, v) => s + v, 0) / len
  let num = 0,
    da2 = 0,
    db2 = 0
  for (let i = 0; i < len; i++) {
    const da = ra[i] - ma
    const db = rb[i] - mb
    num += da * db
    da2 += da * da
    db2 += db * db
  }
  const denom = Math.sqrt(da2 * db2)
  return denom > 0 ? { r: num / denom, days: len } : null
}

function correlationLabel(val) {
  if (val == null) return { text: 'Insufficient data', tone: 'neutral' }
  const abs = Math.abs(val)
  if (abs >= 0.8)
    return {
      text: val > 0 ? 'Strongly correlated' : 'Strongly inversely correlated',
      tone: val > 0 ? 'negative' : 'positive',
    }
  if (abs >= 0.5)
    return {
      text: val > 0 ? 'Moderately correlated' : 'Moderately inversely correlated',
      tone: 'neutral',
    }
  if (abs >= 0.3) return { text: 'Weakly correlated', tone: 'positive' }
  return { text: 'Low correlation — good diversification', tone: 'positive' }
}

function analyseOneTicker(ticker) {
  return Promise.all([fetchOptions(ticker), fetchRate()]).then(async ([optData, rateData]) => {
    if (!optData.expirations?.length) throw new Error(`No options for ${ticker}`)
    const validExps = optData.expirations.filter((e) => daysToExpiry(e.date) >= 1)
    if (!validExps.length) throw new Error(`No valid expirations for ${ticker}`)

    const result = await runWeightedChains(
      optData.ticker || ticker,
      validExps[0],
      optData.price,
      rateData.rate,
      validExps,
    )

    const fundamentals = optData.fundamentals || null
    const spot = optData.price
    const valuation = deriveValuation(fundamentals, spot)
    const quality = deriveQuality(fundamentals)
    const risk = deriveRisk(fundamentals, result)
    const options = deriveOptionsSentiment(result, spot)
    const opportunity = deriveOpportunity(
      valuation,
      quality,
      risk,
      options,
      valuation.analystUpsidePct,
    )

    return {
      ticker: optData.ticker || ticker,
      spot,
      fundamentals,
      analysis: result,
      scores: {
        opportunity: opportunity?.score,
        valuation: valuation?.score,
        quality: quality?.score,
        risk: risk?.score,
        options: options?.score,
      },
      valuation,
      quality,
      risk,
      name: fundamentals?.longName || fundamentals?.name || ticker,
    }
  })
}

const SCORE_ROWS = [
  { key: 'opportunity', label: 'Opportunity' },
  { key: 'valuation', label: 'Valuation' },
  { key: 'quality', label: 'Quality' },
  { key: 'risk', label: 'Risk' },
  { key: 'options', label: 'Options' },
]

function fmtVal(v, kind) {
  if (v == null || !Number.isFinite(v)) return 'N/A'
  if (kind === 'pct') return fmtPct(v)
  if (kind === 'money') return fmt(v)
  if (kind === 'compact') return fmtCompact(v)
  return fmtRatio(v)
}

function metricRows(r) {
  if (!r?.fundamentals) return []
  const f = r.fundamentals
  return [
    { label: 'Forward P/E', a: f.forwardPE, kind: 'ratio', lower: true },
    { label: 'EV/EBITDA', a: f.enterpriseToEbitda, kind: 'ratio', lower: true },
    { label: 'Gross Margin', a: f.grossMargins, kind: 'pct' },
    { label: 'Operating Margin', a: f.operatingMargins, kind: 'pct' },
    { label: 'ROE', a: f.returnOnEquity, kind: 'pct' },
    { label: 'Revenue Growth', a: f.revenueGrowth, kind: 'pct' },
    { label: 'Debt/Equity', a: f.debtToEquity, kind: 'ratio', lower: true },
    { label: 'Current Ratio', a: f.currentRatio, kind: 'ratio' },
    { label: 'Beta', a: f.beta, kind: 'ratio' },
    { label: 'Market Cap', a: f.marketCap, kind: 'compact' },
  ]
}

function CompareInput({ onCompare, initialTickers }) {
  const [t1, setT1] = useState(initialTickers?.[0] || '')
  const [t2, setT2] = useState(initialTickers?.[1] || '')

  // Sync when initialTickers change (e.g. from URL)
  const ticker0 = initialTickers?.[0]
  const ticker1 = initialTickers?.[1]
  useEffect(() => {
    if (ticker0 && !t1) setT1(ticker0)
    if (ticker1 && !t2) setT2(ticker1)
  // t1/t2 intentionally omitted — only prefill on URL change, not on every keystroke
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker0, ticker1])

  function handleSubmit(e) {
    e.preventDefault()
    const a = t1.trim().toUpperCase()
    const b = t2.trim().toUpperCase()
    if (a && b) onCompare(a, b)
  }

  return (
    <form className="compare-form" onSubmit={handleSubmit}>
      <div className="compare-form__inputs">
        <input
          type="text"
          value={t1}
          onChange={(e) => setT1(e.target.value.toUpperCase())}
          placeholder="e.g. AAPL"
          aria-label="First ticker"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck="false"
        />
        <span className="compare-form__vs">vs</span>
        <input
          type="text"
          value={t2}
          onChange={(e) => setT2(e.target.value.toUpperCase())}
          placeholder="e.g. MSFT"
          aria-label="Second ticker"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck="false"
        />
      </div>
      <button className="compare-form__btn" type="submit" disabled={!t1.trim() || !t2.trim()}>
        Compare
      </button>
    </form>
  )
}

export default function ComparePage({ tickers = [] }) {
  // tickers may have 0, 1, or 2 entries from the URL
  const [activeTickers, setActiveTickers] = useState(tickers.length >= 2 ? tickers.slice(0, 2) : [])
  const [results, setResults] = useState([null, null])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function handleCompare(a, b) {
    setActiveTickers([a, b])
    const path = `${COMPARE_PREFIX}${encodeURIComponent(a)}/${encodeURIComponent(b)}`
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path)
    }
  }

  const activeA = activeTickers[0]
  const activeB = activeTickers[1]
  useEffect(() => {
    if (!activeA || !activeB) return
    // Intentional: reset all fetch state synchronously before the async work begins
    // so the UI immediately shows the loading indicator with no stale data visible.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    setResults([null, null])

    Promise.all([
      analyseOneTicker(activeA).catch((e) => ({
        error: e.message,
        ticker: activeA,
      })),
      analyseOneTicker(activeB).catch((e) => ({
        error: e.message,
        ticker: activeB,
      })),
    ])
      .then(([a, b]) => setResults([a, b]))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [activeA, activeB])

  const c = getColors()

  // Build combined metric rows for both tickers
  const metricA = results[0] && !results[0].error ? metricRows(results[0]) : []
  const metricB = results[1] && !results[1].error ? metricRows(results[1]) : []

  return (
    <div className="compare-page">
      <h1>Compare</h1>
      <p className="subtitle">Side-by-side analysis of two tickers.</p>

      <CompareInput onCompare={handleCompare} initialTickers={tickers} />

      {loading && (
        <div className="compare-loading">
          <div className="spinner" />
          <span>
            Analysing {activeTickers[0]} and {activeTickers[1]}&hellip;
          </span>
        </div>
      )}

      {error && <div className="error-box">{error}</div>}

      {!loading &&
        activeTickers.length >= 2 &&
        results[0] &&
        results[1] &&
        (() => {
          const t0 = results[0]?.ticker || activeTickers[0]
          const t1 = results[1]?.ticker || activeTickers[1]
          const histA = results[0]?.analysis?.history || []
          const histB = results[1]?.analysis?.history || []

          // Align both histories to overlapping dates only
          const dateSetB = new Set(histB.map((h) => h.date))
          const dateSetA = new Set(histA.map((h) => h.date))
          const alignedA = histA.filter((h) => dateSetB.has(h.date))
          const alignedB = histB.filter((h) => dateSetA.has(h.date))

          const corrResult = computeCorrelation(histA, histB)
          const corrVal = corrResult?.r ?? null
          const corrDays = corrResult?.days ?? 0
          const { text: corrText, tone: corrTone } = correlationLabel(corrVal)

          return (
            <>
              {/* Header row: tickers + links */}
              <div className="compare-header">
                <h2>
                  {t0} vs {t1}
                </h2>
                <div className="compare-header__links">
                  <a
                    href={`/${encodeURIComponent(activeTickers[0])}`}
                    className="compare-ticker-link"
                  >
                    View {results[0]?.name || t0} &rarr;
                  </a>
                  <a
                    href={`/${encodeURIComponent(activeTickers[1])}`}
                    className="compare-ticker-link"
                  >
                    View {results[1]?.name || t1} &rarr;
                  </a>
                </div>
              </div>

              {/* Two tables side by side */}
              <div className="compare-tables-row">
                <div className="terminal-card">
                  <div className="terminal-eyebrow">Scores</div>
                  <table className="data-table compare-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>{t0}</th>
                        <th>{t1}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SCORE_ROWS.map(({ key, label }) => {
                        const a = results[0]?.scores?.[key]
                        const b = results[1]?.scores?.[key]
                        return (
                          <tr key={key}>
                            <td>{label}</td>
                            <td
                              className={
                                a != null && b != null
                                  ? a > b
                                    ? 'metric-better'
                                    : a < b
                                      ? 'metric-worse'
                                      : ''
                                  : ''
                              }
                            >
                              {a != null ? Math.round(a) : 'N/A'}
                            </td>
                            <td
                              className={
                                a != null && b != null
                                  ? b > a
                                    ? 'metric-better'
                                    : b < a
                                      ? 'metric-worse'
                                      : ''
                                  : ''
                              }
                            >
                              {b != null ? Math.round(b) : 'N/A'}
                            </td>
                          </tr>
                        )
                      })}
                      <tr>
                        <td>Price</td>
                        <td>{results[0]?.spot ? `$${results[0].spot.toFixed(2)}` : 'N/A'}</td>
                        <td>{results[1]?.spot ? `$${results[1].spot.toFixed(2)}` : 'N/A'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {metricA.length > 0 && metricB.length > 0 && (
                  <div className="terminal-card">
                    <div className="terminal-eyebrow">Key Metrics</div>
                    <table className="data-table compare-table">
                      <thead>
                        <tr>
                          <th></th>
                          <th>{t0}</th>
                          <th>{t1}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metricA.map((row, i) => {
                          const va = row.a
                          const vb = metricB[i]?.a
                          const hasBoth =
                            va != null && Number.isFinite(va) && vb != null && Number.isFinite(vb)
                          let clsA = '',
                            clsB = ''
                          if (hasBoth) {
                            if (row.lower) {
                              clsA = va < vb ? 'metric-better' : va > vb ? 'metric-worse' : ''
                              clsB = vb < va ? 'metric-better' : vb > va ? 'metric-worse' : ''
                            } else {
                              clsA = va > vb ? 'metric-better' : va < vb ? 'metric-worse' : ''
                              clsB = vb > va ? 'metric-better' : vb < va ? 'metric-worse' : ''
                            }
                          }
                          return (
                            <tr key={row.label}>
                              <td>{row.label}</td>
                              <td className={clsA}>{fmtVal(va, row.kind)}</td>
                              <td className={clsB}>{fmtVal(vb, metricB[i]?.kind)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Price history overlay chart */}
              {alignedA.length > 5 && alignedB.length > 5 && (
                <section className="terminal-section">
                  <div className="section-heading">
                    <h2>Price History</h2>
                  </div>
                  <div className="terminal-card">
                    <Plot
                      data={[
                        {
                          type: 'scatter',
                          mode: 'lines',
                          name: results[0].ticker,
                          x: alignedA.map((h) => h.date),
                          y: alignedA.map((h) => h.close),
                          yaxis: 'y',
                          line: { color: c.accent, width: 2 },
                        },
                        {
                          type: 'scatter',
                          mode: 'lines',
                          name: results[1].ticker,
                          x: alignedB.map((h) => h.date),
                          y: alignedB.map((h) => h.close),
                          yaxis: 'y2',
                          line: { color: c.accentWarm, width: 2 },
                        },
                      ]}
                      layout={{
                        autosize: true,
                        height: 350,
                        margin: mobileMargin(60, 60, 20, 40, { mobileL: 40, mobileR: 20 }),
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent',
                        font: { color: c.textLight, family: 'DM Sans, sans-serif', size: 12 },
                        legend: { orientation: 'h', y: 1.12, x: 0, font: { color: c.textLight } },
                        xaxis: {
                          fixedrange: true,
                          gridcolor: c.borderLight,
                          tickfont: { color: c.textMuted },
                        },
                        yaxis: {
                          title: results[0].ticker,
                          fixedrange: true,
                          gridcolor: c.borderLight,
                          tickfont: { color: c.accent },
                          titlefont: { color: c.accent },
                        },
                        yaxis2: {
                          title: results[1].ticker,
                          overlaying: 'y',
                          side: 'right',
                          fixedrange: true,
                          showgrid: false,
                          tickfont: { color: c.accentWarm },
                          titlefont: { color: c.accentWarm },
                        },
                      }}
                      config={{ displayModeBar: false, responsive: true }}
                      style={{ width: '100%' }}
                      useResizeHandler
                    />
                  </div>
                </section>
              )}
              {/* Correlation card */}
              {corrResult && (
                <div className="terminal-card compare-correlation">
                  <div className="terminal-eyebrow">Tickers' Correlation</div>
                  <div className="compare-correlation__row">
                    <span className="compare-correlation__value">
                      {corrVal != null ? corrVal.toFixed(2) : 'N/A'}
                    </span>
                    <span
                      className={`compare-correlation__label compare-correlation__label--${corrTone}`}
                    >
                      {corrText}
                    </span>
                  </div>
                  <p className="terminal-caption">
                    Pearson correlation of daily returns over {corrDays} trading days.
                    {corrVal != null && Math.abs(corrVal) >= 0.7
                      ? ' These assets tend to move together — holding both provides limited diversification benefit.'
                      : corrVal != null && Math.abs(corrVal) < 0.3
                        ? ' These assets move largely independently — good for portfolio diversification.'
                        : ''}
                  </p>
                </div>
              )}
            </>
          )
        })()}
    </div>
  )
}
