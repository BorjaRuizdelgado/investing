"""
charts.py – Interactive Plotly charts styled to match borjaruizdelgado.com

Builds a single rich, interactive chart:
  • Past N days of price history
  • Options as coloured bars (by volume + OI) in the projection zone
  • Expanding projection cone (10-90, 25-75 percentile bands)
  • Sideways implied probability distribution at expiry
  • Key levels: spot, mean, max-pain
  • IV smile as a secondary chart
"""

import numpy as np
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from datetime import datetime, timedelta

# ======================================================================
# Theme — matches borjaruizdelgado.com CSS variables
# ======================================================================
THEME = {
    "bg":          "#f7f5f0",
    "bg_alt":      "#efece5",
    "text":        "#1c1c1c",
    "text_light":  "#5a5a5a",
    "text_muted":  "#9a9a9a",
    "accent":      "#4d6a61",
    "accent_warm": "#c08050",
    "border":      "#d8d4cc",
    "border_light":"#e8e5de",
    "green":       "#3d7a5a",
    "red":         "#b05040",
}

LAYOUT_DEFAULTS = dict(
    paper_bgcolor=THEME["bg"],
    plot_bgcolor=THEME["bg"],
    font=dict(family="DM Sans, Helvetica Neue, Helvetica, Arial, sans-serif",
              color=THEME["text"], size=14),
    margin=dict(l=65, r=130, t=55, b=55),
    hoverlabel=dict(
        bgcolor=THEME["bg_alt"],
        bordercolor=THEME["border"],
        font=dict(color=THEME["text"], size=13),
    ),
)


def _axis_style():
    return dict(
        gridcolor=THEME["border_light"],
        gridwidth=0.5,
        linecolor=THEME["border"],
        linewidth=1,
        tickfont=dict(color=THEME["text_muted"], size=12),
        title_font=dict(color=THEME["text_light"], size=13),
        zeroline=False,
    )


# ======================================================================
# Main forecast chart
# ======================================================================

