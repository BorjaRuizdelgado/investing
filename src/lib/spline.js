/**
 * Natural cubic spline interpolation.
 *
 * Given (x[], y[]) knots, builds a smooth C² interpolant and
 * exposes .evaluate(x) and .derivative2(x) for the Breeden-Litzenberger
 * second-derivative calculation.
 */

export function cubicSpline(xs, ys) {
  const n = xs.length - 1
  if (n < 1) throw new Error('Need at least 2 points for spline')

  const h = new Float64Array(n)
  const alpha = new Float64Array(n + 1)
  const l = new Float64Array(n + 1)
  const mu = new Float64Array(n + 1)
  const z = new Float64Array(n + 1)
  const c = new Float64Array(n + 1)
  const b = new Float64Array(n)
  const d = new Float64Array(n)
  const a = Float64Array.from(ys)

  for (let i = 0; i < n; i++) {
    h[i] = xs[i + 1] - xs[i]
  }

  for (let i = 1; i < n; i++) {
    alpha[i] = (3 / h[i]) * (a[i + 1] - a[i]) - (3 / h[i - 1]) * (a[i] - a[i - 1])
  }

  // Natural spline: c[0] = c[n] = 0
  l[0] = 1
  mu[0] = 0
  z[0] = 0

  for (let i = 1; i < n; i++) {
    l[i] = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1]
    mu[i] = h[i] / l[i]
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i]
  }

  l[n] = 1
  z[n] = 0
  c[n] = 0

  for (let j = n - 1; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1]
    b[j] = (a[j + 1] - a[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3
    d[j] = (c[j + 1] - c[j]) / (3 * h[j])
  }

  function findSegment(x) {
    // Binary search for the right segment
    let lo = 0,
      hi = n - 1
    // Clamp to range
    if (x <= xs[0]) return 0
    if (x >= xs[n]) return n - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (xs[mid + 1] < x) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  return {
    evaluate(x) {
      const i = findSegment(x)
      const dx = x - xs[i]
      return a[i] + b[i] * dx + c[i] * dx * dx + d[i] * dx * dx * dx
    },

    /** Second derivative at x — used for Breeden-Litzenberger */
    derivative2(x) {
      const i = findSegment(x)
      const dx = x - xs[i]
      return 2 * c[i] + 6 * d[i] * dx
    },
  }
}
