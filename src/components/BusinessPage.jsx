import React from "react";
import Plot from "react-plotly.js";
import { fmtCompact } from "../lib/format.js";

function StatementChart({ title, series = [], keys = [], colors = [] }) {
  if (!series.length) return null;

  const visibleKeys = keys.filter((key) =>
    series.some((row) => Number.isFinite(row[key.field]))
  );
  if (!visibleKeys.length) return null;

  return (
    <div className="terminal-card">
      <div className="terminal-eyebrow">{title}</div>
      <Plot
        data={visibleKeys.map((key, index) => ({
          type: "bar",
          name: key.label,
          x: series.map((row) => row.period),
          y: series.map((row) => row[key.field]),
          marker: { color: colors[index] },
          hovertemplate: "%{x}<br>%{y:$,.0f}<extra></extra>",
        }))}
        layout={{
          barmode: "group",
          autosize: true,
          height: 320,
          margin: { l: 40, r: 12, t: 12, b: 40 },
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          font: { color: "#5a5a5a", family: "DM Sans, sans-serif", size: 12 },
          legend: { orientation: "h", y: 1.16, x: 0 },
          xaxis: { fixedrange: true },
          yaxis: { fixedrange: true, gridcolor: "#e8e5de" },
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%" }}
        useResizeHandler
      />
    </div>
  );
}

export default function BusinessPage({ ticker, fundamentals, research }) {
  const business = research?.business;
  const summaryCards = [
    {
      label: "Company",
      value: fundamentals?.longName || fundamentals?.name || ticker,
      caption: [fundamentals?.sector, fundamentals?.industry].filter(Boolean).join(" · ") || "No profile metadata",
      show: Boolean(fundamentals?.longName || fundamentals?.name || ticker),
    },
    {
      label: "Revenue",
      value: fmtCompact(fundamentals?.totalRevenue),
      caption: "Latest reported annual revenue",
      show: fundamentals?.totalRevenue != null,
    },
    {
      label: "Free Cash Flow",
      value: fmtCompact(fundamentals?.freeCashflow),
      caption: "Latest trailing free cash flow",
      show: fundamentals?.freeCashflow != null,
    },
  ].filter((card) => card.show);

  if (!business?.hasData) return null;

  return (
    <>
      <section className="terminal-section">
        <div className="section-heading">
          <h2>Business</h2>
        </div>
        {summaryCards.length > 0 && (
          <div className="terminal-grid terminal-grid--3">
            {summaryCards.map((card) => (
              <div key={card.label} className="terminal-card terminal-card--compact">
                <div className="terminal-eyebrow">{card.label}</div>
                <div className="terminal-stat">{card.value}</div>
                <div className="terminal-caption">{card.caption}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {business?.hasFinancialSeries ? (
        <section className="terminal-section">
          <div className="terminal-grid terminal-grid--2">
            {business?.hasIncomeSeries && (
              <StatementChart
                title="Income Statement Trend"
                series={business.incomeSeries}
                keys={[
                  { field: "revenue", label: "Revenue" },
                  { field: "operatingIncome", label: "Operating income" },
                  { field: "netIncome", label: "Net income" },
                ]}
                colors={["#4d6a61", "#c08050", "#6e8a80"]}
              />
            )}
            {business?.hasCashflowSeries && (
              <StatementChart
                title="Cash Flow Trend"
                series={business.cashflowSeries}
                keys={[
                  { field: "operatingCashflow", label: "Operating cash flow" },
                  { field: "freeCashflow", label: "Free cash flow" },
                  { field: "capitalExpenditures", label: "Capex" },
                ]}
                colors={["#4d6a61", "#3d7a5a", "#b05040"]}
              />
            )}
          </div>
        </section>
      ) : (
        <div className="info-box">
          Historical financial statement series were not available for this ticker.
        </div>
      )}
    </>
  );
}
