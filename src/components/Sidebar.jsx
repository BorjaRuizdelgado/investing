import React, { useState } from "react";

export default function Sidebar({
  onAnalyse,
  expirations,
  selectedExpiry,
  onExpiryChange,
  loading,
  daysToExpiry,
}) {
  const [ticker, setTicker] = useState("AAPL");

  function handleSubmit(e) {
    e.preventDefault();
    if (ticker.trim()) onAnalyse(ticker.trim().toUpperCase());
  }

  return (
    <aside className="sidebar">
      <h2>Options Forecast</h2>
      <p className="caption">
        Predict where the market thinks a stock is heading, using real options
        data.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="ticker">Ticker symbol</label>
          <input
            id="ticker"
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="e.g. AAPL, TSLA, SPY …"
          />
        </div>

        <button className="btn" type="submit" disabled={loading} style={{ marginTop: "0.75rem" }}>
          {loading ? "Loading…" : "Analyse"}
        </button>
      </form>

      {expirations && expirations.length > 0 && (
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
      )}
    </aside>
  );
}
