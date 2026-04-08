import React from 'react'
import Tooltip from './Tooltip.jsx'
import { fmt } from '../lib/format.js'
import { METRIC_TIPS } from '../lib/metricTips.js'

function positionPct(spot, bear, bull) {
  if (!Number.isFinite(spot) || !Number.isFinite(bear) || !Number.isFinite(bull) || bull === bear) return null
  return Math.max(0, Math.min(100, ((spot - bear) / (bull - bear)) * 100))
}

function gapLabel(spot, base) {
  if (!Number.isFinite(spot) || !Number.isFinite(base) || base === 0) return null
  const pct = ((spot - base) / base) * 100
  if (Math.abs(pct) < 0.5) return { text: 'At fair value', tone: 'neutral' }
  if (pct > 0) return { text: `${pct.toFixed(1)}% above fair value`, tone: 'negative' }
  return { text: `${Math.abs(pct).toFixed(1)}% below fair value`, tone: 'positive' }
}

export default React.memo(function ScenarioCard({ fairValue, spot }) {
  if (!fairValue) return null

  const pos = positionPct(spot, fairValue.bear, fairValue.bull)
  const gap = gapLabel(spot, fairValue.base)

  return (
    <div className="terminal-card scenario-card">
      <div className="terminal-eyebrow">
        Fair Value Range
        <Tooltip text={METRIC_TIPS.fairValueRange} />
      </div>

      {pos != null && (
        <div className="scenario-range">
          <div className="scenario-range__bar">
            <div className="scenario-range__zone" />
            <div className="scenario-range__marker" style={{ left: `${pos}%` }} />
          </div>
          <div className="scenario-range__labels">
            <span>Bear {fmt(fairValue.bear)}</span>
            <span>Base {fmt(fairValue.base)}</span>
            <span>Bull {fmt(fairValue.bull)}</span>
          </div>
        </div>
      )}

      {!pos && (
        <div className="scenario-table">
          <div className="scenario-row">
            <span className="scenario-label">Bear</span>
            <strong className="scenario-value">{fmt(fairValue.bear)}</strong>
          </div>
          <div className="scenario-row">
            <span className="scenario-label">Base</span>
            <strong className="scenario-value">{fmt(fairValue.base)}</strong>
          </div>
          <div className="scenario-row">
            <span className="scenario-label">Bull</span>
            <strong className="scenario-value">{fmt(fairValue.bull)}</strong>
          </div>
        </div>
      )}

      {gap && (
        <div className={`scenario-gap scenario-gap--${gap.tone}`}>
          {Number.isFinite(spot) && <span className="scenario-gap__price">Current {fmt(spot)}</span>}
          <span className="scenario-gap__text">{gap.text}</span>
        </div>
      )}
    </div>
  )
})
