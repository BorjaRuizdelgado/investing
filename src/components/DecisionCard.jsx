import React from 'react'
import { tone } from '../lib/scoring.js'

function buildSentence(ticker, score, signals) {
  const name = ticker || 'This stock'
  const top = signals?.[0]

  if (!Number.isFinite(score)) {
    return `Not enough data to form a view on ${name} yet.`
  }

  if (score >= 65) {
    const reason = top ? ` ${top.detail}` : ''
    return `${name} looks like a strong opportunity right now.${reason}`
  }
  if (score >= 45) {
    const reason = top ? ` ${top.detail}` : ''
    return `${name} shows a mixed picture — worth watching, not yet compelling.${reason}`
  }
  const reason = top ? ` ${top.detail}` : ''
  return `${name} doesn't screen well at the moment — proceed with caution.${reason}`
}

export default React.memo(function DecisionCard({ ticker, score, signals }) {
  const t = tone(score, 65)
  const text = buildSentence(ticker, score, signals)
  const icon = t === 'positive' ? '✓' : t === 'negative' ? '✗' : '—'

  return (
    <div className={`decision-card decision-card--${t}`}>
      <div className="decision-card__icon" aria-hidden="true">{icon}</div>
      <div className="decision-card__body">
        <div className="decision-card__label">Bottom Line</div>
        <p className="decision-card__text">{text}</p>
      </div>
      {Number.isFinite(score) && (
        <div className="decision-card__score">{Math.round(score)}</div>
      )}
    </div>
  )
})
