"""
visualize.py – Matplotlib charts styled to match borjaruizdelgado.com

Main chart: a single, rich plot showing:
  • Past N days of price history (line + subtle area)
  • Individual options as background bars coloured by volume/OI
  • Implied probability distribution (filled curve)
  • Projected future price path (cone / fan)
  • Key levels: spot, mean, max-pain, percentiles
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.ticker as mtick
import matplotlib.dates as mdates
import matplotlib.colors as mcolors
from datetime import datetime, timedelta
from pathlib import Path

# ======================================================================
# Theme — matches the CSS variables from borjaruizdelgado.com
# ======================================================================
T = {
    "bg":          "#f7f5f0",
    "bg_alt":      "#efece5",
    "text":        "#1c1c1c",
    "text_light":  "#5a5a5a",
    "text_muted":  "#9a9a9a",
    "accent":      "#4d6a61",
    "accent_warm": "#c08050",
    "border":      "#d8d4cc",
    "border_light":"#e8e5de",
}

plt.rcParams.update({
    "figure.facecolor":  T["bg"],
    "axes.facecolor":    T["bg"],
    "axes.edgecolor":    T["border"],
    "axes.labelcolor":   T["text_light"],
    "text.color":        T["text"],
    "xtick.color":       T["text_muted"],
    "ytick.color":       T["text_muted"],
    "grid.color":        T["border_light"],
    "grid.linewidth":    0.5,
    "figure.titlesize":  14,
    "axes.titlesize":    11,
    "font.size":         9,
    "font.family":       "sans-serif",
    "font.sans-serif":   ["DM Sans", "Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
    "axes.spines.top":   False,
    "axes.spines.right": False,
})


# ======================================================================
# PUBLIC: main entry point
# ======================================================================

def plot_full_analysis(
    ticker: str,
    expiry: str,
    spot: float,
    dist: dict,
    em: dict,
    probs: dict,
    pctiles: dict,
    mp: float,
    iv_df: pd.DataFrame | None = None,
    calls: pd.DataFrame | None = None,
    puts: pd.DataFrame | None = None,
    history: pd.DataFrame | None = None,
    days_to_expiry: float = 30,
    save_path: Path | None = None,
):
    """
    Produce a two-row figure:
        top  : price chart with historical prices + future projection + options
        bottom left  : IV smile
        bottom right : summary statistics
    """
    fig = plt.figure(figsize=(14, 10))

    # GridSpec: top row spans full width, bottom row 50/50
    gs = fig.add_gridspec(
        2, 2,
        height_ratios=[2.2, 1],
        hspace=0.32,
        wspace=0.30,
        left=0.07, right=0.96, top=0.92, bottom=0.06,
    )

    ax_main = fig.add_subplot(gs[0, :])   # full-width top panel
    ax_iv   = fig.add_subplot(gs[1, 0])   # bottom-left
    ax_stats = fig.add_subplot(gs[1, 1])  # bottom-right

    # Title
    fig.suptitle(
        f"{ticker}   ·   Options-Implied Forecast   ·   exp. {expiry}",
        fontsize=14,
        fontweight="600",
        color=T["text"],
        y=0.97,
        fontfamily="sans-serif",
    )

    _plot_main_chart(ax_main, ticker, expiry, spot, dist, em, pctiles, mp,
                     calls, puts, history, days_to_expiry)
    _plot_iv_smile(ax_iv, iv_df, spot)
    _plot_summary_table(ax_stats, ticker, expiry, spot, dist, em, probs, pctiles, mp)

    if save_path:
        fig.savefig(save_path, dpi=180, bbox_inches="tight", facecolor=T["bg"])
        print(f"  → saved to {save_path}")
    else:
        plt.show()

    plt.close(fig)


# ======================================================================
# MAIN CHART: history + options background + distribution projection
# ======================================================================

def _plot_main_chart(ax, ticker, expiry, spot, dist, em, pctiles, mp,
                     calls, puts, history, dte):
    """
    Left half  = past N days of close prices (line + area)
    Right half = future projection to expiry (distribution fan + options)
    """
    today = datetime.now()
    expiry_dt = datetime.strptime(expiry, "%Y-%m-%d")
    dte_days = max(int(np.ceil(dte)), 1)

    # ------------------------------------------------------------------
    # 1. Historical price (left side of chart)
    # ------------------------------------------------------------------
    hist_dates = []
    hist_prices = []
    if history is not None and not history.empty:
        hist_dates = [d.to_pydatetime() if hasattr(d, 'to_pydatetime') else d
                      for d in history.index]
        # Remove timezone info if present
        hist_dates = [d.replace(tzinfo=None) if hasattr(d, 'tzinfo') and d.tzinfo else d
                      for d in hist_dates]
        hist_prices = history["Close"].values.tolist()

    # Use the last historical date as "today" anchor (markets may be closed)
    if hist_dates:
        anchor = hist_dates[-1]
    else:
        anchor = today

    # Future dates: trading days only (weekdays)
    future_dates = []
    d = anchor + timedelta(days=1)
    while len(future_dates) < dte_days and d <= expiry_dt + timedelta(days=1):
        if d.weekday() < 5:  # Mon-Fri
            future_dates.append(d)
        d += timedelta(days=1)
    if not future_dates:
        future_dates = [anchor + timedelta(days=1)]

    # ------------------------------------------------------------------
    # 2. Options as background bars (at expiry x-position)
    # ------------------------------------------------------------------
    expiry_x = future_dates[-1] if future_dates else anchor + timedelta(days=dte_days)

    if calls is not None and puts is not None:
        _draw_options_bars(ax, calls, puts, spot, future_dates, expiry_x)

    # ------------------------------------------------------------------
    # 3. Historical price line
    # ------------------------------------------------------------------
    if hist_dates and hist_prices:
        ax.plot(hist_dates, hist_prices,
                color=T["accent"], linewidth=2, solid_capstyle="round",
                zorder=5, label="Price")
        # Subtle area fill under price
        ax.fill_between(hist_dates, hist_prices,
                        min(hist_prices) * 0.995,
                        color=T["accent"], alpha=0.06)
        # Dot at current price
        ax.plot(hist_dates[-1], hist_prices[-1],
                "o", color=T["accent"], markersize=5, zorder=6)

    # ------------------------------------------------------------------
    # 4. Future projection fan (from distribution)
    # ------------------------------------------------------------------
    _draw_projection_fan(ax, dist, pctiles, spot, anchor, future_dates, expiry_x)

    # ------------------------------------------------------------------
    # 5. Key horizontal levels
    # ------------------------------------------------------------------
    all_dates = hist_dates + future_dates
    if all_dates:
        xmin, xmax = min(all_dates), max(all_dates)
    else:
        xmin, xmax = anchor - timedelta(days=30), anchor + timedelta(days=30)

    # Spot line
    ax.axhline(spot, color=T["text"], ls="--", lw=0.8, alpha=0.5, zorder=3)
    ax.text(xmax + timedelta(hours=6), spot, f"  ${spot:,.2f}",
            va="center", fontsize=8, color=T["text"], fontweight="600", zorder=7)

    # Mean implied
    ax.axhline(dist["mean"], color=T["accent"], ls="-.", lw=0.7, alpha=0.4, zorder=3)
    ax.text(xmax + timedelta(hours=6), dist["mean"], f"  μ ${dist['mean']:,.2f}",
            va="center", fontsize=7, color=T["accent"], alpha=0.8, zorder=7)

    # Max pain
    if not np.isnan(mp) and abs(mp - spot) / spot < 0.20:
        ax.axhline(mp, color=T["accent_warm"], ls=":", lw=0.7, alpha=0.4, zorder=3)
        ax.text(xmax + timedelta(hours=6), mp, f"  MP ${mp:,.2f}",
                va="center", fontsize=7, color=T["accent_warm"], alpha=0.7, zorder=7)

    # ------------------------------------------------------------------
    # 6. "Now" vertical divider
    # ------------------------------------------------------------------
    ax.axvline(anchor, color=T["border"], ls="-", lw=1, alpha=0.6, zorder=2)
    ax.text(anchor, ax.get_ylim()[1], "  now",
            va="top", ha="left", fontsize=7, color=T["text_muted"],
            fontstyle="italic", zorder=7)

    # ------------------------------------------------------------------
    # Formatting
    # ------------------------------------------------------------------
    ax.set_title(f"{ticker} — Past {len(hist_prices)}d  /  Forecast to {expiry}",
                 fontsize=11, color=T["text"], loc="left", pad=10)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %d"))
    ax.xaxis.set_major_locator(mdates.AutoDateLocator(minticks=4, maxticks=12))
    ax.yaxis.set_major_formatter(mtick.FormatStrFormatter("$%.0f"))
    ax.grid(True, alpha=0.4, which="major")
    ax.tick_params(axis="both", which="both", length=3)

    # Set y-range to include distribution tails
    K = dist["strikes"]
    cdf = dist["cdf"]
    lo_99 = K[np.searchsorted(cdf, 0.005)]
    hi_99 = K[min(np.searchsorted(cdf, 0.995), len(K) - 1)]

    price_lo = min(lo_99, min(hist_prices) if hist_prices else spot * 0.85) * 0.98
    price_hi = max(hi_99, max(hist_prices) if hist_prices else spot * 1.15) * 1.02
    ax.set_ylim(price_lo, price_hi)

    # Legend
    ax.legend(loc="upper left", fontsize=7, framealpha=0.7,
              edgecolor=T["border_light"], fancybox=False)


# ======================================================================
# Draw individual options as background vertical bars
# ======================================================================

def _draw_options_bars(ax, calls, puts, spot, future_dates, expiry_x):
    """
    Draw each option contract as a thin horizontal bar at its strike
    price, spanning the future projection area. Colour intensity maps
    to volume + open interest.
    Calls → teal shades, Puts → warm copper shades.
    """
    rows = []
    for _, r in calls.iterrows():
        vol = max(r.get("volume", 0) or 0, 0)
        oi  = max(r.get("openInterest", 0) or 0, 0)
        if vol + oi > 0:
            rows.append({"strike": r["strike"], "activity": vol + oi, "type": "call"})
    for _, r in puts.iterrows():
        vol = max(r.get("volume", 0) or 0, 0)
        oi  = max(r.get("openInterest", 0) or 0, 0)
        if vol + oi > 0:
            rows.append({"strike": r["strike"], "activity": vol + oi, "type": "put"})

    if not rows:
        return

    df = pd.DataFrame(rows)

    # Normalise activity to 0-1
    max_act = df["activity"].max()
    if max_act <= 0:
        return
    df["norm"] = df["activity"] / max_act

    # Colour maps: calls → teal, puts → copper
    call_cmap = mcolors.LinearSegmentedColormap.from_list(
        "call_vol", [T["bg"], "#b8d4cc", T["accent"], "#2d4a42"], N=256
    )
    put_cmap = mcolors.LinearSegmentedColormap.from_list(
        "put_vol", [T["bg"], "#e8ddd0", T["accent_warm"], "#8c5530"], N=256
    )

    # Bar x-range: from first future date to expiry
    if len(future_dates) >= 2:
        bar_start = future_dates[0]
        bar_end = future_dates[-1]
    else:
        bar_start = expiry_x - timedelta(days=1)
        bar_end = expiry_x

    # Bar height based on strike spacing
    strikes = sorted(df["strike"].unique())
    if len(strikes) >= 2:
        spacings = np.diff(strikes)
        bar_h = float(np.median(spacings)) * 0.85
    else:
        bar_h = spot * 0.005

    for _, row in df.iterrows():
        k = row["strike"]
        norm = row["norm"]
        cmap = call_cmap if row["type"] == "call" else put_cmap

        # Alpha scales with activity: min 0.04, max 0.55
        alpha = 0.04 + norm * 0.51
        colour = cmap(norm)

        ax.fill_between(
            [bar_start, bar_end],
            k - bar_h / 2,
            k + bar_h / 2,
            color=colour,
            alpha=alpha,
            linewidth=0,
            zorder=1,
        )

    # Small annotation
    ax.annotate("bars = option vol + OI  (teal = calls, copper = puts)",
                xy=(0.99, 0.01), xycoords="axes fraction",
                fontsize=6, color=T["text_muted"], ha="right", va="bottom",
                fontstyle="italic")


# ======================================================================
# Draw the projection fan (percentile bands)
# ======================================================================

def _draw_projection_fan(ax, dist, pctiles, spot, anchor, future_dates, expiry_x):
    """
    Draw expanding bands from spot price today to the implied
    distribution at expiry. Bands = 10-90, 25-75 percentiles, and median.
    At expiry, draw a sideways PDF curve.
    """
    if not future_dates:
        return

    n_steps = len(future_dates)
    dates_arr = [anchor] + future_dates

    # Percentile levels at expiry
    p10 = pctiles.get(10, spot)
    p25 = pctiles.get(25, spot)
    p50 = pctiles.get(50, spot)
    p75 = pctiles.get(75, spot)
    p90 = pctiles.get(90, spot)

    # Linearly interpolate from spot to each percentile
    def interp(target):
        return [spot + (target - spot) * (i / n_steps) for i in range(n_steps + 1)]

    band_10 = interp(p10)
    band_25 = interp(p25)
    band_50 = interp(p50)
    band_75 = interp(p75)
    band_90 = interp(p90)

    # 10-90 band (outer)
    ax.fill_between(dates_arr, band_10, band_90,
                    color=T["accent"], alpha=0.06, zorder=2, label="10th–90th pct")
    # 25-75 band (inner)
    ax.fill_between(dates_arr, band_25, band_75,
                    color=T["accent"], alpha=0.12, zorder=2, label="25th–75th pct")
    # Median line
    ax.plot(dates_arr, band_50,
            color=T["accent"], ls="--", lw=1.2, alpha=0.7, zorder=4, label="Median")

    # At expiry, draw the PDF as a rotated filled curve (sideways)
    K = dist["strikes"]
    pdf = dist["pdf"]

    # Scale PDF to span ~12% of the total x-axis width
    total_width = (dates_arr[-1] - dates_arr[0]).total_seconds()
    pdf_width_secs = total_width * 0.12

    pdf_max = pdf.max()
    if pdf_max > 0:
        pdf_scaled = pdf / pdf_max * pdf_width_secs

        pdf_dates = [expiry_x + timedelta(seconds=float(s)) for s in pdf_scaled]
        base_dates = [expiry_x] * len(K)

        ax.fill_betweenx(K, base_dates, pdf_dates,
                         color=T["accent"], alpha=0.15, zorder=2)
        ax.plot(pdf_dates, K,
                color=T["accent"], lw=1, alpha=0.5, zorder=3)


# ======================================================================
# IV Smile
# ======================================================================

def _plot_iv_smile(ax, iv_df, spot):
    if iv_df is None or iv_df.empty:
        ax.text(0.5, 0.5, "No IV data", ha="center", va="center",
                transform=ax.transAxes, color=T["text_muted"])
        return

    call_iv = iv_df[iv_df["type"] == "call"]
    put_iv  = iv_df[iv_df["type"] == "put"]

    ax.scatter(call_iv["strike"], call_iv["iv"] * 100,
               s=16, color=T["accent"], alpha=0.7, label="Calls", zorder=3,
               edgecolors="none")
    ax.scatter(put_iv["strike"], put_iv["iv"] * 100,
               s=16, color=T["accent_warm"], alpha=0.7, label="Puts", zorder=3,
               edgecolors="none")

    ax.axvline(spot, color=T["text"], ls="--", lw=0.7, alpha=0.35)

    ax.set_title("Implied Volatility Smile", fontsize=10, color=T["text"], loc="left")
    ax.set_xlabel("Strike")
    ax.set_ylabel("IV (%)")
    ax.yaxis.set_major_formatter(mtick.FormatStrFormatter("%.0f%%"))
    ax.legend(fontsize=7, framealpha=0.7, edgecolor=T["border_light"], fancybox=False)
    ax.grid(True, alpha=0.35)


# ======================================================================
# Summary stats table
# ======================================================================

def _plot_summary_table(ax, ticker, expiry, spot, dist, em, probs, pctiles, mp):
    ax.axis("off")
    ax.set_title("Summary", fontsize=10, color=T["text"], loc="left")

    lines = [
        ("Ticker",          ticker),
        ("Expiry",          expiry),
        ("Spot Price",      f"${spot:,.2f}"),
        ("", ""),
        ("Expected (mean)", f"${dist['mean']:,.2f}"),
        ("Median",          f"${dist['median']:,.2f}"),
        ("Std Dev",         f"${dist['std']:,.2f}"),
        ("Skewness",        f"{dist['skew']:+.3f}"),
        ("", ""),
        ("ATM Straddle",    f"${em['straddle']:,.2f}"),
        ("Expected Move",   f"±${em['move_abs']:,.2f}  ({em['move_pct']:.1f}%)"),
        ("Range",           f"${em['lower']:,.2f} – ${em['upper']:,.2f}"),
        ("Max Pain",        f"${mp:,.2f}" if not np.isnan(mp) else "N/A"),
        ("", ""),
        ("P(above spot)",   f"{probs['prob_above']*100:.1f}%"),
        ("P(below spot)",   f"{probs['prob_below']*100:.1f}%"),
        ("", ""),
    ]

    for p, val in sorted(pctiles.items()):
        lines.append((f"{p}th pctile", f"${val:,.2f}"))

    y = 0.95
    for label, value in lines:
        if label == "":
            y -= 0.02
            continue
        ax.text(0.02, y, label, fontsize=8, color=T["text_muted"],
                transform=ax.transAxes, va="top", fontfamily="sans-serif")
        ax.text(0.58, y, value, fontsize=8, color=T["text"],
                transform=ax.transAxes, va="top", fontfamily="sans-serif",
                fontweight="500")
        y -= 0.042
