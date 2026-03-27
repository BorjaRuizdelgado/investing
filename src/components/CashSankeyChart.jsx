import React, { useMemo, useState, useEffect } from 'react'
import Plot from 'react-plotly.js'
import { fmtCompact } from '../lib/format.js'
import { getColors, chartHeight } from '../lib/theme.js'

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
    const formatted = value != null ? fmtCompact(value) : ''
    nodes.push({ label: `${label}<br>${formatted}`, color })
    return i
  }

  const addLink = (source, target, value, color) => {
    if (value == null || value === 0) return
    links.push({ source, target, value: Math.abs(value), color })
  }

  const c = getColors()
  const greenFill = 'rgba(61,122,90,0.45)'
  const redFill = 'rgba(176,80,64,0.45)'

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
    for (const item of items) {
      const val = cf[item.key]
      if (val == null || val === 0) continue
      itemsSum += val
      const positive = val > 0
      const ni = addNode(item.label, val, positive ? c.green : c.red)
      if (positive) {
        addLink(ni, targetNode, val, greenFill)
      } else {
        addLink(targetNode, ni, val, redFill)
      }
    }
    // Add residual "Other" if items don't sum to the total
    const total = cf[totalKey]
    if (total != null) {
      const residual = total - itemsSum
      if (Math.abs(residual) > 1e6) { // only show if > $1M
        const positive = residual > 0
        const ni = addNode('Other', residual, positive ? c.green : c.red)
        if (positive) {
          addLink(ni, targetNode, residual, greenFill)
        } else {
          addLink(targetNode, ni, residual, redFill)
        }
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
  const [cf, setCf] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    setCf(null)
    fetch(`/api/cashflow?ticker=${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setCf(null)
        else setCf(data)
      })
      .catch(() => setCf(null))
      .finally(() => setLoading(false))
  }, [ticker])

  const { data, layout } = useMemo(() => {
    if (!cf || cf.operatingCashflow == null) return { data: null, layout: null }

    const { nodes, links } = buildSankey(cf)
    if (!links.length) return { data: null, layout: null }

    const c = getColors()

    const trace = {
      type: 'sankey',
      orientation: 'h',
      arrangement: 'snap',
      node: {
        pad: 24,
        thickness: 22,
        line: { color: c.border, width: 0.5 },
        label: nodes.map((n) => n.label),
        color: nodes.map((n) => n.color),
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

    const height = chartHeight(620, 460)

    return {
      data: [trace],
      layout: {
        autosize: true,
        height,
        margin: { l: 10, r: 10, t: 10, b: 10 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: {
          family: 'DM Sans, Helvetica Neue, Helvetica, Arial, sans-serif',
          color: c.text,
          size: 13,
        },
      },
    }
  }, [cf])

  if (loading) return null
  if (!data) return null

  const period = cf?.endDate || ''

  return (
    <div className="terminal-card">
      <div className="terminal-eyebrow">
        Cash Flow Breakdown{period ? ` — FY ${period.slice(0, 4)}` : ''}
      </div>
      <Plot
        data={data}
        layout={layout}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%' }}
        useResizeHandler
      />
    </div>
  )
}
