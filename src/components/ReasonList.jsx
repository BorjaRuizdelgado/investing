import React from 'react'

export default function ReasonList({ title = 'What matters', reasons = [] }) {
  if (!reasons.length) return null

  return (
    <section className="terminal-section">
      <div className="section-heading">
        <h2>{title}</h2>
      </div>
      <div className="reason-list">
        {reasons.map((reason) => (
          <div
            key={`${reason.title}-${reason.detail}`}
            className={`reason-item reason-item--${reason.tone || 'neutral'}`}
          >
            <div className="reason-title">{reason.title}</div>
            <div className="reason-detail">{reason.detail}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
