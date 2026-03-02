"""
analysis.py – Core maths: Breeden-Litzenberger implied distribution,
expected move, and summary statistics.
"""

import numpy as np
import pandas as pd
from scipy.interpolate import CubicSpline


# ======================================================================
# Breeden-Litzenberger implied probability distribution
# ======================================================================

def implied_distribution(
    calls: pd.DataFrame,
    spot: float,
    r: float,
    T: float,
    n_points: int = 500,
    strike_range: tuple[float, float] | None = None,
    puts: pd.DataFrame | None = None,
) -> dict:
    """
    Compute the risk-neutral probability density from option prices
    using the Breeden-Litzenberger identity:

        f(K) = e^{rT}  d²C / dK²

    Uses **OTM options** for best results: OTM puts (K < spot) are
    converted to equivalent call prices via put-call parity, then
    merged with OTM calls (K ≥ spot) to build a clean call-price
    curve across all strikes.

    Parameters
    ----------
    calls : DataFrame with 'strike' and 'mid' columns.
    spot  : current underlying price.
    r     : annualised risk-free rate.
    T     : time to expiry in years.
    n_points : resolution of the output grid.
    strike_range : (lo, hi) strike bounds; defaults to ±40 % of spot.
    puts  : DataFrame with 'strike' and 'mid' columns (optional but
            strongly recommended for accuracy).

    Returns
    -------
    dict with keys:
        strikes  – 1-D array of strike prices
        pdf      – probability density (same length)
        cdf      – cumulative probability
        mean     – expected price
        median   – 50th-percentile price
        std      – standard deviation of distribution
        skew     – skewness (negative = left-leaning)
    """

    discount = np.exp(-r * T)
    forward = spot / discount  # forward price

    # --- Build a synthetic call-price curve from OTM options -----------
    #   • K ≥ spot  →  use OTM call mid-prices directly
    #   • K < spot  →  convert OTM put prices via put-call parity:
    #                   C(K) = P(K) + S - K·e^{-rT}
    rows: list[tuple[float, float]] = []

    # OTM calls (strike ≥ spot)
    otm_calls = calls[calls["strike"] >= spot * 0.98].copy()
    for _, row in otm_calls.iterrows():
        if row["mid"] > 0:
            rows.append((float(row["strike"]), float(row["mid"])))

    # OTM puts → synthetic call prices (strike < spot)
    if puts is not None:
        otm_puts = puts[puts["strike"] <= spot * 1.02].copy()
        for _, row in otm_puts.iterrows():
            if row["mid"] > 0:
                k = float(row["strike"])
                # Put-call parity: C = P + S - K·e^{-rT}
                synthetic_c = float(row["mid"]) + spot - k * discount
                if synthetic_c > 0:
                    rows.append((k, synthetic_c))

    if not rows:
        raise ValueError("No usable option prices found")

    # Deduplicate strikes (prefer OTM data when overlapping)
    strike_price = {}
    for k, p in rows:
        if k not in strike_price or (k >= spot and p > 0):
            strike_price[k] = p
    strikes_sorted = sorted(strike_price.keys())
    strikes_raw = np.array(strikes_sorted)
    prices_raw = np.array([strike_price[k] for k in strikes_sorted])

    # Require at least 6 strikes for a cubic spline
    if len(strikes_raw) < 6:
        raise ValueError("Too few liquid strikes to build a distribution")

    # --- Ensure monotonically decreasing call prices -------------------
    prices_raw = _enforce_monotone_decreasing(strikes_raw, prices_raw)

    # --- Build smooth spline ------------------------------------------
    spline = CubicSpline(strikes_raw, prices_raw, bc_type="natural")

    if strike_range:
        lo, hi = strike_range
    else:
        lo = max(strikes_raw[0], spot * 0.60)
        hi = min(strikes_raw[-1], spot * 1.40)
    K = np.linspace(lo, hi, n_points)

    # --- Second derivative → PDF --------------------------------------
    pdf = (1.0 / discount) * spline(K, 2)  # e^{rT} · C''(K)
    pdf = np.maximum(pdf, 0.0)

    # Normalise
    total = np.trapezoid(pdf, K)
    if total > 0:
        pdf /= total

    # --- CDF ----------------------------------------------------------
    cdf = np.cumsum(pdf) * (K[1] - K[0])
    cdf = np.clip(cdf, 0, 1)

    # --- Summary statistics -------------------------------------------
    mean = np.trapezoid(K * pdf, K)
    var = np.trapezoid((K - mean) ** 2 * pdf, K)
    std = np.sqrt(max(var, 0))
    skew = np.trapezoid(((K - mean) / std) ** 3 * pdf, K) if std > 0 else 0.0

    # Median: K where CDF ≈ 0.5
    idx_median = np.searchsorted(cdf, 0.5)
    idx_median = min(idx_median, len(K) - 1)
    median = K[idx_median]

    return {
        "strikes": K,
        "pdf": pdf,
        "cdf": cdf,
        "mean": mean,
        "median": median,
        "std": std,
        "skew": skew,
    }


