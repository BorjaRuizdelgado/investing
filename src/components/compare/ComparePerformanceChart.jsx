import React from 'react'
import { fmtPct } from '../../lib/format.js'
import { getColors, mobileMargin } from '../../lib/theme.js'
import { getHistoryWindow, indexHistory, trailingReturn } from '../../lib/compare.js'
import ChartFrame from '../ChartFrame.jsx'

const RANGE_TO_BARS = {
  '1M': 22,
  '3M': 66,
  '6M': 132,
  '1Y': 252,
}

const RETURN_WINDOWS = [
  ['1M', 22],
  ['3M', 66],
  ['6M', 132],
  ['1Y', 252],
]

function formatOptionalPct(value) {
  return Number.isFinite(value) ? fmtPct(value) : 'N/A'
}

export default function ComparePerformanceChart({ left, right, range, onRangeChange }) {
  const colors = getColors()
  const leftSeries = indexHistory(getHistoryWindow(left.history, RANGE_TO_BARS[range]))
  const rightSeries = indexHistory(getHistoryWindow(right.history, RANGE_TO_BARS[range]))

  if (leftSeries.length < 2 || rightSeries.length < 2) return null

  return (
    <section className="terminal-section">
      <div className="section-heading compare-section-heading">
        <div>
          <h2>Relative Performance</h2>
          <p>Both lines are rebased to 100 so you compare returns instead of absolute share prices.</p>
        </div>
        <div className="compare-range-toggle">
          {Object.keys(RANGE_TO_BARS).map((option) => (
            <button
              key={option}
              type="button"
              className={`compare-range-toggle__btn${range === option ? ' compare-range-toggle__btn--active' : ''}`}
              onClick={() => onRangeChange(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="terminal-card">
        <ChartFrame
          data={[
            {
              type: 'scatter',
              mode: 'lines',
              name: left.ticker,
              x: leftSeries.map((bar) => bar.date),
              y: leftSeries.map((bar) => bar.indexedClose),
              line: { color: colors.accent, width: 2.5 },
            },
            {
              type: 'scatter',
              mode: 'lines',
              name: right.ticker,
              x: rightSeries.map((bar) => bar.date),
              y: rightSeries.map((bar) => bar.indexedClose),
              line: { color: colors.accentWarm, width: 2.5 },
            },
          ]}
          layout={{
            autosize: true,
            height: 360,
            margin: mobileMargin(60, 30, 20, 40, { mobileL: 36, mobileR: 16 }),
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { color: colors.textLight, family: 'DM Sans, sans-serif', size: 12 },
            legend: { orientation: 'h', y: 1.22, yanchor: 'bottom', x: 0, font: { color: colors.textLight } },
            xaxis: { fixedrange: true, gridcolor: colors.borderLight, tickfont: { color: colors.textMuted } },
            yaxis: {
              title: 'Indexed return',
              fixedrange: true,
              gridcolor: colors.borderLight,
              tickfont: { color: colors.textMuted },
            },
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%' }}
          showControls={false}
          defaultInteractive={false}
        />

        <div className="compare-return-grid">
          <div className="compare-return-grid__label"></div>
          <div className="compare-return-grid__header compare-return-grid__header--left">{left.ticker}</div>
          <div className="compare-return-grid__header compare-return-grid__header--right">{right.ticker}</div>
          {RETURN_WINDOWS.map(([label, bars]) => (
            <React.Fragment key={label}>
              <div className="compare-return-grid__label">{label}</div>
              <div>{formatOptionalPct(trailingReturn(left.history, bars))}</div>
              <div>{formatOptionalPct(trailingReturn(right.history, bars))}</div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}
