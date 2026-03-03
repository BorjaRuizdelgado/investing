# Options-Implied Price Forecast

> See what the options market is pricing in — interactive forecast charts derived from real options data.

[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## What It Does

Reads live option chains and derives a **probability distribution** for a stock's or cryptocurrency's future price at a given expiration. It answers:

- What price range does the market expect?
- What is the probability the stock goes up or down?
- Where is options activity concentrated?

It does **not** predict the future — it shows what is already priced into traded options contracts.

## Quick Start

```bash
npm install
npm run dev        # local dev server with hot reload
```

Open the URL shown in your terminal (usually `http://localhost:5173`). Enter any US stock ticker (e.g. AAPL, TSLA, SPY) or crypto ticker (BTC, ETH) and pick an expiration date.

## Deploy

The app runs on **Cloudflare Pages** with a Worker that proxies Yahoo Finance (stocks) and Deribit (crypto options).

```bash
npm run deploy     # builds + deploys via wrangler
```

## Architecture

| Path | Purpose |
|---|---|
| `src/worker.js` | Cloudflare Worker — API proxy for Yahoo Finance + Deribit |
| `src/App.jsx` | Main React component |
| `src/components/` | Chart and UI components (Plotly) |
| `src/lib/analysis.js` | Breeden-Litzenberger distribution, metrics, IV smile |
| `src/lib/fetcher.js` | API client |
| `src/lib/spline.js` | Cubic spline interpolation |
| `src/lib/theme.js` | Plotly theme constants |
| `src/styles.css` | Global styles |
| `wrangler.jsonc` | Cloudflare Worker configuration |

## Data Sources

- **Stocks / ETFs** — Yahoo Finance (via cookie+crumb auth proxy)
- **Crypto** — Deribit public API for options (BTC, ETH), Yahoo Finance for history. Other crypto tickers (SOL, XRP, etc.) fall back to Yahoo Finance.

## Methodology

The **Breeden-Litzenberger identity** states that the risk-neutral probability density of the underlying price at expiration is:

$$f(K) = e^{rT} \frac{\partial^2 C}{\partial K^2}$$

where $C(K)$ is the call price at strike $K$, $r$ is the risk-free rate, and $T$ is time to expiration.

In practice:

1. Select OTM puts ($K < S$) and OTM calls ($K \geq S$).
2. Convert OTM puts to equivalent call prices via put-call parity.
3. Fit a smooth cubic spline to the combined call-price curve.
4. Take the second derivative analytically and normalise to get a proper density.

## Limitations

- Uses **risk-neutral** probabilities, not real-world forecasts.
- Yahoo Finance data can be delayed or stale for illiquid options.
- Wide bid-ask spreads on far OTM options add noise to the distribution tails.
- The analysis is a snapshot — it changes as options prices update.
- Crypto options (Deribit) are currently available for BTC and ETH only. Other crypto tickers use Yahoo Finance which may have limited options data.

## Contributing

Bug fixes, features, and improvements are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
