"""
app.py – Streamlit interactive UI for Options-Implied Price Forecast.

Run with:
    streamlit run app.py
"""

import streamlit as st
import numpy as np
from data_fetcher import MarketData
from analysis import (
    implied_distribution,
    expected_move,
    bull_bear_probabilities,
    percentile_levels,
    max_pain,
    iv_smile,
)
from charts import build_forecast_chart, build_distribution_chart, build_iv_smile_chart, build_oi_chart

# ======================================================================
# Theme
# ======================================================================
ACCENT = "#4d6a61"
ACCENT_WARM = "#c08050"
BG = "#f7f5f0"
TEXT = "#1c1c1c"
GREEN = "#3d7a5a"
RED = "#b05040"

st.set_page_config(
    page_title="Options-Implied Forecast",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Inject custom CSS to match borjaruizdelgado.com palette
st.markdown(f"""
<style>
    /* ---- global ---- */
    .stApp {{
        background-color: {BG};
        color: {TEXT};
        font-family: 'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    }}
    section[data-testid="stSidebar"] {{
        background-color: #efece5;
        border-right: 1px solid #d8d4cc;
    }}
    section[data-testid="stSidebar"] * {{
        color: {TEXT} !important;
    }}
    /* ---- headers ---- */
    h1, h2, h3 {{ color: {TEXT}; }}
    /* ---- metric cards ---- */
    [data-testid="stMetricLabel"] {{ font-size: 0.95rem; }}
    [data-testid="stMetricValue"] {{ color: {ACCENT}; font-weight: 600; font-size: 1.6rem; }}
    [data-testid="stMetricDelta"] {{ font-size: 0.9rem; }}
    /* ---- buttons & inputs ---- */
    .stButton > button {{
        background-color: {ACCENT};
        color: white;
        border: none;
        border-radius: 8px;
        padding: 0.5rem 1.2rem;
        font-weight: 500;
    }}
    .stButton > button:hover {{
        background-color: #3d5a51;
    }}
    div[data-baseweb="input"] > div {{
        border-color: #d8d4cc !important;
    }}
    /* ---- info/success boxes ---- */
    .stAlert {{ border-radius: 8px; }}
    /* ---- divider ---- */
    hr {{ border-color: #d8d4cc; }}
    /* ---- expander triangle ---- */
    .streamlit-expanderHeader {{ font-weight: 500; }}
</style>
""", unsafe_allow_html=True)


# ======================================================================
# Sidebar – inputs
# ======================================================================

with st.sidebar:
    st.markdown(f"## Options Forecast")
    st.caption("Predict where the market thinks a stock is heading, using real options data.")

    ticker_input = st.text_input(
        "Ticker symbol",
        value="AAPL",
        placeholder="e.g. AAPL, TSLA, SPY …",
        help="Enter any US stock or ETF ticker symbol.",
    ).strip().upper()

    analyse_btn = st.button("Analyse", use_container_width=True)


# ======================================================================
# State management
# ======================================================================

if "last_ticker" not in st.session_state:
    st.session_state["last_ticker"] = None
if "market" not in st.session_state:
    st.session_state["market"] = None

should_run = analyse_btn or (
    ticker_input and ticker_input != st.session_state.get("last_ticker")
    and st.session_state.get("last_ticker") is not None
)


# ======================================================================
# Landing state
# ======================================================================

if not ticker_input:
    st.title("Options-Implied Price Forecast")
    st.info("Enter a ticker symbol in the sidebar and click **Analyse** to get started.")
    st.stop()


# ======================================================================
# Fetch + cache data
# ======================================================================

@st.cache_data(ttl=300, show_spinner=False)
def fetch_data(ticker: str):
    """Fetch serializable market metadata for a ticker. Cached 5 min."""
    market = MarketData(ticker)
    spot = market.spot_price
    expirations = [e for e in market.expirations if market.days_to_expiry(e) >= 1]
    r = MarketData.risk_free_rate()
    # Return only pickle-safe types; MarketData stored in session_state
    return spot, expirations, r


# Initial fetch on button click or first load
if analyse_btn or st.session_state.get("last_ticker") != ticker_input:
    try:
        with st.spinner(f"Fetching data for **{ticker_input}** …"):
            spot, expirations, r = fetch_data(ticker_input)
            market = MarketData(ticker_input)  # lightweight; kept in session
        if not expirations:
            st.error(f"No options data available for **{ticker_input}**.")
            st.stop()
        st.session_state["last_ticker"] = ticker_input
        st.session_state["market"] = market
        st.session_state["spot"] = spot
        st.session_state["expirations"] = expirations
        st.session_state["r"] = r
    except Exception as e:
        st.error(f"Could not load data for **{ticker_input}**: {e}")
        st.stop()

# Guard: make sure we have data
if st.session_state.get("market") is None:
    st.title("Options-Implied Price Forecast")
    st.info("Enter a ticker symbol in the sidebar and click **Analyse** to get started.")
    st.stop()

market = st.session_state["market"]
spot = st.session_state["spot"]
expirations = st.session_state["expirations"]
r = st.session_state["r"]


# ======================================================================
# Expiry selector
# ======================================================================

with st.sidebar:
    st.markdown("### Expiration")

    exp_labels = []
    for e in expirations:
        dte_val = market.days_to_expiry(e)
        exp_labels.append(f"{e}  ({int(dte_val)}d)")

    exp_idx = st.selectbox(
        "Expiration date",
        range(len(expirations)),
        format_func=lambda i: exp_labels[i],
        help="Choose the options expiration date to analyse.",
    )
    expiry = expirations[exp_idx]
    dte = market.days_to_expiry(expiry)


# ======================================================================
# Run analysis
# ======================================================================

@st.cache_data(ttl=300, show_spinner=False)
def run_analysis(ticker: str, expiry: str, spot: float, r: float, dte: float):
    """Run the full analysis pipeline for one expiry."""
    m = MarketData(ticker)
    chain = m.options_chain(expiry)
    calls, puts = chain["calls"], chain["puts"]

    T = dte / 365.0
    dist = implied_distribution(calls, spot, r, T, puts=puts)
    em = expected_move(calls, puts, spot)
    probs = bull_bear_probabilities(dist, spot)
    pctiles = percentile_levels(dist)
    mp = max_pain(calls, puts)
    iv_df = iv_smile(calls, puts, spot)

    hist_days = max(int(dte), 30)
    history = m.historical_prices(hist_days)

    return dist, em, probs, pctiles, mp, iv_df, calls, puts, history


try:
    with st.spinner("Running analysis …"):
        dist, em, probs, pctiles, mp, iv_df, calls, puts, history = run_analysis(
            ticker_input, expiry, spot, r, dte
        )
except ValueError as e:
    st.error(f"Analysis failed for **{expiry}**: {e}")
    st.stop()
except Exception as e:
    st.error(f"Unexpected error: {e}")
    st.stop()


# ======================================================================
# Header
# ======================================================================

st.markdown(f"# {ticker_input}")
st.caption(f"Current price: **${spot:,.2f}** · Expiry: **{expiry}** ({int(dte)} days)")


# ======================================================================
# KPI row
# ======================================================================

c1, c2, c3, c4, c5 = st.columns(5)

mean_chg = (dist["mean"] - spot) / spot * 100
c1.metric("Expected Price", f"${dist['mean']:,.2f}",
           delta=f"{mean_chg:+.1f}%",
           delta_color="normal")

c2.metric("Expected Move", f"±{em['move_pct']:.1f}%",
           delta=f"${em['move_abs']:,.2f}")

c3.metric("P(above spot)", f"{probs['prob_above']*100:.1f}%")

c4.metric("P(below spot)", f"{probs['prob_below']*100:.1f}%")

mp_display = f"${mp:,.2f}" if not np.isnan(mp) else "N/A"
c5.metric("Max Pain", mp_display)


# ======================================================================
# Main chart
# ======================================================================

st.plotly_chart(
    build_forecast_chart(
        ticker=ticker_input,
        expiry=expiry,
        spot=spot,
        dist=dist,
        em=em,
        pctiles=pctiles,
        mp=mp,
        calls=calls,
        puts=puts,
        history=history,
        days_to_expiry=dte,
    ),
    use_container_width=True,
    config={"displayModeBar": True, "scrollZoom": True},
)


# ======================================================================
# Distribution chart
# ======================================================================

st.plotly_chart(
    build_distribution_chart(
        dist=dist,
        spot=spot,
        pctiles=pctiles,
        mp=mp,
        calls=calls,
        puts=puts,
    ),
    use_container_width=True,
    config={"displayModeBar": True, "scrollZoom": True},
)


# ======================================================================
# Secondary charts
# ======================================================================

col_iv, col_oi = st.columns(2)

with col_iv:
    st.plotly_chart(
        build_iv_smile_chart(iv_df, spot),
        use_container_width=True,
        config={"displayModeBar": False},
    )

with col_oi:
    st.plotly_chart(
        build_oi_chart(calls, puts, spot),
        use_container_width=True,
        config={"displayModeBar": False},
    )


# ======================================================================
# Percentile table
# ======================================================================

with st.expander("Percentile Breakdown", expanded=False):
    st.markdown(
        "Percentiles show where the market implies the price will land. "
        "For example, the 25th percentile means there is roughly a 25% chance "
        "the price will be **at or below** that level by expiry."
    )
    pct_rows = []
    for p, val in sorted(pctiles.items()):
        chg = (val - spot) / spot * 100
        pct_rows.append({"Percentile": f"{p}th", "Price": f"${val:,.2f}", "Change from spot": f"{chg:+.1f}%"})
    st.table(pct_rows)


# ======================================================================
# Distribution stats
# ======================================================================

with st.expander("Distribution Details", expanded=False):
    s1, s2, s3, s4 = st.columns(4)
    s1.metric("Mean", f"${dist['mean']:,.2f}")
    s2.metric("Median", f"${dist['median']:,.2f}")
    s3.metric("Std Dev", f"${dist['std']:,.2f}")
    s4.metric("Skewness", f"{dist['skew']:+.3f}")
    st.caption(
        "The implied distribution is derived from market option prices using the "
        "Breeden-Litzenberger identity. It represents the market's risk-neutral "
        "probability assessment for the underlying's price at expiry."
    )


# ======================================================================
# How it works
# ======================================================================

st.divider()
st.caption(
    "This tool shows what is already priced into traded options — it does not predict the future.  \n"
    "Read the full methodology and limitations in the project README."
)