def build_forecast_chart(
    ticker: str,
    expiry: str,
    spot: float,
    dist: dict,
    em: dict,
    pctiles: dict,
    mp: float,
    calls: pd.DataFrame,
    puts: pd.DataFrame,
    history: pd.DataFrame | None,
    days_to_expiry: float,
) -> go.Figure:
    """Build the main interactive price forecast chart."""

    fig = go.Figure()
    dte_days = max(int(np.ceil(days_to_expiry)), 1)

    # ------------------------------------------------------------------
    # Dates setup
    # ------------------------------------------------------------------
    hist_dates, hist_prices = [], []
    if history is not None and not history.empty:
        hist_dates = [d.to_pydatetime() if hasattr(d, 'to_pydatetime') else d
                      for d in history.index]
        hist_dates = [d.replace(tzinfo=None) if hasattr(d, 'tzinfo') and d.tzinfo else d
                      for d in hist_dates]
        hist_prices = history["Close"].values.tolist()

    anchor = hist_dates[-1] if hist_dates else datetime.now()
    expiry_dt = datetime.strptime(expiry, "%Y-%m-%d")

    # Future trading dates
    future_dates = []
    d = anchor + timedelta(days=1)
    while len(future_dates) < dte_days and d <= expiry_dt + timedelta(days=1):
        if d.weekday() < 5:
            future_dates.append(d)
        d += timedelta(days=1)
    if not future_dates:
        future_dates = [anchor + timedelta(days=i+1) for i in range(max(dte_days, 2))]

    # ------------------------------------------------------------------
    # 1) PROJECTION FAN — percentile bands expanding from spot to expiry
    # ------------------------------------------------------------------
    _add_projection_fan(fig, dist, pctiles, spot, anchor, future_dates)

    # ------------------------------------------------------------------
    # 3) HISTORICAL PRICE LINE
    # ------------------------------------------------------------------
    if hist_dates and hist_prices:
        fig.add_trace(go.Scatter(
            x=hist_dates, y=hist_prices,
            mode="lines",
            line=dict(color=THEME["accent"], width=2.5),
            name="Historical price",
            hovertemplate="<b>%{x|%b %d}</b><br>$%{y:,.2f}<extra></extra>",
        ))
        # Current price dot
        fig.add_trace(go.Scatter(
            x=[hist_dates[-1]], y=[hist_prices[-1]],
            mode="markers",
            marker=dict(color=THEME["accent"], size=8, line=dict(color="white", width=1.5)),
            name=f"Current ${spot:,.2f}",
            hovertemplate=f"<b>Current Price</b><br>${spot:,.2f}<extra></extra>",
        ))

    # ------------------------------------------------------------------
    # 3) KEY LEVELS — horizontal lines
    # ------------------------------------------------------------------
    all_dates = hist_dates + future_dates
    xmin = min(all_dates) if all_dates else anchor - timedelta(days=30)
    xmax = max(all_dates) if all_dates else anchor + timedelta(days=30)

    # Spot
    fig.add_hline(y=spot, line=dict(color=THEME["text"], width=1, dash="dash"), opacity=0.5)
    fig.add_annotation(text=f"Spot ${spot:,.2f}", x=1.01, y=spot,
                       xref="paper", yref="y", xanchor="left",
                       font=dict(size=12, color=THEME["text"]), showarrow=False)
    # Mean
    fig.add_hline(y=dist["mean"], line=dict(color=THEME["accent"], width=1, dash="dashdot"), opacity=0.4)
    fig.add_annotation(text=f"Mean ${dist['mean']:,.2f}", x=1.01, y=dist["mean"],
                       xref="paper", yref="y", xanchor="left",
                       font=dict(size=11, color=THEME["accent"]), showarrow=False)
    # Max pain
    if not np.isnan(mp) and abs(mp - spot) / spot < 0.25:
        fig.add_hline(y=mp, line=dict(color=THEME["accent_warm"], width=1, dash="dot"), opacity=0.35)
        fig.add_annotation(text=f"Max Pain ${mp:,.2f}", x=1.01, y=mp,
                           xref="paper", yref="y", xanchor="left",
                           font=dict(size=11, color=THEME["accent_warm"]), showarrow=False)

    # "Now" divider
    fig.add_vline(x=anchor, line=dict(color=THEME["border"], width=1.5), opacity=0.6)
    fig.add_annotation(text="now", x=anchor, y=1.03,
                       xref="x", yref="paper",
                       font=dict(size=12, color=THEME["text_muted"]), showarrow=False)

    # ------------------------------------------------------------------
    # Layout
    # ------------------------------------------------------------------
    # Y-axis range to include distribution tails + history
    K, cdf = dist["strikes"], dist["cdf"]
    lo_99 = K[np.searchsorted(cdf, 0.01)]
    hi_99 = K[min(np.searchsorted(cdf, 0.99), len(K) - 1)]
    price_lo = min(lo_99, min(hist_prices) if hist_prices else spot * 0.85) * 0.97
    price_hi = max(hi_99, max(hist_prices) if hist_prices else spot * 1.15) * 1.03

    fig.update_layout(
        **LAYOUT_DEFAULTS,
        title=dict(text=f"<b>{ticker}</b>  —  Forecast to {expiry}",
                   font=dict(size=17, color=THEME["text"]), x=0.01),
        xaxis=dict(**_axis_style(), title=""),
        yaxis=dict(**_axis_style(), title="Price ($)", tickprefix="$",
                   range=[price_lo, price_hi]),
        showlegend=True,
        legend=dict(
            bgcolor="rgba(247,245,240,0.90)",
            bordercolor=THEME["border_light"],
            borderwidth=1,
            font=dict(size=12),
            x=0.01, y=0.99,
            xanchor="left", yanchor="top",
        ),
        height=560,
        hovermode="x unified",
    )

    return fig


# ======================================================================
# Options bars
# ======================================================================

