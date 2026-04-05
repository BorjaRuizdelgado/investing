import React from 'react'
import ScoreCard from './ScoreCard.jsx'
import MetricTable from './MetricTable.jsx'
import ReasonList from './ReasonList.jsx'
import TldrBanner from './TldrBanner.jsx'
import { METRIC_TIPS } from '../lib/metricTips.js'
import { buildSectorMedians } from '../lib/sectorMedians.js'
import { qualityTldr } from '../lib/tldr.js'

export default function QualityPage({ research, fundamentals }) {
  // useMemo must come before any conditional return (Rules of Hooks)
  const sectorMedians = React.useMemo(() => buildSectorMedians(fundamentals), [fundamentals])
  const tldr = React.useMemo(() => qualityTldr(research, fundamentals), [research, fundamentals])

  if (!research?.quality?.hasData) return null

  return (
    <>
      {tldr && <TldrBanner text={tldr.text} tone={tldr.tone} />}
      <section className="terminal-section">
        <div className="section-heading">
          <h2>Business Quality</h2>
        </div>
        <div className="terminal-grid terminal-grid--2">
          <ScoreCard
            label="Quality Score"
            score={research?.quality?.score}
            tone={
              research?.quality?.score >= 70
                ? 'positive'
                : research?.quality?.score < 40
                  ? 'negative'
                  : 'neutral'
            }
            detail={research?.quality?.label}
            tooltip={METRIC_TIPS.qualityScore}
          />
          <div className="terminal-card">
            <div className="terminal-eyebrow">Interpretation</div>
            <p className="terminal-copy">
              Strong businesses usually sustain margins, generate cash, and avoid relying on purely
              narrative-driven growth.
            </p>
          </div>
        </div>
      </section>

      <MetricTable
        title="Quality Metrics"
        metrics={research?.quality?.metrics || []}
        sectorMedians={sectorMedians}
      />
      <ReasonList title="Quality Drivers" reasons={research?.quality?.reasons || []} />
    </>
  )
}
