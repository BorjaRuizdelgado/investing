import React, { useMemo } from "react";
import Plot from "react-plotly.js";
import { COLORS, LAYOUT_DEFAULTS, axisStyle, PLOTLY_CONFIG_SMALL, chartHeight } from "../lib/theme.js";

export default function OiChart({ calls, puts, spot }) {
  const { data, layout } = useMemo(() => {
    const traces = [];

    const hasData =
      calls.some((c) => (c.openInterest || 0) + (c.volume || 0) > 0) ||
      puts.some((p) => (p.openInterest || 0) + (p.volume || 0) > 0);

    if (!hasData) {
      return {
        data: [],
        layout: {
          ...LAYOUT_DEFAULTS,
          height: chartHeight(400),
          annotations: [{ text: "No open interest / volume data available", xref: "paper", yref: "paper", x: 0.5, y: 0.5, showarrow: false, font: { size: 14, color: COLORS.textMuted } }],
        },
      };
    }

    // Calls OI
    const cOi = calls.filter((c) => c.openInterest > 0);
    if (cOi.length > 0) {
      traces.push({
        x: cOi.map((c) => c.strike),
        y: cOi.map((c) => c.openInterest),
        type: "bar",
        name: "Calls OI",
        marker: { color: COLORS.accent },
        opacity: 0.7,
        hovertemplate: "<b>Call</b> $%{x:,.0f}<br>OI: %{y:,.0f}<extra></extra>",
      });
    }

    // Calls Volume
    const cVol = calls.filter((c) => c.volume > 0);
    if (cVol.length > 0) {
      traces.push({
        x: cVol.map((c) => c.strike),
        y: cVol.map((c) => c.volume),
        type: "bar",
        name: "Calls Vol",
        marker: { color: COLORS.accent },
        opacity: 0.35,
        hovertemplate: "<b>Call</b> $%{x:,.0f}<br>Vol: %{y:,.0f}<extra></extra>",
      });
    }

    // Puts OI
    const pOi = puts.filter((p) => p.openInterest > 0);
    if (pOi.length > 0) {
      traces.push({
        x: pOi.map((p) => p.strike),
        y: pOi.map((p) => p.openInterest),
        type: "bar",
        name: "Puts OI",
        marker: { color: COLORS.accentWarm },
        opacity: 0.7,
        hovertemplate: "<b>Put</b> $%{x:,.0f}<br>OI: %{y:,.0f}<extra></extra>",
      });
    }

    // Puts Volume
    const pVol = puts.filter((p) => p.volume > 0);
    if (pVol.length > 0) {
      traces.push({
        x: pVol.map((p) => p.strike),
        y: pVol.map((p) => p.volume),
        type: "bar",
        name: "Puts Vol",
        marker: { color: COLORS.accentWarm },
        opacity: 0.35,
        hovertemplate: "<b>Put</b> $%{x:,.0f}<br>Vol: %{y:,.0f}<extra></extra>",
      });
    }

    const shapes = [
      { type: "line", x0: spot, x1: spot, y0: 0, y1: 1, yref: "paper", line: { color: COLORS.text, width: 2, dash: "dash" }, opacity: 0.4 },
    ];

    const annotations = [
      { text: `Spot $${spot.toFixed(2)}`, x: spot, y: 1.05, xref: "x", yref: "paper", showarrow: false, font: { size: 12, color: COLORS.textLight } },
    ];

    const lo = {
      ...LAYOUT_DEFAULTS,
      margin: { l: 65, r: 30, t: 80, b: 55 },
      title: { text: "<b>Open Interest & Volume by Strike</b>", font: { size: 16, color: COLORS.text }, x: 0.01 },
      xaxis: { ...axisStyle(), title: "Strike ($)", tickprefix: "$" },
      yaxis: { ...axisStyle(), title: "Contracts" },
      barmode: "group",
      showlegend: true,
      legend: { bgcolor: "rgba(247,245,240,0.90)", bordercolor: COLORS.borderLight, borderwidth: 1, font: { size: 12 }, x: 0.01, y: 0.99, xanchor: "left", yanchor: "top" },
      height: chartHeight(400),
      hovermode: "x unified",
      shapes,
      annotations,
    };

    return { data: traces, layout: lo };
  }, [calls, puts, spot]);

  return (
    <div className="chart-section">
      <Plot data={data} layout={layout} config={PLOTLY_CONFIG_SMALL} useResizeHandler style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
