import React, { useMemo, useState, useEffect } from 'react'
import { getColors, chartHeight, hexToRgba } from '../lib/theme.js'
import { fmtCompact } from '../lib/format.js'
import ChartFrame from './ChartFrame.jsx'
import Skeleton from './Skeleton.jsx'

/** Compact label for Sankey nodes — 1 decimal to keep labels short. Returns '' for invalid. */
function fmtSankeyLabel(val) {
  if (val == null || !Number.isFinite(val)) return ''
  return fmtCompact(val, 1)
}

/**
 * Builds Plotly Sankey node/link arrays from SEC EDGAR cash flow data.
 *
 * Layout (left → right):
 *   Operating items → Operating CF ──→ Free Cash Flow ──→ Net Change in Cash
 *   Investing items → Investing CF ─────────────────────↗
 *   Financing items → Financing CF ─────────────────────↗
 */
function buildSankey(cf) {
  const nodes = []
  const links = []
  let idx = 0

  const addNode = (label, value, color) => {
    const i = idx++
    const formatted = fmtSankeyLabel(value)
    nodes.push({ label: formatted ? `${label}  ${formatted}` : label, color })
    return i
  }

  const addLink = (source, target, value, color) => {
    if (value == null || value === 0) return
    links.push({ source, target, value: Math.abs(value), color })
  }

  const c = getColors()
  const greenFill = hexToRgba(c.green, 0.55)
  const redFill = hexToRgba(c.red, 0.55)

  // --- Aggregated nodes (middle/right) ---
  const nOperatingCF = addNode('Operating CF', cf.operatingCashflow,
    cf.operatingCashflow >= 0 ? c.green : c.red)
  const nInvestingCF = addNode('Investing CF', cf.investingCashflow,
    cf.investingCashflow >= 0 ? c.green : c.red)
  const nFinancingCF = addNode('Financing CF', cf.financingCashflow,
    cf.financingCashflow >= 0 ? c.green : c.red)

  const fcf =
    cf.operatingCashflow != null && cf.capitalExpenditures != null
      ? cf.operatingCashflow + cf.capitalExpenditures
      : null
  const nFCF = addNode('Free Cash Flow', fcf, fcf >= 0 ? c.green : c.red)
  const nNetChange = addNode('Net Change in Cash', cf.netChangeInCash,
    cf.netChangeInCash >= 0 ? c.green : c.red)

  // Helper: add section items with residual ("Other") to balance the total
  function addSectionItems(items, totalKey, targetNode) {
    let itemsSum = 0
    const resolved = []
    for (const item of items) {
      const val = cf[item.key]
      if (val == null || val === 0) continue
      itemsSum += val
      resolved.push({ label: item.label, val })
    }
    // Add residual "Other" if items don't sum to the total
    const total = cf[totalKey]
    if (total != null) {
      const residual = total - itemsSum
      if (Math.abs(residual) > 5e6) {
        resolved.push({ label: 'Other', val: residual })
      }
    }
    // Positives first (inflows, left side), then negatives (outflows, right side).
    // Within each group, sort largest-to-smallest so the biggest bands sit next to
    // each other and the Plotly layout engine can avoid crossings.
    resolved.sort((a, b) => {
      if (a.val > 0 && b.val <= 0) return -1
      if (a.val <= 0 && b.val > 0) return 1
      return Math.abs(b.val) - Math.abs(a.val)
    })
    for (const { label, val } of resolved) {
      const positive = val > 0
      const ni = addNode(label, val, positive ? c.green : c.red)
      if (positive) {
        addLink(ni, targetNode, val, greenFill)
      } else {
        addLink(targetNode, ni, Math.abs(val), redFill)
      }
    }
  }

  // --- Operating items ---
  addSectionItems([
    { key: 'netIncome', label: 'Net Income' },
    { key: 'depreciation', label: 'Depreciation & Amort.' },
    { key: 'stockBasedComp', label: 'Stock-Based Comp' },
    { key: 'deferredTax', label: 'Deferred Tax' },
    { key: 'otherNonCash', label: 'Other Non-Cash' },
    { key: 'changeReceivables', label: 'Change in Receivables' },
    { key: 'changePayables', label: 'Change in Payables' },
    { key: 'changeInventory', label: 'Change in Inventory' },
    { key: 'changeOtherLiabilities', label: 'Other Working Capital' },
    { key: 'changeOtherReceivables', label: 'Other Receivables' },
    { key: 'changeDeferredRevenue', label: 'Deferred Revenue' },
  ], 'operatingCashflow', nOperatingCF)

  // --- Investing items ---
  addSectionItems([
    { key: 'capitalExpenditures', label: 'Capital Expenditures' },
    { key: 'purchaseInvestments', label: 'Purchases of Investments' },
    { key: 'maturitiesInvestments', label: 'Maturities of Investments' },
    { key: 'saleInvestments', label: 'Sales of Investments' },
    { key: 'acquisitions', label: 'Acquisitions' },
    { key: 'otherInvesting', label: 'Other Investing' },
  ], 'investingCashflow', nInvestingCF)

  // --- Financing items ---
  addSectionItems([
    { key: 'debtIssuance', label: 'Debt Issuance' },
    { key: 'debtRepayment', label: 'Debt Repayment' },
    { key: 'stockBuybacks', label: 'Stock Buybacks' },
    { key: 'stockIssuance', label: 'Stock Issuance' },
    { key: 'dividendsPaid', label: 'Dividends Paid' },
    { key: 'taxWithholdingSBC', label: 'Tax Withholding (SBC)' },
  ], 'financingCashflow', nFinancingCF)

  // --- Aggregated flows → right side ---
  // Operating CF → Free Cash Flow
  if (cf.operatingCashflow > 0 && fcf != null) {
    addLink(nOperatingCF, nFCF, Math.abs(fcf), greenFill)
  }

  // FCF → Net Change in Cash
  if (fcf != null && fcf > 0) {
    addLink(nFCF, nNetChange, Math.abs(fcf), greenFill)
  } else if (fcf != null && fcf < 0) {
    addLink(nNetChange, nFCF, Math.abs(fcf), redFill)
  }

  // Investing CF (non-capex portion) → Net Change in Cash
  const investingNonCapex =
    cf.investingCashflow != null && cf.capitalExpenditures != null
      ? cf.investingCashflow - cf.capitalExpenditures
      : cf.investingCashflow
  if (investingNonCapex != null && investingNonCapex !== 0) {
    if (investingNonCapex > 0) {
      addLink(nInvestingCF, nNetChange, Math.abs(investingNonCapex), greenFill)
    } else {
      addLink(nNetChange, nInvestingCF, Math.abs(investingNonCapex), redFill)
    }
  }

  // Financing CF → Net Change in Cash
  if (cf.financingCashflow != null && cf.financingCashflow !== 0) {
    if (cf.financingCashflow > 0) {
      addLink(nFinancingCF, nNetChange, cf.financingCashflow, greenFill)
    } else {
      addLink(nNetChange, nFinancingCF, Math.abs(cf.financingCashflow), redFill)
    }
  }

  return { nodes, links }
}

