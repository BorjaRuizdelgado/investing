import React, { useState, forwardRef } from 'react'
import { WATCHLIST_PATH, SCREENER_PATH, tickerFromPath } from '../lib/routes.js'
import TickerSearch from './TickerSearch.jsx'

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
    activePage,
    onNavigateWatchlist,
    onNavigateScreener,
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

  function handleSelect(symbol) {
    setTicker(symbol)
    onAnalyse(symbol)
    setMenuOpen(false)
  }

  function go(fn) {
    setMenuOpen(false)
    fn()
  }

  function navCls(page) {
    return `app-header__nav-link${activePage === page ? ' app-header__nav-link--active' : ''}`
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
            <TickerSearch
              value={ticker}
              onChange={setTicker}
              onSelect={handleSelect}
              placeholder="Search — e.g. AAPL, Apple, Tesla…"
              ariaLabel="Ticker symbol"
              inputRef={inputRef}
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
              className={navCls('compare')}
              onClick={() => onNavigateCompare(activeTicker || null)}
            >
              Compare
            </button>
          )}
          {onNavigateWatchlist && (
            <a
              href={WATCHLIST_PATH}
              className={navCls('watchlist')}
              onClick={(e) => {
                e.preventDefault()
                onNavigateWatchlist()
              }}
            >
              Watchlist
            </a>
          )}
          {onNavigateScreener && (
            <a
              href={SCREENER_PATH}
              className={navCls('screener')}
              onClick={(e) => {
                e.preventDefault()
                onNavigateScreener()
              }}
            >
              Discover
            </a>
          )}
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
              <TickerSearch
                value={ticker}
                onChange={setTicker}
                onSelect={handleSelect}
                placeholder="Search — e.g. AAPL, Apple…"
                ariaLabel="Ticker symbol"
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
          {onNavigateScreener && (
            <button className="app-header__menu-link" onClick={() => go(onNavigateScreener)}>
              Discover
            </button>
          )}
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
