export const METRIC_TIPS = {
  trailingPE:
    'Price-to-Earnings based on trailing 12 months. Lower values can indicate cheaper valuation, but context matters.',
  forwardPE:
    'Price-to-Earnings based on forward earnings estimates. Lower values suggest less optimism is priced in.',
  pegRatio:
    'P/E divided by expected earnings growth. Around 1 is often treated as growth-adjusted fair value.',
  priceToBook:
    'Price relative to book value. More useful for asset-heavy businesses than for software or service firms.',
  priceToSales: 'Price relative to revenue. Useful when earnings are weak or volatile.',
  marketCap: 'Total market value of the company’s equity.',
  enterpriseValue:
    'Market cap plus debt minus cash. A cleaner total-value measure than market cap alone.',
  enterpriseToRevenue:
    'Enterprise value divided by revenue. Measures what the market pays per dollar of sales.',
  enterpriseToEbitda:
    'Enterprise value divided by EBITDA. Common shorthand for operating valuation.',
  earningsYield: 'Inverse of P/E. Higher values mean more earnings per dollar invested.',
  fcfYield:
    'Free cash flow divided by market cap. Higher values suggest more cash generation relative to price.',
  revenueGrowth:
    'Year-over-year revenue growth. Positive growth usually indicates business expansion.',
  earningsGrowth:
    'Year-over-year earnings growth. More volatile than revenue growth, but important for profitability trends.',
  grossMargins:
    'Gross profit divided by revenue. Shows how efficiently the company produces what it sells.',
  operatingMargins:
    'Operating income divided by revenue. A cleaner measure of core business profitability.',
  profitMargins:
    'Net income divided by revenue. Captures bottom-line profitability after all expenses.',
  returnOnEquity:
    'Net income relative to shareholder equity. Measures how effectively equity capital is used.',
  returnOnAssets:
    'Net income relative to total assets. Shows how effectively the asset base generates profit.',
  fcfMargin: 'Free cash flow divided by revenue. Shows how much revenue turns into spendable cash.',
  debtToEquity:
    'Debt relative to shareholder equity. Higher values can indicate higher financial risk.',
  currentRatio: 'Current assets divided by current liabilities. Helps assess short-term liquidity.',
  quickRatio: 'Like current ratio, but excludes inventory. A stricter liquidity test.',
  beta: 'Sensitivity to market movements. Above 1 means more volatile than the market.',
  shortPercentOfFloat:
    'Short interest as a share of tradable float. High values can signal bearish positioning or squeeze risk.',
  impliedMove: 'Options-implied expected move into expiry based on the ATM straddle.',
  opportunityScore:
    'Composite score blending valuation, quality, risk, options posture, and upside gap when available.',
  valuationScore: 'Composite score from the available valuation inputs only.',
  qualityScore:
    'Composite score from the available profitability, growth, and cash-generation inputs only.',
  riskScore:
    'Composite score from the available leverage, liquidity, volatility, and event-risk inputs only.',
  optionsScore: 'Composite score from the available options-implied positioning inputs only.',
  fundamentalsScore: 'Composite score from the available raw fundamental fields only.',
  valuationVerdict: 'High-level interpretation of the current valuation inputs.',
  qualityVerdict: 'High-level interpretation of the current business quality inputs.',
  riskVerdict: 'High-level interpretation of the current risk inputs.',
  fairValueRange: 'Scenario range based on the valuation methods available for this ticker.',
}

