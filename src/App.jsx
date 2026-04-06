import React, { lazy, Suspense, useMemo, useState, useRef, useCallback } from 'react'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import TerminalTabs from './components/TerminalTabs.jsx'
import OverviewPage from './components/OverviewPage.jsx'
import ValuePage from './components/ValuePage.jsx'
import QualityPage from './components/QualityPage.jsx'
import RiskPage from './components/RiskPage.jsx'
import TrendingTickers from './components/TrendingTickers.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import TldrBanner from './components/TldrBanner.jsx'

// Heavy pages — deferred until first visit so Plotly stays out of the initial bundle
const TechnicalsPage = lazy(() => import('./components/TechnicalsPage.jsx'))
const BusinessPage = lazy(() => import('./components/BusinessPage.jsx'))
const OptionsPage = lazy(() => import('./components/OptionsPage.jsx'))
const FundamentalsPanel = lazy(() => import('./components/FundamentalsPanel.jsx'))
const DisclaimerPage = lazy(() => import('./components/DisclaimerPage.jsx'))
const DonationsPage = lazy(() => import('./components/DonationsPage.jsx'))
const WatchlistPage = lazy(() => import('./components/WatchlistPage.jsx'))
const ComparePage = lazy(() => import('./components/ComparePage.jsx'))
const ScreenerPage = lazy(() => import('./components/ScreenerPage.jsx'))
import { daysToExpiry } from './lib/fetcher.js'
import useResearchTerminal from './hooks/useResearchTerminal.js'
import useTheme from './hooks/useTheme.js'
import useWatchlist from './hooks/useWatchlist.js'
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts.js'
import { invalidateColors } from './lib/theme.js'
import {
  DISCLAIMER_PATH,
  DONATE_PATH,
  WATCHLIST_PATH,
  SCREENER_PATH,
  COMPARE_PREFIX,
  currentPath,
  tabFromPath,
  isComparePath,
  compareTickersFromPath,
} from './lib/routes.js'
import { OverviewSkeleton, ChartSkeleton } from './components/SkeletonLayouts.jsx'
import ShortcutHelp from './components/ShortcutHelp.jsx'
import { prefetchLazyChunks } from './lib/prefetch.js'
import { tabTldr } from './lib/tldr.js'

