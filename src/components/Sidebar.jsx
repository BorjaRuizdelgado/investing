import React, { useState } from "react";
import SupportVault from "./SupportVault.jsx";
import Tooltip from "./Tooltip.jsx";

export default function Sidebar({
  onAnalyse,
  expirations,
  selectedExpiry,
  onExpiryChange,
  loading,
  daysToExpiry,
  weighted,
  onWeightedToggle,
  activeTicker,
}) {
  const [ticker, setTicker] = useState(() => {
    // Pre-fill from URL path if present (e.g. /SPY → "SPY")
    const path = window.location.pathname.replace(/^\//, "").replace(/\/$/, "");
    return path && !path.includes("/") ? decodeURIComponent(path).toUpperCase() : "";
  });
  const [collapsed, setCollapsed] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (ticker.trim()) onAnalyse(ticker.trim().toUpperCase());
  }

  return (
    <aside className={`sidebar${collapsed ? " sidebar--collapsed" : ""}`}>
      <button
        className="sidebar-toggle"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? "\u00bb" : "\u00ab"}
      </button>
      <a href="/" className="sidebar-logo" onClick={(e) => { e.preventDefault(); window.location.href = "/"; }}>
        <span className="sidebar-logo-mark">R</span>
        {!collapsed && <span className="sidebar-logo-text">Investing</span>}
      </a>

      {!collapsed && (
        <>
          <form onSubmit={handleSubmit}>
            <input
              id="ticker"
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="e.g. AAPL, TSLA, SPY …"
            />
            <button className="btn" type="submit" disabled={loading}>
              {loading ? "Loading…" : "Analyse"}
            </button>
          </form>

          {expirations && expirations.length > 0 && (
            <>
              <div className="field">
                <label htmlFor="expiry">Expiration</label>
                <select
                  id="expiry"
                  value={selectedExpiry?.timestamp ?? ""}
                  onChange={(e) => onExpiryChange(e.target.value)}
                >
                  {expirations.map((exp) => {
                    const dte = daysToExpiry(exp.date);
                    return (
                      <option key={exp.timestamp} value={exp.timestamp}>
                        {exp.date} ({Math.round(dte)}d)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="field field--toggle">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={weighted}
                    onChange={() => onWeightedToggle()}
                    disabled={loading}
                  />
                  <span className="toggle-switch" />
                </label>
                <span className="toggle-text">Multi-expiry<br />computation</span>
                <Tooltip text="When enabled, blends all option chains expiring up to the selected date, weighted by proximity (nearer = higher weight). When off, uses only the selected expiry chain." />
              </div>
            </>
          )}

          <div className="sidebar-vault">
            <SupportVault />
          </div>

          <a href="https://borjaruizdelgado.com" className="sidebar-home">
            ← Return Home
          </a>
        </>
      )}
    </aside>
  );
}
