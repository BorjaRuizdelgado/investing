import React from "react";

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
            {item.tooltip && (
              <span className="tip-wrap">
                <span className="tip-icon">?</span>
                <span className="tip-box">{item.tooltip}</span>
              </span>
            )}
          </div>
          <span className="label-strip-value" style={{ color: item.color }}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
