import React from 'react'

function scoreLabel(value) {
  return Number.isFinite(value) ? Math.round(value) : 'N/A'
}

export default function CompareScoreboard({ left, right, rows }) {
  return (
    <section className="terminal-section">
      <div className="section-heading">
        <h2>Category Scoreboard</h2>
        <p>Each row shows relative strength on a 0-100 scale.</p>
      </div>

      <div className="terminal-card compare-scoreboard">
        {rows.map((row) => (
          <div key={row.key} className="compare-scoreboard__row">
            <div className="compare-scoreboard__header">
              <span>{row.label}</span>
              <span className="compare-scoreboard__winner">
                {row.winner === 'a'
                  ? `${left.ticker} leads`
                  : row.winner === 'b'
                    ? `${right.ticker} leads`
                    : 'Even'}
              </span>
            </div>
            <div className="compare-scoreboard__track">
              <span
                className="compare-scoreboard__marker compare-scoreboard__marker--left"
                style={{ left: Number.isFinite(row.leftScore) ? `${row.leftScore}%` : '0%' }}
              />
              <span
                className="compare-scoreboard__marker compare-scoreboard__marker--right"
                style={{ left: Number.isFinite(row.rightScore) ? `${row.rightScore}%` : '0%' }}
              />
            </div>
            <div className="compare-scoreboard__values">
              <span>
                {left.ticker} {scoreLabel(row.leftScore)}
              </span>
              <span>
                {right.ticker} {scoreLabel(row.rightScore)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
