import React, { useState, forwardRef } from "react";
import { DISCLAIMER_PATH, DONATE_PATH, WATCHLIST_PATH, COMPARE_PREFIX, tickerFromPath } from "../lib/routes.js";

const Header = forwardRef(function Header({
  onAnalyse, loading, activeTicker, onNavigateDisclaimer, onNavigateDonate,
  onNavigateWatchlist, onNavigateCompare, theme, onToggleTheme, hasAnalysis,
}, inputRef) {
  const [ticker, setTicker] = useState(() => tickerFromPath(window.location.pathname) || "");
  const [menuOpen, setMenuOpen] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    const val = ticker.trim().toUpperCase();
    if (val) {
      onAnalyse(val);
      setMenuOpen(false);
    }
  }

  return (
    <header className="app-header">
      <div className="app-header__inner">
        {/* Logo */}
        <a href="/" className="app-header__logo" onClick={(e) => { e.preventDefault(); window.location.href = "/"; }}>
          <span className="app-header__logo-mark">R</span>
          <span className="app-header__logo-text">Investing Tools</span>
        </a>

        {/* Search */}
        <form
          className={`app-header__search${menuOpen ? " app-header__search--open" : ""}`}
          onSubmit={handleSubmit}
        >
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
              {loading ? "\u2026" : "Analyse"}
            </button>
          </div>
        </form>

        {/* Right side nav */}
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
              onClick={(e) => { e.preventDefault(); onNavigateWatchlist(); }}
            >
              Watchlist
            </a>
          )}
          <a
            href={DONATE_PATH}
            className="app-header__nav-link"
            onClick={(e) => { e.preventDefault(); onNavigateDonate(); }}
          >
            Support
          </a>
          <a
            href={DISCLAIMER_PATH}
            className="app-header__nav-link"
            onClick={(e) => { e.preventDefault(); onNavigateDisclaimer(); }}
          >
            Disclaimer
          </a>
          <button
            className="app-header__nav-link app-header__theme-btn"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? "\u2600" : "\u263E"}
          </button>
        </nav>

        {/* Mobile hamburger */}
        <button
          className={`app-header__burger${menuOpen ? " app-header__burger--open" : ""}`}
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          <span /><span /><span />
        </button>
      </div>
    </header>
  );
});

export default Header;
