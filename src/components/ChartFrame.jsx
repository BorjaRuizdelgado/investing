import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Plot from 'react-plotly.js'
import Plotly from 'plotly.js-dist-min'

function ChartIcon({ name }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }

  if (name === 'reset') {
    return (
      <svg {...common}>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v6h6" />
      </svg>
    )
  }

  if (name === 'view') {
    return (
      <svg {...common}>
        <path d="m5 3 7.2 17 1.9-6.1L20 12 5 3Z" />
        <path d="m13.5 13.5 4.5 4.5" />
      </svg>
    )
  }

  if (name === 'pan') {
    return (
      <svg {...common}>
        <path d="M12 2v20" />
        <path d="m5 9 7-7 7 7" />
        <path d="m19 15-7 7-7-7" />
        <path d="M2 12h20" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-5-5" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </svg>
  )
}

function defaultMode() {
  return 'view'
}

function modeFromProps(defaultInteractive) {
  if (defaultInteractive === false) return 'view'
  if (defaultInteractive === true) return 'pan'
  return defaultMode()
}

function dragmodeForMode(mode) {
  return mode === 'pan' ? 'pan' : false
}

function cloneFigurePart(value, revision) {
  void revision
  if (value == null) return value
  if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

const MODE_OPTIONS = [
  { key: 'view', label: 'View', title: 'Read the chart and scroll the page normally' },
  { key: 'pan', label: 'Pan / zoom', title: 'Drag to pan; scroll to zoom' },
]

export default function ChartFrame({
  data,
  layout,
  config,
  className = '',
  style,
  useResizeHandler = true,
  showControls = true,
  defaultInteractive,
  onInitialized,
  onUpdate,
}) {
  const graphRef = useRef(null)
  const frameRef = useRef(null)
  const [modeOverride, setModeOverride] = useState(null)
  const [resetKey, setResetKey] = useState(0)
  const [uiRevision, setUiRevision] = useState(0)
  const mode = modeOverride ?? modeFromProps(defaultInteractive)
  const interactive = mode !== 'view'

  const preparedData = useMemo(() => cloneFigurePart(data, resetKey), [data, resetKey])

  const preparedLayout = useMemo(() => {
    const cleanLayout = cloneFigurePart(layout, resetKey) || {}
    return {
      ...cleanLayout,
      dragmode: dragmodeForMode(mode),
      uirevision: `chart-${uiRevision}`,
      selectionrevision: `chart-${uiRevision}`,
      editrevision: `chart-${uiRevision}`,
    }
  }, [layout, mode, resetKey, uiRevision])

  const preparedConfig = useMemo(
    () => ({
      ...config,
      displayModeBar: false,
      displaylogo: false,
      responsive: true,
      scrollZoom: interactive,
      doubleClick: 'reset',
    }),
    [config, interactive],
  )

  useEffect(() => {
    if (!graphRef.current) return
    Plotly.relayout(graphRef.current, { dragmode: dragmodeForMode(mode) })
  }, [mode, uiRevision])

  useEffect(() => {
    const node = frameRef.current
    if (!node) return undefined

    const handleWheel = (event) => {
      if (interactive) return
      event.stopImmediatePropagation()
    }

    node.addEventListener('wheel', handleWheel, { capture: true, passive: true })
    return () => node.removeEventListener('wheel', handleWheel, { capture: true })
  }, [interactive])

  const handleInitialized = useCallback(
    (figure, graphDiv) => {
      graphRef.current = graphDiv
      onInitialized?.(figure, graphDiv)
    },
    [onInitialized],
  )

  const handleUpdate = useCallback(
    (figure, graphDiv) => {
      graphRef.current = graphDiv
      onUpdate?.(figure, graphDiv)
    },
    [onUpdate],
  )

  const handleReset = useCallback(() => {
    graphRef.current = null
    setResetKey((value) => value + 1)
    setUiRevision((value) => value + 1)
  }, [])

  return (
    <div
      ref={frameRef}
      className={[
        'chart-frame',
        `chart-frame--${mode}`,
        interactive ? 'chart-frame--interactive' : 'chart-frame--locked',
        className,
      ].filter(Boolean).join(' ')}
    >
      {showControls && (
        <div className="chart-frame__toolbar" aria-label="Chart controls">
          <div className="chart-frame__mode-group" role="group" aria-label="Chart interaction mode">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`chart-frame__button${mode === option.key ? ' chart-frame__button--active' : ''}`}
                aria-pressed={mode === option.key}
                aria-label={option.label}
                title={option.title}
                onClick={() => setModeOverride(option.key)}
              >
                <ChartIcon name={option.key} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="chart-frame__button chart-frame__button--reset"
            aria-label="Reset chart view"
            title="Reset chart view"
            onClick={handleReset}
          >
            <ChartIcon name="reset" />
            <span>Reset</span>
          </button>
        </div>
      )}
      <Plot
        key={resetKey}
        revision={uiRevision}
        data={preparedData}
        layout={preparedLayout}
        config={preparedConfig}
        useResizeHandler={useResizeHandler}
        style={style || { width: '100%', height: '100%' }}
        onInitialized={handleInitialized}
        onUpdate={handleUpdate}
      />
    </div>
  )
}
