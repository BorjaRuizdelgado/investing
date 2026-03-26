import React, { useMemo } from 'react'
import Plot from 'react-plotly.js'
import { COLORS, LAYOUT_DEFAULTS, axisStyle, PLOTLY_CONFIG, chartHeight } from '../lib/theme.js'

export default function DistributionChart({ dist, spot, pctiles, mp }) {
  const { data, layout } = useMemo(() => {
    const K = dist.strikes
    const pdf = dist.pdf
    const cdf = dist.cdf
    const traces = []

    if (Math.max(...pdf) <= 0) {
      return {
        data: [],
        layout: {
          ...LAYOUT_DEFAULTS,
          height: 480,
          annotations: [
            {
              text: 'No distribution data',
              xref: 'paper',
              yref: 'paper',
              x: 0.5,
              y: 0.5,
              showarrow: false,
            },
          ],
        },
      }
    }

    const p10 = pctiles[10] || spot
    const p25 = pctiles[25] || spot
    const p75 = pctiles[75] || spot
    const p90 = pctiles[90] || spot
    const mean = dist.mean

    // Find 2.5th and 97.5th percentile for shading
    let i025 = 0,
      i975 = K.length - 1
    for (let i = 0; i < cdf.length; i++) {
      if (cdf[i] >= 0.025) {
        i025 = i
        break
      }
    }
    for (let i = 0; i < cdf.length; i++) {
      if (cdf[i] >= 0.975) {
        i975 = i
        break
      }
    }
    const p025 = K[i025]
    const p975 = K[i975]

    // 95% shaded band
    const maskIndices = []
    for (let i = 0; i < K.length; i++) {
      if (K[i] >= p025 && K[i] <= p975) maskIndices.push(i)
    }
    if (maskIndices.length > 0) {
      const k95 = maskIndices.map((i) => K[i])
      const pdf95 = maskIndices.map((i) => pdf[i])
      traces.push({
        x: [k95[0], ...k95, k95[k95.length - 1]],
        y: [0, ...pdf95, 0],
        fill: 'toself',
        fillcolor: 'rgba(77,106,97,0.12)',
        line: { color: 'rgba(77,106,97,0.25)', width: 0.5 },
        mode: 'lines',
        name: '95% range',
        hoverinfo: 'skip',
      })
    }

    // PDF curve
    traces.push({
      x: Array.from(K),
      y: Array.from(pdf),
      mode: 'lines',
      line: { color: COLORS.accent, width: 2 },
      name: 'Implied density',
      hovertemplate: '$%{x:,.2f}<br>Density: %{y:.4f}<extra></extra>',
    })

    const shapes = []
    const annotations = []
    const tagTop = { bgcolor: 'rgba(247,245,240,0.85)', borderpad: 3 }

    shapes.push({
      type: 'line',
      x0: spot,
      x1: spot,
      y0: 0,
      y1: 1,
      yref: 'paper',
      line: { color: COLORS.text, width: 2, dash: 'dash' },
      opacity: 0.5,
    })
    annotations.push({
      text: '<b>Spot</b>',
      x: spot,
      y: 1.07,
      xref: 'x',
      yref: 'paper',
      showarrow: false,
      font: { size: 12, color: COLORS.text },
      ...tagTop,
    })

    shapes.push({
      type: 'line',
      x0: mean,
      x1: mean,
      y0: 0,
      y1: 1,
      yref: 'paper',
      line: { color: COLORS.accent, width: 2, dash: 'dashdot' },
      opacity: 0.4,
    })
    annotations.push({
      text: '<b>Mean</b>',
      x: mean,
      y: 1.07,
      xref: 'x',
      yref: 'paper',
      showarrow: false,
      font: { size: 12, color: COLORS.accent },
      ...tagTop,
    })

    if (!isNaN(mp) && Math.abs(mp - spot) / spot < 0.25) {
      shapes.push({
        type: 'line',
        x0: mp,
        x1: mp,
        y0: 0,
        y1: 1,
        yref: 'paper',
        line: { color: COLORS.accentWarm, width: 2, dash: 'dot' },
        opacity: 0.4,
      })
      annotations.push({
        text: '<b>MP</b>',
        x: mp,
        y: 1.07,
        xref: 'x',
        yref: 'paper',
        showarrow: false,
        font: { size: 12, color: COLORS.accentWarm },
        ...tagTop,
      })
    }

    for (const [val, colour, label] of [
      [p10, COLORS.red, 'P10'],
      [p25, COLORS.accentWarm, 'P25'],
      [p75, COLORS.accent, 'P75'],
      [p90, COLORS.green, 'P90'],
    ]) {
      shapes.push({
        type: 'line',
        x0: val,
        x1: val,
        y0: 0,
        y1: 1,
        yref: 'paper',
        line: { color: colour, width: 1, dash: 'dot' },
        opacity: 0.35,
      })
      annotations.push({
        text: `<b>${label}</b>`,
        x: val,
        y: -0.09,
        xref: 'x',
        yref: 'paper',
        showarrow: false,
        font: { size: 12, color: colour },
        ...tagTop,
      })
    }

    // X-axis: trim to 1st-99th percentile
    let i01 = 0,
      i99 = K.length - 1
    for (let i = 0; i < cdf.length; i++) {
      if (cdf[i] >= 0.01) {
        i01 = i
        break
      }
    }
    for (let i = 0; i < cdf.length; i++) {
      if (cdf[i] >= 0.99) {
        i99 = i
        break
      }
    }
    const xPad = (K[i99] - K[i01]) * 0.15

    const lo = {
      ...LAYOUT_DEFAULTS,
      margin: { l: 65, r: 30, t: 80, b: 65 },
      title: {
        text: '<b>Implied Price Distribution</b>',
        font: { size: 16, color: COLORS.text },
        x: 0.01,
      },
      xaxis: {
        ...axisStyle(),
        title: 'Price ($)',
        tickprefix: '$',
        range: [K[i01] - xPad, K[i99] + xPad],
      },
      yaxis: { ...axisStyle(), title: 'Probability Density', showticklabels: false },
      showlegend: true,
      legend: {
        bgcolor: 'rgba(247,245,240,0.90)',
        bordercolor: COLORS.borderLight,
        borderwidth: 1,
        font: { size: 12 },
        x: 0.01,
        y: 0.99,
        xanchor: 'left',
        yanchor: 'top',
      },
      height: chartHeight(480),
      hovermode: 'x unified',
      shapes,
      annotations,
    }

    return { data: traces, layout: lo }
  }, [dist, spot, pctiles, mp])

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
