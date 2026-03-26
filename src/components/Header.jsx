import React, { useState, forwardRef } from 'react'
import { DISCLAIMER_PATH, DONATE_PATH, WATCHLIST_PATH, tickerFromPath } from '../lib/routes.js'

const SunIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

const MoonIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

const Header = forwardRef(function Header(
  {
    onAnalyse,
    loading,
    activeTicker,
    onNavigateDisclaimer,
    onNavigateDonate,
    onNavigateWatchlist,
    onNavigateCompare,
    theme,
    onToggleTheme,
    hasAnalysis: _hasAnalysis,
  },
  inputRef,
) {
  const [ticker, setTicker] = useState(() => tickerFromPath(window.location.pathname) || '')
  const [menuOpen, setMenuOpen] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    const val = ticker.trim().toUpperCase()
    if (val) {
      onAnalyse(val)
      setMenuOpen(false)
    }
  }

  function go(fn) {
    setMenuOpen(false)
    fn()
  }

  return (
    <header className="app-header">
      <div className="app-header__inner">
        {/* Logo */}
        <a
          href="/"
          className="app-header__logo"
          onClick={(e) => {
            e.preventDefault()
            window.location.href = '/'
          }}
        >
          <span className="app-header__logo-mark">R</span>
          <span className="app-header__logo-text">Investing Tools</span>
        </a>

        {/* Desktop search */}
        <form className="app-header__search" onSubmit={handleSubmit}>
          <div className="app-header__search-row">
            <input
              ref={inputRef}
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="Ticker — e.g. AAPL, TSLA, SPY…"
              aria-label="Ticker symbol"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck="false"
            />
            <button className="app-header__search-btn" type="submit" disabled={loading}>
              {loading ? '\u2026' : 'Analyse'}
            </button>
          </div>
        </form>

        {/* Desktop nav */}
        <nav className="app-header__nav">
          {onNavigateCompare && (
            <button
              className="app-header__nav-link"
              onClick={() => onNavigateCompare(activeTicker || null)}
            >
              Compare
            </button>
          )}
          {onNavigateWatchlist && (
            <a
              href={WATCHLIST_PATH}
              className="app-header__nav-link"
              onClick={(e) => {
                e.preventDefault()
                onNavigateWatchlist()
              }}
            >
              Watchlist
            </a>
          )}
          <a
            href={DONATE_PATH}
            className="app-header__nav-link"
            onClick={(e) => {
              e.preventDefault()
              onNavigateDonate()
            }}
          >
            Support
          </a>
          <a
            href={DISCLAIMER_PATH}
            className="app-header__nav-link"
            onClick={(e) => {
              e.preventDefault()
              onNavigateDisclaimer()
            }}
          >
            Disclaimer
          </a>
          <button
            className="app-header__nav-link app-header__theme-btn"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            <span className="theme-text">{theme === 'dark' ? ' Light' : ' Dark'}</span>
          </button>
        </nav>

        {/* Mobile burger */}
        <button
          className={`app-header__burger${menuOpen ? ' app-header__burger--open' : ''}`}
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* Mobile full-screen panel */}
      <div className={`app-header__menu-panel${menuOpen ? ' app-header__menu-panel--open' : ''}`}>
        <div className="app-header__menu-search">
          <form onSubmit={handleSubmit}>
            <div className="app-header__search-row">
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="Ticker — e.g. AAPL, TSLA, SPY…"
                aria-label="Ticker symbol"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck="false"
              />
              <button className="app-header__search-btn" type="submit" disabled={loading}>
                {loading ? '\u2026' : 'Analyse'}
              </button>
            </div>
          </form>
        </div>

        <div className="app-header__menu-links">
          {onNavigateCompare && (
            <button
              className="app-header__menu-link"
              onClick={() => go(() => onNavigateCompare(activeTicker || null))}
            >
              Compare
            </button>
          )}
          {onNavigateWatchlist && (
            <button className="app-header__menu-link" onClick={() => go(onNavigateWatchlist)}>
              Watchlist
            </button>
          )}
          <button className="app-header__menu-link" onClick={() => go(onNavigateDonate)}>
            Support
          </button>
          <button className="app-header__menu-link" onClick={() => go(onNavigateDisclaimer)}>
            Disclaimer
          </button>
          <button
            className="app-header__menu-link"
            onClick={() => {
              onToggleTheme()
            }}
          >
            {theme === 'dark' ? (
              <>
                <SunIcon /> Light mode
              </>
            ) : (
              <>
                <MoonIcon /> Dark mode
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  )
})

export default Header
