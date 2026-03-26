/**
 * constants.js — Centralised magic numbers and scoring thresholds.
 *
 * Every hard-coded literal that controls analysis behaviour lives here
 * so the values are documented, discoverable, and easy to tune.
 */

// ---- analysis.js: implied distribution & expected move ----------------

/** Minimum liquid strikes required for distribution (relaxed pass) */
export const MIN_STRIKES_RELAXED = 4

/** Minimum liquid strikes required before the relaxed pass */
export const MIN_STRIKES_STRICT = 6

/** OTM call/put multipliers for the relaxed pass */
export const OTM_CALL_FACTOR_RELAXED = 0.9
export const OTM_PUT_FACTOR_RELAXED = 1.1

/** Strike range multipliers for the interpolated PDF grid */
export const STRIKE_RANGE_LO = 0.6
export const STRIKE_RANGE_HI = 1.4

/** Straddle-to-expected-move conversion factor */
export const STRADDLE_MOVE_FACTOR = 0.85

/** ATM band for IV smile (2% either side of spot) */
export const ATM_BAND_LO = 0.98
export const ATM_BAND_HI = 1.02

/** Default number of points in the distribution grid */
export const DIST_POINTS = 500

/** Default number of support/resistance levels per side */
export const SR_LEVEL_COUNT = 6

// ---- scoring.js: label band thresholds --------------------------------

/** Score boundaries for labelFromScore() */
export const BAND_WEAK = 35
export const BAND_MIXED = 55
export const BAND_GOOD = 75

/** softenScore floor & ceiling */
export const SOFTEN_FLOOR = 8
export const SOFTEN_CEILING = 92

// ---- valuation.js: scoring ranges -------------------------------------

/** Forward P/E — lower is better */
export const VAL_FWD_PE_GOOD = 12
export const VAL_FWD_PE_BAD = 32

/** Trailing P/E — lower is better */
export const VAL_TRAIL_PE_GOOD = 15
export const VAL_TRAIL_PE_BAD = 35

/** Price-to-Book — lower is better */
export const VAL_PB_GOOD = 1.5
export const VAL_PB_BAD = 6

/** EV/Revenue — lower is better */
export const VAL_EV_REV_GOOD = 2
export const VAL_EV_REV_BAD = 10

/** EV/EBITDA — lower is better */
export const VAL_EV_EBITDA_GOOD = 8
export const VAL_EV_EBITDA_BAD = 22

/** Earnings yield — higher is better */
export const VAL_EY_BAD = 0.02
export const VAL_EY_GOOD = 0.08

/** FCF yield — higher is better */
export const VAL_FCF_BAD = 0.01
export const VAL_FCF_GOOD = 0.06

// ---- quality.js: scoring ranges ---------------------------------------

/** Revenue growth — higher is better */
export const QUAL_REV_GROWTH_BAD = -0.05
export const QUAL_REV_GROWTH_GOOD = 0.15

/** Earnings growth — higher is better */
export const QUAL_EARN_GROWTH_BAD = -0.1
export const QUAL_EARN_GROWTH_GOOD = 0.18

/** Gross margin — higher is better */
export const QUAL_GROSS_MARGIN_BAD = 0.2
export const QUAL_GROSS_MARGIN_GOOD = 0.55

/** Operating margin — higher is better */
export const QUAL_OP_MARGIN_BAD = 0.03
export const QUAL_OP_MARGIN_GOOD = 0.2

/** Net margin — higher is better */
export const QUAL_NET_MARGIN_BAD = 0.02
export const QUAL_NET_MARGIN_GOOD = 0.18

/** ROE — higher is better */
export const QUAL_ROE_BAD = 0.05
export const QUAL_ROE_GOOD = 0.2

/** ROA — higher is better */
export const QUAL_ROA_BAD = 0.01
export const QUAL_ROA_GOOD = 0.08

/** FCF margin — higher is better */
export const QUAL_FCF_MARGIN_BAD = 0.01
export const QUAL_FCF_MARGIN_GOOD = 0.15

// ---- risk.js: scoring ranges ------------------------------------------

/** Debt/Equity — lower is better */
export const RISK_DE_GOOD = 40
export const RISK_DE_BAD = 180

/** Current ratio — higher is better */
export const RISK_CR_BAD = 0.9
export const RISK_CR_GOOD = 2

/** Quick ratio — higher is better */
export const RISK_QR_BAD = 0.8
export const RISK_QR_GOOD = 1.8

/** Beta — range-better: 0.8-1.2 is ideal */
export const RISK_BETA_LO_GOOD = 0.8
export const RISK_BETA_HI_GOOD = 1.2
export const RISK_BETA_LO_BAD = 0.3
export const RISK_BETA_HI_BAD = 2.2

/** Short % float — lower is better */
export const RISK_SHORT_GOOD = 5
export const RISK_SHORT_BAD = 25

/** Implied move — lower is better */
export const RISK_MOVE_GOOD = 0.03
export const RISK_MOVE_BAD = 0.12

// ---- technicals.js: indicator parameters & scoring ranges ----------------

/** RSI */
export const TA_RSI_PERIOD = 14
export const TA_RSI_OVERSOLD = 30
export const TA_RSI_OVERBOUGHT = 70

/** MACD */
export const TA_MACD_FAST = 12
export const TA_MACD_SLOW = 26
export const TA_MACD_SIGNAL = 9

/** Bollinger Bands */
export const TA_BB_PERIOD = 20
export const TA_BB_STD_DEV = 2

/** Volume trend lookback */
export const TA_VOLUME_SHORT = 5
export const TA_VOLUME_LONG = 20

/** Earnings proximity warning threshold (days) */
export const EARNINGS_WARNING_DAYS = 14
