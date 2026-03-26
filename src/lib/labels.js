/**
 * Build the LabelStrip item arrays for each chart section.
 *
 * Extracted from App.jsx so the render tree stays clean and
 * each label set is easy to find and modify in one place.
 */

import { fmt, capitalize } from './format.js'

/** Labels shown below the forecast chart. */
export function forecastLabels(analysis) {
  return [
    {
      label: 'Spot',
      value: fmt(analysis.spot),
      color: '#1c1c1c',
      tooltip: 'Current market price of the asset.',
    },
    {
      label: 'Mean',
      value: fmt(analysis.dist.mean),
      color: '#4d6a61',
      tooltip:
        'Options-implied expected price at expiry, weighted by the probability distribution.',
    },
    {
      label: 'Max Pain',
      value: !isNaN(analysis.mp) ? fmt(analysis.mp) : 'N/A',
      color: '#c08050',
      tooltip:
        'Strike where the most options expire worthless. Often acts as a gravitational target near expiry.',
    },
    {
      label: 'Range low',
      value: fmt(analysis.em.lower),
      color: '#b05040',
      tooltip: 'Lower bound of the 1-std-dev expected move (~68% confidence interval).',
    },
    {
      label: 'Range high',
      value: fmt(analysis.em.upper),
      color: '#3d7a5a',
      tooltip: 'Upper bound of the 1-std-dev expected move (~68% confidence interval).',
    },
  ]
}

/** Labels shown below the distribution chart. */
export function distributionLabels(analysis) {
  const p = analysis.pctiles
  return [
    {
      label: '10th pct',
      value: fmt(p[10] || 0),
      color: '#b05040',
      tooltip: '10% chance price is at or below this level by expiry.',
    },
    {
      label: '25th pct',
      value: fmt(p[25] || 0),
      color: '#c08050',
      tooltip: '25% chance price is at or below this level by expiry.',
    },
    {
      label: '50th pct',
      value: fmt(p[50] || 0),
      color: '#4d6a61',
      tooltip: 'Median — equal chance price ends above or below this level by expiry.',
    },
    {
      label: '75th pct',
      value: fmt(p[75] || 0),
      color: '#4d6a61',
      tooltip: '75% chance price is at or below this level by expiry.',
    },
    {
      label: '90th pct',
      value: fmt(p[90] || 0),
      color: '#3d7a5a',
      tooltip: '90% chance price is at or below this level by expiry.',
    },
  ]
}

/** Labels shown below the S/R + entry chart. */
export function entryLabels(analysis) {
  const { entry, pcr } = analysis
  const biasColour =
    entry.bias === 'bullish' ? '#3d7a5a' : entry.bias === 'bearish' ? '#b05040' : '#1c1c1c'
  const rr = !isNaN(entry.riskReward) ? `${entry.riskReward.toFixed(1)}\u00d7` : 'N/A'
  const pcrVol = !isNaN(pcr.pcrVol) ? pcr.pcrVol.toFixed(2) : 'N/A'

  return [
    {
      label: 'Bias',
      value: capitalize(entry.bias),
      color: biasColour,
      tooltip:
        'Directional lean derived from S/R positioning and the options probability distribution.',
    },
    {
      label: 'Spot',
      value: fmt(analysis.spot),
      color: '#1c1c1c',
      tooltip: 'Current market price of the asset.',
    },
    {
      label: 'Entry',
      value: fmt(entry.entry),
      color: '#c08050',
      tooltip: 'Suggested entry price based on the nearest support or resistance level.',
    },
    {
      label: 'Stop',
      value: fmt(entry.stop),
      color: '#b05040',
      tooltip: 'Suggested stop-loss level to cap downside if the trade goes against you.',
    },
    {
      label: 'Target',
      value: fmt(entry.target),
      color: '#3d7a5a',
      tooltip: 'Suggested profit target based on the opposing S/R level.',
    },
    {
      label: 'R/R',
      value: rr,
      color: '#4d6a61',
      tooltip: 'Risk-to-reward ratio: target distance \u00f7 stop distance.',
    },
    {
      label: 'Put/Call (Vol)',
      value: pcrVol,
      color: '#555555',
      tooltip: 'Ratio of put volume to call volume.',
    },
    {
      label: 'Sentiment',
      value: capitalize(pcr.sentiment),
      color: '#555555',
      tooltip: 'Market sentiment implied by the Put/Call ratio.',
    },
  ]
}
