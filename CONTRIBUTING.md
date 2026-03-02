# Contributing

Thanks for your interest in improving **Options-Implied Price Forecast**! Contributions of all kinds are welcome — bug reports, feature ideas, documentation fixes, code improvements.

---

## Getting Started

1. **Fork** the repository and clone your fork:

   ```bash
   git clone https://github.com/<your-user>/options-implied-forecast.git
   cd options-implied-forecast
   ```

2. Create a **virtual environment** and install dependencies:

   ```bash
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. Verify the app runs:

   ```bash
   streamlit run app.py
   ```

---

## Making Changes

1. Create a **feature branch** from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes. Keep commits small and focused.

3. Test your changes locally — run the Streamlit app and the CLI to make sure nothing is broken:

   ```bash
   streamlit run app.py          # web UI
   python main.py AAPL           # CLI
   ```

4. **Commit** with a clear, descriptive message:

   ```bash
   git commit -m "Add X to improve Y"
   ```

5. **Push** and open a **Pull Request** against `main`.

---

## Code Style

- **Python 3.10+** — use modern syntax (type hints, `match`, `|` unions where appropriate).
- Follow [PEP 8](https://peps.python.org/pep-0008/) conventions.
- Keep functions focused and well-documented with docstrings.
- Use the existing theme constants in `charts.py` (`THEME` dict) for any new visual elements.

---

## Project Layout

| File / Folder | Purpose |
|---|---|
| `app.py` | Streamlit web UI |
| `main.py` | CLI entry point |
| `data_fetcher.py` | Yahoo Finance data layer |
| `analysis.py` | Distribution, metrics, IV smile |
| `charts.py` | Plotly interactive charts |
| `visualize.py` | Matplotlib static charts (CLI) |
| `options_forecast/` | Package layout (analysis + charts submodules) |

---

## Reporting Bugs

Open a [GitHub Issue](https://github.com/borjaruizdelgado/options-implied-forecast/issues) with:

- Steps to reproduce the problem.
- The ticker and expiration date you were analysing (if applicable).
- The full error traceback.

---

## Suggesting Features

Open an issue with the **enhancement** label. Describe the use case and, if possible, sketch out how it might work.

---

## License

By contributing you agree that your contributions will be licensed under the [MIT License](LICENSE).
