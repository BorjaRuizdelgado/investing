/**
 * /api/cashflow — SEC EDGAR cash flow breakdown.
 */

import { jsonResp, cachedJsonResp, logError } from '../utils.js'

const SEC_UA = 'investing-tools contact@example.com'
let cachedCikMap = null
let cikMapExpiry = 0

async function getCikMap() {
  const now = Date.now()
  if (cachedCikMap && now < cikMapExpiry) return cachedCikMap
  const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': SEC_UA, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`SEC tickers ${res.status}`)
  const data = await res.json()
  // Build ticker → CIK map
  const map = {}
  for (const entry of Object.values(data)) {
    map[entry.ticker] = String(entry.cik_str).padStart(10, '0')
  }
  cachedCikMap = map
  cikMapExpiry = now + 24 * 60 * 60 * 1000 // 24h cache
  return map
}

// XBRL field → our field name. Multiple XBRL tags can map to the same field (first match wins).
const CF_FIELDS = [
  // Operating
  ['NetIncomeLoss', 'netIncome'],
  ['DepreciationDepletionAndAmortization', 'depreciation'],
  ['DepreciationAndAmortization', 'depreciation'],
  ['ShareBasedCompensation', 'stockBasedComp'],
  ['DeferredIncomeTaxExpenseBenefit', 'deferredTax'],
  ['DeferredIncomeTaxesAndTaxCredits', 'deferredTax'],
  ['OtherNoncashIncomeExpense', 'otherNonCash'],
  ['IncreaseDecreaseInAccountsReceivable', 'changeReceivables'],
  ['IncreaseDecreaseInInventories', 'changeInventory'],
  ['IncreaseDecreaseInAccountsPayable', 'changePayables'],
  ['IncreaseDecreaseInOtherOperatingLiabilities', 'changeOtherLiabilities'],
  ['IncreaseDecreaseInOtherReceivables', 'changeOtherReceivables'],
  ['IncreaseDecreaseInContractWithCustomerLiability', 'changeDeferredRevenue'],
  ['NetCashProvidedByUsedInOperatingActivities', 'operatingCashflow'],
  // Investing
  ['PaymentsToAcquirePropertyPlantAndEquipment', 'capitalExpenditures'],
  ['PaymentsToAcquireMarketableSecurities', 'purchaseInvestments'],
  ['PaymentsToAcquireAvailableForSaleSecuritiesDebt', 'purchaseInvestments'],
  ['PaymentsToAcquireInvestments', 'purchaseInvestments'],
  ['ProceedsFromMaturitiesPrepaymentsAndCallsOfAvailableForSaleSecurities', 'maturitiesInvestments'],
  ['ProceedsFromSaleOfAvailableForSaleSecuritiesDebt', 'saleInvestments'],
  ['ProceedsFromSaleAndMaturityOfMarketableSecurities', 'saleInvestments'],
  ['PaymentsToAcquireBusinessesNetOfCashAcquired', 'acquisitions'],
  ['PaymentsForProceedsFromOtherInvestingActivities', 'otherInvesting'],
  ['NetCashProvidedByUsedInInvestingActivities', 'investingCashflow'],
  // Financing
  ['ProceedsFromIssuanceOfLongTermDebt', 'debtIssuance'],
  ['ProceedsFromIssuanceOfDebt', 'debtIssuance'],
  ['RepaymentsOfLongTermDebt', 'debtRepayment'],
  ['RepaymentsOfDebt', 'debtRepayment'],
  ['PaymentsForRepurchaseOfCommonStock', 'stockBuybacks'],
  ['ProceedsFromIssuanceOfCommonStock', 'stockIssuance'],
  ['ProceedsFromStockOptionsExercised', 'stockIssuance'],
  ['PaymentsOfDividends', 'dividendsPaid'],
  ['PaymentsOfDividendsCommonStock', 'dividendsPaid'],
  ['PaymentsRelatedToTaxWithholdingForShareBasedCompensation', 'taxWithholdingSBC'],
  ['NetCashProvidedByUsedInFinancingActivities', 'financingCashflow'],
  // Net change
  ['CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect', 'netChangeInCash'],
  ['CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents', 'endingCash'],
]

/** Extract the latest 10-K entry for a given XBRL field matching a specific fiscal end date. */
function getAnnualValue(gaap, xbrlField, targetEnd) {
  if (!(xbrlField in gaap)) return undefined
  const units = gaap[xbrlField].units || {}
  const unitKey = Object.keys(units)[0]
  if (!unitKey) return undefined
  const entries = units[unitKey]
  // Find entries from 10-K matching target end date
  if (targetEnd) {
    const match = entries.filter((e) => e.form === '10-K' && e.end === targetEnd)
    if (match.length) return match[match.length - 1].val
  }
  // Fallback: latest 10-K entry
  const annual = entries.filter((e) => e.form === '10-K')
  return annual.length ? annual[annual.length - 1].val : undefined
}

export async function handleCashflow(ticker) {
  try {
    const cikMap = await getCikMap()
    const cik = cikMap[ticker]
    if (!cik) return jsonResp({ error: 'Ticker not found in SEC filings' }, 404)

    const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
      headers: { 'User-Agent': SEC_UA, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`SEC EDGAR ${res.status}`)
    const data = await res.json()
    const gaap = data?.facts?.['us-gaap'] || {}

    // Step 1: Find the most recent fiscal year end from the Operating CF total
    const ocfField = 'NetCashProvidedByUsedInOperatingActivities'
    let fiscalEnd = null
    if (ocfField in gaap) {
      const units = gaap[ocfField].units || {}
      const unitKey = Object.keys(units)[0]
      if (unitKey) {
        const annual = units[unitKey].filter((e) => e.form === '10-K')
        if (annual.length) fiscalEnd = annual[annual.length - 1].end
      }
    }
    if (!fiscalEnd) return jsonResp({ error: 'No annual cash flow data found' }, 404)

    // Step 2: Extract all fields aligned to the same fiscal period
    const result = {}
    for (const [xbrlField, ourField] of CF_FIELDS) {
      if (result[ourField] != null) continue // first XBRL match wins
      const val = getAnnualValue(gaap, xbrlField, fiscalEnd)
      if (val !== undefined) result[ourField] = val
    }

    // Step 3: Negate spending fields (SEC reports "Payments..." as positive values)
    const negateFields = [
      'capitalExpenditures', 'purchaseInvestments', 'acquisitions',
      'debtRepayment', 'stockBuybacks', 'dividendsPaid', 'taxWithholdingSBC',
    ]
    for (const f of negateFields) {
      if (result[f] > 0) result[f] = -result[f]
    }

    result.endDate = fiscalEnd
    result.ticker = ticker
    return cachedJsonResp(result, 86400) // 24h cache — annual data barely changes
  } catch (err) {
    logError('/api/cashflow', err, { ticker })
    return jsonResp({ error: err.message }, 500)
  }
}
