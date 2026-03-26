import React, { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

/**
 * Small "?" icon that shows a tooltip on hover.
 * Renders the tooltip via a portal so it escapes overflow-clipped containers
 * (e.g. the sidebar) and overlaps the main page content.
 */
export default function Tooltip({ text }) {
  const [pos, setPos] = useState(null)
  const iconRef = useRef(null)

  const handleMouseEnter = useCallback(() => {
    if (!iconRef.current) return
    const rect = iconRef.current.getBoundingClientRect()
    setPos({
      // Vertically centred on the icon, opens to the right into main content
      top: rect.top + rect.height / 2,
      left: rect.right + 8,
    })
  }, [])

  const handleMouseLeave = useCallback(() => setPos(null), [])

  if (!text) return null

  const tooltip =
    pos &&
    createPortal(
      <div className="tooltip-portal" style={{ top: pos.top, left: pos.left }}>
        {text}
      </div>,
      document.body,
    )

  return (
    <span className="tip-wrap">
      <span
        ref={iconRef}
        className="tip-icon"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        ?
      </span>
      {tooltip}
    </span>
  )
}
