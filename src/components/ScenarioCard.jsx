import React from 'react'
import Tooltip from './Tooltip.jsx'
import { fmt } from '../lib/format.js'
import { METRIC_TIPS } from '../lib/metricTips.js'

export default function ScenarioCard({ fairValue }) {
  if (!fairValue) return null

  return (
    <div className="terminal-card scenario-card">
      <div className="terminal-eyebrow">
        Fair Value Range
        <Tooltip text={METRIC_TIPS.fairValueRange} />
      </div>
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
    </div>
  )
}
