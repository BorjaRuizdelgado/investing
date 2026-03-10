# Contributing

Thanks for your interest in improving the **Investing Tool**! Contributions of all kinds are welcome — bug reports, feature ideas, documentation fixes, code improvements.

## Getting Started

1. **Fork** the repository and clone your fork:

   ```bash
   git clone https://github.com/<your-user>/options-implied-forecast.git
   cd options-implied-forecast
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

3. Test locally — run the dev server and verify your changes work for both stock tickers (AAPL) and crypto (BTC).

4. **Commit** with a clear, descriptive message:

   ```bash
   git commit -m "Add X to improve Y"
   ```

5. **Push** and open a **Pull Request** against `main`.

## Project Layout

| Path | Purpose |
| --- | --- |
| `src/worker.js` | Cloudflare Worker — API proxy for Yahoo Finance + Bybit |
| `src/App.jsx` | Main React app component |
| `src/components/` | Chart and UI components (Plotly) |
| `src/lib/analysis.js` | Distribution, metrics, IV smile calculations |
| `src/lib/fetcher.js` | API client |
| `src/lib/format.js` | Number & currency formatting helpers |
| `src/lib/spline.js` | Cubic spline interpolation |
| `src/lib/theme.js` | Plotly theme constants |
| `src/styles.css` | Global styles |

## Reporting Bugs

Open a [GitHub Issue](https://github.com/borjaruizdelgado/options-implied-forecast/issues) with:

- Steps to reproduce the problem.
- The ticker and expiration date you were analysing (if applicable).
- The full error message.

## Suggesting Features

Open an issue with the **enhancement** label. Describe the use case and, if possible, sketch out how it might work.

## License

By contributing you agree that your contributions will be licensed under the [MIT License](LICENSE).