# ======================================================================
# Expected move from ATM straddle
# ======================================================================

def expected_move(calls: pd.DataFrame, puts: pd.DataFrame, spot: float) -> dict:
    """
    Estimate the expected move implied by the at-the-money straddle.

    Returns dict with keys:
        atm_strike, call_price, put_price, straddle, move_abs, move_pct,
        upper, lower
    """
    atm_k = _nearest_strike(calls, spot)

    call_row = calls.loc[calls["strike"] == atm_k].iloc[0]
    put_row = puts.loc[puts["strike"] == atm_k].iloc[0]

    c_price = call_row["mid"]
    p_price = put_row["mid"]
    straddle = c_price + p_price

    # Rule of thumb: expected move ≈ 85 % of straddle price
    move = straddle * 0.85

    return {
        "atm_strike": atm_k,
        "call_price": c_price,
        "put_price": p_price,
        "straddle": straddle,
        "move_abs": move,
        "move_pct": move / spot * 100,
        "upper": spot + move,
        "lower": spot - move,
    }


# ======================================================================
# Probability of finishing above / below spot
# ======================================================================

def bull_bear_probabilities(dist: dict, spot: float) -> dict:
    """
    From the implied distribution, compute:
        prob_above – probability of finishing above current spot
        prob_below – probability of finishing below current spot
    """
    K = dist["strikes"]
    cdf = dist["cdf"]

    idx = np.searchsorted(K, spot)
    idx = min(idx, len(cdf) - 1)
    prob_below = cdf[idx]
    prob_above = 1.0 - prob_below

    return {"prob_above": prob_above, "prob_below": prob_below}


# ======================================================================
# Percentile price levels
# ======================================================================

def percentile_levels(dist: dict, percentiles: list[float] | None = None) -> dict:
    """
    Return strike prices at the given percentiles of the implied
    distribution.
    """
    if percentiles is None:
        percentiles = [10, 25, 50, 75, 90]

    K = dist["strikes"]
    cdf = dist["cdf"]
    levels = {}
    for p in percentiles:
        idx = np.searchsorted(cdf, p / 100.0)
        idx = min(idx, len(K) - 1)
        levels[p] = K[idx]
    return levels


# ======================================================================
# Max-pain calculation
# ======================================================================

def max_pain(calls: pd.DataFrame, puts: pd.DataFrame) -> float:
    """
    The strike at which the total dollar value of all outstanding
    options expires worthless (i.e. causes maximum pain to holders).
    """
    strikes = sorted(set(calls["strike"]).intersection(set(puts["strike"])))
    if not strikes:
        return np.nan

    pain = []
    for k in strikes:
        c_oi = calls.loc[calls["strike"] == k, "openInterest"].values
        p_oi = puts.loc[puts["strike"] == k, "openInterest"].values
        c_oi = c_oi[0] if len(c_oi) else 0
        p_oi = p_oi[0] if len(p_oi) else 0

        # Total intrinsic value that expires ITM for all other strikes
        total = 0.0
        for s in strikes:
            c_oi_s = calls.loc[calls["strike"] == s, "openInterest"].values
            p_oi_s = puts.loc[puts["strike"] == s, "openInterest"].values
            c_oi_s = c_oi_s[0] if len(c_oi_s) else 0
            p_oi_s = p_oi_s[0] if len(p_oi_s) else 0

            # If underlying settles at k, calls with strike < k are ITM
            if s < k:
                total += (k - s) * c_oi_s
            # Puts with strike > k are ITM
            if s > k:
                total += (s - k) * p_oi_s
        pain.append((k, total))

    # Strike with the minimum total payout
    pain.sort(key=lambda x: x[1])
    return pain[0][0]


# ======================================================================
# IV smile data
# ======================================================================

def iv_smile(calls: pd.DataFrame, puts: pd.DataFrame, spot: float) -> pd.DataFrame:
    """
    Build a tidy DataFrame of strike vs IV for calls and puts,
    useful for plotting the volatility smile.
    """
    rows = []
    for _, row in calls.iterrows():
        if row["impliedVolatility"] > 0:
            rows.append({
                "strike": row["strike"],
                "iv": row["impliedVolatility"],
                "moneyness": row["strike"] / spot,
                "type": "call",
            })
    for _, row in puts.iterrows():
        if row["impliedVolatility"] > 0:
            rows.append({
                "strike": row["strike"],
                "iv": row["impliedVolatility"],
                "moneyness": row["strike"] / spot,
                "type": "put",
            })
    return pd.DataFrame(rows)


# ======================================================================
# Helpers
# ======================================================================

def _nearest_strike(df: pd.DataFrame, target: float) -> float:
    idx = (df["strike"] - target).abs().idxmin()
    return df.loc[idx, "strike"]


def _enforce_monotone_decreasing(strikes, prices):
    """
    Call prices must be non-increasing in strike (no-arbitrage).
    Enforce by walking right-to-left and capping.
    """
    p = prices.copy()
    for i in range(len(p) - 2, -1, -1):
        if p[i] < p[i + 1]:
            p[i] = p[i + 1]
    return p
