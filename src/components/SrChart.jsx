import React, { useMemo } from 'react'
import Plot from 'react-plotly.js'
import { COLORS, LAYOUT_DEFAULTS, axisStyle, PLOTLY_CONFIG, chartHeight } from '../lib/theme.js'
import { buildMaTracesAndAnnotations } from '../lib/ma.js'

export default function SrChart({ ticker, history, spot, sr, entryInfo, overlays = {} }) {
  const { data, layout } = useMemo(() => {
    const traces = []
    const shapes = []
    const maAnnotations = []

    let dates = []
    if (history && history.length > 0) {
      const hist = history.slice(-60)
      dates = hist.map((b) => b.date)

      const hasOHLC = hist[0].open != null && hist[0].high != null && hist[0].low != null

      if (hasOHLC) {
        traces.push({
          x: dates,
          open: hist.map((b) => b.open),
          high: hist.map((b) => b.high),
          low: hist.map((b) => b.low),
          close: hist.map((b) => b.close),
          type: 'candlestick',
          name: 'Price',
          increasing: { line: { color: COLORS.green }, fillcolor: 'rgba(61,122,90,0.50)' },
          decreasing: { line: { color: COLORS.red }, fillcolor: 'rgba(176,80,64,0.50)' },
          showlegend: false,
        })
      } else {
        traces.push({
          x: dates,
          y: hist.map((b) => b.close),
          mode: 'lines',
          line: { color: COLORS.accent, width: 2 },
          name: 'Close',
          showlegend: false,
        })
      }

      // Moving averages (only when toggled on)
      const ma = buildMaTracesAndAnnotations({
        dates: history.map((b) => b.date),
        closes: history.map((b) => b.close),
        overlays,
        variant: 'entry',
        sliceLast: 60,
        anchorSide: 'left',
      })
      traces.push(...ma.traces)
      maAnnotations.push(...ma.annotations)
    }

    // S/R levels
    const levels = sr.levels || []
    const nonMa = levels.filter((l) => {
      if (l.source.startsWith('MA')) return false
      if (l.source === 'gamma_wall' && !overlays.gw) return false
      if (l.source === 'pivot' && !overlays.pivots) return false
      return true
    })
    const supports = nonMa
      .filter((l) => l.price < spot)
      .sort((a, b) => Math.abs(a.price - spot) - Math.abs(b.price - spot))
      .slice(0, 3)
    const resistances = nonMa
      .filter((l) => l.price > spot)
      .sort((a, b) => Math.abs(a.price - spot) - Math.abs(b.price - spot))
      .slice(0, 3)

    const bias = (entryInfo.bias || '').toLowerCase()

    for (const level of [...supports, ...resistances]) {
      const price = level.price
      const ltype = level.type
      const src = level.source
      let colour
      if (bias === 'bullish') colour = ltype === 'support' ? COLORS.green : COLORS.red
      else if (bias === 'bearish') colour = ltype === 'support' ? COLORS.red : COLORS.green
      else colour = ltype === 'support' ? COLORS.green : COLORS.red
      const dash = src === 'gamma_wall' ? 'dash' : 'dot'
      const label = (src === 'gamma_wall' ? 'GW' : 'Pivot') + ` $${price.toFixed(0)}`

      shapes.push({
        type: 'line',
        x0: 0,
        x1: 1,
        xref: 'paper',
        y0: price,
        y1: price,
        line: { color: colour, width: 2, dash },
        opacity: 0.55,
      })

      traces.push({
        x: dates.length > 0 ? [dates[dates.length - 1]] : [new Date().toISOString().slice(0, 10)],
        y: [price],
        mode: 'markers',
        marker: { color: 'rgba(0,0,0,0)', size: 0 },
        showlegend: false,
        hovertemplate: `<b>${label}</b><br>${ltype}<extra></extra>`,
      })
    }

    const annotations = []
    const tag = { bgcolor: 'rgba(247,245,240,0.85)', borderpad: 3 }

    // Spot line
    shapes.push({
      type: 'line',
      x0: 0,
      x1: 1,
      xref: 'paper',
      y0: spot,
      y1: spot,
      line: { color: COLORS.text, width: 2.5, dash: 'dash' },
      opacity: 0.55,
    })
    annotations.push({
      text: `<b>Spot</b> $${spot.toFixed(2)}`,
      x: 1.0,
      xref: 'paper',
      y: spot,
      yref: 'y',
      showarrow: false,
      xanchor: 'right',
      yshift: 14,
      font: { size: 12, color: COLORS.text },
      ...tag,
    })

    // MA annotations
    annotations.push(...maAnnotations)

    // S/R level annotations
    for (const level of [...supports, ...resistances]) {
      const src = level.source
      const label = (src === 'gamma_wall' ? 'GW' : 'Pivot') + ` $${level.price.toFixed(0)}`
      const clr = level.type === 'support' ? COLORS.green : COLORS.red
      annotations.push({
        text: `<b>${label}</b>`,
        x: 0.0,
        xref: 'paper',
        y: level.price,
        yref: 'y',
        showarrow: false,
        xanchor: 'left',
        yshift: 14,
        font: { size: 12, color: clr },
        ...tag,
      })
    }

    // Entry / Stop / Target
    const entry = entryInfo.entry
    const stop = entryInfo.stop
    const target = entryInfo.target

    let entryFill
    if (bias === 'bullish') entryFill = 'rgba(61,122,90,0.18)'
    else if (bias === 'bearish') entryFill = 'rgba(176,80,64,0.18)'
    else entryFill = 'rgba(192,128,80,0.18)'

    if (entry != null) {
      const bandH = entry * 0.004
      shapes.push({
        type: 'rect',
        x0: 0,
        x1: 1,
        xref: 'paper',
        y0: entry - bandH,
        y1: entry + bandH,
        fillcolor: entryFill,
        line: { width: 0 },
        layer: 'above',
      })
      annotations.push({
        text: `<b>Entry</b> $${entry.toFixed(0)}`,
        x: 1.0,
        xref: 'paper',
        y: entry,
        yref: 'y',
        showarrow: false,
        xanchor: 'right',
        yshift: -14,
        font: { size: 12, color: COLORS.accentWarm },
        ...tag,
      })
    }

    if (stop != null) {
      shapes.push({
        type: 'line',
        x0: 0,
        x1: 1,
        xref: 'paper',
        y0: stop,
        y1: stop,
        line: { color: COLORS.red, width: 2.5, dash: 'dot' },
        opacity: 0.7,
      })
      annotations.push({
        text: `<b>Stop</b> $${stop.toFixed(0)}`,
        x: 1.0,
        xref: 'paper',
        y: stop,
        yref: 'y',
        showarrow: false,
        xanchor: 'right',
        yshift: -14,
        font: { size: 12, color: COLORS.red },
        ...tag,
      })
    }

    if (target != null) {
      shapes.push({
        type: 'line',
        x0: 0,
        x1: 1,
        xref: 'paper',
        y0: target,
        y1: target,
        line: { color: COLORS.green, width: 2.5, dash: 'dot' },
        opacity: 0.7,
      })
      annotations.push({
        text: `<b>Target</b> $${target.toFixed(0)}`,
        x: 1.0,
        xref: 'paper',
        y: target,
        yref: 'y',
        showarrow: false,
        xanchor: 'right',
        yshift: 14,
        font: { size: 12, color: COLORS.green },
        ...tag,
      })
    }

    const lo = {
      ...LAYOUT_DEFAULTS,
      margin: { l: 65, r: 40, t: 50, b: 50 },
      title: {
        text: `<b>${ticker}</b>  \u2014  Potential Entry Setup`,
        font: { size: 16, color: COLORS.text },
        x: 0.01,
      },
      xaxis: { ...axisStyle(), title: '', rangeslider: { visible: false } },
      yaxis: { ...axisStyle(), title: 'Price ($)', tickprefix: '$', autorange: true },
      showlegend: true,
      legend: {
        bgcolor: 'rgba(247,245,240,0.85)',
        bordercolor: COLORS.borderLight,
        borderwidth: 1,
        font: { size: 12 },
        x: 0.01,
        y: 0.99,
        xanchor: 'left',
        yanchor: 'top',
      },
      height: chartHeight(600),
      hovermode: 'x unified',
      shapes,
      annotations,
    }

    return { data: traces, layout: lo }
  }, [ticker, history, spot, sr, entryInfo, overlays])

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
