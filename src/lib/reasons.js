/**
 * reasons.js — Shared helper for building reason lists across scoring modules.
 */

/** Push a { tone, title, detail } object onto a reasons array. */
export function addReason(reasons, tone, title, detail) {
  reasons.push({ tone, title, detail })
}
