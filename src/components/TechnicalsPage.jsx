import React, { useMemo } from 'react'
import Plot from 'react-plotly.js'
import ScoreCard from './ScoreCard.jsx'
import MetricTable from './MetricTable.jsx'
import ReasonList from './ReasonList.jsx'
import { METRIC_TIPS } from '../lib/metricTips.js'
import { COLORS, LAYOUT_DEFAULTS, axisStyle, PLOTLY_CONFIG, chartHeight } from '../lib/theme.js'

function tone(score) {
  if (!Number.isFinite(score)) return 'neutral'
  if (score >= 70) return 'positive'
  if (score < 40) return 'negative'
  return 'neutral'
}

function PriceBBChart({ indicators }) {
  const data = useMemo(() => {
    const { dates, closes, bbUpper, bbMiddle, bbLower, sma50, sma200 } = indicators
    const traces = []

    // BB upper (invisible line for fill)
    traces.push({
      x: dates,
      y: bbUpper,
      mode: 'lines',
      line: { width: 0 },
      showlegend: false,
      hoverinfo: 'skip',
    })

    // BB lower with fill to upper
    traces.push({
      x: dates,
      y: bbLower,
      mode: 'lines',
      fill: 'tonexty',
      fillcolor: `${COLORS.accent}15`,
      line: { width: 0 },
      showlegend: false,
      hoverinfo: 'skip',
    })

    // BB middle (SMA 20)
    traces.push({
      x: dates,
      y: bbMiddle,
      mode: 'lines',
      name: 'SMA 20',
      line: { color: COLORS.accent, width: 1, dash: 'dot' },
    })

    // Close price
    traces.push({
      x: dates,
      y: closes,
      mode: 'lines',
      name: 'Close',
      line: { color: COLORS.text, width: 1.5 },
    })

    // SMA 50
    traces.push({
      x: dates,
      y: sma50,
      mode: 'lines',
      name: 'SMA 50',
      line: { color: COLORS.accentWarm, width: 1 },
    })

    // SMA 200
    traces.push({
      x: dates,
      y: sma200,
      mode: 'lines',
      name: 'SMA 200',
      line: { color: COLORS.red, width: 1 },
    })

    return traces
  }, [indicators])

  const layout = useMemo(
    () => ({
      ...LAYOUT_DEFAULTS,
      height: chartHeight(380),
      margin: { l: 65, r: 30, t: 20, b: 55 },
      xaxis: { ...axisStyle(), type: 'date' },
      yaxis: { ...axisStyle(), title: 'Price' },
      legend: { orientation: 'h', y: -0.15, x: 0.5, xanchor: 'center' },
    }),
    [],
  )

  return (
    <>
      <div className="section-heading"><h2>Price &amp; Bollinger Bands</h2></div>
      <Plot data={data} layout={layout} config={PLOTLY_CONFIG} useResizeHandler style={{ width: '100%' }} />
    </>
  )
}

function RSIChart({ indicators }) {
  const data = useMemo(() => {
    const { dates, rsi } = indicators
    return [
      {
        x: dates,
        y: rsi,
        mode: 'lines',
        name: 'RSI (14)',
        line: { color: COLORS.accent, width: 1.5 },
      },
      // Overbought line
      {
        x: [dates[0], dates[dates.length - 1]],
        y: [70, 70],
        mode: 'lines',
        name: 'Overbought',
        line: { color: COLORS.red, width: 1, dash: 'dash' },
      },
      // Oversold line
      {
        x: [dates[0], dates[dates.length - 1]],
        y: [30, 30],
        mode: 'lines',
        name: 'Oversold',
        line: { color: COLORS.green, width: 1, dash: 'dash' },
      },
    ]
  }, [indicators])

  const layout = useMemo(
    () => ({
      ...LAYOUT_DEFAULTS,
      height: chartHeight(250),
      margin: { l: 65, r: 30, t: 20, b: 55 },
      xaxis: { ...axisStyle(), type: 'date' },
      yaxis: { ...axisStyle(), title: 'RSI', range: [0, 100] },
      legend: { orientation: 'h', y: -0.2, x: 0.5, xanchor: 'center' },
      shapes: [
        {
          type: 'rect',
          xref: 'paper',
          yref: 'y',
          x0: 0,
          x1: 1,
          y0: 30,
          y1: 70,
          fillcolor: `${COLORS.accent}08`,
          line: { width: 0 },
        },
      ],
    }),
    [],
  )

  return (
    <>
      <div className="section-heading"><h2>RSI (14)</h2></div>
      <Plot data={data} layout={layout} config={PLOTLY_CONFIG} useResizeHandler style={{ width: '100%' }} />
    </>
  )
}

function MACDChart({ indicators }) {
  const data = useMemo(() => {
    const { dates, macdLine, signalLine, histogram } = indicators
    const barColors = histogram.map((v) => (v != null && v >= 0 ? COLORS.green : COLORS.red))

    return [
      {
        x: dates,
        y: histogram,
        type: 'bar',
        name: 'Histogram',
        marker: { color: barColors },
      },
      {
        x: dates,
        y: macdLine,
        mode: 'lines',
        name: 'MACD',
        line: { color: COLORS.accent, width: 1.5 },
      },
      {
        x: dates,
        y: signalLine,
        mode: 'lines',
        name: 'Signal',
        line: { color: COLORS.accentWarm, width: 1.5 },
      },
    ]
  }, [indicators])

  const layout = useMemo(
    () => ({
      ...LAYOUT_DEFAULTS,
      height: chartHeight(250),
      margin: { l: 65, r: 30, t: 20, b: 55 },
      xaxis: { ...axisStyle(), type: 'date' },
      yaxis: { ...axisStyle(), title: 'MACD' },
      legend: { orientation: 'h', y: -0.2, x: 0.5, xanchor: 'center' },
      bargap: 0.1,
    }),
    [],
  )

  return (
    <>
      <div className="section-heading"><h2>MACD (12 / 26 / 9)</h2></div>
      <Plot data={data} layout={layout} config={PLOTLY_CONFIG} useResizeHandler style={{ width: '100%' }} />
    </>
  )
}

export default function TechnicalsPage({ research }) {
  const technicals = research?.technicals
  if (!technicals?.hasData) return null

  return (
    <>
      <section className="terminal-section">
        <div className="section-heading">
          <h2>Technical Analysis</h2>
        </div>
        <div className="terminal-grid terminal-grid--2">
          <ScoreCard
            label="Technicals Score"
            score={technicals.score}
            tone={tone(technicals.score)}
            detail={technicals.label}
            tooltip={METRIC_TIPS.technicalsScore}
          />
          <div className="terminal-card">
            <div className="terminal-eyebrow">Interpretation</div>
            <p className="terminal-copy">
              Combines RSI momentum, MACD trend, Bollinger Band position, moving average alignment,
              and volume confirmation into a single directional read.
            </p>
          </div>
        </div>
      </section>

      {technicals.indicators && (
        <>
          <section className="terminal-section">
            <PriceBBChart indicators={technicals.indicators} />
          </section>
          <section className="terminal-section">
            <RSIChart indicators={technicals.indicators} />
          </section>
          <section className="terminal-section">
            <MACDChart indicators={technicals.indicators} />
          </section>
        </>
      )}

      <MetricTable title="Technical Indicators" metrics={technicals.metrics || []} />
      <ReasonList title="Signal Interpretation" reasons={technicals.reasons || []} />
    </>
  )
}
