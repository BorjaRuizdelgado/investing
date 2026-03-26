/**
 * ma.js — Moving-average computation + Plotly trace/annotation builders.
 *
 * Shared across ForecastChart and SrChart so the logic lives in one place.
 */
import { legendBg } from './theme.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Colour per MA period — vivid enough against the beige background. */
export const MA_COLORS = {
  20: '#d48c2e', // warm amber
  50: '#2e7d9e', // teal blue
  200: '#8b3a8b', // deep purple
}

/**
 * Per-period visual config.
 * `width.forecast` is used on the Forecast chart, `width.entry` on the Entry chart.
 */
export const MA_CONFIGS = [
  {
    period: 20,
    color: MA_COLORS[20],
    dash: 'dot',
    width: { forecast: 1.8, entry: 2 },
    key: 'ma20',
  },
  {
    period: 50,
    color: MA_COLORS[50],
    dash: 'dash',
    width: { forecast: 2, entry: 2.2 },
    key: 'ma50',
  },
  {
    period: 200,
    color: MA_COLORS[200],
    dash: 'dashdot',
    width: { forecast: 2.2, entry: 2.5 },
    key: 'ma200',
  },
]

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

/**
 * Compute the full SMA series for every configured period.
 *
 * @param {number[]} closes
 * @returns {Record<number, (number|null)[]>}  keyed by period; null where
 *          there aren't enough data points yet.
 */
export function computeMaSeries(closes) {
  const result = {}
  for (const { period } of MA_CONFIGS) {
    const vals = new Array(closes.length)
    // Running sum for O(n) computation instead of re-summing every window.
    let sum = 0
    for (let i = 0; i < closes.length; i++) {
      sum += closes[i]
      if (i >= period) sum -= closes[i - period]
      vals[i] = i < period - 1 ? null : sum / period
    }
    result[period] = vals
  }
  return result
}

// ---------------------------------------------------------------------------
// Plotly trace + annotation builder
// ---------------------------------------------------------------------------

/**
 * Build Plotly traces and price-tag annotations for visible MAs.
 *
 * @param {object}  opts
 * @param {string[]}  opts.dates         date strings (same length as closes)
 * @param {number[]}  opts.closes        closing prices (full history)
 * @param {object}    opts.overlays      toggle state, e.g. { ma20: true }
 * @param {"forecast"|"entry"} opts.variant  which line-width set to use
 * @param {number}    [opts.sliceLast]   trim series to the last N points
 * @param {"left"|"right"} [opts.anchorSide="right"] annotation placement
 * @returns {{ traces: object[], annotations: object[] }}
 */
export function buildMaTracesAndAnnotations({
  dates,
  closes,
  overlays,
  variant,
  sliceLast,
  anchorSide = 'right',
}) {
  const maSeries = computeMaSeries(closes)
  const traces = []
  const annotations = []

  for (const cfg of MA_CONFIGS) {
    if (!overlays[cfg.key]) continue

    const fullVals = maSeries[cfg.period]
    if (!fullVals) continue

    let plotDates = dates
    let plotVals = fullVals
    if (sliceLast) {
      plotDates = dates.slice(-sliceLast)
      plotVals = fullVals.slice(-sliceLast)
    }

    const lastMa = plotVals[plotVals.length - 1]

    traces.push({
      x: plotDates,
      y: plotVals,
      mode: 'lines',
      line: { color: cfg.color, width: cfg.width[variant], dash: cfg.dash },
      opacity: 0.85,
      name: `MA ${cfg.period} (${cfg.period}-day moving avg)`,
      hovertemplate: `MA${cfg.period}: $%{y:,.2f}<extra></extra>`,
      connectgaps: false,
    })

    if (lastMa != null) {
      const isLeft = anchorSide === 'left'
      // Stagger annotations vertically to reduce overlap.
      const yshift = cfg.period === 50 ? (isLeft ? 14 : -14) : isLeft ? -14 : 14

      annotations.push({
        text: `<b>MA${cfg.period}</b> $${lastMa.toFixed(2)}`,
        x: isLeft ? 0.0 : 1.0,
        xref: 'paper',
        y: lastMa,
        yref: 'y',
        showarrow: false,
        xanchor: isLeft ? 'left' : 'right',
        yshift,
        font: { size: 12, color: cfg.color },
        bgcolor: legendBg(0.85),
        borderpad: 3,
      })
    }
  }

  return { traces, annotations }
}
