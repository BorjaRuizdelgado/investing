import React, { useMemo } from 'react'
import Plot from 'react-plotly.js'
import {
  COLORS,
  LAYOUT_DEFAULTS,
  axisStyle,
  PLOTLY_CONFIG_SMALL,
  chartHeight,
  legendBg,
  mobileMargin,
} from '../lib/theme.js'

export default function IvSmileChart({ ivData, spot }) {
  const { data, layout } = useMemo(() => {
    const traces = []

    if (!ivData || ivData.length === 0) {
      return {
        data: [],
        layout: {
          ...LAYOUT_DEFAULTS,
          height: chartHeight(400),
          annotations: [
            {
              text: 'No IV data available',
              xref: 'paper',
              yref: 'paper',
              x: 0.5,
              y: 0.5,
              showarrow: false,
              font: { size: 14, color: COLORS.textMuted },
            },
          ],
        },
      }
    }

    const callIv = ivData.filter((d) => d.type === 'call')
    const putIv = ivData.filter((d) => d.type === 'put')

    if (callIv.length > 0) {
      traces.push({
        x: callIv.map((d) => d.strike),
        y: callIv.map((d) => d.iv * 100),
        type: 'bar',
        marker: { color: COLORS.accent },
        opacity: 0.75,
        name: 'Calls',
        hovertemplate: '<b>Call</b> $%{x:,.0f}<br>IV: %{y:.1f}%<extra></extra>',
      })
    }

    if (putIv.length > 0) {
      traces.push({
        x: putIv.map((d) => d.strike),
        y: putIv.map((d) => d.iv * 100),
        type: 'bar',
        marker: { color: COLORS.accentWarm },
        opacity: 0.75,
        name: 'Puts',
        hovertemplate: '<b>Put</b> $%{x:,.0f}<br>IV: %{y:.1f}%<extra></extra>',
      })
    }

    const shapes = [
      {
        type: 'line',
        x0: spot,
        x1: spot,
        y0: 0,
        y1: 1,
        yref: 'paper',
        line: { color: COLORS.text, width: 2, dash: 'dash' },
        opacity: 0.4,
      },
    ]

    const annotations = [
      {
        text: `Spot $${spot.toFixed(2)}`,
        x: spot,
        y: 1.05,
        xref: 'x',
        yref: 'paper',
        showarrow: false,
        font: { size: 12, color: COLORS.textLight },
      },
    ]

    const lo = {
      ...LAYOUT_DEFAULTS,
      margin: mobileMargin(65, 30, 80, 55),
      title: {
        text: '<b>Implied Volatility Smile</b>',
        font: { size: 16, color: COLORS.text },
        x: 0.01,
      },
      xaxis: { ...axisStyle(), title: 'Strike ($)', tickprefix: '$' },
      yaxis: { ...axisStyle(), title: 'Implied Volatility (%)', ticksuffix: '%' },
      showlegend: true,
      legend: {
        bgcolor: legendBg(),
        bordercolor: COLORS.borderLight,
        borderwidth: 1,
        font: { size: 12, color: COLORS.text },
        x: 0.01,
        y: 0.99,
        xanchor: 'left',
        yanchor: 'top',
      },
      height: chartHeight(400),
      hovermode: 'x unified',
      barmode: 'group',
      shapes,
      annotations,
    }

    return { data: traces, layout: lo }
  }, [ivData, spot])

  return (
    <div className="chart-section">
      <Plot
        data={data}
        layout={layout}
        config={PLOTLY_CONFIG_SMALL}
        useResizeHandler
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
