import React from "react";
import PageHeader from "../components/PageHeader.jsx";

export default function ScreenerPage() {
  return (
    <div className="terminal-page">
      <PageHeader
        eyebrow="Feature 003 Preview"
        title="Screener"
        description="This route is live now so the navigation and lazy route boundaries are stable. The ranking model, filters, and badges land in the next stacked feature branches."
      />

      <section className="hero-grid">
        <div className="hero-card hero-card--primary">
          <h2>Planned Output</h2>
          <ul className="feature-list">
            <li>Value, quality, balance-sheet, and risk scores</li>
            <li>Labels for Underpriced, Fairly Priced, and Overpriced</li>
            <li>Badges for Good Value and High Risk/Reward</li>
            <li>Options-aware conviction when chain quality is strong</li>
          </ul>
        </div>

        <div className="hero-card">
          <h2>Current Status</h2>
          <p>
            The shell is ready. The data provider and screener engine have not
            been introduced on this branch yet.
          </p>
        </div>
      </section>
    </div>
  );
}
