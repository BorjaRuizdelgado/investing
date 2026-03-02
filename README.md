# Options-Implied Price Forecast

Extract where the market thinks a stock price is headed, using **publicly available options data** from Yahoo Finance.

## What It Does

The tool reads real option chains and derives a **probability distribution** for a stock's future price. It answers questions like:

- What price range does the market expect?
- What is the probability the stock goes up or down?
- Where is options activity concentrated?

It does **not** predict the future — it shows what is already priced into traded options contracts.

## Interactive UI

The primary interface is a **Streamlit web app** with interactive Plotly charts.

```bash
# Create a virtual environment (recommended)
python -m venv .venv && source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Launch the web app
streamlit run app.py
```

Open the URL shown in your terminal (usually `http://localhost:8501`). Enter any US stock ticker and pick an expiration date.

### CLI (alternative)

A command-line interface is also available:

```bash
python main.py AAPL              # nearest expiration
python main.py AAPL --expiry 2   # third-nearest expiration
python main.py TSLA --all-expiries
python main.py SPY --save        # save charts to output/
```

## How It Works

1. **Fetch the options chain** for a given ticker via `yfinance`.
2. **Build the risk-neutral probability distribution** using the [Breeden-Litzenberger identity](https://quant.stackexchange.com/questions/29524/breeden-litzenberger-formula-for-risk-neutral-densities) — the second derivative of call prices with respect to strike gives the probability density.
3. **Compute key metrics**: expected price, expected move, bull/bear probabilities, percentile ranges, max pain, IV smile.
4. **Visualise** historical prices, the projection cone, options activity, and the implied distribution in interactive charts.

## Output

- **Forecast chart** — historical prices on the left, expanding projection cone (50 % and 80 % confidence bands) on the right, with options activity shown as background bars.
- **IV Smile** — implied volatility across strikes for calls and puts.
- **Open Interest by Strike** — bar chart of where the most contracts sit.
- **Key metrics** — expected price, expected move, P(above/below spot), max pain, percentile breakdown.

## Methodology

The **Breeden-Litzenberger identity** states that the risk-neutral probability density of the underlying price at expiration is:

$$f(K) = e^{rT} \frac{\partial^2 C}{\partial K^2}$$

where $C(K)$ is the call price at strike $K$, $r$ is the risk-free rate, and $T$ is time to expiration.

In practice we:

1. Select OTM puts (K < spot) and OTM calls (K >= spot).
2. Convert OTM puts to equivalent call prices via put-call parity: $C = P + S - Ke^{-rT}$.
3. Fit a smooth cubic spline to the combined call-price curve.
4. Take the second derivative analytically and normalise to get a proper density.

This yields the **market-implied distribution** — not a prediction of what *will* happen, but what the options market is *pricing in*.

## Dependencies

- `yfinance` — free market and options data
- `numpy` / `scipy` — numerical analysis and interpolation
- `pandas` — data wrangling
- `streamlit` — interactive web UI
- `plotly` — interactive charts
- `matplotlib` — static charts (CLI mode)

## Limitations

- Uses **risk-neutral** probabilities, not real-world forecasts. Markets embed a risk premium, so tail probabilities may appear larger than historical frequencies.
- Yahoo Finance data can be delayed or stale for illiquid options.
- Wide bid-ask spreads on far OTM options add noise to the distribution tails.
- The analysis is a snapshot — it changes as options prices update.
