import React from 'react'
import {
  annualizedVolatility,
  buildEdgeItems,
  correlationLabel,
  maxDrawdown,
  trailingReturn,
} from '../../lib/compare.js'
import { fmtPct } from '../../lib/format.js'

function formatOptionalPct(value) {
  return Number.isFinite(value) ? fmtPct(value) : 'N/A'
}

function InsightList({ title, items, ticker }) {
  return (
    <div className="terminal-card compare-insight-card">
      <div className="terminal-eyebrow">{title}</div>
      <h3>{ticker}</h3>
      {items.length ? (
        <div className="compare-insight-list">
          {items.map((item) => (
            <div key={item.label} className="compare-insight-list__item">
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="terminal-caption">No clean edge stood out from the available data.</p>
      )}
    </div>
  )
}

export default function CompareInsights({ left, right, corrResult }) {
  const leftEdges = buildEdgeItems(left, right)
  const rightEdges = buildEdgeItems(right, left)
  const corrVal = corrResult?.r ?? null
  const corrMeta = correlationLabel(corrVal)

  return (
    <section className="terminal-section">
      <div className="section-heading">
        <h2>Decision Readout</h2>
        <p>Fast takeaways on where each stock has the edge and how differently they trade.</p>
      </div>

      <div className="compare-insight-grid">
        <div className="compare-insight-grid__edges">
          <InsightList title="Why It Leads" items={leftEdges} ticker={left.ticker} />
          <InsightList title="Why It Leads" items={rightEdges} ticker={right.ticker} />
        </div>
        <div className="terminal-card compare-insight-card">
          <div className="terminal-eyebrow">Market Relationship</div>
          <h3>{corrVal != null ? corrVal.toFixed(2) : 'N/A'}</h3>
          <p className={`compare-correlation__label compare-correlation__label--${corrMeta.tone}`}>
            {corrMeta.text}
          </p>
          <div className="compare-relationship-grid">
            <div>
              <span>3M return spread</span>
              <strong>
                {formatOptionalPct(
                  Number.isFinite(trailingReturn(left.history, 66)) &&
                    Number.isFinite(trailingReturn(right.history, 66))
                    ? trailingReturn(left.history, 66) - trailingReturn(right.history, 66)
                    : null,
                )}
              </strong>
            </div>
            <div>
              <span>Volatility gap</span>
              <strong>
                {formatOptionalPct(
                  Number.isFinite(annualizedVolatility(left.history)) &&
                    Number.isFinite(annualizedVolatility(right.history))
                    ? annualizedVolatility(left.history) - annualizedVolatility(right.history)
                    : null,
                )}
              </strong>
            </div>
            <div>
              <span>{left.ticker} max drawdown</span>
              <strong>{formatOptionalPct(maxDrawdown(left.history))}</strong>
            </div>
            <div>
              <span>{right.ticker} max drawdown</span>
              <strong>{formatOptionalPct(maxDrawdown(right.history))}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
