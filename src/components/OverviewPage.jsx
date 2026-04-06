import React, { lazy, Suspense, useState, useMemo } from 'react'
import { fmt, fmtCompact, fmtPct } from '../lib/format.js'
import ScoreCard from './ScoreCard.jsx'
import ReasonList from './ReasonList.jsx'
import Tooltip from './Tooltip.jsx'
import ScenarioCard from './ScenarioCard.jsx'
import MarketSentimentCard from './MarketSentimentCard.jsx'
import { METRIC_TIPS } from '../lib/metricTips.js'

// Lazy-load EarningsCalendar — it imports Plotly (~3 MB) for the EPS chart.
// Deferring it keeps the initial bundle small for the Overview tab.
const EarningsCalendar = lazy(() => import('./EarningsCalendar.jsx'))

function CollapsedReasonList({ title, reasons = [] }) {
  const [expanded, setExpanded] = useState(false)
  if (!reasons.length) return null
  const visible = expanded ? reasons : reasons.slice(0, 3)
  return (
    <section className="terminal-section">
      <div className="section-heading">
        <h2>{title}</h2>
      </div>
      <div className="reason-list">
        {visible.map((reason) => (
          <div
            key={`${reason.title}-${reason.detail}`}
            className={`reason-item reason-item--${reason.tone || 'neutral'}`}
          >
            <div className="reason-title">{reason.title}</div>
            <div className="reason-detail">{reason.detail}</div>
          </div>
        ))}
      </div>
      {reasons.length > 3 && (
        <button className="overview-description-toggle" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : `Show all ${reasons.length} signals`}
        </button>
      )}
    </section>
  )
}

function DescriptionBlock({ text }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="overview-description-wrap">
      <p className={`overview-description${expanded ? ' overview-description--expanded' : ''}`}>
        {text}
      </p>
      <button className="overview-description-toggle" onClick={() => setExpanded((v) => !v)}>
        {expanded ? 'Read less' : 'Read more'}
      </button>
    </div>
  )
}

function tone(score) {
  if (!Number.isFinite(score)) return 'neutral'
  if (score >= 70) return 'positive'
  if (score < 40) return 'negative'
  return 'neutral'
}

