import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import SupportVault from "./SupportVault.jsx";

const NAV_ITEMS = [
  { to: "/", label: "Home", description: "Overview and roadmap" },
  { to: "/screener", label: "Screener", description: "Rank ideas and filter the universe" },
  { to: "/compare", label: "Compare", description: "Stack names side by side" },
  { to: "/saved", label: "Saved", description: "Watchlists and presets" },
];

function normaliseTicker(pathname) {
  const match = pathname.match(/^\/ticker\/([^/]+)/);
  return match ? decodeURIComponent(match[1]).toUpperCase() : "";
}

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [ticker, setTicker] = useState(() => normaliseTicker(window.location.pathname));
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const activeTicker = normaliseTicker(location.pathname);
    if (activeTicker) {
      setTicker(activeTicker);
    }
  }, [location.pathname]);

  const activeLabel = useMemo(() => {
    if (location.pathname.startsWith("/ticker/")) return "Ticker";
    const item = NAV_ITEMS.find((entry) => entry.to === location.pathname);
    return item?.label || "Home";
  }, [location.pathname]);

  function handleSubmit(event) {
    event.preventDefault();
    if (!ticker.trim()) return;
    navigate(`/ticker/${encodeURIComponent(ticker.trim().toUpperCase())}`);
  }

  return (
    <aside className={`sidebar terminal-sidebar${collapsed ? " sidebar--collapsed" : ""}`}>
      <button
        className="sidebar-toggle"
        onClick={() => setCollapsed((current) => !current)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? "\u00bb" : "\u00ab"}
      </button>

      <NavLink to="/" className="sidebar-logo">
        <span className="sidebar-logo-mark">R</span>
        {!collapsed && (
          <span className="sidebar-logo-text">Investment Terminal</span>
        )}
      </NavLink>

      {!collapsed && (
        <>
          <div className="terminal-status">
            <span className="terminal-status-label">Current Workspace</span>
            <strong>{activeLabel}</strong>
          </div>

          <form onSubmit={handleSubmit} className="terminal-search">
            <label htmlFor="ticker">Research ticker</label>
            <input
              id="ticker"
              type="text"
              value={ticker}
              onChange={(event) => setTicker(event.target.value.toUpperCase())}
              placeholder="AAPL, MSFT, NVDA …"
            />
            <button className="btn" type="submit">
              Open Ticker
            </button>
          </form>

          <nav className="terminal-nav" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `terminal-nav-link${isActive ? " terminal-nav-link--active" : ""}`
                }
              >
                <span className="terminal-nav-link-label">{item.label}</span>
                <span className="terminal-nav-link-desc">{item.description}</span>
              </NavLink>
            ))}
          </nav>

          <div className="terminal-notes">
            <div className="terminal-notes-title">Stacked SDD Chain</div>
            <ol className="terminal-notes-list">
              <li>001 Shell & routing</li>
              <li>002 Data provider</li>
              <li>003 Screener</li>
              <li>004 Ticker workspace</li>
              <li>005 Options conviction</li>
              <li>006 Report visuals</li>
              <li>007 Compare & saved</li>
              <li>008 Performance polish</li>
            </ol>
          </div>

          <div className="sidebar-vault">
            <SupportVault />
          </div>
        </>
      )}
    </aside>
  );
}
