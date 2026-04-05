import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Small "?" icon that shows a tooltip on hover (desktop) OR click/tap (mobile).
 * Renders the tooltip via a portal so it escapes overflow-clipped containers
 * (e.g. the sidebar) and overlaps the main page content.
 * Tapping outside the tooltip dismisses it on touch devices.
 */
export default function Tooltip({ text }) {
  const [pos, setPos] = useState(null)
  const iconRef = useRef(null)
  const open = Boolean(pos)

  const positionTooltip = useCallback(() => {
    if (!iconRef.current) return null
    const rect = iconRef.current.getBoundingClientRect()
    return { top: rect.top + rect.height / 2, left: rect.right + 8 }
  }, [])

  const handleMouseEnter = useCallback(() => {
    setPos(positionTooltip())
  }, [positionTooltip])

  const handleMouseLeave = useCallback(() => setPos(null), [])

  const handleClick = useCallback((e) => {
    e.stopPropagation()
    setPos((prev) => (prev ? null : positionTooltip()))
  }, [positionTooltip])

  // Dismiss on outside click/tap (for mobile)
  useEffect(() => {
    if (!open) return
    const dismiss = (e) => {
      if (iconRef.current && iconRef.current.contains(e.target)) return
      setPos(null)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

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
        role="button"
        aria-label="More info"
        tabIndex={0}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(e) } }}
      >
        ?
      </span>
      {tooltip}
    </span>
  )
}