function VerdictCard({ label, value, caption, tooltip, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  const chipClass =
    value === 'Undervalued' || value === 'Strong' || value === 'Safe'
      ? 'verdict-chip--positive'
      : value === 'Overvalued' || value === 'Weak' || value === 'Risky'
        ? 'verdict-chip--negative'
        : 'verdict-chip--neutral'
  return (
    <Tag
      className={`terminal-card terminal-card--compact${onClick ? ' terminal-card--clickable' : ''}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <div className="terminal-eyebrow">
        {label}
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      <div className="terminal-stat">
        <span className={`verdict-chip ${chipClass}`} />
        {value}
      </div>
      {caption && <div className="terminal-caption">{caption}</div>}
    </Tag>
  )
}

// Map verdict label → tab id
const VERDICT_TO_TAB = {
  'Valuation Verdict': 'value',
  'Quality Verdict': 'quality',
  'Risk Verdict': 'risk',
}

// Map score label → tab id
const SCORE_TO_TAB = {
  Opportunity: null,
  Valuation: 'value',
  Quality: 'quality',
  Risk: 'risk',
  Technicals: 'technicals',
  Options: 'options',
}

function availableScoreCards(research) {
  return [
    research?.opportunity?.hasData
      ? {
          label: 'Opportunity',
          value: research.opportunity.score,
          detail: research.opportunity.label,
          tooltip: METRIC_TIPS.opportunityScore,
        }
      : null,
    research?.valuation?.hasData
      ? {
          label: 'Valuation',
          value: research.valuation.score,
          detail: research.valuation.label,
          tooltip: METRIC_TIPS.valuationScore,
        }
      : null,
    research?.quality?.hasData
      ? {
          label: 'Quality',
          value: research.quality.score,
          detail: research.quality.label,
          tooltip: METRIC_TIPS.qualityScore,
        }
      : null,
    research?.risk?.hasData
      ? {
          label: 'Risk',
          value: research.risk.score,
          detail: research.risk.label,
          tooltip: METRIC_TIPS.riskScore,
          _origScore: research.risk.safetyScore,
        }
      : null,
    research?.technicals?.hasData
      ? {
          label: 'Technicals',
          value: research.technicals.score,
          detail: research.technicals.label,
          tooltip: METRIC_TIPS.technicalsScore,
        }
      : null,
    research?.options?.score != null
      ? {
          label: 'Options',
          value: research.options.score,
          detail: research.options.label,
          tooltip: METRIC_TIPS.optionsScore,
        }
      : null,
  ].filter(Boolean)
}

function buildScoreExplanation(label, bucket, fallbackDetail) {
  if (!bucket?.hasData && bucket?.score == null) return null
  const primaryReason = bucket?.reasons?.[0]
  return {
    tone: primaryReason?.tone || 'neutral',
    title: `${label} Score`,
    detail: primaryReason?.detail || fallbackDetail,
  }
}

export function buildOverviewScoreReasons(research) {
  const reasons = [
    research?.opportunity?.hasData
      ? {
          tone: 'neutral',
          title: 'Opportunity Score',
          detail:
            'Opportunity blends valuation, quality, risk, options posture, and analyst upside when those inputs are available.',
        }
      : null,
    buildScoreExplanation('Valuation', research?.valuation, METRIC_TIPS.valuationScore),
    buildScoreExplanation('Quality', research?.quality, METRIC_TIPS.qualityScore),
    buildScoreExplanation('Risk', research?.risk, METRIC_TIPS.riskScore),
    buildScoreExplanation('Technicals', research?.technicals, METRIC_TIPS.technicalsScore),
    research?.options?.score != null
      ? buildScoreExplanation('Options', research?.options, METRIC_TIPS.optionsScore)
      : null,
  ]

  return reasons.filter(Boolean)
}

export default function OverviewPage({
  ticker,
  spot,
  fundamentals,
  research,
  analysis,
  onTabChange,
  watchlistHas,
  onToggleWatchlist,
}) {
  const title = fundamentals?.longName || fundamentals?.name || ticker
  const sectorLine = [fundamentals?.sector, fundamentals?.industry].filter(Boolean).join(' · ')
  const scoreCards = useMemo(() => availableScoreCards(research), [research])
  const verdicts = useMemo(() => [
    research?.valuation?.hasData
      ? {
          label: 'Valuation Verdict',
          value: research.valuation.label,
          tooltip: METRIC_TIPS.valuationVerdict,
          caption:
            research.valuation.analystUpsidePct != null
              ? `Analyst gap ${fmtPct(research.valuation.analystUpsidePct)}`
              : 'No analyst fair value in hand',
        }
      : null,
    research?.quality?.hasData
      ? {
          label: 'Quality Verdict',
          value: research.quality.label,
          tooltip: METRIC_TIPS.qualityVerdict,
          caption: Number.isFinite(fundamentals?.operatingMargins)
            ? `Operating margin ${fmtPct(fundamentals.operatingMargins)}`
            : 'Limited profitability data',
        }
      : null,
    research?.risk?.hasData
      ? {
          label: 'Risk Verdict',
          value: research.risk.label,
          tooltip: METRIC_TIPS.riskVerdict,
          caption:
            analysis?.em?.movePct != null
              ? `Implied move ${analysis.em.movePct.toFixed(1)}%`
              : 'No options move estimate',
        }
      : null,
  ].filter(Boolean), [research, fundamentals, analysis])
  const reasonPool = useMemo(() => buildOverviewScoreReasons(research), [research])

  // Stable callback map so memoized children don't re-render due to new arrow functions
  const tabCallbacks = useMemo(() => {
    if (!onTabChange) return {}
    const ids = ['value', 'quality', 'risk', 'technicals', 'options']
    const map = {}
    for (const id of ids) map[id] = () => onTabChange(id)
    return map
  }, [onTabChange])

  return (
    <>
      <section className="terminal-hero">
        <div>
          <div className="hero-title-row">
            <h1>{ticker}</h1>
            {onToggleWatchlist && (
              <button
                className={`overview-watchlist-btn${watchlistHas ? ' overview-watchlist-btn--active' : ''}`}
                onClick={onToggleWatchlist}
              >
                {watchlistHas ? '\u2605 In watchlist' : '\u2606 Add to watchlist'}
              </button>
            )}
          </div>
          <p className="subtitle">
            {title}
            {sectorLine ? ` · ${sectorLine}` : ''}
          </p>
          {fundamentals?.description && (
            <DescriptionBlock text={fundamentals.description} />
          )}
        </div>
        <div className="hero-stats">
          <div className="terminal-card terminal-card--compact">
            <div className="terminal-eyebrow">Price</div>
            <div className="terminal-stat">{fmt(spot)}</div>
            <div className="terminal-caption">{fundamentals?.currency || 'USD'}</div>
          </div>
          <div className="terminal-card terminal-card--compact">
            <div className="terminal-eyebrow">Market Cap</div>
            <div className="terminal-stat">{fmtCompact(fundamentals?.marketCap)}</div>
            <div className="terminal-caption">{fundamentals?.exchange || 'Market'}</div>
          </div>
        </div>
      </section>

      {scoreCards.length > 0 && (
        <section className="terminal-section">
          <div className="section-heading">
            <h2>Composite Scores</h2>
          </div>
          <div className="score-grid">
            {scoreCards.map((card) => {
              const tabId = SCORE_TO_TAB[card.label]
              return (
                <ScoreCard
                  key={card.label}
                  label={card.label}
                  score={card.value}
                  tone={card._origScore != null ? tone(card._origScore) : tone(card.value)}
                  detail={card.detail}
                  tooltip={card.tooltip}
                  onClick={tabId ? tabCallbacks[tabId] : undefined}
                />
              )
            })}
            <MarketSentimentCard
              sentiment={research?.marketSentiment}
              onClick={tabCallbacks.technicals}
            />
          </div>
        </section>
      )}

      {verdicts.length > 0 && (
        <section className="terminal-section">
          <div className="section-heading">
            <h2>At A Glance</h2>
          </div>
          <div className="terminal-grid terminal-grid--3">
            {verdicts.map((verdict) => {
              const tabId = VERDICT_TO_TAB[verdict.label]
              return (
                <VerdictCard
                  key={verdict.label}
                  {...verdict}
                  onClick={tabId ? tabCallbacks[tabId] : undefined}
                />
              )
            })}
          </div>
        </section>
      )}

      {research?.valuation?.fairValue && (
        <section className="terminal-section">
          <div className="section-heading">
            <h2>Fair Value Scenario</h2>
          </div>
          <ScenarioCard fairValue={research.valuation.fairValue} />
        </section>
      )}

      <Suspense fallback={null}>
        <EarningsCalendar fundamentals={fundamentals} />
      </Suspense>

      <CollapsedReasonList title="Key Signals" reasons={research?.signals || []} />
      <CollapsedReasonList title="Why These Scores" reasons={reasonPool} />
    </>
  )
}
