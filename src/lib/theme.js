/**
 * Theme constants matching borjaruizdelgado.com palette.
 * Used by all Plotly chart builders.
 */

export const COLORS = {
  bg: "#f7f5f0",
  bgAlt: "#efece5",
  text: "#1c1c1c",
  textLight: "#5a5a5a",
  textMuted: "#9a9a9a",
  accent: "#4d6a61",
  accentWarm: "#c08050",
  border: "#d8d4cc",
  borderLight: "#e8e5de",
  green: "#3d7a5a",
  red: "#b05040",
};

export const LAYOUT_DEFAULTS = {
  paper_bgcolor: COLORS.bg,
  plot_bgcolor: COLORS.bg,
  font: {
    family: "DM Sans, Helvetica Neue, Helvetica, Arial, sans-serif",
    color: COLORS.text,
    size: 14,
  },
  margin: { l: 65, r: 30, t: 55, b: 55 },
  hoverlabel: {
    bgcolor: COLORS.bgAlt,
    bordercolor: COLORS.border,
    font: { color: COLORS.text, size: 14 },
  },
};

export function axisStyle() {
  return {
    gridcolor: COLORS.borderLight,
    gridwidth: 0.5,
    linecolor: COLORS.border,
    linewidth: 1,
    tickfont: { color: COLORS.textMuted, size: 13 },
    title_font: { color: COLORS.textLight, size: 14 },
    zeroline: false,
  };
}

export const PLOTLY_CONFIG = {
  displayModeBar: true,
  scrollZoom: true,
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ["lasso2d", "select2d"],
};

export const PLOTLY_CONFIG_SMALL = {
  displayModeBar: false,
  responsive: true,
  displaylogo: false,
};

/** Responsive chart height: returns smaller height on narrow viewports. */
export function chartHeight(desktop, mobile = Math.round(desktop * 0.65)) {
  if (typeof window === "undefined") return desktop;
  return window.innerWidth <= 600 ? mobile : desktop;
}
