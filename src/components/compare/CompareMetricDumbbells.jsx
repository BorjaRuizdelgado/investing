import React from 'react'
import { COMPARE_METRIC_DEFS, formatCompareValue, getWinner } from '../../lib/compare.js'

/**
 * Compute how far apart two values are as a 0-100 "spread" score.
 * Uses relative difference: |a - b| / max(|a|, |b|).
 * Capped at 100 so extreme outliers don't break the bar.
 */
function spreadPct(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  const denom = Math.max(Math.abs(a), Math.abs(b))
  if (denom === 0) return 0
  return Math.min(Math.abs(a - b) / denom, 1) * 100
}

export default function CompareMetricDumbbells({ left, right }) {
  const rows = COMPARE_METRIC_DEFS.map((metric) => {
    const leftValue = left?.fundamentals?.[metric.key]
    const rightValue = right?.fundamentals?.[metric.key]
    if (!Number.isFinite(leftValue) && !Number.isFinite(rightValue)) return null

    const winner = getWinner(leftValue, rightValue, { lowerBetter: metric.lowerBetter })
    const spread = spreadPct(leftValue, rightValue)

    return { ...metric, leftValue, rightValue, winner, spread }
  }).filter(Boolean)

  if (!rows.length) return null

  return (
    <section className="terminal-section">
      <div className="section-heading">
        <h2>Key Metric Spread</h2>
        <p>Bar length shows how wide the gap is between the two stocks on each metric.</p>
      </div>

      <div className="terminal-card compare-metrics">
        {rows.map((row) => {
          // Bar grows left from center (winner=a) or right from center (winner=b)
          const barWidth = Math.max(row.spread, 4) // min 4% so tiny gaps are still visible
          const barSide = row.winner === 'a' ? 'left' : row.winner === 'b' ? 'right' : 'even'

          return (
            <div key={row.key} className="compare-metric">
              <div className="compare-metric__top">
                <span className="compare-metric__label">{row.label}</span>
                <span className="compare-metric__winner">
                  {row.winner === 'a'
                    ? `${left.ticker} better`
                    : row.winner === 'b'
                      ? `${right.ticker} better`
                      : 'Even'}
                </span>
              </div>
              <div className="compare-metric__bar">
                <span className="compare-metric__val compare-metric__val--left">
                  {formatCompareValue(row.leftValue, row.kind)}
                </span>
                <div className="compare-metric__track">
                  <div className="compare-metric__center" />
                  {barSide === 'left' && (
                    <div
                      className="compare-metric__fill compare-metric__fill--left"
                      style={{ width: `${barWidth / 2}%`, right: '50%' }}
                    />
                  )}
                  {barSide === 'right' && (
                    <div
                      className="compare-metric__fill compare-metric__fill--right"
                      style={{ width: `${barWidth / 2}%`, left: '50%' }}
                    />
                  )}
                  {barSide === 'even' && (
                    <div
                      className="compare-metric__fill compare-metric__fill--even"
                      style={{ width: '2px', left: 'calc(50% - 1px)' }}
                    />
                  )}
                </div>
                <span className="compare-metric__val compare-metric__val--right">
                  {formatCompareValue(row.rightValue, row.kind)}
                </span>
              </div>
              {row.lowerBetter && <div className="compare-metric__caption">Lower is better</div>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
