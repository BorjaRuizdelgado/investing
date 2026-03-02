# Options-Implied Price Forecast

> See where the market thinks a stock price is headed — derived entirely from publicly available options data.

> **Note:** This is a personal / learning project built quickly for fun — it is **not production-ready**. There are rough edges, limited error handling, and no test suite. That said, contributions are very welcome! If you find it useful and want to improve it, check out [CONTRIBUTING.md](CONTRIBUTING.md).

[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Streamlit](https://img.shields.io/badge/streamlit-%E2%9C%A8-red)](https://streamlit.io/)

## What It Does

The tool reads real option chains and derives a **probability distribution** for a stock's or cryptocurrency's future price at a given expiration. It answers questions like:

- What price range does the market expect?
- What is the probability the stock goes up or down?
- Where is options activity concentrated?

It does **not** predict the future — it shows what is already priced into traded options contracts.

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/borjaruizdelgado/options-implied-forecast.git
cd options-implied-forecast

# Create a virtual environment (recommended)
python -m venv .venv && source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Launch the web app
streamlit run app.py
```

Open the URL shown in your terminal (usually `http://localhost:8501`). Enter any US stock ticker (or **BTC** / **ETH** for crypto options) and pick an expiration date.

### CLI

A command-line interface is also available:

```bash
python main.py AAPL              # nearest expiration
python main.py AAPL --expiry 2   # third-nearest expiration
python main.py TSLA --all-expiries
python main.py SPY --save        # save charts to output/
python main.py BTC               # crypto options via Deribit
python main.py ETH --expiry 1
```

---

## How It Works

1. **Fetch the option chain** for a given ticker via `yfinance` (stocks/ETFs) or the **Deribit public API** (BTC/ETH crypto options).
2. **Build the risk-neutral probability distribution** using the [Breeden-Litzenberger identity](https://quant.stackexchange.com/questions/29524/breeden-litzenberger-formula-for-risk-neutral-densities) — the second derivative of call prices with respect to strike gives the probability density.
3. **Compute key metrics**: expected price, expected move, bull/bear probabilities, percentile ranges, max pain, IV smile.
4. **Visualise** historical prices, the projection cone, options activity, and the implied distribution in interactive charts.

---

## Charts & Output

| Chart | Description |
|---|---|
| **Forecast** | Historical prices on the left, expanding projection cone (percentile bands) on the right, with options activity as background bars. |
| **Implied Distribution** | Risk-neutral probability density across strikes, trimmed to the meaningful range (1st–99th percentile). |
| **IV Smile** | Implied volatility across strikes for calls and puts. |
| **Open Interest** | Bar chart showing where the most contracts sit. |

Key metrics displayed: expected price, expected move, P(above/below spot), max pain, percentile breakdown.

---

## Methodology

The **Breeden-Litzenberger identity** states that the risk-neutral probability density of the underlying price at expiration is:

$$f(K) = e^{rT} \frac{\partial^2 C}{\partial K^2}$$

where $C(K)$ is the call price at strike $K$, $r$ is the risk-free rate, and $T$ is time to expiration.

In practice:

1. Select OTM puts ($K < S$) and OTM calls ($K \geq S$).
2. Convert OTM puts to equivalent call prices via put-call parity: $C = P + S - Ke^{-rT}$.
3. Fit a smooth cubic spline to the combined call-price curve.
4. Take the second derivative analytically and normalise to get a proper density.

This yields the **market-implied distribution** — not a prediction of what *will* happen, but what the options market is *pricing in*.

---

## Project Structure

```
├── app.py              # Streamlit web UI
├── main.py             # CLI entry point
├── data_fetcher.py     # Yahoo Finance data layer
├── crypto_fetcher.py   # Deribit API data layer (BTC/ETH options)
├── analysis.py         # Distribution, metrics, IV smile
├── charts.py           # Plotly interactive charts
├── visualize.py        # Matplotlib static charts (CLI)
├── requirements.txt
└── options_forecast/   # Package layout (analysis/ + charts/)
```

---

## Dependencies

| Package | Purpose |
|---|---|
| `yfinance` | Free market and options data (stocks/ETFs) |
| `requests` | HTTP client for the Deribit crypto options API |
| `numpy` / `scipy` | Numerical analysis and interpolation |
| `pandas` | Data wrangling |
| `streamlit` | Interactive web UI |
| `plotly` | Interactive charts |
| `matplotlib` | Static charts (CLI mode) |

---

## Limitations

- Uses **risk-neutral** probabilities, not real-world forecasts. Markets embed a risk premium, so tail probabilities may appear larger than historical frequencies.
- Yahoo Finance data can be delayed or stale for illiquid options.
- Wide bid-ask spreads on far OTM options add noise to the distribution tails.
- The analysis is a snapshot — it changes as options prices update.
- **Crypto options** are sourced from Deribit only — only BTC and ETH are supported. Deribit prices are quoted as a fraction of the underlying and converted to USD at the current index price.

---

## Contributing

This started as a quick weekend project, so there is plenty of room for improvement. Bug fixes, new features, better error handling, tests — all contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the [MIT License](LICENSE).
