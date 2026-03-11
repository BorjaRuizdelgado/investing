import React, { useMemo, useState, useRef } from "react";
import Header from "./components/Header.jsx";
import TerminalTabs from "./components/TerminalTabs.jsx";
import OverviewPage from "./components/OverviewPage.jsx";
import ValuePage from "./components/ValuePage.jsx";
import QualityPage from "./components/QualityPage.jsx";
import RiskPage from "./components/RiskPage.jsx";
import BusinessPage from "./components/BusinessPage.jsx";
import OptionsPage from "./components/OptionsPage.jsx";
import FundamentalsPanel from "./components/FundamentalsPanel.jsx";
import DisclaimerPage from "./components/DisclaimerPage.jsx";
import DonationsPage from "./components/DonationsPage.jsx";
import TrendingTickers from "./components/TrendingTickers.jsx";
import SupportVault from "./components/SupportVault.jsx";
import { daysToExpiry } from "./lib/fetcher.js";
import useResearchTerminal from "./hooks/useResearchTerminal.js";
import { DISCLAIMER_PATH, DONATE_PATH, currentPath, tabFromPath } from "./lib/routes.js";

const TABS = [
  { id: "overview", label: "Overview", caption: "Decision snapshot" },
  { id: "value", label: "Value", caption: "Cheap or expensive" },
  { id: "quality", label: "Quality", caption: "Business strength" },
  { id: "risk", label: "Risk", caption: "Fragility and downside" },
  { id: "business", label: "Business", caption: "Financial trends" },
  { id: "options", label: "Options Forecasting", caption: "Market pricing" },
  { id: "fundamentals", label: "Fundamentals", caption: "Raw reference" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    const tab = tabFromPath(window.location.pathname);
    return tab || "overview";
  });
  const initialUrlTab = tabFromPath(window.location.pathname);
  const desiredTabRef = useRef(initialUrlTab);
  const [page, setPage] = useState(() => {
    const p = currentPath();
    if (p === DISCLAIMER_PATH) return "disclaimer";
    if (p === DONATE_PATH) return "donate";
    return "terminal";
  });
  const {
    loading,
    error,
    ticker,
    expirations,
    selectedExpiry,
    analysis,
    fundamentals,
    research,
    weighted,
    handleAnalyse,
    handleExpiryChange,
    handleWeightedToggle,
  } = useResearchTerminal();

  const visibleTabs = useMemo(
    () => TABS.filter((tab) => research?.availability?.[tab.id] ?? tab.id === "overview"),
    [research],
  );
  React.useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab) && visibleTabs[0]) {
      // If the URL specified a tab and it's now available, use it.
      if (desiredTabRef.current && visibleTabs.some((t) => t.id === desiredTabRef.current)) {
        setActiveTab(desiredTabRef.current);
      } else {
        setActiveTab(visibleTabs[0].id);
      }
    }
  }, [activeTab, visibleTabs]);

  // When research becomes available, if the URL requested a specific tab
  // and that tab is now visible, switch to it once.
  React.useEffect(() => {
    if (desiredTabRef.current && visibleTabs.some((t) => t.id === desiredTabRef.current)) {
      if (activeTab !== desiredTabRef.current) setActiveTab(desiredTabRef.current);
      desiredTabRef.current = null;
    }
  }, [visibleTabs]);

  React.useEffect(() => {
    const onPop = () => {
      const p = currentPath();
      if (p === DISCLAIMER_PATH) setPage("disclaimer");
      else if (p === DONATE_PATH) setPage("donate");
      else setPage("terminal");

      const tab = tabFromPath(window.location.pathname);
      if (tab) setActiveTab(tab);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = React.useCallback((path, pageKey) => {
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }
    setPage(pageKey);
  }, []);

  return (
    <div className="app">
      <Header
        onAnalyse={(nextTicker) => {
          setActiveTab("overview");
          setPage("terminal");
          handleAnalyse(nextTicker);
        }}
        loading={loading}
        activeTicker={ticker}
        onNavigateDisclaimer={() => navigate(DISCLAIMER_PATH, "disclaimer")}
        onNavigateDonate={() => navigate(DONATE_PATH, "donate")}
      />

      <main className="main">
        {page === "disclaimer" && (
          <div className="main-content">
            <DisclaimerPage />
            <div className="page-link-row">
              <a href="/" className="page-link" onClick={(e) => { e.preventDefault(); navigate("/", "terminal"); }}>Back to terminal</a>
            </div>
          </div>
        )}

        {page === "donate" && (
          <div className="main-content">
            <DonationsPage />
            <div className="page-link-row">
              <a href="/" className="page-link" onClick={(e) => { e.preventDefault(); navigate("/", "terminal"); }}>Back to terminal</a>
            </div>
          </div>
        )}

        {page === "terminal" && !ticker && !loading && !error && (
          <div className="landing">
            <h1>Borja Ruizdelgado's - Investing Tools</h1>
            <p className="landing-desc">
              A browser-based investing workspace for valuation, business quality,
              downside risk, and options-implied market pricing. Search a ticker
              or start from the live trending list.
            </p>
            <TrendingTickers onTickerClick={(nextTicker) => {
              setActiveTab("overview");
              handleAnalyse(nextTicker);
            }} />
          </div>
        )}

        {page === "terminal" && loading && !analysis && (
          <div className="main-content">
            <div className="loading">
              <div className="spinner" />
              <span>{ticker ? `Running analysis for ${ticker}…` : "Fetching data…"}</span>
            </div>
          </div>
        )}

        {page === "terminal" && error && (
          <div className="main-content">
            <div className="error-box">{error}</div>
          </div>
        )}

        {page === "terminal" && analysis && research && (
          <>
            <div className="terminal-tabs-bar">
              <TerminalTabs
                tabs={visibleTabs}
                activeTab={activeTab}
                onChange={(tabId) => {
                  setActiveTab(tabId);
                  if (ticker) {
                    const path = `/${encodeURIComponent(ticker)}/${encodeURIComponent(tabId)}`;
                    if (window.location.pathname !== path) {
                      window.history.pushState(null, "", path);
                    }
                  }
                }}
              />
            </div>

            <div className="tab-content">
              {activeTab === "overview" && (
                <OverviewPage
                  ticker={ticker}
                  spot={analysis.spot}
                  fundamentals={fundamentals}
                  research={research}
                  analysis={analysis}
                />
              )}
              {activeTab === "value" && <ValuePage research={research} />}
              {activeTab === "quality" && <QualityPage research={research} />}
              {activeTab === "risk" && <RiskPage research={research} />}
              {activeTab === "business" && (
                <BusinessPage ticker={ticker} fundamentals={fundamentals} research={research} />
              )}
              {activeTab === "options" && (
                <OptionsPage
                  ticker={ticker}
                  analysis={analysis}
                  expirations={expirations}
                  selectedExpiry={selectedExpiry}
                  onExpiryChange={handleExpiryChange}
                  daysToExpiry={daysToExpiry}
                  weighted={weighted}
                  onWeightedToggle={handleWeightedToggle}
                  loading={loading}
                />
              )}
              {activeTab === "fundamentals" && (
                fundamentals ? (
                  <FundamentalsPanel fundamentals={fundamentals} />
                ) : (
                  <div className="info-box">Fundamental reference data is not available for this ticker.</div>
                )
              )}

              <hr />
              <div className="page-link-row">
                <a
                  href={DISCLAIMER_PATH}
                  className="page-link"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(DISCLAIMER_PATH, "disclaimer");
                  }}
                >
                  Disclaimer
                </a>
              </div>
              <SupportVault />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
