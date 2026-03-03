import React, { useState, useCallback } from "react";
import Sidebar from "./components/Sidebar.jsx";
import KpiRow from "./components/KpiRow.jsx";
import LabelStrip from "./components/LabelStrip.jsx";
import ForecastChart from "./components/ForecastChart.jsx";
import DistributionChart from "./components/DistributionChart.jsx";
import IvSmileChart from "./components/IvSmileChart.jsx";
import OiChart from "./components/OiChart.jsx";
import SrChart from "./components/SrChart.jsx";
import {
  PercentileExpander,
  DistributionExpander,
  EntryExpander,
  PcrExpander,
} from "./components/Expanders.jsx";
import { fetchOptions, fetchChain, fetchHistory, fetchRate, daysToExpiry } from "./lib/fetcher.js";
import {
  impliedDistribution,
  expectedMove,
  bullBearProbabilities,
  percentileLevels,
  maxPain,
  ivSmile,
  supportResistanceLevels,
  entryAnalysis,
  putCallRatio,
} from "./lib/analysis.js";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Data state
  const [ticker, setTicker] = useState(null);
  const [spot, setSpot] = useState(null);
  const [expirations, setExpirations] = useState(null);
  const [selectedExpiry, setSelectedExpiry] = useState(null);

  // Analysis state
  const [analysis, setAnalysis] = useState(null);

  const handleAnalyse = useCallback(async (tickerInput) => {
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      // Fetch expirations + spot price and risk-free rate in parallel
      const [optData, rateData] = await Promise.all([
        fetchOptions(tickerInput),
        fetchRate(),
      ]);

      if (!optData.expirations || optData.expirations.length === 0) {
        throw new Error(`No options data available for ${tickerInput}`);
      }

      // Expirations are now {date, timestamp} objects. Filter with at least 1 day.
      const validExps = optData.expirations.filter(
        (e) => daysToExpiry(e.date) >= 1
      );
      if (validExps.length === 0) {
        throw new Error(`No valid expirations for ${tickerInput}`);
      }

      setTicker(optData.ticker || tickerInput);
      setSpot(optData.price);
      setExpirations(validExps);
      setSelectedExpiry(validExps[0]);

      // Run analysis for the first expiry
      await runAnalysis(
        optData.ticker || tickerInput,
        validExps[0],
        optData.price,
        rateData.rate
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const runAnalysis = async (tickerVal, expiry, spotVal, r) => {
    // expiry is a {date, timestamp} object
    setLoading(true);
    setError(null);

    try {
      const dte = daysToExpiry(expiry.date);
      const histDays = Math.min(Math.max(Math.floor(dte), 30), 200);

      // Fetch chain and history in parallel
      const [chainData, histData] = await Promise.all([
        fetchChain(tickerVal, expiry.timestamp),
        fetchHistory(tickerVal, histDays),
      ]);

      const { calls, puts } = chainData;
      const T = dte / 365;

      const dist = impliedDistribution(calls, spotVal, r, T, puts);
      const em = expectedMove(calls, puts, spotVal);
      const probs = bullBearProbabilities(dist, spotVal);
      const pctiles = percentileLevels(dist);
      const mp = maxPain(calls, puts);
      const ivData = ivSmile(calls, puts, spotVal);
      const sr = supportResistanceLevels(histData.bars, calls, puts, spotVal);
      const entry = entryAnalysis(dist, em, probs, pctiles, sr, spotVal);
      const pcr = putCallRatio(calls, puts);

      setAnalysis({
        dist,
        em,
        probs,
        pctiles,
        mp,
        ivData,
        calls,
        puts,
        history: histData.bars,
        sr,
        entry,
        pcr,
        dte,
        expiry: expiry.date,
        r,
        spot: spotVal,
      });
    } catch (err) {
      setError(`Analysis failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExpiryChange = useCallback(
    async (timestampStr) => {
      // Find the expiry object matching the selected timestamp
      const match = expirations?.find((e) => String(e.timestamp) === timestampStr);
      if (!match) return;
      setSelectedExpiry(match);
      if (ticker && spot != null && analysis) {
        await runAnalysis(ticker, match, spot, analysis.r);
      }
    },
    [ticker, spot, analysis, expirations]
  );

  const fmt = (v) =>
    `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="app">
      <Sidebar
        onAnalyse={handleAnalyse}
        expirations={expirations}
        selectedExpiry={selectedExpiry}
        onExpiryChange={handleExpiryChange}
        loading={loading}
        daysToExpiry={daysToExpiry}
      />

      <main className="main">
        {/* Landing state */}
        {!ticker && !loading && !error && (
          <div className="landing">
            <h1>Options-Implied Price Forecast</h1>
            <p className="info-box">
              Enter a ticker symbol in the sidebar and click{" "}
              <strong>Analyse</strong> to get started.
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
            </p>

            <KpiRow
              dist={analysis.dist}
              spot={analysis.spot}
              em={analysis.em}
              probs={analysis.probs}
              mp={analysis.mp}
            />

            {/* Main forecast chart */}
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
            />
            <LabelStrip
              items={[
                { label: "Spot", value: fmt(analysis.spot), color: "#1c1c1c", tooltip: "Current market price of the asset." },
                { label: "Mean", value: fmt(analysis.dist.mean), color: "#4d6a61", tooltip: "Options-implied expected price at expiry, weighted by the probability distribution." },
                { label: "Max Pain", value: !isNaN(analysis.mp) ? fmt(analysis.mp) : "N/A", color: "#c08050", tooltip: "Strike where the most options expire worthless. Often acts as a gravitational target near expiry." },
                { label: "Range low", value: fmt(analysis.em.lower), color: "#b05040", tooltip: "Lower bound of the 1-std-dev expected move (~68% confidence interval)." },
                { label: "Range high", value: fmt(analysis.em.upper), color: "#3d7a5a", tooltip: "Upper bound of the 1-std-dev expected move (~68% confidence interval)." },
              ]}
            />

            {/* Distribution chart */}
            <DistributionChart
              dist={analysis.dist}
              spot={analysis.spot}
              pctiles={analysis.pctiles}
              mp={analysis.mp}
            />
            <LabelStrip
              items={[
                { label: "10th pct", value: fmt(analysis.pctiles[10] || 0), color: "#b05040", tooltip: "10% chance price is at or below this level by expiry." },
                { label: "25th pct", value: fmt(analysis.pctiles[25] || 0), color: "#c08050", tooltip: "25% chance price is at or below this level by expiry." },
                { label: "50th pct", value: fmt(analysis.pctiles[50] || 0), color: "#4d6a61", tooltip: "Median — equal chance price ends above or below this level by expiry." },
                { label: "75th pct", value: fmt(analysis.pctiles[75] || 0), color: "#4d6a61", tooltip: "75% chance price is at or below this level by expiry." },
                { label: "90th pct", value: fmt(analysis.pctiles[90] || 0), color: "#3d7a5a", tooltip: "90% chance price is at or below this level by expiry." },
              ]}
            />

            {/* S/R + Entry chart */}
            <SrChart
              ticker={ticker}
              history={analysis.history}
              spot={analysis.spot}
              sr={analysis.sr}
              entryInfo={analysis.entry}
            />
            <LabelStrip
              items={(() => {
                const biasLabel = analysis.entry.bias.charAt(0).toUpperCase() + analysis.entry.bias.slice(1);
                const biasColour = analysis.entry.bias === "bullish" ? "#3d7a5a" : analysis.entry.bias === "bearish" ? "#b05040" : "#1c1c1c";
                const rr = !isNaN(analysis.entry.riskReward) ? `${analysis.entry.riskReward.toFixed(1)}\u00d7` : "N/A";
                const pcrVol = !isNaN(analysis.pcr.pcrVol) ? analysis.pcr.pcrVol.toFixed(2) : "N/A";
                return [
                  { label: "Bias", value: biasLabel, color: biasColour, tooltip: "Directional lean derived from S/R positioning and the options probability distribution." },
                  { label: "Spot", value: fmt(analysis.spot), color: "#1c1c1c", tooltip: "Current market price of the asset." },
                  { label: "Entry", value: fmt(analysis.entry.entry), color: "#c08050", tooltip: "Suggested entry price based on the nearest support or resistance level." },
                  { label: "Stop", value: fmt(analysis.entry.stop), color: "#b05040", tooltip: "Suggested stop-loss level to cap downside if the trade goes against you." },
                  { label: "Target", value: fmt(analysis.entry.target), color: "#3d7a5a", tooltip: "Suggested profit target based on the opposing S/R level." },
                  { label: "R/R", value: rr, color: "#4d6a61", tooltip: "Risk-to-reward ratio: target distance \u00f7 stop distance." },
                  { label: "Put/Call (Vol)", value: pcrVol, color: "#555555", tooltip: "Ratio of put volume to call volume." },
                  { label: "Sentiment", value: analysis.pcr.sentiment.charAt(0).toUpperCase() + analysis.pcr.sentiment.slice(1), color: "#555555", tooltip: "Market sentiment implied by the Put/Call ratio." },
                ];
              })()}
            />

            {/* Secondary charts side-by-side */}
            <div className="chart-row">
              <IvSmileChart ivData={analysis.ivData} spot={analysis.spot} />
              <OiChart calls={analysis.calls} puts={analysis.puts} spot={analysis.spot} />
            </div>

            {/* Expanders */}
            <PercentileExpander pctiles={analysis.pctiles} spot={analysis.spot} />
            <DistributionExpander dist={analysis.dist} />
            <EntryExpander entryInfo={analysis.entry} sr={analysis.sr} />
            <PcrExpander pcr={analysis.pcr} />

            <hr />
            <p className="footnote">
              This tool shows what is already priced into traded options — it
              does not predict the future.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
