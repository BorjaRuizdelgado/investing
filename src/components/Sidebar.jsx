import React, { useState } from 'react'
import SupportVault from './SupportVault.jsx'
import { DISCLAIMER_PATH, tickerFromPath } from '../lib/routes.js'

export default function Sidebar({ onAnalyse, loading, activeTicker: _activeTicker, onNavigateDisclaimer }) {
  const [ticker, setTicker] = useState(() => {
    return tickerFromPath(window.location.pathname) || ''
  })
  const [collapsed, setCollapsed] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (ticker.trim()) onAnalyse(ticker.trim().toUpperCase())
  }

  return (
    <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
      <button
        className="sidebar-toggle"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '\u00bb' : '\u00ab'}
      </button>

      {!collapsed && (
        <>
          <a
            href="/"
            className="sidebar-logo"
            onClick={(e) => {
              e.preventDefault()
              window.location.href = '/'
            }}
          >
            <span className="sidebar-logo-mark">R</span>
            {!collapsed && <span className="sidebar-logo-text">Investing Tools</span>}
          </a>
          <form onSubmit={handleSubmit}>
            <input
              id="ticker"
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="e.g. AAPL, TSLA, SPY …"
            />
            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Loading…' : 'Analyse'}
            </button>
          </form>

          <div className="sidebar-vault">
            <SupportVault />
          </div>

          <a
            href={DISCLAIMER_PATH}
            className="sidebar-home"
            onClick={(e) => {
              e.preventDefault()
              onNavigateDisclaimer()
            }}
          >
            Disclaimer
          </a>
        </>
      )}
    </aside>
  )
}
