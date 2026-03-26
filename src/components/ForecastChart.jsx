import React, { useMemo } from 'react'
import Plot from 'react-plotly.js'
import { COLORS, LAYOUT_DEFAULTS, axisStyle, PLOTLY_CONFIG, chartHeight, legendBg } from '../lib/theme.js'
import { buildMaTracesAndAnnotations } from '../lib/ma.js'

/**
 * Main forecast chart: historical price + expanding projection cone.
 */
export default function ForecastChart({
  ticker,
  expiry,
  spot,
  dist,
  em,
  pctiles,
  mp,
  history,
  dte,
  overlays = {},
}) {
  const { data, layout } = useMemo(() => {
    const dteDays = Math.max(Math.ceil(dte), 1)
    const traces = []

    // ---- Dates setup ----
    const maxHist = Math.max(dteDays * 2, 30)
    let histDates = []
    let histPrices = []
    if (history && history.length > 0) {
      const slice = history.slice(-maxHist)
      histDates = slice.map((b) => b.date)
      histPrices = slice.map((b) => b.close)
    }

    const anchor =
      histDates.length > 0 ? histDates[histDates.length - 1] : new Date().toISOString().slice(0, 10)
    const anchorDate = new Date(anchor + 'T00:00:00Z')
    const expiryDate = new Date(expiry + 'T00:00:00Z')

    // Future trading dates (weekdays only) — always extend all the way to expiry,
    // regardless of DTE count, so the cone never stops short when the history
    // anchor is one day behind the current date.
    const futureDates = []
    let d = new Date(anchorDate.getTime() + 86400000) // start the day after anchor
    while (d <= expiryDate) {
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        futureDates.push(d.toISOString().slice(0, 10))
      }
      d = new Date(d.getTime() + 86400000)
    }
    // Fallback: ensure at least dteDays points even if the loop above was empty
    // (e.g. same-day expiry or weekend-only gap)
    if (futureDates.length === 0) {
      for (let i = 0; i < Math.max(dteDays, 1); i++) {
        const fd = new Date(anchorDate.getTime() + (i + 1) * 86400000)
        futureDates.push(fd.toISOString().slice(0, 10))
      }
    }

    const n = futureDates.length
    const allDates = [anchor, ...futureDates]

    // ---- Projection fan ----
    const p10 = pctiles[10] || spot
    const p25 = pctiles[25] || spot
    const p50 = pctiles[50] || spot
    const p75 = pctiles[75] || spot
    const p90 = pctiles[90] || spot

    const interp = (target) =>
      Array.from({ length: n + 1 }, (_, i) => spot + (target - spot) * (i / n))

    const b10 = interp(p10)
    const b25 = interp(p25)
    const b50 = interp(p50)
    const b75 = interp(p75)
    const b90 = interp(p90)

    // 10-90 band (outer)
    traces.push({
      x: [...allDates, ...allDates.slice().reverse()],
      y: [...b90, ...b10.slice().reverse()],
      fill: 'toself',
      fillcolor: 'rgba(77,106,97,0.08)',
      line: { color: 'rgba(77,106,97,0.25)', width: 0.5 },
      mode: 'lines',
      name: '10\u201390 pct (80%)',
      hoverinfo: 'skip',
      showlegend: true,
    })

    // 25-75 band (inner)
    traces.push({
      x: [...allDates, ...allDates.slice().reverse()],
      y: [...b75, ...b25.slice().reverse()],
      fill: 'toself',
      fillcolor: 'rgba(77,106,97,0.15)',
      line: { color: 'rgba(77,106,97,0.40)', width: 0.5 },
      mode: 'lines',
      name: '25\u201375 pct (50%)',
      hoverinfo: 'skip',
      showlegend: true,
    })

    // Median forecast
    traces.push({
      x: allDates,
      y: b50,
      mode: 'lines',
      line: { color: COLORS.accent, width: 2, dash: 'dash' },
      name: `Median forecast $${p50.toFixed(2)}`,
      hovertemplate: '<b>Median</b><br>$%{y:,.2f}<extra></extra>',
    })

    // Historical price line
    const maAnnotations = []
    if (histDates.length > 0) {
      traces.push({
        x: histDates,
        y: histPrices,
        mode: 'lines',
        line: { color: COLORS.accent, width: 2.5 },
        name: 'Historical price',
        hovertemplate: '<b>%{x}</b><br>$%{y:,.2f}<extra></extra>',
      })

      // Current price dot
      traces.push({
        x: [histDates[histDates.length - 1]],
        y: [histPrices[histPrices.length - 1]],
        mode: 'markers',
        marker: { color: COLORS.accent, size: 8, line: { color: COLORS.bg, width: 1.5 } },
        name: `Current $${spot.toFixed(2)}`,
        hovertemplate: `<b>Current Price</b><br>$${spot.toFixed(2)}<extra></extra>`,
      })

      // Moving averages
      const ma = buildMaTracesAndAnnotations({
        dates: history.map((b) => b.date),
        closes: history.map((b) => b.close),
        overlays,
        variant: 'forecast',
        sliceLast: maxHist,
        anchorSide: 'right',
      })
      traces.push(...ma.traces)
      maAnnotations.push(...ma.annotations)
    }

    // Endpoint dots
    for (const [label, val, colour] of [
      ['90th', p90, COLORS.green],
      ['75th', p75, COLORS.accent],
      ['50th', p50, COLORS.accent],
      ['25th', p25, COLORS.accentWarm],
      ['10th', p10, COLORS.red],
    ]) {
      traces.push({
        x: [allDates[allDates.length - 1]],
        y: [val],
        mode: 'markers',
        marker: { color: colour, size: 7, symbol: 'circle' },
        showlegend: false,
        hovertemplate: `<b>${label} percentile</b><br>$${val.toFixed(2)}<extra></extra>`,
      })
    }

    const shapes = [
      {
        type: 'line',
        x0: 0,
        x1: 1,
        xref: 'paper',
        y0: spot,
        y1: spot,
        line: { color: COLORS.text, width: 2, dash: 'dash' },
        opacity: 0.5,
      },
      {
        type: 'line',
        x0: 0,
        x1: 1,
        xref: 'paper',
        y0: dist.mean,
        y1: dist.mean,
        line: { color: COLORS.accent, width: 2, dash: 'dashdot' },
        opacity: 0.4,
      },
      {
        type: 'line',
        x0: anchor,
        x1: anchor,
        y0: 0,
        y1: 1,
        yref: 'paper',
        line: { color: COLORS.border, width: 1.5 },
        opacity: 0.6,
      },
    ]

    const tagStyle = { bgcolor: legendBg(0.85), borderpad: 3 }
    const annotations = [
      ...maAnnotations,
      {
        text: `<b>Spot</b> $${spot.toFixed(2)}`,
        x: 1.0,
        xref: 'paper',
        y: spot,
        yref: 'y',
        showarrow: false,
        xanchor: 'right',
        yshift: 12,
        font: { size: 12, color: COLORS.text },
        ...tagStyle,
      },
      {
        text: `<b>Mean</b> $${dist.mean.toFixed(2)}`,
        x: 1.0,
        xref: 'paper',
        y: dist.mean,
        yref: 'y',
        showarrow: false,
        xanchor: 'right',
        yshift: -12,
        font: { size: 12, color: COLORS.accent },
        ...tagStyle,
      },
      {
        text: '<b>Now</b>',
        x: anchor,
        xref: 'x',
        y: 1.04,
        yref: 'paper',
        showarrow: false,
        font: { size: 12, color: COLORS.textMuted },
      },
    ]

    if (!isNaN(mp) && Math.abs(mp - spot) / spot < 0.25) {
      shapes.push({
        type: 'line',
        x0: 0,
        x1: 1,
        xref: 'paper',
        y0: mp,
        y1: mp,
        line: { color: COLORS.accentWarm, width: 2, dash: 'dot' },
        opacity: 0.35,
      })
      annotations.push({
        text: `<b>Max Pain</b> $${mp.toFixed(0)}`,
        x: 0.0,
        xref: 'paper',
        y: mp,
        yref: 'y',
        showarrow: false,
        xanchor: 'left',
        yshift: 12,
        font: { size: 12, color: COLORS.accentWarm },
        ...tagStyle,
      })
    }

    const lo = {
      ...LAYOUT_DEFAULTS,
      title: {
        text: `<b>${ticker}</b>  \u2014  Options Forecast to ${expiry}`,
        font: { size: 17, color: COLORS.text },
        x: 0.01,
      },
      xaxis: { ...axisStyle(), title: '' },
      yaxis: { ...axisStyle(), title: 'Price ($)', tickprefix: '$', autorange: true },
      showlegend: true,
      legend: {
        bgcolor: legendBg(),
        bordercolor: COLORS.borderLight,
        borderwidth: 1,
        font: { size: 13, color: COLORS.text },
        x: 0.01,
        y: 0.99,
        xanchor: 'left',
        yanchor: 'top',
      },
      height: chartHeight(720),
      hovermode: 'x unified',
      shapes,
      annotations,
    }

    return { data: traces, layout: lo }
  }, [ticker, expiry, spot, dist, em, pctiles, mp, history, dte, overlays])

  return (
    <div className="chart-section">
      <Plot
        data={data}
        layout={layout}
        config={PLOTLY_CONFIG}
        useResizeHandler
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
