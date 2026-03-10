/**
 * Shared formatting helpers used across components.
 */

/** Format a number as a dollar amount, e.g. "$1,234.56". Returns "N/A" for invalid values. */
export function fmt(val) {
  if (val == null || isNaN(val)) return "N/A";
  return `$${Number(val).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Format a number to 2 decimal places, e.g. "1.23". Returns "N/A" for NaN. */
export function fmtDecimal(v) {
  return isNaN(v) ? "N/A" : v.toFixed(2);
}

/** Format an integer with locale grouping, e.g. "1,234". */
export function fmtInt(v) {
  return Number(v).toLocaleString();
}

/** Format a large number with compact suffix, e.g. "$2.4T", "$156.2B". Returns "N/A" for invalid. */
export function fmtCompact(val) {
  if (val == null || isNaN(val)) return "N/A";
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(2)}K`;
  return fmt(val);
}

/** Format a decimal as a percentage, e.g. 0.0234 → "2.34%". Returns "N/A" for invalid. */
export function fmtPct(val, decimals = 2) {
  if (val == null || isNaN(val)) return "N/A";
  return `${(val * 100).toFixed(decimals)}%`;
}

/** Format a ratio (no $ sign), e.g. 28.45. Returns "N/A" for invalid. */
export function fmtRatio(val, decimals = 2) {
  if (val == null || isNaN(val)) return "N/A";
  return Number(val).toFixed(decimals);
}

/** Capitalise the first letter of a string. */
export function capitalize(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
