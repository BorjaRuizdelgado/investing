import React from 'react'
import Tooltip from './Tooltip.jsx'
import { fmt } from '../lib/format.js'

function KpiCard({ label, value, delta, deltaPositive, tooltip }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">
        {label}
        <Tooltip text={tooltip} />
      </div>
      <div className="kpi-value">{value}</div>
      {delta != null && (
        <div className={`kpi-delta ${deltaPositive ? 'positive' : 'negative'}`}>{delta}</div>
      )}
    </div>
  )
}

export default function KpiRow({ dist, spot, em, probs, mp }) {
  const meanChg = ((dist.mean - spot) / spot) * 100

  return (
    <div className="kpi-row">
      <KpiCard
        label="Expected Price"
        value={fmt(dist.mean)}
        deltaPositive={meanChg >= 0}
        tooltip="Options-implied expected price at expiry, derived from the Breeden-Litzenberger probability distribution."
      />
      <KpiCard
        label="Expected Move"
        value={`\u00B1${em.movePct.toFixed(1)}%`}
        deltaPositive={dist.mean >= spot}
        tooltip="Market-implied \u00B11 standard deviation price range. Delta shows implied mean change vs spot."
      />
      <KpiCard
        label="P(above spot)"
        value={`${(probs.probAbove * 100).toFixed(1)}%`}
        tooltip="Implied probability the price will be above the current spot price at expiry."
      />
      <KpiCard
        label="P(below spot)"
        value={`${(probs.probBelow * 100).toFixed(1)}%`}
        tooltip="Implied probability the price will be below the current spot price at expiry."
      />
      <KpiCard
        label="Max Pain"
        value={fmt(mp)}
        tooltip="Strike price where the most options expire worthless, causing maximum pain to option holders."
      />
    </div>
  )
}
