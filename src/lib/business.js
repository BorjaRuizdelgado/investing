export function deriveBusiness(fundamentals) {
  const statements = fundamentals?.statements || null

  const incomeSeries = (statements?.income || [])
    .slice()
    .reverse()
    .map((row) => ({
      period: row.endDate,
      revenue: row.totalRevenue,
      grossProfit: row.grossProfit,
      operatingIncome: row.operatingIncome,
      netIncome: row.netIncome,
    }))

  const cashflowSeries = (statements?.cashflow || [])
    .slice()
    .reverse()
    .map((row) => ({
      period: row.endDate,
      operatingCashflow: row.operatingCashflow,
      capitalExpenditures: row.capitalExpenditures,
      freeCashflow: row.freeCashflow,
    }))

  const seriesHasValues = (series, fields) =>
    series.some((row) => fields.some((field) => Number.isFinite(row[field])))

  const hasIncomeSeries = seriesHasValues(incomeSeries, [
    'revenue',
    'grossProfit',
    'operatingIncome',
    'netIncome',
  ])
  const hasCashflowSeries = seriesHasValues(cashflowSeries, [
    'operatingCashflow',
    'capitalExpenditures',
    'freeCashflow',
  ])
  const hasFinancialSeries = hasIncomeSeries || hasCashflowSeries
  const hasSummary =
    Boolean(fundamentals?.longName || fundamentals?.name) &&
    [
      fundamentals?.totalRevenue,
      fundamentals?.freeCashflow,
      fundamentals?.sector,
      fundamentals?.industry,
    ].some((value) => value != null)

  return {
    hasData: hasFinancialSeries || hasSummary,
    hasFinancialSeries,
    hasIncomeSeries,
    hasCashflowSeries,
    hasSummary,
    incomeSeries,
    cashflowSeries,
    hasRevenueMix: false,
  }
}
