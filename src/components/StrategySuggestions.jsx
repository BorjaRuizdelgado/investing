import React from "react";
import { suggestStrategies } from "../lib/strategies.js";

export default function StrategySuggestions({ analysis, research }) {
  const strategies = React.useMemo(
    () => suggestStrategies(analysis, research),
    [analysis, research],
  );

  if (!strategies.length) return null;

  return (
    <section className="terminal-section">
      <div className="section-heading">
        <h2>Strategy Ideas</h2>
        <p>Suggested options strategies based on current market conditions and scores.</p>
      </div>

      <div className="strategy-grid">
        {strategies.map((s) => (
          <div key={s.name} className="terminal-card strategy-card">
            <div className="terminal-eyebrow">{s.name}</div>
            <p className="terminal-caption" style={{ marginBottom: "0.5rem" }}>{s.description}</p>

            <table className="strategy-legs">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Type</th>
                  <th>Strike</th>
                </tr>
              </thead>
              <tbody>
                {s.legs.map((leg, i) => (
                  <tr key={i}>
                    <td className={leg.action === "Sell" ? "strategy-sell" : "strategy-buy"}>
                      {leg.action}
                    </td>
                    <td>{leg.type}</td>
                    <td>${leg.strike}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="strategy-meta">
              <span><strong>Premium:</strong> {s.premium}</span>
              <span><strong>Max Risk:</strong> {s.maxRisk}</span>
            </div>

            <p className="strategy-rationale">{s.rationale}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
