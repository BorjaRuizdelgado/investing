import React from 'react'
import Plot from 'react-plotly.js'
import { getColors } from '../lib/theme.js'

function formatDate(ts) {
  if (!ts) return null
  const d = new Date(ts * 1000)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function EarningsCalendar({ fundamentals }) {
  if (!fundamentals) return null

  const earningsTs = fundamentals.earningsTimestampStart || fundamentals.earningsTimestamp
  const earningsDate = earningsTs ? new Date(earningsTs * 1000) : null
  const now = new Date()
  const daysUntil = earningsDate ? Math.ceil((earningsDate - now) / 86400000) : null

  // EPS history from fundamentals (if available via earningsChart or earningsHistory)
  const epsHistory = fundamentals.earningsHistory || []

  // Nothing to show for crypto / tickers without earnings data
  if (!earningsDate && epsHistory.length === 0) return null

  const c = getColors()
  const epsValues = epsHistory.flatMap((q) => [q?.epsEstimate, q?.epsActual]).filter(Number.isFinite)
  const epsMin = epsValues.length ? Math.min(...epsValues) : null
  const epsMax = epsValues.length ? Math.max(...epsValues) : null
  const epsSpan =
    epsMin != null && epsMax != null ? Math.max(Math.abs(epsMax - epsMin), 0.1) : null
  const epsRange =
    epsMin != null && epsMax != null
      ? [epsMin - epsSpan * 0.12, epsMax + epsSpan * (epsMax <= 0 ? 0.28 : 0.12)]
      : undefined

  return (
    <section className="terminal-section">
      <div className="section-heading">
        <h2>Earnings</h2>
      </div>

      <div className="terminal-grid terminal-grid--2">
        <div className="terminal-card">
          <div className="terminal-eyebrow">Next Earnings</div>
          {earningsDate ? (
            <>
              <div className="terminal-stat">{formatDate(earningsTs)}</div>
              <div className="terminal-caption">
                {daysUntil > 0
                  ? `In ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`
                  : daysUntil === 0
                    ? 'Today'
                    : `${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''} ago`}
              </div>
            </>
          ) : (
            <>
              <div className="terminal-stat" style={{ fontSize: '1rem', color: c.textMuted }}>
                Not available
              </div>
              <div className="terminal-caption">Earnings date not reported</div>
            </>
          )}
        </div>

        {epsHistory.length > 0 ? (
          <div className="terminal-card">
            <div className="terminal-eyebrow">EPS History (Last {epsHistory.length} Quarters)</div>
            <Plot
              data={[
                {
                  type: 'bar',
                  name: 'Estimate',
                  x: epsHistory.map((q) => q.quarter || q.period || ''),
                  y: epsHistory.map((q) => q.epsEstimate),
                  marker: { color: c.textMuted },
                  hovertemplate: 'Est: $%{y:.2f}<extra></extra>',
                },
                {
                  type: 'bar',
                  name: 'Actual',
                  x: epsHistory.map((q) => q.quarter || q.period || ''),
                  y: epsHistory.map((q) => q.epsActual),
                  marker: {
                    color: epsHistory.map((q) =>
                      q.surprisePercent > 0 ? c.green : q.surprisePercent < 0 ? c.red : c.accent,
                    ),
                  },
                  hovertemplate: 'Act: $%{y:.2f}<extra></extra>',
                },
              ]}
              layout={{
                barmode: 'group',
                autosize: true,
                height: 230,
                margin: { l: 40, r: 12, t: 52, b: 40 },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                font: { color: c.textLight, family: 'DM Sans, sans-serif', size: 12 },
                legend: { orientation: 'h', y: 1.16, x: 0, font: { color: c.textLight } },
                xaxis: { fixedrange: true, tickfont: { color: c.textMuted } },
                yaxis: {
                  fixedrange: true,
                  gridcolor: c.borderLight,
                  range: epsRange,
                  tickfont: { color: c.textMuted },
                  tickprefix: '$',
                },
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%', height: '230px' }}
              useResizeHandler
            />
          </div>
        ) : (
          <div className="terminal-card">
            <div className="terminal-eyebrow">Quarterly EPS</div>
            <p className="terminal-caption">Historical EPS data not available for this ticker.</p>
          </div>
        )}
      </div>
    </section>
  )
}
