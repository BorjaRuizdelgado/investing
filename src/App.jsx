import React, { useState, useCallback } from "react";
import Sidebar from "./components/Sidebar.jsx";
import KpiRow from "./components/KpiRow.jsx";
import LabelStrip from "./components/LabelStrip.jsx";
import ForecastChart from "./components/ForecastChart.jsx";
import DistributionChart from "./components/DistributionChart.jsx";
import IvSmileChart from "./components/IvSmileChart.jsx";
import OiChart from "./components/OiChart.jsx";
import SrChart from "./components/SrChart.jsx";
import ChartOverlays from "./components/ChartOverlays.jsx";
import {
  PercentileExpander,
  DistributionExpander,
  EntryExpander,
  PcrExpander,
} from "./components/Expanders.jsx";
import FundamentalsPanel from "./components/FundamentalsPanel.jsx";
import TrendingTickers from "./components/TrendingTickers.jsx";
import SupportVault from "./components/SupportVault.jsx";
import { daysToExpiry } from "./lib/fetcher.js";
import { fmt } from "./lib/format.js";
import { forecastLabels, distributionLabels, entryLabels } from "./lib/labels.js";
import useOptionsAnalysis from "./hooks/useOptionsAnalysis.js";

const DEFAULT_FORECAST_OVERLAYS = { ma20: false, ma50: false, ma200: false };
const DEFAULT_ENTRY_OVERLAYS = { ma20: false, ma50: false, ma200: false, gw: true, pivots: true };

export default function App() {
  const [forecastOverlays, setForecastOverlays] = useState(DEFAULT_FORECAST_OVERLAYS);
  const [entryOverlays, setEntryOverlays] = useState(DEFAULT_ENTRY_OVERLAYS);

  const toggleForecast = useCallback((key) => {
    setForecastOverlays((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleEntry = useCallback((key) => {
    setEntryOverlays((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const {
    loading,
    error,
    ticker,
    expirations,
    selectedExpiry,
    analysis,
    fundamentals,
    weighted,
    handleAnalyse,
    handleExpiryChange,
    handleWeightedToggle,
  } = useOptionsAnalysis();

  return (
    <div className="app">
      <Sidebar
        onAnalyse={handleAnalyse}
        expirations={expirations}
        selectedExpiry={selectedExpiry}
        onExpiryChange={handleExpiryChange}
        loading={loading}
        daysToExpiry={daysToExpiry}
        weighted={weighted}
        onWeightedToggle={handleWeightedToggle}
        activeTicker={ticker}
      />

      <main className="main">
        {/* Landing state */}
        {!ticker && !loading && !error && (
          <div className="landing">
            <h1>Borja Ruizdelgado - Investing</h1>
            <p className="landing-desc">
              Options-implied forecasts, stock fundamentals, analyst estimates,
              and crypto analysis — unified in one free tool. Pick a trending
              ticker below or search any symbol to get started.
            </p>
            <TrendingTickers onTickerClick={handleAnalyse} />
            <p className="info-box">
              Or enter any ticker in the sidebar to get started.
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && !analysis && (
          <div className="loading">
            <div className="spinner" />
            <span>
              {ticker
                ? `Running analysis for ${ticker}…`
                : "Fetching data…"}
            </span>
          </div>
        )}

        {/* Error */}
        {error && <div className="error-box">{error}</div>}

        {/* Analysis results */}
        {analysis && (
          <>
            <h1>{ticker}</h1>
            <p className="subtitle">
              Current price: <strong>{fmt(analysis.spot)}</strong> · Expiry:{" "}
              <strong>{analysis.expiry}</strong> ({Math.round(analysis.dte)}{" "}
              days)
              {analysis.chainsUsed > 1 && (
                <> · Weighted from <strong>{analysis.chainsUsed}</strong> expiry chains</>
              )}
            </p>

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

            {fundamentals && <FundamentalsPanel fundamentals={fundamentals} />}

            <hr />
            <p className="footnote">
              This tool shows what is already priced into traded options — it
              does not predict the future.
            </p>

            <SupportVault />
          </>
        )}
      </main>
    </div>
  );
}
