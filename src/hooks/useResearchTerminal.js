import { useState, useCallback, useEffect, useRef } from "react";
import { fetchOptions, fetchRate, daysToExpiry } from "../lib/fetcher.js";
import { runSingleChain, runWeightedChains } from "../lib/chainRunner.js";
import { deriveValuation } from "../lib/valuation.js";
import { deriveQuality } from "../lib/quality.js";
import { deriveRisk } from "../lib/risk.js";
import { deriveBusiness } from "../lib/business.js";
import { deriveOpportunity, deriveOptionsSentiment, deriveSignals } from "../lib/signals.js";
import { tickerFromPath } from "../lib/routes.js";

function deriveResearch(fundamentals, analysis, spot) {
  const valuation = deriveValuation(fundamentals, spot);
  const quality = deriveQuality(fundamentals);
  const risk = deriveRisk(fundamentals, analysis);
  const options = deriveOptionsSentiment(analysis, spot);
  const opportunity = deriveOpportunity(
    valuation,
    quality,
    risk,
    options,
    valuation.analystUpsidePct
  );
  const signals = deriveSignals({
    valuation,
    quality,
    risk,
    options,
    analystUpsidePct: valuation.analystUpsidePct,
  });
  const business = deriveBusiness(fundamentals);
  const fundamentalsHasData = Boolean(
    fundamentals &&
    Object.entries(fundamentals).some(([key, value]) => {
      if (key === "statements") {
        return Boolean(value?.income?.length || value?.balance?.length || value?.cashflow?.length);
      }
      return value != null;
    })
  );
  const availability = {
    overview: true,
    value: Boolean(valuation?.hasData),
    quality: Boolean(quality?.hasData),
    risk: Boolean(risk?.hasData),
    business: Boolean(business?.hasData),
    options: Boolean(analysis),
    fundamentals: fundamentalsHasData,
  };

  return {
    opportunity,
    valuation,
    quality,
    risk,
    options,
    business,
    signals,
    availability,
  };
}

export default function useResearchTerminal() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ticker, setTicker] = useState(null);
  const [spot, setSpot] = useState(null);
  const [expirations, setExpirations] = useState(null);
  const [selectedExpiry, setSelectedExpiry] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [fundamentals, setFundamentals] = useState(null);
  const [research, setResearch] = useState(null);
  const [weighted, setWeighted] = useState(true);

  const runAnalysis = useCallback(async (tickerVal, expiry, spotVal, r, allExpirations, useWeighted, fundData) => {
    setLoading(true);
    setError(null);

    try {
      const result = useWeighted
        ? await runWeightedChains(tickerVal, expiry, spotVal, r, allExpirations)
        : await runSingleChain(tickerVal, expiry, spotVal, r);
      setAnalysis(result);
      setResearch(deriveResearch(fundData || fundamentals, result, spotVal));
    } catch (err) {
      setError(`Analysis failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [fundamentals]);

  const handleAnalyse = useCallback(async (tickerInput) => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setFundamentals(null);
    setResearch(null);

    try {
      const [optData, rateData] = await Promise.all([
        fetchOptions(tickerInput),
        fetchRate(),
      ]);

      if (!optData.expirations?.length) {
        throw new Error(`No options data available for ${tickerInput}`);
      }

      const validExps = optData.expirations.filter(
        (e) => daysToExpiry(e.date) >= 1,
      );
      if (validExps.length === 0) {
        throw new Error(`No valid expirations for ${tickerInput}`);
      }

      const resolvedTicker = optData.ticker || tickerInput;
      setTicker(resolvedTicker);
      setSpot(optData.price);
      setFundamentals(optData.fundamentals || null);
      setExpirations(validExps);
      setSelectedExpiry(validExps[0]);

      const basePath = `/${encodeURIComponent(resolvedTicker)}`;
      // Only update the URL if it doesn't already start with the resolved ticker
      if (!window.location.pathname.startsWith(basePath)) {
        window.history.pushState(null, "", basePath);
      }

      await runAnalysis(
        resolvedTicker,
        validExps[0],
        optData.price,
        rateData.rate,
        validExps,
        weighted,
        optData.fundamentals || null
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [runAnalysis, weighted]);

  const didAutoRun = useRef(false);
  useEffect(() => {
    if (didAutoRun.current) return;
    const urlTicker = tickerFromPath(window.location.pathname);
    if (urlTicker) {
      didAutoRun.current = true;
      handleAnalyse(urlTicker);
    }
  }, [handleAnalyse]);

  useEffect(() => {
    const onPop = () => {
      const urlTicker = tickerFromPath(window.location.pathname);
      if (!window.location.pathname.replace(/\/$/, "") || window.location.pathname === "/") {
        setTicker(null);
        setSpot(null);
        setExpirations(null);
        setSelectedExpiry(null);
        setAnalysis(null);
        setFundamentals(null);
        setResearch(null);
        setError(null);
        setLoading(false);
        return;
      }

      if (urlTicker && (!ticker || ticker.toUpperCase() !== urlTicker)) {
        handleAnalyse(urlTicker);
      }
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [handleAnalyse, ticker]);

  const handleExpiryChange = useCallback(
    async (timestampStr) => {
      const match = expirations?.find((e) => String(e.timestamp) === timestampStr);
      if (!match) return;
      setSelectedExpiry(match);
      if (ticker && spot != null && analysis && expirations) {
        await runAnalysis(ticker, match, spot, analysis.r, expirations, weighted, fundamentals);
      }
    },
    [ticker, spot, analysis, expirations, runAnalysis, weighted, fundamentals],
  );

  const handleWeightedToggle = useCallback(
    async (newVal) => {
      const val = typeof newVal === "boolean" ? newVal : !weighted;
      setWeighted(val);
      if (ticker && selectedExpiry && spot != null && analysis && expirations) {
        await runAnalysis(ticker, selectedExpiry, spot, analysis.r, expirations, val, fundamentals);
      }
    },
    [ticker, selectedExpiry, spot, analysis, expirations, runAnalysis, weighted, fundamentals],
  );

  return {
    loading,
    error,
    ticker,
    spot,
    expirations,
    selectedExpiry,
    analysis,
    fundamentals,
    research,
    weighted,
    handleAnalyse,
    handleExpiryChange,
    handleWeightedToggle,
  };
}
