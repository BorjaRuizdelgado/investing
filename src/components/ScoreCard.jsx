import React from 'react'
import Tooltip from './Tooltip.jsx'

const TONE_ICON = { positive: '▲', negative: '▼', neutral: '■' }

export default React.memo(function ScoreCard({ label, score, tone = 'neutral', detail, tooltip, onClick }) {
  const rounded = Number.isFinite(score) ? Math.round(score) : null
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      className={`score-card score-card--${tone}${onClick ? ' score-card--clickable' : ''}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <div className="score-card-header">
        <span className="score-card-label">
          {label}
          {tooltip && <Tooltip text={tooltip} />}
        </span>
        <span className="score-card-value">
          <span className={`score-card-tone-icon score-card-tone-icon--${tone}`} aria-hidden="true">
            {TONE_ICON[tone] || TONE_ICON.neutral}
          </span>
          {rounded != null ? rounded : 'N/A'}
        </span>
      </div>
      <div className="score-bar" style={{ '--fill': `${rounded != null ? rounded : 0}%` }}>
        <div className="score-bar-fill" style={{ width: `${rounded != null ? rounded : 0}%` }} />
      </div>
      {detail && <p className="score-card-detail">{detail}</p>}
    </Tag>
  )
})
