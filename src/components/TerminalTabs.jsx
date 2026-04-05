import React, { useRef, useEffect, useState, useCallback } from 'react'

export default function TerminalTabs({ tabs, activeTab, onChange }) {
  const containerRef = useRef(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const rafId = useRef(0)

  const updateScrollState = useCallback(() => {
    const el = containerRef.current
    if (!el) return setShowScrollBtn(false)
    const overflow = el.scrollWidth > el.clientWidth + 1
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
    setShowScrollBtn(overflow && !atEnd)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    updateScrollState()
    const el = containerRef.current
    if (!el) return

    function throttled() {
      if (rafId.current) return
      rafId.current = requestAnimationFrame(() => {
        rafId.current = 0
        updateScrollState()
      })
    }

    window.addEventListener('resize', throttled)
    el.addEventListener('scroll', throttled, { passive: true })

    return () => {
      window.removeEventListener('resize', throttled)
      el.removeEventListener('scroll', throttled)
      cancelAnimationFrame(rafId.current)
    }
  }, [tabs, updateScrollState])

  function scrollRight() {
    const el = containerRef.current
    if (!el) return
    const amount = Math.round(el.clientWidth * 0.6)
    el.scrollBy({ left: amount, behavior: 'smooth' })
  }

  return (
    <div className="terminal-tabs-wrapper">
      <div
        ref={containerRef}
        className="terminal-tabs"
        role="tablist"
        aria-label="Research sections"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`terminal-tab${activeTab === tab.id ? ' terminal-tab--active' : ''}`}
            onClick={() => onChange(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            <span className="terminal-tab__label">{tab.label}</span>
            {tab.caption && <span className="terminal-tab__caption">{tab.caption}</span>}
          </button>
        ))}
      </div>

      {showScrollBtn && (
        <button
          type="button"
          className="terminal-tabs-scroll-btn"
          aria-label="Scroll tabs right"
          onClick={scrollRight}
        >
          »
        </button>
      )}
    </div>
  )
}
