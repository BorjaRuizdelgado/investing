import React from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";

const cards = [
  {
    title: "Screener",
    description:
      "Rank the universe by value, quality, and risk. Later branches add filters, badges, and options-aware conviction.",
    to: "/screener",
  },
  {
    title: "Ticker Workspace",
    description:
      "A single research surface for valuation, risk, financials, reports, and price/options context.",
    to: "/ticker/AAPL",
  },
  {
    title: "Compare",
    description:
      "Cross-check multiple names on the same fair-value, quality, and risk framework.",
    to: "/compare",
  },
  {
    title: "Saved",
    description:
      "Persist watchlists, presets, and custom assumptions locally so the terminal remains usable without a backend.",
    to: "/saved",
  },
];

export default function HomePage() {
  return (
    <div className="terminal-page">
      <PageHeader
        eyebrow="Feature 001"
        title="Local Investment Terminal"
        description="This branch establishes the application shell, route layout, and spec-driven workspace that later stacked branches will fill with real screening, research, and reporting features."
      />

      <section className="hero-grid">
        <div className="hero-card hero-card--primary">
          <h2>Execution Model</h2>
          <p>
            The app now has route boundaries and a dedicated terminal shell. From
            here, each branch adds one reviewable feature without collapsing the
            rest of the workspace.
          </p>
          <div className="pill-row">
            <span className="pill">Stacked PRs</span>
            <span className="pill">Spec-driven</span>
            <span className="pill">Browser-first</span>
          </div>
        </div>

        <div className="hero-card">
          <h2>What Lands Next</h2>
          <ul className="feature-list">
            <li>Data provider abstraction and local snapshots</li>
            <li>Value-focused screener and ranking engine</li>
            <li>Ticker tabs for valuation, risk, financials, and reports</li>
            <li>Options-aware conviction overlay</li>
          </ul>
        </div>
      </section>

      <section className="route-card-grid">
        {cards.map((card) => (
          <Link key={card.title} to={card.to} className="route-card">
            <div className="route-card-title">{card.title}</div>
            <p>{card.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
