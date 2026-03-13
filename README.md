# Investing Tools

> Options-implied forecasts, scored fundamentals, business financials, and trending tickers — one free tool.

[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**Live:** [investing.borjaruizdelgado.com](https://investing.borjaruizdelgado.com)

## What It Does

A single-page research terminal for stocks and crypto that combines options math with fundamental analysis. Enter any US stock, ETF, or crypto ticker and get:

- Scored, reasoned assessment across Opportunity, Valuation, Quality, Risk, and Options dimensions (0–100)
- Options-implied probability distribution and expected move derived from live market pricing
- Cross-metric signals — e.g. value trap, undervalued quality, financial fragility
- Full fundamentals reference: P/E, EBITDA, margins, ROE, balance sheet, cash flow, analyst targets
- Income statement and cash flow charts over 3 years
- IV smile, open interest, put/call ratio, support/resistance, and entry analysis
- Trending tickers landing page for discovery

All information reflects what is already priced into traded options and publicly available financial data — it does **not** predict the future.

## Quick Start

```bash
npm install
npm run dev        # local dev server with hot reload
```

Open the URL shown in your terminal (usually `http://localhost:5173`). Enter any US stock ticker (e.g. `AAPL`, `TSLA`, `SPY`) or crypto ticker (`BTC`, `ETH`, `SOL`, `XRP`, `DOGE`) and pick an expiration date.

## Deploy

The app runs on **Cloudflare Pages** with a Worker that proxies Yahoo Finance (stocks) and Bybit (crypto options).

```bash
npm run deploy     # builds + deploys via wrangler
```

## URL Structure

Routes follow `/{ticker}/{tab}` and are bookmarkable. Supported tabs: `overview`, `value`, `quality`, `risk`, `business`, `options`, `fundamentals`. Navigating to `/AAPL/options` loads Apple's options analysis directly.

## Tabs

| Tab | Content |
|-----|---------|
| **Overview** | All five scores at a glance + top reasons + cross-metric signals |
| **Value** | Valuation score + bear/base/bull fair value range + metric table + reasons |
| **Quality** | Profitability score + growth, margins, ROE/ROA, FCF margin |
| **Risk** | Safety score (inverted for clarity) + leverage, liquidity, beta, volatility |
| **Business** | Revenue, income, and cash flow charts over 3 fiscal years |
| **Options Forecasting** | Full options hub — forecast cone, distribution, IV smile, OI, S/R, entry |
| **Fundamentals** | Raw fundamentals reference — all metrics in sortable tables |

## Scoring System

Each dimension is scored 0–100 and labelled Weak / Mixed / Good / Strong. The **Opportunity** score aggregates valuation, quality, risk, options sentiment, and analyst upside into a single signal.

### Cross-metric signals

| Signal | Condition |
|--------|-----------|
| Undervalued quality | Low valuation + high quality |
| Value trap | Low valuation + low quality |
| Financial fragility | High risk despite apparent value |
| Analyst alignment | Score direction matches analyst consensus |
| Pricing full | Options-implied upside already matches analyst target |

## Options Analysis

### Multi-Expiry Weighted Mode

By default the analysis blends **up to 8 option chains** expiring up to the selected date, weighted by proximity:

$$w_i = \frac{1}{\sqrt{DTE_i}}$$

Nearer-term expirations carry more weight because they reflect the market's most current and liquid pricing. The merged PDF, expected move, max-pain, IV smile, put/call ratio, and support/resistance levels all benefit from the broader data.

Toggle this off in the sidebar to use only the single selected expiry chain.

### Metrics derived

- Implied probability distribution (Breeden-Litzenberger)
- Expected move range with confidence intervals
- Percentile price levels (5th through 95th)
- Max pain
- IV smile
- Open interest and volume by strike
- Put/call ratio sentiment
- Support and resistance levels
- Entry/stop/target suggestions

## Fundamentals (stocks only)

- **Valuation** — P/E (TTM & forward), PEG, P/B, P/S, EV/Revenue, EV/EBITDA, FCF yield
- **Profitability** — EPS, EBITDA, net income, gross profit, all margin types, ROE, ROA
- **Growth** — revenue growth, earnings growth, quarterly earnings growth
- **Balance Sheet** — total cash, total debt, debt/equity, current & quick ratio, book value, total assets/liabilities
- **Cash Flow** — operating CF, CapEx, free cash flow (3 years of statement history)
- **Dividends** — yield, rate, payout ratio, 5-year avg yield, ex-dividend date
- **Trading** — beta, 52-week range & change, volume, float, insider & institutional ownership
- **Short Interest** — shares short, short ratio, short % of float, prior month comparison
- **Analyst Estimates** — mean/median price targets, target range, consensus rating, opinions count

## Methodology

The **Breeden-Litzenberger identity** states that the risk-neutral probability density of the underlying price at expiration is:

$$f(K) = e^{rT} \frac{\partial^2 C}{\partial K^2}$$

where $C(K)$ is the call price at strike $K$, $r$ is the risk-free rate, and $T$ is time to expiration.

In practice:

1. Select OTM puts ($K < S$) and OTM calls ($K \geq S$).
2. Convert OTM puts to equivalent call prices via put-call parity.
3. Fit a smooth cubic spline to the combined call-price curve.
4. Take the second derivative analytically and normalise to get a proper density.

When multi-expiry weighting is enabled (the default), steps 1–4 are repeated for every available chain up to the selected date. Each resulting PDF is resampled onto a common strike grid and blended using inverse-square-root-of-DTE weights.

## Data Sources

| Source | Used for |
|--------|----------|
| Yahoo Finance | Options chains (cookie+crumb auth proxy), fundamentals, price history, risk-free rate (^IRX) |
| Bybit public API | Crypto options for BTC, ETH, SOL, XRP, DOGE |
| Yahoo Finance (fallback) | Crypto price history |

## Limitations

- Uses **risk-neutral** probabilities, not real-world forecasts.
- Yahoo Finance data can be delayed or stale for illiquid options.
- Wide bid-ask spreads on far OTM options add noise to the distribution tails.
- The analysis is a snapshot — it changes as options prices update.
- Crypto options via Bybit cover BTC, ETH, SOL, XRP, and DOGE only.
- Fundamentals and scoring are only available for stocks — crypto tickers show options analysis only.

## Tech Stack

- **React 18** + **Vite 6** — frontend SPA
- **Plotly.js** — all charts (forecast cone, distribution, IV smile, OI, candlestick S/R, financial statements)
- **Cloudflare Pages** — static hosting with SPA fallback
- **Cloudflare Workers** — API proxy with Yahoo auth caching and Bybit routing

## Contributing

Bug fixes, features, and improvements are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