/** Per-field tooltips for the raw fundamentals reference panel. */
export const FUNDAMENTAL_TIPS = {
  trailingPE:
    'Price-to-Earnings (trailing 12 months). Below 15 is generally considered cheap; above 30 expensive.',
  forwardPE:
    'Price-to-Earnings based on forward estimates. Lower values suggest cheaper valuation relative to expected earnings.',
  pegRatio:
    'P/E divided by earnings growth rate (5yr expected). Below 1 suggests undervaluation relative to growth.',
  priceToBook:
    'Price-to-Book value. Below 1.5 may indicate undervaluation; above 5 suggests premium pricing.',
  priceToSales:
    'Price-to-Sales ratio. Useful for companies with low or negative earnings. Lower is generally better.',
  marketCap: 'Total market value of outstanding shares.',
  enterpriseValue: 'Market cap + debt − cash. Represents the total cost to acquire the company.',
  enterpriseToRevenue:
    'Enterprise Value / Revenue. Measures what the market pays per dollar of revenue.',
  enterpriseToEbitda:
    'Enterprise Value / EBITDA. Common acquisition valuation metric; lower may signal value.',
  eps: 'Earnings Per Share (trailing 12 months). Positive means the company is profitable.',
  epsForward: 'Expected Earnings Per Share for the next fiscal year based on analyst estimates.',
  ebitda:
    'Earnings Before Interest, Taxes, Depreciation & Amortisation. A proxy for operating cash flow.',
  totalRevenue: "Total revenue (trailing 12 months). The company's top-line income.",
  revenuePerShare: 'Revenue divided by shares outstanding.',
  revenueGrowth: 'Year-over-year revenue growth rate. Positive indicates expanding top-line.',
  earningsGrowth: 'Year-over-year earnings growth rate.',
  profitMargins: 'Net income / revenue. Higher margins indicate better profitability.',
  grossMargins: 'Gross profit / revenue. Shows production efficiency before operating costs.',
  ebitdaMargins: 'EBITDA / revenue. Measures operational profitability before non-cash charges.',
  operatingMargins: 'Operating income / revenue. Measures core business profitability.',
  returnOnEquity:
    'Net income / shareholder equity. Measures how efficiently equity capital generates profit.',
  returnOnAssets: 'Net income / total assets. How efficiently assets generate earnings.',
  netIncome: 'Bottom-line profit after all expenses, taxes, and costs (most recent annual).',
  grossProfit: 'Revenue minus cost of goods sold (most recent annual).',
  operatingIncome: 'Profit from core operations before interest and taxes (most recent annual).',
  totalCash: 'Total cash and cash equivalents on the balance sheet.',
  totalCashPerShare: 'Cash per share — total cash divided by shares outstanding.',
  totalDebt: 'Total debt obligations.',
  debtToEquity: 'Total debt / shareholder equity. Lower values suggest less leverage risk.',
  currentRatio:
    'Current assets / current liabilities. Above 1 means the company can cover short-term debts.',
  quickRatio:
    'Quick assets / current liabilities. Like current ratio but excludes inventory — stricter test of liquidity.',
  bookValue: 'Net asset value per share (total assets minus liabilities, divided by shares).',
  totalAssets: 'Total assets on the balance sheet.',
  totalLiabilities: 'Total liabilities on the balance sheet.',
  totalStockholderEquity: 'Total shareholder equity — assets minus liabilities.',
  operatingCashflow: 'Cash generated from operations. Positive is healthy.',
  freeCashflow:
    'Operating cash flow minus capital expenditures. Cash available for dividends, buybacks, or reinvestment.',
  capitalExpenditures: 'Spending on fixed assets (property, equipment, etc.).',
  dividendYield:
    'Annual dividend / share price. Higher yields provide more income per dollar invested.',
  dividendRate: 'Annual dividend payment per share in dollars.',
  trailingAnnualDividendRate: 'Sum of dividends paid over the last 12 months per share.',
  fiveYearAvgDividendYield: 'Average dividend yield over the past 5 years.',
  payoutRatio: 'Dividends paid / net income. A very high ratio may be unsustainable.',
  exDividendDate: 'Last ex-dividend date. Buy before this date to receive the next dividend.',
  lastDividendValue: 'Most recent dividend payment per share.',
  beta: 'Volatility relative to the market (S&P 500). 1.0 = same volatility; >1.5 = high; <0.5 = low.',
  fiftyTwoWeek: 'Lowest and highest price over the past 52 weeks.',
  fiftyTwoWeekChange: 'Price change over the past 52 weeks as a percentage.',
  fiftyDayAverage: 'Average closing price over the last 50 trading days.',
  twoHundredDayAverage:
    'Average closing price over the last 200 trading days. Key long-term trend indicator.',
  avgVolume: 'Average daily trading volume over the last 3 months.',
  avgVolume10d: 'Average daily trading volume over the last 10 days.',
  sharesOutstanding: 'Total number of shares currently held by all shareholders.',
  floatShares: 'Shares available for public trading (excludes insider and restricted shares).',
  heldPercentInsiders: 'Percentage of shares held by company insiders.',
  heldPercentInstitutions: 'Percentage of shares held by institutional investors.',
  sharesShort: 'Number of shares currently sold short.',
  shortRatio: 'Days to cover: short interest / average daily volume.',
  shortPercentOfFloat:
    'Short interest as a percentage of float. High values may indicate bearish sentiment or squeeze potential.',
  sharesShortPriorMonth:
    'Short interest from the prior reporting month. Compare with current to spot trends.',
  dayRange: "Today's low and high trading prices.",
  previousClose: "Last session's closing price.",
  open: "Today's opening price.",
  volume: 'Number of shares traded today.',
  marketChange: 'Price change from previous close in dollars and percent.',
  targetMeanPrice: 'Average analyst price target.',
  targetMedianPrice: 'Median analyst price target.',
  targetRange: 'Range of analyst price targets from low to high.',
  recommendationKey: 'Analyst consensus: strong buy, buy, hold, underperform, or sell.',
  numberOfAnalystOpinions: 'Number of analysts providing estimates.',
  earningsDate: 'Upcoming or most recent earnings report date.',
  earningsQuarterlyGrowth: 'Year-over-year quarterly earnings growth rate.',
}