def _add_options_bars(fig, calls, puts, spot, future_dates):
    """
    Draw each option as a semi-transparent horizontal bar at its strike.
    Colour: calls = teal, puts = copper. Opacity = normalised volume+OI.
    """
    if future_dates and len(future_dates) >= 2:
        bar_x0 = future_dates[0]
        bar_x1 = future_dates[-1]
    else:
        return

    rows = []
    for _, r in calls.iterrows():
        vol = max(r.get("volume", 0) or 0, 0)
        oi = max(r.get("openInterest", 0) or 0, 0)
        activity = vol + oi
        if activity > 0:
            rows.append({"strike": r["strike"], "activity": activity, "vol": vol,
                         "oi": oi, "type": "Call", "iv": r.get("impliedVolatility", 0)})
    for _, r in puts.iterrows():
        vol = max(r.get("volume", 0) or 0, 0)
        oi = max(r.get("openInterest", 0) or 0, 0)
        activity = vol + oi
        if activity > 0:
            rows.append({"strike": r["strike"], "activity": activity, "vol": vol,
                         "oi": oi, "type": "Put", "iv": r.get("impliedVolatility", 0)})

    if not rows:
        return

    df = pd.DataFrame(rows)
    max_act = df["activity"].max()
    if max_act <= 0:
        return

    # Strike spacing for bar height
    strikes = sorted(df["strike"].unique())
    bar_h = np.median(np.diff(strikes)) * 0.8 if len(strikes) >= 2 else spot * 0.005

    # Group: show one bar per strike per type, so we loop over unique combos
    for _, row in df.iterrows():
        k = row["strike"]
        norm = row["activity"] / max_act
        is_call = row["type"] == "Call"

        # Opacity: 0.08 minimum → 0.70 maximum
        alpha = 0.08 + norm * 0.62
        colour = THEME["accent"] if is_call else THEME["accent_warm"]

        fig.add_shape(
            type="rect",
            x0=bar_x0, x1=bar_x1,
            y0=k - bar_h / 2, y1=k + bar_h / 2,
            fillcolor=colour,
            opacity=alpha,
            line_width=0,
            layer="below",
        )

    # Invisible hover traces so users can inspect option details on hover
    for opt_type, colour in [("Call", THEME["accent"]), ("Put", THEME["accent_warm"])]:
        sub = df[df["type"] == opt_type]
        if sub.empty:
            continue
        mid_x = future_dates[len(future_dates) // 2]
        fig.add_trace(go.Scatter(
            x=[mid_x] * len(sub),
            y=sub["strike"].values,
            mode="markers",
            marker=dict(color="rgba(0,0,0,0)", size=0),
            showlegend=False,
            customdata=np.stack([sub["vol"].values, sub["oi"].values,
                                 sub["activity"].values,
                                 sub["iv"].values * 100], axis=-1),
            hovertemplate=(
                f"<b>{opt_type}</b> $%{{y:,.0f}}<br>"
                "Vol: %{customdata[0]:,.0f}<br>"
                "OI: %{customdata[1]:,.0f}<br>"
                "Total: %{customdata[2]:,.0f}<br>"
                "IV: %{customdata[3]:.1f}%"
                "<extra></extra>"
            ),
        ))


# ======================================================================
# Projection fan
# ======================================================================

def _add_projection_fan(fig, dist, pctiles, spot, anchor, future_dates):
    """Percentile bands expanding from spot → expiry."""
    if not future_dates:
        return

    n = len(future_dates)
    dates_arr = [anchor] + future_dates

    p10 = pctiles.get(10, spot)
    p25 = pctiles.get(25, spot)
    p50 = pctiles.get(50, spot)
    p75 = pctiles.get(75, spot)
    p90 = pctiles.get(90, spot)

    def interp(target):
        return [spot + (target - spot) * (i / n) for i in range(n + 1)]

    b10, b25, b50, b75, b90 = interp(p10), interp(p25), interp(p50), interp(p75), interp(p90)

    # 10-90 band (outer)
    fig.add_trace(go.Scatter(
        x=dates_arr + dates_arr[::-1],
        y=b90 + b10[::-1],
        fill="toself",
        fillcolor="rgba(77,106,97,0.08)",
        line=dict(width=0),
        mode="none",
        name="Likely range (80%)",
        hoverinfo="skip",
        showlegend=True,
    ))

    # 25-75 band (inner)
    fig.add_trace(go.Scatter(
        x=dates_arr + dates_arr[::-1],
        y=b75 + b25[::-1],
        fill="toself",
        fillcolor="rgba(77,106,97,0.15)",
        line=dict(width=0),
        mode="none",
        name="Most likely range (50%)",
        hoverinfo="skip",
        showlegend=True,
    ))

    # Median line
    fig.add_trace(go.Scatter(
        x=dates_arr, y=b50,
        mode="lines",
        line=dict(color=THEME["accent"], width=2, dash="dash"),
        name=f"Median forecast ${p50:,.2f}",
        hovertemplate="<b>Median</b><br>$%{y:,.2f}<extra></extra>",
    ))

    # Endpoint price labels in the right margin
    for label, val, colour in [
        ("90th", p90, THEME["green"]),
        ("75th", p75, THEME["accent"]),
        ("50th", p50, THEME["accent"]),
        ("25th", p25, THEME["accent_warm"]),
        ("10th", p10, THEME["red"]),
    ]:
        fig.add_annotation(
            x=1.01, y=val,
            xref="paper", yref="y",
            text=f"{label}: ${val:,.0f}",
            showarrow=False,
            font=dict(size=11, color=colour),
            xanchor="left",
        )


# ======================================================================
# Sideways PDF at expiry
# ======================================================================

def _add_pdf_at_expiry(fig, dist, future_dates, anchor):
    """Draw the probability density as a rotated filled curve at expiry."""
    if not future_dates:
        return

    K = dist["strikes"]
    pdf = dist["pdf"]
    pdf_max = pdf.max()
    if pdf_max <= 0:
        return

    expiry_x = future_dates[-1]
    total_secs = (future_dates[-1] - anchor).total_seconds()
    pdf_width_secs = total_secs * 0.15

    pdf_scaled = pdf / pdf_max * pdf_width_secs
    pdf_dates = [expiry_x + timedelta(seconds=float(s)) for s in pdf_scaled]
    base_dates = [expiry_x] * len(K)

    fig.add_trace(go.Scatter(
        x=list(base_dates) + list(reversed(pdf_dates)),
        y=list(K) + list(reversed(K)),
        fill="toself",
        fillcolor=f"rgba(77,106,97,0.18)",
        line=dict(color=THEME["accent"], width=1),
        mode="lines",
        name="Implied price distribution",
        hoverinfo="skip",
        showlegend=True,
    ))


# ======================================================================
# Implied Distribution chart
# ======================================================================

def build_distribution_chart(
    dist: dict,
    spot: float,
    pctiles: dict,
    mp: float,
    calls: pd.DataFrame,
    puts: pd.DataFrame,
) -> go.Figure:
    """
    Standalone chart showing the options-implied probability distribution.
    X-axis: strike/price, Y-axis: probability density.
    Shaded regions for percentile bands, with key levels marked.
    """
    fig = go.Figure()

    K = dist["strikes"]
    pdf = dist["pdf"]

    if pdf.max() <= 0:
        fig.add_annotation(text="No distribution data", xref="paper", yref="paper",
                           x=0.5, y=0.5, showarrow=False,
                           font=dict(size=14, color=THEME["text_muted"]))
        fig.update_layout(**LAYOUT_DEFAULTS, height=340)
        return fig

    # Percentile values
    p10 = pctiles.get(10, spot)
    p25 = pctiles.get(25, spot)
    p75 = pctiles.get(75, spot)
    p90 = pctiles.get(90, spot)
    mean = dist["mean"]

    # ------------------------------------------------------------------
    # Shaded bands under the PDF
    # ------------------------------------------------------------------
    # 10-90 band (outer) — light fill
    mask_outer = (K >= p10) & (K <= p90)
    K_outer = K[mask_outer]
    pdf_outer = pdf[mask_outer]
    if len(K_outer) > 0:
        fig.add_trace(go.Scatter(
            x=np.concatenate([[K_outer[0]], K_outer, [K_outer[-1]]]),
            y=np.concatenate([[0], pdf_outer, [0]]),
            fill="toself",
            fillcolor="rgba(77,106,97,0.10)",
            line=dict(width=0),
            mode="lines",
            name="80% range (10th–90th)",
            hoverinfo="skip",
        ))

    # 25-75 band (inner) — darker fill
    mask_inner = (K >= p25) & (K <= p75)
    K_inner = K[mask_inner]
    pdf_inner = pdf[mask_inner]
    if len(K_inner) > 0:
        fig.add_trace(go.Scatter(
            x=np.concatenate([[K_inner[0]], K_inner, [K_inner[-1]]]),
            y=np.concatenate([[0], pdf_inner, [0]]),
            fill="toself",
            fillcolor="rgba(77,106,97,0.20)",
            line=dict(width=0),
            mode="lines",
            name="50% range (25th–75th)",
            hoverinfo="skip",
        ))

    # ------------------------------------------------------------------
    # PDF curve
    # ------------------------------------------------------------------
    fig.add_trace(go.Scatter(
        x=K, y=pdf,
        mode="lines",
        line=dict(color=THEME["accent"], width=2),
        name="Implied density",
        hovertemplate="$%{x:,.2f}<br>Density: %{y:.4f}<extra></extra>",
    ))

    # ------------------------------------------------------------------
    # Key levels as vertical lines
    # ------------------------------------------------------------------
    y_max = pdf.max()

    # Spot
    fig.add_vline(x=spot, line=dict(color=THEME["text"], width=1.5, dash="dash"), opacity=0.6)
    fig.add_annotation(text=f"Spot ${spot:,.2f}", x=spot, y=y_max * 1.08,
                       xref="x", yref="y", showarrow=False,
                       font=dict(size=11, color=THEME["text"]))

    # Mean
    fig.add_vline(x=mean, line=dict(color=THEME["accent"], width=1.5, dash="dashdot"), opacity=0.5)
    fig.add_annotation(text=f"Mean ${mean:,.2f}", x=mean, y=y_max * 0.98,
                       xref="x", yref="y", showarrow=False,
                       font=dict(size=10, color=THEME["accent"]))

    # Max pain
    if not np.isnan(mp) and abs(mp - spot) / spot < 0.25:
        fig.add_vline(x=mp, line=dict(color=THEME["accent_warm"], width=1, dash="dot"), opacity=0.4)
        fig.add_annotation(text=f"Max Pain ${mp:,.2f}", x=mp, y=y_max * 0.88,
                           xref="x", yref="y", showarrow=False,
                           font=dict(size=10, color=THEME["accent_warm"]))

    # Percentile markers at the bottom
    for label, val, colour in [
        ("10th", p10, THEME["red"]),
        ("25th", p25, THEME["accent_warm"]),
        ("75th", p75, THEME["accent"]),
        ("90th", p90, THEME["green"]),
    ]:
        fig.add_annotation(
            text=f"{label}<br>${val:,.0f}",
            x=val, y=0,
            xref="x", yref="y",
            showarrow=True,
            arrowhead=0, arrowwidth=1, arrowcolor=colour,
            ax=0, ay=30,
            font=dict(size=10, color=colour),
        )

    # ------------------------------------------------------------------
    # Layout
    # ------------------------------------------------------------------
    cdf = dist["cdf"]
    lo_01 = K[np.searchsorted(cdf, 0.01)]
    hi_99 = K[min(np.searchsorted(cdf, 0.99), len(K) - 1)]

    _sm_layout = {**LAYOUT_DEFAULTS, "margin": dict(l=65, r=30, t=55, b=55)}
    fig.update_layout(
        **_sm_layout,
        title=dict(text="<b>Implied Price Distribution</b>",
                   font=dict(size=15, color=THEME["text"]), x=0.01),
        xaxis=dict(**_axis_style(), title="Price ($)", tickprefix="$",
                   range=[lo_01 * 0.98, hi_99 * 1.02]),
        yaxis=dict(**_axis_style(), title="Probability Density",
                   showticklabels=False),
        showlegend=True,
        legend=dict(bgcolor="rgba(247,245,240,0.90)", bordercolor=THEME["border_light"],
                    borderwidth=1, font=dict(size=12)),
        height=340,
        hovermode="x unified",
    )

    return fig


# ======================================================================
# IV Smile chart
# ======================================================================

def build_iv_smile_chart(iv_df: pd.DataFrame, spot: float) -> go.Figure:
    """Build an interactive IV smile chart."""
    fig = go.Figure()

    if iv_df is None or iv_df.empty:
        fig.add_annotation(text="No IV data available", xref="paper", yref="paper",
                           x=0.5, y=0.5, showarrow=False,
                           font=dict(size=14, color=THEME["text_muted"]))
        fig.update_layout(**LAYOUT_DEFAULTS, height=300)
        return fig

    call_iv = iv_df[iv_df["type"] == "call"]
    put_iv = iv_df[iv_df["type"] == "put"]

    if not call_iv.empty:
        fig.add_trace(go.Scatter(
            x=call_iv["strike"], y=call_iv["iv"] * 100,
            mode="markers+lines",
            marker=dict(color=THEME["accent"], size=6),
            line=dict(color=THEME["accent"], width=1.5),
            name="Calls IV",
            hovertemplate="<b>Call</b> $%{x:,.0f}<br>IV: %{y:.1f}%<extra></extra>",
        ))

    if not put_iv.empty:
        fig.add_trace(go.Scatter(
            x=put_iv["strike"], y=put_iv["iv"] * 100,
            mode="markers+lines",
            marker=dict(color=THEME["accent_warm"], size=6),
            line=dict(color=THEME["accent_warm"], width=1.5),
            name="Puts IV",
            hovertemplate="<b>Put</b> $%{x:,.0f}<br>IV: %{y:.1f}%<extra></extra>",
        ))

    fig.add_vline(x=spot, line=dict(color=THEME["text"], width=1, dash="dash"),
                  opacity=0.4)
    fig.add_annotation(text=f"Spot ${spot:,.2f}", x=spot, y=1.05,
                       xref="x", yref="paper", showarrow=False,
                       font=dict(size=9, color=THEME["text_light"]))

    _sm_layout = {**LAYOUT_DEFAULTS, "margin": dict(l=65, r=30, t=55, b=55)}
    fig.update_layout(
        **_sm_layout,
        title=dict(text="<b>Implied Volatility Smile</b>",
                   font=dict(size=15, color=THEME["text"]), x=0.01),
        xaxis=dict(**_axis_style(), title="Strike ($)", tickprefix="$"),
        yaxis=dict(**_axis_style(), title="Implied Volatility (%)", ticksuffix="%"),
        showlegend=True,
        legend=dict(bgcolor="rgba(247,245,240,0.90)", bordercolor=THEME["border_light"],
                    borderwidth=1, font=dict(size=12)),
        height=340,
        hovermode="x unified",
    )

    return fig


# ======================================================================
# Open Interest chart
# ======================================================================

def build_oi_chart(calls: pd.DataFrame, puts: pd.DataFrame, spot: float) -> go.Figure:
    """Bar chart showing open interest at each strike."""
    fig = go.Figure()

    calls_oi = calls[["strike", "openInterest"]].copy()
    calls_oi["openInterest"] = pd.to_numeric(calls_oi["openInterest"], errors="coerce").fillna(0)
    puts_oi = puts[["strike", "openInterest"]].copy()
    puts_oi["openInterest"] = pd.to_numeric(puts_oi["openInterest"], errors="coerce").fillna(0)
    c_data = calls_oi[calls_oi["openInterest"] > 0].copy()
    p_data = puts_oi[puts_oi["openInterest"] > 0].copy()

    if not c_data.empty:
        fig.add_trace(go.Bar(
            x=c_data["strike"], y=c_data["openInterest"],
            name="Calls OI",
            marker_color=THEME["accent"],
            opacity=0.7,
            hovertemplate="<b>Call</b> $%{x:,.0f}<br>OI: %{y:,.0f}<extra></extra>",
        ))

    if not p_data.empty:
        fig.add_trace(go.Bar(
            x=p_data["strike"], y=p_data["openInterest"],
            name="Puts OI",
            marker_color=THEME["accent_warm"],
            opacity=0.7,
            hovertemplate="<b>Put</b> $%{x:,.0f}<br>OI: %{y:,.0f}<extra></extra>",
        ))

    fig.add_vline(x=spot, line=dict(color=THEME["text"], width=1, dash="dash"),
                  opacity=0.4)
    fig.add_annotation(text=f"Spot ${spot:,.2f}", x=spot, y=1.05,
                       xref="x", yref="paper", showarrow=False,
                       font=dict(size=9, color=THEME["text_light"]))

    _sm_layout = {**LAYOUT_DEFAULTS, "margin": dict(l=65, r=30, t=55, b=55)}
    fig.update_layout(
        **_sm_layout,
        title=dict(text="<b>Open Interest by Strike</b>",
                   font=dict(size=15, color=THEME["text"]), x=0.01),
        xaxis=dict(**_axis_style(), title="Strike ($)", tickprefix="$"),
        yaxis=dict(**_axis_style(), title="Open Interest"),
        barmode="group",
        showlegend=True,
        legend=dict(bgcolor="rgba(247,245,240,0.90)", bordercolor=THEME["border_light"],
                    borderwidth=1, font=dict(size=12)),
        height=340,
        hovermode="x unified",
    )

    return fig
