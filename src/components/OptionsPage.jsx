import React, { useState, useCallback } from "react";
import Tooltip from "./Tooltip.jsx";
import KpiRow from "./KpiRow.jsx";
import LabelStrip from "./LabelStrip.jsx";
import ForecastChart from "./ForecastChart.jsx";
import DistributionChart from "./DistributionChart.jsx";
import IvSmileChart from "./IvSmileChart.jsx";
import OiChart from "./OiChart.jsx";
import SrChart from "./SrChart.jsx";
import ChartOverlays from "./ChartOverlays.jsx";
import {
  PercentileExpander,
  DistributionExpander,
  EntryExpander,
  PcrExpander,
} from "./Expanders.jsx";
import { forecastLabels, distributionLabels, entryLabels } from "../lib/labels.js";
import { fmt } from "../lib/format.js";
import StrategySuggestions from "./StrategySuggestions.jsx";

const DEFAULT_FORECAST_OVERLAYS = { ma20: false, ma50: false, ma200: false };
const DEFAULT_ENTRY_OVERLAYS = { ma20: false, ma50: false, ma200: false, gw: true, pivots: true };

export default function OptionsPage({
  ticker,
  analysis,
  expirations,
  selectedExpiry,
  onExpiryChange,
  daysToExpiry,
  weighted,
  onWeightedToggle,
  loading,
  research,
}) {
  const [forecastOverlays, setForecastOverlays] = useState(DEFAULT_FORECAST_OVERLAYS);
  const [entryOverlays, setEntryOverlays] = useState(DEFAULT_ENTRY_OVERLAYS);

  const toggleForecast = useCallback((key) => {
    setForecastOverlays((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleEntry = useCallback((key) => {
    setEntryOverlays((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (!analysis) return null;

  return (
    <div className="options-page">
      <section className="terminal-section">
        <div className="section-heading">
          <h2>Options Positioning</h2>
          <p>
            Current price <strong>{fmt(analysis.spot)}</strong> · Expiry <strong>{analysis.expiry}</strong>
            {" "}({Math.round(analysis.dte)} days)
            {analysis.chainsUsed > 1 && <> · Weighted from <strong>{analysis.chainsUsed}</strong> chains</>}
          </p>
        </div>
        {expirations?.length > 0 && (
          <div className="options-controls">
            <div className="field">
              <label htmlFor="options-expiry">Expiration</label>
              <select
                id="options-expiry"
                value={selectedExpiry?.timestamp ?? ""}
                onChange={(e) => onExpiryChange(e.target.value)}
                disabled={loading}
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

            <div className="field field--toggle options-toggle">
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
          </div>
        )}
      </section>

      <KpiRow
        dist={analysis.dist}
        spot={analysis.spot}
        em={analysis.em}
        probs={analysis.probs}
        mp={analysis.mp}
      />

      <ChartOverlays
        overlays={[
          { key: "ma20", label: "MA 20", active: forecastOverlays.ma20 },
          { key: "ma50", label: "MA 50", active: forecastOverlays.ma50 },
          { key: "ma200", label: "MA 200", active: forecastOverlays.ma200 },
        ]}
        onToggle={toggleForecast}
      />
      <ForecastChart
        ticker={ticker}
        expiry={analysis.expiry}
        spot={analysis.spot}
        dist={analysis.dist}
        em={analysis.em}
        pctiles={analysis.pctiles}
        mp={analysis.mp}
        history={analysis.history}
        dte={analysis.dte}
        sr={analysis.sr}
        overlays={forecastOverlays}
      />
      <LabelStrip items={forecastLabels(analysis)} />

      <DistributionChart
        dist={analysis.dist}
        spot={analysis.spot}
        pctiles={analysis.pctiles}
        mp={analysis.mp}
      />
      <LabelStrip items={distributionLabels(analysis)} />

      <ChartOverlays
        overlays={[
          { key: "ma20", label: "MA 20", active: entryOverlays.ma20 },
          { key: "ma50", label: "MA 50", active: entryOverlays.ma50 },
          { key: "ma200", label: "MA 200", active: entryOverlays.ma200 },
          { key: "gw", label: "Gamma Walls", active: entryOverlays.gw },
          { key: "pivots", label: "Pivots", active: entryOverlays.pivots },
        ]}
        onToggle={toggleEntry}
      />
      <SrChart
        ticker={ticker}
        history={analysis.history}
        spot={analysis.spot}
        sr={analysis.sr}
        entryInfo={analysis.entry}
        overlays={entryOverlays}
      />
      <LabelStrip items={entryLabels(analysis)} />

      <div className="chart-row">
        <IvSmileChart ivData={analysis.ivData} spot={analysis.spot} />
        <OiChart calls={analysis.calls} puts={analysis.puts} spot={analysis.spot} />
      </div>

      <PercentileExpander pctiles={analysis.pctiles} spot={analysis.spot} />
      <DistributionExpander dist={analysis.dist} />
      <EntryExpander entryInfo={analysis.entry} sr={analysis.sr} />
      <PcrExpander pcr={analysis.pcr} />

      <StrategySuggestions analysis={analysis} research={research} />
    </div>
  );
}
