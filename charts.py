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
        font=dict(color=THEME["text"], size=14),
    ),
)


def _axis_style():
    return dict(
        gridcolor=THEME["border_light"],
        gridwidth=0.5,
        linecolor=THEME["border"],
        linewidth=1,
        tickfont=dict(color=THEME["text_muted"], size=13),
        title_font=dict(color=THEME["text_light"], size=14),
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
        # Limit history to at most 2x DTE trading days for a balanced chart
        max_hist = max(dte_days * 2, 30)
        hist_data = history.tail(max_hist)
        hist_dates = [d.to_pydatetime() if hasattr(d, 'to_pydatetime') else d
                      for d in hist_data.index]
        hist_dates = [d.replace(tzinfo=None) if hasattr(d, 'tzinfo') and d.tzinfo else d
                      for d in hist_dates]
        hist_prices = hist_data["Close"].values.tolist()

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
                       font=dict(size=13, color=THEME["text"]), showarrow=False)
    # Mean
    fig.add_hline(y=dist["mean"], line=dict(color=THEME["accent"], width=1, dash="dashdot"), opacity=0.4)
    fig.add_annotation(text=f"Mean ${dist['mean']:,.2f}", x=1.01, y=dist["mean"],
                       xref="paper", yref="y", xanchor="left",
                       font=dict(size=13, color=THEME["accent"]), showarrow=False)
    # Max pain
    if not np.isnan(mp) and abs(mp - spot) / spot < 0.25:
        fig.add_hline(y=mp, line=dict(color=THEME["accent_warm"], width=1, dash="dot"), opacity=0.35)
        fig.add_annotation(text=f"Max Pain ${mp:,.2f}", x=1.01, y=mp,
                           xref="paper", yref="y", xanchor="left",
                           font=dict(size=13, color=THEME["accent_warm"]), showarrow=False)

    # "Now" divider
    fig.add_vline(x=anchor, line=dict(color=THEME["border"], width=1.5), opacity=0.6)
    fig.add_annotation(text="now", x=anchor, y=1.03,
                       xref="x", yref="paper",
                       font=dict(size=13, color=THEME["text_muted"]), showarrow=False)

    # ------------------------------------------------------------------
    # Layout
    # ------------------------------------------------------------------
    # Let Plotly autoscale the Y-axis (avoid custom data scaling)

    fig.update_layout(
        **LAYOUT_DEFAULTS,
        title=dict(text=f"<b>{ticker}</b>  \u2014  Forecast to {expiry}",
                   font=dict(size=17, color=THEME["text"]), x=0.01),
        xaxis=dict(**_axis_style(), title=""),
        yaxis=dict(**_axis_style(), title="Price ($)", tickprefix="$",
               autorange=True),
        showlegend=True,
        legend=dict(
            bgcolor="rgba(247,245,240,0.90)",
            bordercolor=THEME["border_light"],
            borderwidth=1,
            font=dict(size=13),
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
            font=dict(size=13, color=colour),
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
    cdf = dist["cdf"]

    # 95% range for default view (2.5th – 97.5th percentile)
    p025 = K[np.searchsorted(cdf, 0.025)]
    p975 = K[min(np.searchsorted(cdf, 0.975), len(K) - 1)]

    # ------------------------------------------------------------------
    # Shaded 95% band under the PDF
    # ------------------------------------------------------------------
    mask_95 = (K >= p025) & (K <= p975)
    K_95 = K[mask_95]
    pdf_95 = pdf[mask_95]
    if len(K_95) > 0:
        fig.add_trace(go.Scatter(
            x=np.concatenate([[K_95[0]], K_95, [K_95[-1]]]),
            y=np.concatenate([[0], pdf_95, [0]]),
            fill="toself",
            fillcolor="rgba(77,106,97,0.12)",
            line=dict(width=0),
            mode="lines",
            name="95% range",
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

    # Offset annotations to avoid overlap when Spot/Mean/MaxPain are close
    level_annotations = [
        ("Spot", spot, spot, THEME["text"]),
        ("Mean", mean, mean, THEME["accent"]),
    ]
    if not np.isnan(mp) and abs(mp - spot) / spot < 0.25:
        level_annotations.append(("Max Pain", mp, mp, THEME["accent_warm"]))

    # Sort by price value and stagger y-positions to avoid text overlap
    level_annotations.sort(key=lambda t: t[1])
    y_positions = [1.12, 1.02, 0.92]  # staggered multipliers of y_max
    for i, (lbl, val, _, colour) in enumerate(level_annotations):
        y_pos = y_max * y_positions[i] if i < len(y_positions) else y_max * 0.82
        fig.add_vline(x=val,
                      line=dict(color=colour, width=1.5,
                                dash="dash" if lbl == "Spot" else
                                     "dashdot" if lbl == "Mean" else "dot"),
                      opacity=0.5 if lbl == "Spot" else 0.4)
        fig.add_annotation(text=f"{lbl} ${val:,.2f}", x=val, y=y_pos,
                           xref="x", yref="y", showarrow=False,
                           font=dict(size=12, color=colour))

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
            font=dict(size=12, color=colour),
        )

    # ------------------------------------------------------------------
    # Layout — allow Plotly to autoscale the X-axis (no custom scaling)
    # ------------------------------------------------------------------
    _sm_layout = {**LAYOUT_DEFAULTS, "margin": dict(l=65, r=30, t=80, b=65)}
    fig.update_layout(
        **_sm_layout,
        title=dict(text="<b>Implied Price Distribution</b>",
                   font=dict(size=16, color=THEME["text"]), x=0.01),
        xaxis=dict(**_axis_style(), title="Price ($)", tickprefix="$", autorange=True),
        yaxis=dict(**_axis_style(), title="Probability Density",
                   showticklabels=False),
        showlegend=True,
        legend=dict(bgcolor="rgba(247,245,240,0.90)", bordercolor=THEME["border_light"],
                    borderwidth=1, font=dict(size=12),
                    orientation="h",
                    x=0.5, xanchor="center", y=1.0, yanchor="bottom"),
        height=360,
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
                       font=dict(size=12, color=THEME["text_light"]))

    _sm_layout = {**LAYOUT_DEFAULTS, "margin": dict(l=65, r=30, t=80, b=55)}
    fig.update_layout(
        **_sm_layout,
        title=dict(text="<b>Implied Volatility Smile</b>",
                   font=dict(size=16, color=THEME["text"]), x=0.01),
        xaxis=dict(**_axis_style(), title="Strike ($)", tickprefix="$"),
        yaxis=dict(**_axis_style(), title="Implied Volatility (%)", ticksuffix="%"),
        showlegend=True,
        legend=dict(bgcolor="rgba(247,245,240,0.90)", bordercolor=THEME["border_light"],
                    borderwidth=1, font=dict(size=12),
                    orientation="h",
                    x=0.5, xanchor="center", y=1.0, yanchor="bottom"),
        height=360,
        hovermode="x unified",
    )

    return fig


# ======================================================================
# Open Interest chart
# ======================================================================

def build_oi_chart(calls: pd.DataFrame, puts: pd.DataFrame, spot: float) -> go.Figure:
    """Bar chart showing open interest + volume at each strike."""
    fig = go.Figure()

    # ---- Prepare data: combine OI and volume per strike ----
    def _prepare(df, opt_type):
        d = df[["strike"]].copy()
        d["openInterest"] = pd.to_numeric(df["openInterest"], errors="coerce").fillna(0)
        d["volume"] = pd.to_numeric(df.get("volume", 0), errors="coerce").fillna(0)
        d["type"] = opt_type
        return d

    c = _prepare(calls, "Call")
    p = _prepare(puts, "Put")

    # Merge on strike to show all strikes that have *any* activity
    all_data = pd.concat([c, p], ignore_index=True)
    all_data["total"] = all_data["openInterest"] + all_data["volume"]

    # If there's nothing at all, show a message
    if all_data["total"].sum() == 0:
        fig.add_annotation(text="No open interest / volume data available",
                           xref="paper", yref="paper", x=0.5, y=0.5,
                           showarrow=False,
                           font=dict(size=14, color=THEME["text_muted"]))
        fig.update_layout(**LAYOUT_DEFAULTS, height=340)
        return fig

    # ---- Calls ----
    c_oi = c[c["openInterest"] > 0]
    c_vol = c[c["volume"] > 0]

    if not c_oi.empty:
        fig.add_trace(go.Bar(
            x=c_oi["strike"], y=c_oi["openInterest"],
            name="Calls OI",
            marker_color=THEME["accent"],
            opacity=0.7,
            hovertemplate="<b>Call</b> $%{x:,.0f}<br>OI: %{y:,.0f}<extra></extra>",
        ))
    if not c_vol.empty:
        fig.add_trace(go.Bar(
            x=c_vol["strike"], y=c_vol["volume"],
            name="Calls Vol",
            marker_color=THEME["accent"],
            opacity=0.35,
            hovertemplate="<b>Call</b> $%{x:,.0f}<br>Vol: %{y:,.0f}<extra></extra>",
        ))

    # ---- Puts ----
    p_oi = p[p["openInterest"] > 0]
    p_vol = p[p["volume"] > 0]

    if not p_oi.empty:
        fig.add_trace(go.Bar(
            x=p_oi["strike"], y=p_oi["openInterest"],
            name="Puts OI",
            marker_color=THEME["accent_warm"],
            opacity=0.7,
            hovertemplate="<b>Put</b> $%{x:,.0f}<br>OI: %{y:,.0f}<extra></extra>",
        ))
    if not p_vol.empty:
        fig.add_trace(go.Bar(
            x=p_vol["strike"], y=p_vol["volume"],
            name="Puts Vol",
            marker_color=THEME["accent_warm"],
            opacity=0.35,
            hovertemplate="<b>Put</b> $%{x:,.0f}<br>Vol: %{y:,.0f}<extra></extra>",
        ))

    fig.add_vline(x=spot, line=dict(color=THEME["text"], width=1, dash="dash"),
                  opacity=0.4)
    fig.add_annotation(text=f"Spot ${spot:,.2f}", x=spot, y=1.05,
                       xref="x", yref="paper", showarrow=False,
                       font=dict(size=12, color=THEME["text_light"]))

    _sm_layout = {**LAYOUT_DEFAULTS, "margin": dict(l=65, r=30, t=80, b=55)}
    fig.update_layout(
        **_sm_layout,
        title=dict(text="<b>Open Interest & Volume by Strike</b>",
                   font=dict(size=16, color=THEME["text"]), x=0.01),
        xaxis=dict(**_axis_style(), title="Strike ($)", tickprefix="$"),
        yaxis=dict(**_axis_style(), title="Contracts"),
        barmode="group",
        showlegend=True,
        legend=dict(bgcolor="rgba(247,245,240,0.90)", bordercolor=THEME["border_light"],
                    borderwidth=1, font=dict(size=12),
                    orientation="h",
                    x=0.5, xanchor="center", y=1.0, yanchor="bottom"),
        height=360,
        hovermode="x unified",
    )

    return fig
