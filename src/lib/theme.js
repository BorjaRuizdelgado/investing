/**
 * Theme constants matching borjaruizdelgado.com palette.
 * Used by all Plotly chart builders.
 * Reads from CSS variables so dark/light mode works automatically.
 */

let _cache = null
let _cacheTheme = null

function currentTheme() {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.dataset.theme || 'light'
}

export function getColors() {
  const theme = currentTheme()
  if (_cache && _cacheTheme === theme) return _cache

  if (typeof document === 'undefined') {
    _cache = {
      bg: '#f7f5f0',
      bgAlt: '#efece5',
      text: '#1c1c1c',
      textLight: '#5a5a5a',
      textMuted: '#9a9a9a',
      accent: '#4d6a61',
      accentWarm: '#c08050',
      border: '#d8d4cc',
      borderLight: '#e8e5de',
      green: '#3d7a5a',
      red: '#b05040',
    }
    _cacheTheme = theme
    return _cache
  }

  const s = getComputedStyle(document.documentElement)
  const v = (name) => s.getPropertyValue(name).trim()

  _cache = {
    bg: v('--bg') || '#f7f5f0',
    bgAlt: v('--bg-alt') || '#efece5',
    text: v('--text') || '#1c1c1c',
    textLight: v('--text-light') || '#5a5a5a',
    textMuted: v('--text-muted') || '#9a9a9a',
    accent: v('--accent') || '#4d6a61',
    accentWarm: v('--accent-warm') || '#c08050',
    border: v('--border') || '#d8d4cc',
    borderLight: v('--border-light') || '#e8e5de',
    green: v('--green') || '#3d7a5a',
    red: v('--red') || '#b05040',
  }
  _cacheTheme = theme
  return _cache
}

/** Invalidate cached colors (call after theme switch). */
export function invalidateColors() {
  _cache = null
  _cacheTheme = null
}

// Backward-compatible COLORS object — accesses are live via getColors()
export const COLORS = new Proxy(
  {},
  {
    get(_, prop) {
      return getColors()[prop]
    },
  },
)

export function getLayoutDefaults() {
  const c = getColors()
  return {
    paper_bgcolor: c.bg,
    plot_bgcolor: c.bg,
    font: {
      family: 'DM Sans, Helvetica Neue, Helvetica, Arial, sans-serif',
      color: c.text,
      size: 14,
    },
    margin: { l: 65, r: 30, t: 55, b: 55 },
    hoverlabel: {
      bgcolor: c.bgAlt,
      bordercolor: c.border,
      font: { color: c.text, size: 14 },
    },
  }
}

export const LAYOUT_DEFAULTS = new Proxy(
  {},
  {
    get(_, prop) {
      return getLayoutDefaults()[prop]
    },
    ownKeys() {
      return Object.keys(getLayoutDefaults())
    },
    getOwnPropertyDescriptor(_, prop) {
      const val = getLayoutDefaults()[prop]
      if (val !== undefined) return { configurable: true, enumerable: true, value: val }
    },
  },
)

/** Semi-transparent bg for chart legends & annotation tags. */
export function legendBg(opacity = 0.9) {
  const theme = currentTheme()
  return theme === 'dark'
    ? `rgba(36,36,36,${opacity})`
    : `rgba(247,245,240,${opacity})`
}

export function axisStyle() {
  const c = getColors()
  return {
    gridcolor: c.borderLight,
    gridwidth: 0.5,
    linecolor: c.border,
    linewidth: 1,
    tickfont: { color: c.textMuted, size: 13 },
    title_font: { color: c.textLight, size: 14 },
    zeroline: false,
  }
}

export const PLOTLY_CONFIG = {
  displayModeBar: true,
  scrollZoom: true,
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ['lasso2d', 'select2d'],
}

export const PLOTLY_CONFIG_SMALL = {
  displayModeBar: false,
  responsive: true,
  displaylogo: false,
}

/** Responsive chart height: returns smaller height on narrow viewports. */
export function chartHeight(desktop, mobile = Math.round(desktop * 0.65)) {
  if (typeof window === 'undefined') return desktop
  return window.innerWidth <= 600 ? mobile : desktop
}

/** Responsive chart margin: tighter on narrow (≤640px) viewports to maximise plot width. */
export function mobileMargin(l = 65, r = 30, t = 20, b = 55, { mobileL = 44, mobileR = 6 } = {}) {
  if (typeof window === 'undefined') return { l, r, t, b }
  const mob = window.innerWidth <= 640
  return mob ? { l: mobileL, r: mobileR, t, b: b > 28 ? b - 8 : b } : { l, r, t, b }
}
