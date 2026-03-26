import React from 'react'

/**
 * Pill-toggle bar for chart overlays (MAs, gamma walls, etc.).
 * Each toggle is a small pill that lights up when active.
 */
export default function ChartOverlays({ overlays, onToggle }) {
  return (
    <div className="chart-overlays">
      {overlays.map(({ key, label, active }) => (
        <button
          key={key}
          className={`overlay-pill${active ? ' overlay-pill--active' : ''}`}
          onClick={() => onToggle(key)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  )
}
