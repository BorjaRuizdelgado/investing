import React from 'react'
import { fmt, fmtDecimal, fmtInt } from '../lib/format.js'
import Expander from './Expander.jsx'

export function PercentileExpander({ pctiles, spot }) {
  const rows = Object.entries(pctiles)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([p, val]) => {
      const chg = ((val - spot) / spot) * 100
      return {
        percentile: `${p}th`,
        price: fmt(val),
        change: `${chg >= 0 ? '+' : ''}${chg.toFixed(1)}%`,
      }
    })

  return (
    <Expander title="Percentile Breakdown">
      <p>
        Percentiles show where the market implies the price will land. For example, the 25th
        percentile means there is roughly a 25% chance the price will be{' '}
        <strong>at or below</strong> that level by expiry.
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Percentile</th>
            <th>Price</th>
            <th>Change from spot</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.percentile}>
              <td>{r.percentile}</td>
              <td>{r.price}</td>
              <td>{r.change}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Expander>
  )
}

export function DistributionExpander({ dist }) {
  return (
    <Expander title="Distribution Details">
      <div className="metrics-grid cols-4">
        <div className="metric-card">
          <div className="metric-label">Mean</div>
          <div className="metric-value">{fmt(dist.mean)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Median</div>
          <div className="metric-value">{fmt(dist.median)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Std Dev</div>
          <div className="metric-value">{fmt(dist.std)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Skewness</div>
          <div className="metric-value">
            {dist.skew >= 0 ? '+' : ''}
            {dist.skew.toFixed(3)}
          </div>
        </div>
      </div>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        The implied distribution is derived from market option prices using the Breeden-Litzenberger
        identity. It represents the market&apos;s risk-neutral probability assessment for the
        underlying&apos;s price at expiry.
      </p>
    </Expander>
  )
}

export function EntryExpander({ entryInfo, sr }) {
  const levels = (sr.levels || []).sort((a, b) => a.price - b.price)
  const ma = sr.movingAvgs || {}

  return (
    <Expander title="Entry Setup Details">
      <p>
        These levels are derived from the implied probability distribution, historical price pivots,
        high open-interest gamma walls and moving averages. They are informational — always apply
        your own risk management.
      </p>
      <ul style={{ margin: '0.75rem 0', paddingLeft: '1.2rem' }}>
        {entryInfo.notes.map((note, i) => (
          <li key={i} style={{ marginBottom: '0.25rem' }}>
            {note}
          </li>
        ))}
      </ul>

      {levels.length > 0 && (
        <>
          <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>Key Levels</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>Price</th>
                <th>Type</th>
                <th>Source</th>
                <th>Strength</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((l, i) => (
                <tr key={i}>
                  <td>{fmt(l.price)}</td>
                  <td style={{ textTransform: 'capitalize' }}>{l.type}</td>
                  <td>{l.source.replace(/_/g, ' ')}</td>
                  <td>{'★'.repeat(l.strength)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {Object.values(ma).some((v) => v != null) && (
        <>
          <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>Moving Averages</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>MA</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(ma)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([period, val]) => (
                  <tr key={period}>
                    <td>MA{period}</td>
                    <td>{val != null ? fmt(val) : 'N/A'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}
    </Expander>
  )
}

export function PcrExpander({ pcr }) {
  return (
    <Expander title="Put/Call Ratio">
      <p>
        The Put/Call Ratio (PCR) measures relative options activity. A PCR{' '}
        <strong>above 1.2</strong> is broadly bearish sentiment; <strong>below 0.7</strong> is
        broadly bullish.
      </p>
      <div className="metrics-grid cols-4" style={{ marginTop: '0.75rem' }}>
        <div className="metric-card">
          <div className="metric-label">PCR (Volume)</div>
          <div className="metric-value">{fmtDecimal(pcr.pcrVol)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">PCR (OI)</div>
          <div className="metric-value">{fmtDecimal(pcr.pcrOi)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Call Volume</div>
          <div className="metric-value">{fmtInt(pcr.callVolume)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Put Volume</div>
          <div className="metric-value">{fmtInt(pcr.putVolume)}</div>
        </div>
      </div>
      <div className="metrics-grid cols-2">
        <div className="metric-card">
          <div className="metric-label">Call OI</div>
          <div className="metric-value">{fmtInt(pcr.callOi)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Put OI</div>
          <div className="metric-value">{fmtInt(pcr.putOi)}</div>
        </div>
      </div>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
        Sentiment signal: <strong style={{ textTransform: 'capitalize' }}>{pcr.sentiment}</strong>
      </p>
    </Expander>
  )
}
