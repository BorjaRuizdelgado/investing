import React from "react";
import PageHeader from "../components/PageHeader.jsx";

export default function ComparePage() {
  return (
    <div className="terminal-page">
      <PageHeader
        eyebrow="Feature 007 Preview"
        title="Compare"
        description="This route will become the side-by-side decision surface for valuation, quality, risk, and options-confirmation once the core provider and screener layers are in place."
      />

      <div className="hero-card">
        <h2>Coming Here</h2>
        <ul className="feature-list">
          <li>Multi-ticker comparison grid</li>
          <li>Shared fair-value and quality/risk metrics</li>
          <li>Options confirmation state for supported names</li>
        </ul>
      </div>
    </div>
  );
}
