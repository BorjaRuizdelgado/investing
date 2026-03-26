import React from "react";
import ScoreCard from "./ScoreCard.jsx";
import MetricTable from "./MetricTable.jsx";
import ReasonList from "./ReasonList.jsx";
import { METRIC_TIPS } from "../lib/metricTips.js";
import { buildSectorMedians } from "../lib/sectorMedians.js";

export default function RiskPage({ research, fundamentals }) {
  if (!research?.risk?.hasData) return null;

  const sectorMedians = React.useMemo(() => buildSectorMedians(fundamentals), [fundamentals]);

  return (
    <>
      <section className="terminal-section">
        <div className="section-heading">
          <h2>Risk</h2>
        </div>
        <div className="terminal-grid terminal-grid--2">
          <ScoreCard
            label="Risk Score"
            score={research?.risk?.score}
            tone={research?.risk?.safetyScore >= 65 ? "positive" : research?.risk?.safetyScore < 40 ? "negative" : "neutral"}
            detail={research?.risk?.label}
            tooltip={METRIC_TIPS.riskScore}
          />
          <div className="terminal-card">
            <div className="terminal-eyebrow">Interpretation</div>
            <p className="terminal-copy">
              Cheap names with weak balance sheets are often cheap for a reason. This section exists to stop that mistake.
            </p>
          </div>
        </div>
      </section>

      <MetricTable title="Risk Metrics" metrics={research?.risk?.metrics || []} sectorMedians={sectorMedians} />
      <ReasonList title="Risk Drivers" reasons={research?.risk?.reasons || []} />
    </>
  );
}