const TABS = [
  { id: 'overview', label: 'Overview', caption: 'Decision snapshot' },
  { id: 'value', label: 'Value', caption: 'Cheap or expensive' },
  { id: 'quality', label: 'Quality', caption: 'Business strength' },
  { id: 'risk', label: 'Risk', caption: 'Fragility and downside' },
  { id: 'technicals', label: 'Technicals', caption: 'Price momentum' },
  { id: 'business', label: 'Business', caption: 'Financial trends' },
  { id: 'options', label: 'Options Forecasting', caption: 'Market pricing' },
  { id: 'fundamentals', label: 'Fundamentals', caption: 'Raw reference' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    const tab = tabFromPath(window.location.pathname)
    return tab || 'overview'
  })
  const initialUrlTab = tabFromPath(window.location.pathname)
  const desiredTabRef = useRef(initialUrlTab)
  const [page, setPage] = useState(() => {
    const p = currentPath()
    if (p === DISCLAIMER_PATH) return 'disclaimer'
    if (p === DONATE_PATH) return 'donate'
    if (p === WATCHLIST_PATH) return 'watchlist'
    if (p === SCREENER_PATH) return 'screener'
    if (isComparePath(p)) return 'compare'
    return 'terminal'
  })

  const { theme, toggle: toggleTheme } = useTheme()
  const watchlist = useWatchlist()
  const inputRef = useRef(null)

  const {
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
  } = useResearchTerminal()

  const visibleTabs = useMemo(
    () => TABS.filter((tab) => research?.availability?.[tab.id] ?? tab.id === 'overview'),
    [research],
  )

  const activeTabTldr = useMemo(
    () =>
      tabTldr({
        activeTab,
        research,
        fundamentals,
        analysis,
        ticker,
      }),
    [activeTab, research, fundamentals, analysis, ticker],
  )

  const handleThemeToggle = useCallback(() => {
    toggleTheme()
    invalidateColors()
  }, [toggleTheme])

  const { showHelp, setShowHelp } = useKeyboardShortcuts({
    inputRef,
    visibleTabs,
    activeTab,
    setActiveTab,
  })

  // Prefetch lazy chunks once the initial paint is done
  React.useEffect(() => { prefetchLazyChunks() }, [])

  React.useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab) && visibleTabs[0]) {
      if (desiredTabRef.current && visibleTabs.some((t) => t.id === desiredTabRef.current)) {
        setActiveTab(desiredTabRef.current)
      } else {
        setActiveTab(visibleTabs[0].id)
      }
    }
  }, [activeTab, visibleTabs])

  React.useEffect(() => {
    if (desiredTabRef.current && visibleTabs.some((t) => t.id === desiredTabRef.current)) {
      if (activeTab !== desiredTabRef.current) setActiveTab(desiredTabRef.current)
      desiredTabRef.current = null
    }
  }, [visibleTabs, activeTab])

  React.useEffect(() => {
    const onPop = () => {
      const p = currentPath()
      if (p === DISCLAIMER_PATH) setPage('disclaimer')
      else if (p === DONATE_PATH) setPage('donate')
      else if (p === WATCHLIST_PATH) setPage('watchlist')
      else if (p === SCREENER_PATH) setPage('screener')
      else if (isComparePath(p)) setPage('compare')
      else {
        setPage('terminal')
        // tabFromPath returns null for bare ticker URLs like /NVDA (no tab segment),
        // which represents the overview. Default to 'overview' so the back button
        // correctly restores the overview when returning from a tab like /NVDA/technicals.
        const tab = tabFromPath(window.location.pathname)
        setActiveTab(tab || 'overview')
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = React.useCallback((path, pageKey) => {
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path)
    }
    setPage(pageKey)
  }, [])

  const handleNavigateCompare = useCallback(
    (prefillTicker) => {
      if (prefillTicker) {
        navigate(`${COMPARE_PREFIX}${encodeURIComponent(prefillTicker)}`, 'compare')
      } else {
        navigate(`/compare`, 'compare')
      }
    },
    [navigate],
  )

  return (
    <div className="app">
      <Header
        ref={inputRef}
        onAnalyse={(nextTicker) => {
          setActiveTab('overview')
          setPage('terminal')
          handleAnalyse(nextTicker)
        }}
        loading={loading}
        activeTicker={ticker}
        activePage={page}
        onNavigateWatchlist={() => navigate(WATCHLIST_PATH, 'watchlist')}
        onNavigateScreener={() => navigate(SCREENER_PATH, 'screener')}
        onNavigateCompare={handleNavigateCompare}
        theme={theme}
        onToggleTheme={handleThemeToggle}
        hasAnalysis={Boolean(analysis && research)}
      />

      <main className="main">
        {page === 'disclaimer' && (
          <div className="main-content">
            <Suspense fallback={null}>
              <DisclaimerPage />
            </Suspense>
          </div>
        )}

        {page === 'donate' && (
          <div className="main-content">
            <Suspense fallback={null}>
              <DonationsPage />
            </Suspense>
          </div>
        )}

        {page === 'watchlist' && (
          <div className="main-content">
            <Suspense fallback={<OverviewSkeleton />}>
              <WatchlistPage
                watchlist={watchlist}
                onAnalyse={(t) => {
                  setActiveTab('overview')
                  setPage('terminal')
                  handleAnalyse(t)
                }}
              />
            </Suspense>
          </div>
        )}

        {page === 'compare' && (
          <div className="main-content">
            <Suspense fallback={<OverviewSkeleton />}>
              <ComparePage tickers={compareTickersFromPath(currentPath())} />
            </Suspense>
          </div>
        )}

        {page === 'screener' && (
          <div className="main-content">
            <Suspense fallback={<OverviewSkeleton />}>
              <ScreenerPage
                onAnalyse={(t) => {
                  setActiveTab('overview')
                  setPage('terminal')
                  handleAnalyse(t)
                }}
                watchlist={watchlist}
              />
            </Suspense>
          </div>
        )}

        {page === 'terminal' && !ticker && !loading && !error && (
          <div className="landing">
            <h1>Borja Ruizdelgado's Trading Tools</h1>
            <p className="landing-subtitle">Search any ticker to get started</p>
            <div className="landing-steps">
              <div className="landing-step">
                <span className="landing-step__num">1</span>
                <span className="landing-step__text">Search a stock or crypto</span>
              </div>
              <div className="landing-step">
                <span className="landing-step__num">2</span>
                <span className="landing-step__text">Read the scores &amp; verdicts</span>
              </div>
              <div className="landing-step">
                <span className="landing-step__num">3</span>
                <span className="landing-step__text">Explore the deep-dive tabs</span>
              </div>
            </div>
            <TrendingTickers
              onTickerClick={(nextTicker) => {
                setActiveTab('overview')
                handleAnalyse(nextTicker)
              }}
            />
          </div>
        )}

        {page === 'terminal' && loading && !analysis && (
          <div className="main-content">
            <OverviewSkeleton />
          </div>
        )}

        {page === 'terminal' && error && (
          <div className="main-content">
            <div className="error-box">{error}</div>
          </div>
        )}

        {page === 'terminal' && research && (
          <>
            <div className="terminal-tabs-bar">
              <TerminalTabs
                tabs={visibleTabs}
                activeTab={activeTab}
                onChange={(tabId) => {
                  setActiveTab(tabId)
                  if (ticker) {
                    const path = `/${encodeURIComponent(ticker)}/${encodeURIComponent(tabId)}`
                    if (window.location.pathname !== path) {
                      window.history.pushState(null, '', path)
                    }
                  }
                }}
              />
            </div>

            <div className="tab-content" key={theme}>
              {activeTabTldr && <TldrBanner text={activeTabTldr.text} tone={activeTabTldr.tone} />}
              {activeTab === 'overview' && (
                <ErrorBoundary name="OverviewPage">
                  <OverviewPage
                    ticker={ticker}
                    spot={spot ?? analysis?.spot}
                    fundamentals={fundamentals}
                    research={research}
                    analysis={analysis}
                    onTabChange={(tabId) => {
                      setActiveTab(tabId)
                      if (ticker) {
                        const path = `/${encodeURIComponent(ticker)}/${encodeURIComponent(tabId)}`
                        if (window.location.pathname !== path) {
                          window.history.pushState(null, '', path)
                        }
                      }
                    }}
                    watchlistHas={ticker ? watchlist.has(ticker) : false}
                    onToggleWatchlist={
                      ticker
                        ? () =>
                            watchlist.has(ticker) ? watchlist.remove(ticker) : watchlist.add(ticker)
                        : undefined
                    }
                  />
                </ErrorBoundary>
              )}
              {activeTab === 'value' && (
                <ErrorBoundary name="ValuePage">
                  <ValuePage research={research} fundamentals={fundamentals} />
                </ErrorBoundary>
              )}
              {activeTab === 'quality' && (
                <ErrorBoundary name="QualityPage">
                  <QualityPage research={research} fundamentals={fundamentals} />
                </ErrorBoundary>
              )}
              {activeTab === 'risk' && (
                <ErrorBoundary name="RiskPage">
                  <RiskPage research={research} fundamentals={fundamentals} />
                </ErrorBoundary>
              )}
              {activeTab === 'technicals' && (
                <ErrorBoundary name="TechnicalsPage">
                  <Suspense fallback={<ChartSkeleton />}>
                    <TechnicalsPage research={research} />
                  </Suspense>
                </ErrorBoundary>
              )}
              {activeTab === 'business' && (
                <ErrorBoundary name="BusinessPage">
                  <Suspense fallback={<ChartSkeleton />}>
                    <BusinessPage ticker={ticker} fundamentals={fundamentals} research={research} />
                  </Suspense>
                </ErrorBoundary>
              )}
              {activeTab === 'options' && (
                <ErrorBoundary name="OptionsPage">
                  <Suspense fallback={<ChartSkeleton />}>
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
                      research={research}
                      fundamentals={fundamentals}
                    />
                  </Suspense>
                </ErrorBoundary>
              )}
              {activeTab === 'fundamentals' && (
                <ErrorBoundary name="FundamentalsPanel">
                  {fundamentals ? (
                    <Suspense fallback={<ChartSkeleton />}>
                      <FundamentalsPanel fundamentals={fundamentals} />
                    </Suspense>
                  ) : (
                    <div className="info-box">
                      Fundamental data isn't available for this ticker yet. Try a stock listed on a major exchange (NYSE, NASDAQ).
                    </div>
                  )}
                </ErrorBoundary>
              )}

            </div>
          </>
        )}
      </main>

      <Footer onNavigate={navigate} />

      {showHelp && <ShortcutHelp onClose={() => setShowHelp(false)} />}
    </div>
  )
}
