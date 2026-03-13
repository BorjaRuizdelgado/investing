# Contributing

Thanks for your interest in improving **Investing Tools**! Contributions of all kinds are welcome — bug reports, feature ideas, documentation fixes, code improvements.

## Getting Started

1. **Fork** the repository and clone your fork:

   ```bash
   git clone https://github.com/<your-user>/investing.git
   cd investing
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

## Making Changes

1. Create a **feature branch** from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes. Keep commits small and focused.

3. Test locally — run the dev server and verify your changes work for both a stock ticker (e.g. `AAPL`) and a crypto ticker (e.g. `BTC`) across every tab.

4. **Commit** with a clear, descriptive message:

   ```bash
   git commit -m "Add X to improve Y"
   ```

5. **Push** and open a **Pull Request** against `main`.

## Project Layout

### Entry points

| Path | Purpose |
|------|---------|
| `src/worker.js` | Cloudflare Worker — API proxy for Yahoo Finance + Bybit, trending endpoint, SEO meta tags |
| `src/App.jsx` | Root React component — page routing, tab state, layout |
| `src/main.jsx` | Vite entry point |
| `src/styles.css` | Global styles |

### Hook

| Path | Purpose |
|------|---------|
| `src/hooks/useResearchTerminal.js` | Main data orchestrator — fetches, runs analysis, derives all research objects, exposes state to `App.jsx` |

### Pages (src/components/)

| Component | Tab |
|-----------|-----|
| `OverviewPage.jsx` | Overview — all five scores + top reasons + cross-metric signals |
| `ValuePage.jsx` | Value — valuation score, fair value range card, metric table |
| `QualityPage.jsx` | Quality — profitability score, growth/margin/ROE metrics |
| `RiskPage.jsx` | Risk — safety score (inverted), leverage/liquidity/volatility metrics |
| `BusinessPage.jsx` | Business — income statement and cash flow charts (3-year history) |
| `OptionsPage.jsx` | Options Forecasting — full options analysis hub |
| `FundamentalsPanel.jsx` | Fundamentals — raw reference tables for all metrics |
| `DisclaimerPage.jsx` | `/disclaimer` — legal disclaimer |
| `DonationsPage.jsx` | `/donate` — crypto wallet addresses |

### UI components (src/components/)

| Component | Purpose |
|-----------|---------|
| `Header.jsx` | Top bar — search input, nav links, mobile hamburger |
| `TerminalTabs.jsx` | Scrollable tab bar for the 7 research tabs |
| `TrendingTickers.jsx` | Landing page grid — popular stocks + crypto with price/change |
| `ScoreCard.jsx` | Score (0–100) with fill bar, label, and detail text |
| `ScenarioCard.jsx` | Bear/base/bull fair value range card |
| `KpiRow.jsx` | 5-column options KPI strip (expected price, move, probabilities, max pain) |
| `MetricTable.jsx` | Generic metric table — auto-hides N/A rows |
| `ReasonList.jsx` | Tone-coloured bullet list of analysis drivers |
| `ForecastChart.jsx` | 60-day price history + forward cone with percentile bands + MA overlays |
| `DistributionChart.jsx` | Implied PDF + CDF with spot/mean/max-pain annotations |
| `IvSmileChart.jsx` | Call vs put IV by strike |
| `OiChart.jsx` | Open interest and volume by strike (grouped bars) |
| `SrChart.jsx` | 60-bar candlestick with S/R levels, entry/stop/target lines, MA overlays |
| `ChartOverlays.jsx` | Toggle pills for MA20/50/200, gamma walls, pivots |
| `Expanders.jsx` | Collapsible sections — percentile table, distribution details, entry setup, put/call breakdown |
| `LabelStrip.jsx` | Colour-coded label row below charts |
| `Tooltip.jsx` | Portal-rendered floating tooltip ("?" hover) |
| `Expander.jsx` | Single collapsible section primitive |
| `SupportVault.jsx` | Collapsible tip jar with wallet addresses |
| `Sidebar.jsx` | Collapsible search form |

### Analysis library (src/lib/)

| Module | Purpose |
|--------|---------|
| `analysis.js` | Core options math — Breeden-Litzenberger PDF, expected move, percentile levels, max pain, IV smile, S/R, entry analysis, put/call ratio, multi-expiry merge |
| `spline.js` | Natural cubic spline — `evaluate()` + `derivative2()` used by distribution calc |
| `chainRunner.js` | Orchestrates chain fetches + history, runs all analysis, returns merged result |
| `scoring.js` | Scoring primitives — `scoreHighBetter()`, `scoreLowBetter()`, `scoreRangeBetter()`, `labelFromScore()`, `metricSentiment()` |
| `valuation.js` | Derives valuation score, fair value range (analyst mean / forward EPS×18 / FCF yield 5%), metric list, reasons |
| `quality.js` | Derives quality score from growth, margins, ROE/ROA, FCF margin + reasons |
| `risk.js` | Derives safety score (inverted for UX) from debt, liquidity, beta, volatility, short interest + reasons |
| `business.js` | Parses 3-year income/balance/cashflow statement history for charting |
| `signals.js` | Cross-metric signal detection (value trap, undervalued quality, fragility, alignment, priced-in) + composite Opportunity score |
| `fetcher.js` | HTTP helpers for all `/api/` routes; intraday 4 pm ET DTE handling for 0-DTE |
| `format.js` | Number/currency formatters — `fmt()`, `fmtCompact()`, `fmtPct()`, `fmtRatio()` |
| `routes.js` | URL parsing — `tickerFromPath()`, `tabFromPath()`, path constants |
| `labels.js` | Colour-coded label arrays for forecast, distribution, and entry label strips |
| `ma.js` | Moving average computation + Plotly trace/annotation builders for MA20/50/200 |
| `theme.js` | Colour palette constants + Plotly layout and axis defaults |
| `metricTips.js` | 50+ tooltip strings for every displayed metric |
| `config.js` | Donation wallet addresses |

## API Routes (Cloudflare Worker)

| Route | Returns |
|-------|---------|
| `GET /api/options?ticker=` | Expirations, spot price, full fundamentals (Yahoo quoteSummary) |
| `GET /api/chain?ticker=&exp=` | Single option chain — calls and puts (Yahoo options v7) |
| `GET /api/history?ticker=&days=60` | OHLCV bars (Yahoo chart v8) |
| `GET /api/rate` | Risk-free rate from ^IRX (Yahoo) |
| `GET /api/trending` | Trending stocks + crypto (Yahoo trending + hardcoded fallbacks) |
| Crypto routes (`BTC`, `ETH`, `SOL`, `XRP`, `DOGE`) | Options chains from Bybit public API v5 |

## Reporting Bugs

Open a [GitHub Issue](https://github.com/borjaruizdelgado/investing/issues) with:

- Steps to reproduce the problem.
- The ticker and expiration date you were analysing (if applicable).
- The full error message or unexpected output.

## Suggesting Features

Open an issue with the **enhancement** label. Describe the use case and, if possible, sketch out how it might work.

## License

By contributing you agree that your contributions will be licensed under the [MIT License](LICENSE).
