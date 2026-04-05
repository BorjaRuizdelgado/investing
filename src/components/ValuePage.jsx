import React from 'react'
import ScoreCard from './ScoreCard.jsx'
import MetricTable from './MetricTable.jsx'
import ReasonList from './ReasonList.jsx'
import ScenarioCard from './ScenarioCard.jsx'
import TldrBanner from './TldrBanner.jsx'
import { METRIC_TIPS } from '../lib/metricTips.js'
import { buildSectorMedians } from '../lib/sectorMedians.js'
import { valuationTldr } from '../lib/tldr.js'

export default function ValuePage({ research, fundamentals }) {
  // useMemo must come before any conditional return (Rules of Hooks)
  const sectorMedians = React.useMemo(() => buildSectorMedians(fundamentals), [fundamentals])
  const tldr = React.useMemo(() => valuationTldr(research, fundamentals), [research, fundamentals])

  if (!research?.valuation?.hasData) return null

  return (
    <>
      {tldr && <TldrBanner text={tldr.text} tone={tldr.tone} />}
      <section className="terminal-section">
        <div className="section-heading">
          <h2>Valuation</h2>
        </div>
        <div className="terminal-grid terminal-grid--2">
          <ScoreCard
            label="Valuation Score"
            score={research?.valuation?.score}
            tone={
              research?.valuation?.score >= 60
                ? 'positive'
                : research?.valuation?.score < 35
                  ? 'negative'
                  : 'neutral'
            }
            detail={research?.valuation?.label}
            tooltip={METRIC_TIPS.valuationScore}
          />
          {research?.valuation?.fairValue ? (
            <ScenarioCard fairValue={research.valuation.fairValue} />
          ) : (
            <div className="terminal-card">
              <div className="terminal-eyebrow">Fair Value Range</div>
              <p className="terminal-caption">
                Not enough inputs to derive a fair value range yet.
              </p>
            </div>
          )}
        </div>
      </section>

      <MetricTable
        title="Valuation Metrics"
        metrics={research?.valuation?.metrics || []}
        sectorMedians={sectorMedians}
      />
      <ReasonList title="Valuation Drivers" reasons={research?.valuation?.reasons || []} />
    </>
  )
}
