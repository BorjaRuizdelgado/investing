# Investing Tool

> Unified investing analysis — options-implied forecasts, stock fundamentals, analyst estimates, balance sheet data, and crypto options in one free tool.

[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**Live:** [investing.borjaruizdelgado.com](https://investing.borjaruizdelgado.com)

## What It Does

A single-page investing dashboard that combines:

- **Options-implied probability distributions** — what range does the market expect?
- **Expected move & percentile levels** — quantified upside/downside
- **Stock fundamentals** — P/E, EBITDA, margins, ROE, balance sheet, cash flow, analyst targets
- **IV smile & open interest** — where is options activity concentrated?
- **Support/resistance & entry analysis** — derived from historical price action + options flow
- **Trending tickers** — discover popular stocks and crypto with one click

It shows what is already priced into traded options and publicly available financial data — it does **not** predict the future.

### Multi-Expiry Weighted Mode

By default the analysis blends **all option chains expiring up to the selected date**, weighted by proximity:

$$w_i = \frac{1}{\sqrt{DTE_i}}$$

Nearer-term expirations carry more weight because they reflect the market's most current and liquid pricing. The merged implied PDF, expected move, max-pain, put/call ratio, and support/resistance levels all benefit from the broader data.

Toggle this off in the sidebar to use **only the single selected expiry chain**.

## Quick Start

```bash
npm install
npm run dev        # local dev server with hot reload
```

Open the URL shown in your terminal (usually `http://localhost:5173`). Enter any US stock ticker (e.g. AAPL, TSLA, SPY) or crypto ticker (BTC, ETH, SOL, XRP, DOGE) and pick an expiration date.

## Deploy

The app runs on **Cloudflare Pages** with a Worker that proxies Yahoo Finance (stocks) and Bybit (crypto options).

```bash
npm run deploy     # builds + deploys via wrangler
```

## Data Sources

- **Stocks / ETFs** — Yahoo Finance (options via cookie+crumb auth proxy, fundamentals via quoteSummary modules)
- **Crypto** — Bybit public API for options (BTC, ETH, SOL, XRP, DOGE), Yahoo Finance for price history

## Features

### Options Analysis

- Implied probability distribution (Breeden-Litzenberger)
- Expected move range with confidence intervals
- Percentile price levels (5th through 95th)
- Max pain calculation
- IV smile visualisation
- Open interest analysis
- Put/call ratio sentiment
- Support & resistance levels
- Entry/stop/target suggestions

### Fundamentals (stocks only)

- **Valuation** — P/E (TTM & forward), PEG ratio, P/B, P/S, EV/Revenue, EV/EBITDA
- **Profitability** — EPS, EBITDA, net income, gross profit, margins (profit, gross, EBITDA, operating), ROE, ROA, revenue & earnings growth
- **Balance Sheet & Cash Flow** — total cash, total debt, debt/equity, current & quick ratio, book value, total assets/liabilities, operating & free cash flow, CapEx
- **Dividends** — yield, rate, payout ratio, 5-year avg yield, ex-dividend date
- **Trading** — beta, 52-week range & change, moving averages, volume, float, insider & institutional ownership
- **Short Interest** — shares short, short ratio, short % of float, prior month comparison
- **Analyst Estimates** — mean/median price targets, target range, consensus rating, quarterly earnings growth

## Methodology

The **Breeden-Litzenberger identity** states that the risk-neutral probability density of the underlying price at expiration is:

$$f(K) = e^{rT} \frac{\partial^2 C}{\partial K^2}$$

where $C(K)$ is the call price at strike $K$, $r$ is the risk-free rate, and $T$ is time to expiration.

In practice:

1. Select OTM puts ($K < S$) and OTM calls ($K \geq S$).
2. Convert OTM puts to equivalent call prices via put-call parity.
3. Fit a smooth cubic spline to the combined call-price curve.
4. Take the second derivative analytically and normalise to get a proper density.

When **multi-expiry weighting** is enabled (the default), steps 1–4 are repeated for every available chain up to the selected date. Each resulting PDF is resampled onto a common strike grid and blended using inverse-square-root-of-DTE weights.

## Limitations

- Uses **risk-neutral** probabilities, not real-world forecasts.
- Yahoo Finance data can be delayed or stale for illiquid options.
- Wide bid-ask spreads on far OTM options add noise to the distribution tails.
- The analysis is a snapshot — it changes as options prices update.
- Crypto options via Bybit cover BTC, ETH, SOL, XRP, and DOGE. Other crypto tickers fall back to Yahoo Finance.
- Fundamentals are only shown for stocks — crypto tickers do not return fundamental data.

## Contributing

Bug fixes, features, and improvements are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
