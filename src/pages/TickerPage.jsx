import React from "react";
import { useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";

const tabs = ["Overview", "Valuation", "Quality & Risk", "Financials", "Report", "Price/Options"];

export default function TickerPage() {
  const { symbol = "Ticker" } = useParams();
  const upper = symbol.toUpperCase();

  return (
    <div className="terminal-page">
      <PageHeader
        eyebrow="Feature 004 Preview"
        title={upper}
        description="The ticker route is now stable and ready for the research workspace. Later branches will fill these tabs with real data, scorecards, and visuals."
      />

      <section className="tabs-preview">
        {tabs.map((tab) => (
          <div key={tab} className="tab-preview">
            {tab}
          </div>
        ))}
      </section>

      <section className="hero-grid">
        <div className="hero-card hero-card--primary">
          <h2>Workspace Contract</h2>
          <p>
            The route path and page shell are fixed early so deeper features can
            build on the same URL and layout contract without reworking
            navigation.
          </p>
        </div>
        <div className="hero-card">
          <h2>Next Dependencies</h2>
          <ul className="feature-list">
            <li>Provider abstraction and snapshot data</li>
            <li>Screener ranking logic and badges</li>
            <li>Tabbed ticker research panels</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
