import React from 'react'
import Tooltip from './Tooltip.jsx'
import { fmt, fmtPct, fmtRatio, fmtCompact } from '../lib/format.js'
import { isLowerBetter } from '../lib/sectorMedians.js'

function formatMetric(metric) {
  if (metric.value == null || Number.isNaN(metric.value)) return 'N/A'
  if (metric.kind === 'pct') return fmtPct(metric.value)
  if (metric.kind === 'pct-whole') return `${Number(metric.value).toFixed(1)}%`
  if (metric.kind === 'money') return fmt(metric.value)
  if (metric.kind === 'compact-money') return fmtCompact(metric.value)
  return fmtRatio(metric.value)
}

function formatSectorValue(value, kind) {
  if (value == null || Number.isNaN(value)) return 'N/A'
  if (kind === 'pct') return fmtPct(value)
  if (kind === 'pct-whole') return `${Number(value).toFixed(1)}%`
  if (kind === 'money') return fmt(value)
  if (kind === 'compact-money') return fmtCompact(value)
  return fmtRatio(value)
}

function compareClass(metricKey, metricValue, sectorValue) {
  if (metricValue == null || sectorValue == null) return ''
  const lower = isLowerBetter(metricKey)
  if (lower) {
    return metricValue < sectorValue
      ? 'metric-better'
      : metricValue > sectorValue
        ? 'metric-worse'
        : ''
  }
  return metricValue > sectorValue
    ? 'metric-better'
    : metricValue < sectorValue
      ? 'metric-worse'
      : ''
}

export default function MetricTable({ title, metrics = [], sectorMedians }) {
  const visible = metrics.filter((metric) => metric.value != null && !Number.isNaN(metric.value))
  if (!visible.length) return null

  const hasSector = sectorMedians && visible.some((m) => m.key && sectorMedians[m.key] != null)

  return (
    <section className="terminal-section">
      <div className="section-heading">
        <h2>{title}</h2>
      </div>
      <div className="terminal-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
              {hasSector && <th>Market</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((metric) => {
              const sectorVal = metric.key && sectorMedians ? sectorMedians[metric.key] : null
              const cls = metric.key ? compareClass(metric.key, metric.value, sectorVal) : ''
              return (
                <tr key={metric.label}>
                  <td>
                    <span className="metric-table-label">
                      {metric.label}
                      {metric.tip && <Tooltip text={metric.tip} />}
                    </span>
                  </td>
                  <td className={cls}>{formatMetric(metric)}</td>
                  {hasSector && (
                    <td className="metric-sector-val">
                      {sectorVal != null ? formatSectorValue(sectorVal, metric.kind) : '\u2014'}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
