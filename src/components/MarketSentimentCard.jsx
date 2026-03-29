import React from 'react'
import Tooltip from './Tooltip.jsx'

const TOOLTIP =
  'Ticker sentiment score computed from this asset\'s own price history: momentum vs 125-day SMA, 14-day RSI, 52-week range position, volume pressure (10d vs 60d avg), and Bollinger %B. All factors equally weighted and normalized to 0–100.'

function sentimentTone(score) {
  if (!Number.isFinite(score)) return 'neutral'
  if (score <= 44) return 'negative'
  if (score <= 55) return 'neutral'
  return 'positive'
}

/**
 * Per-ticker Fear/Greed card. Works for both equities and crypto.
 * Pass onClick to make the card navigable (e.g. to the Technicals tab).
 */
export default function MarketSentimentCard({ sentiment, onClick }) {
  if (!sentiment || !Number.isFinite(sentiment.score)) return null

  const { name, score, classification, attribution } = sentiment
  const tone = sentimentTone(score)
  const rounded = Math.round(score)
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      className={`score-card score-card--${tone}${onClick ? ' score-card--clickable' : ''}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <div className="score-card-header">
        <span className="score-card-label">
          {name}
          <Tooltip text={TOOLTIP} />
        </span>
        <span className="score-card-value">{rounded}</span>
      </div>
      <div className="score-bar" style={{ '--fill': `${rounded}%` }}>
        <div className="score-bar-fill" style={{ width: `${rounded}%` }} />
      </div>
      <p className="score-card-detail">{classification}</p>
      {attribution && (
        <p className="terminal-caption">
          Source:{' '}
          <a href={attribution.url} target="_blank" rel="noopener noreferrer">
            {attribution.label}
          </a>
        </p>
      )}
    </Tag>
  )
}
