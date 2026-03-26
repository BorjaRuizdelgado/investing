import React from 'react'
import Tooltip from './Tooltip.jsx'

/**
 * Horizontal label strip rendered below a chart.
 * items: [{ label, value, color, tooltip? }]
 */
export default function LabelStrip({ items }) {
  return (
    <div className="label-strip">
      {items.map((item, i) => (
        <div className="label-strip-item" key={i}>
          <div className="label-strip-label">
            {item.label}
            <Tooltip text={item.tooltip} />
          </div>
          <span className="label-strip-value" style={{ color: item.color }}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  )
}
