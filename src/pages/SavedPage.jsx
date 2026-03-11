import React from "react";
import PageHeader from "../components/PageHeader.jsx";

export default function SavedPage() {
  return (
    <div className="terminal-page">
      <PageHeader
        eyebrow="Feature 007 Preview"
        title="Saved"
        description="This route is reserved for local persistence: watchlists, screen presets, recent tickers, and valuation assumptions."
      />

      <div className="hero-card">
        <h2>Persistence Scope</h2>
        <ul className="feature-list">
          <li>Watchlists saved in browser storage</li>
          <li>Reusable screener presets</li>
          <li>Recent research history</li>
          <li>User-defined valuation assumptions</li>
        </ul>
      </div>
    </div>
  );
}
