import React from 'react'

/**
 * A single-sentence plain-English summary banner that sits at the top of a tab.
 * Helps casual users quickly understand the takeaway before diving into metrics.
 */
export default React.memo(function TldrBanner({ text, tone = 'neutral' }) {
  if (!text) return null

  return (
    <div className={`tldr-banner tldr-banner--${tone}`}>
      <span className="tldr-banner__icon" aria-hidden="true">
        {tone === 'positive' ? '↑' : tone === 'negative' ? '↓' : '—'}
      </span>
      <p className="tldr-banner__text">{text}</p>
    </div>
  )
})
