import React from 'react'
import { fmt, fmtCompact, fmtPct } from '../../lib/format.js'

function CompareCompanyCard({ item, tone, href }) {
  const changePct = item?.fundamentals?.marketChangePct
  const changeClass =
    Number.isFinite(changePct) && changePct < 0
      ? 'negative'
      : Number.isFinite(changePct)
        ? 'positive'
        : ''

  return (
    <div className={`compare-fighter compare-fighter--${tone}`}>
      <div className="compare-fighter__eyebrow">{item?.fundamentals?.sector || 'Equity'}</div>
      <div className="compare-fighter__ticker">{item?.ticker}</div>
      <h2>{item?.name || item?.ticker}</h2>
      <div className="compare-fighter__stats">
        <div>
          <span className="compare-fighter__label">Price</span>
          <strong>{fmt(item?.spot)}</strong>
        </div>
        <div>
          <span className="compare-fighter__label">1D</span>
          <strong className={changeClass}>{Number.isFinite(changePct) ? fmtPct(changePct / 100) : 'N/A'}</strong>
        </div>
        <div>
          <span className="compare-fighter__label">Market Cap</span>
          <strong>{fmtCompact(item?.fundamentals?.marketCap)}</strong>
        </div>
        <div>
          <span className="compare-fighter__label">Industry</span>
          <strong>{item?.fundamentals?.industry || 'N/A'}</strong>
        </div>
      </div>
      <a href={href} className="compare-ticker-link">
        Open full analysis &rarr;
      </a>
    </div>
  )
}

export default function CompareHero({ left, right, summary }) {
  const totalWins = summary.leftWins + summary.rightWins
  const verdict =
    summary.leftWins === summary.rightWins
      ? 'Balanced setup'
      : summary.leftWins > summary.rightWins
        ? `${left.ticker} has the broader edge`
        : `${right.ticker} has the broader edge`

  return (
    <section className="compare-battle">
      <CompareCompanyCard item={left} tone="left" href={`/${encodeURIComponent(left.ticker)}`} />

      <div className="compare-battle__center">
        <div className="compare-battle__eyebrow">Head to Head</div>
        <div className="compare-battle__verdict">{verdict}</div>
        <p className="compare-battle__caption">
          {left.ticker} wins {summary.leftWins} categories. {right.ticker} wins {summary.rightWins}.
          {totalWins === 0 ? ' The available data is too thin for a clean call.' : ''}
        </p>
        <div className="compare-battle__scoreline">
          <span className="compare-battle__pill compare-battle__pill--left">
            {left.ticker}: {summary.leftWins}
          </span>
          <span className="compare-battle__pill compare-battle__pill--right">
            {right.ticker}: {summary.rightWins}
          </span>
        </div>
      </div>

      <CompareCompanyCard item={right} tone="right" href={`/${encodeURIComponent(right.ticker)}`} />
    </section>
  )
}