export default function CashSankeyChart({ ticker }) {
  const [request, setRequest] = useState({ ticker: null, cf: null })

  useEffect(() => {
    if (!ticker) return
    let cancelled = false

    fetch(`/api/cashflow?ticker=${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setRequest({ ticker, cf: data.error ? null : data })
      })
      .catch(() => {
        if (!cancelled) setRequest({ ticker, cf: null })
      })

    return () => {
      cancelled = true
    }
  }, [ticker])

  const loading = Boolean(ticker) && request.ticker !== ticker
  const cf = request.ticker === ticker ? request.cf : null

  const { data, layout } = useMemo(() => {
    if (!cf || cf.operatingCashflow == null) return { data: null, layout: null }

    const { nodes, links } = buildSankey(cf)
    if (!links.length) return { data: null, layout: null }

    const c = getColors()

    const trace = {
      type: 'sankey',
      orientation: 'h',
      arrangement: 'freeform',
      node: {
        pad: 38,
        thickness: 18,
        line: { color: c.border, width: 0.4 },
        label: nodes.map((n) => n.label),
        color: nodes.map((n) => n.color),
        font: { color: c.text },
        hovertemplate: '%{label}<extra></extra>',
      },
      link: {
        source: links.map((l) => l.source),
        target: links.map((l) => l.target),
        value: links.map((l) => l.value),
        color: links.map((l) => l.color),
        hovertemplate: '%{source.label} → %{target.label}<br>%{value:$,.0f}<extra></extra>',
      },
    }

    const height = chartHeight(800, 580)

    return {
      data: [trace],
      layout: {
        autosize: true,
        height,
        margin: { l: 0, r: 10, t: 16, b: 10 },
        paper_bgcolor: c.bg,
        plot_bgcolor: c.bg,
        hoverlabel: {
          bgcolor: c.bg,
          bordercolor: c.border,
          font: { color: c.text, size: 13, family: 'DM Sans, Helvetica Neue, Helvetica, Arial, sans-serif' },
        },
        font: {
          family: 'DM Sans, Helvetica Neue, Helvetica, Arial, sans-serif',
          color: c.text,
          size: 14,
        },
      },
    }
  }, [cf])

  if (loading) {
    return (
      <div className="terminal-card">
        <Skeleton height="2rem" width="40%" style={{ marginBottom: '1rem' }} />
        <Skeleton height="500px" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="terminal-card">
        <div className="terminal-eyebrow">Cash Flow Breakdown</div>
        <div className="info-box" style={{ marginTop: '0.75rem' }}>
          Cash flow data is not available for this ticker.
        </div>
      </div>
    )
  }

  const period = cf?.endDate || ''

  return (
    <div className="terminal-card">
      <div className="terminal-eyebrow">
        Cash Flow Breakdown{period ? ` — FY ${period.slice(0, 4)}` : ''}
      </div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <ChartFrame
          data={data}
          layout={layout}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', minWidth: 1200 }}
          showControls={false}
          defaultInteractive={false}
        />
      </div>
    </div>
  )
}
