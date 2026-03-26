import React from "react";
import Skeleton from "./Skeleton.jsx";

export function OverviewSkeleton() {
  return (
    <div className="skeleton-layout">
      {/* Score cards row */}
      <div className="score-grid" style={{ marginBottom: "1.75rem" }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="terminal-card" style={{ padding: "0.95rem 1rem" }}>
            <Skeleton width="60%" height="0.75rem" style={{ marginBottom: "0.5rem" }} />
            <Skeleton width="40%" height="1.6rem" style={{ marginBottom: "0.7rem" }} />
            <Skeleton width="100%" height="8px" style={{ marginBottom: "0.55rem" }} />
            <Skeleton width="50%" height="0.8rem" />
          </div>
        ))}
      </div>

      {/* Glance cards */}
      <div className="terminal-grid terminal-grid--3" style={{ marginBottom: "1.75rem" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="terminal-card terminal-card--compact">
            <Skeleton width="40%" height="0.7rem" style={{ marginBottom: "0.5rem" }} />
            <Skeleton width="70%" height="1.4rem" style={{ marginBottom: "0.5rem" }} />
            <Skeleton width="90%" height="0.85rem" />
          </div>
        ))}
      </div>

      {/* Reasons list */}
      <div style={{ display: "grid", gap: "0.75rem" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="terminal-card" style={{ padding: "0.85rem 0.95rem" }}>
            <Skeleton width="30%" height="0.9rem" style={{ marginBottom: "0.35rem" }} />
            <Skeleton width="80%" height="0.85rem" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="terminal-card" style={{ padding: "1rem" }}>
      <Skeleton width="100%" height="280px" />
    </div>
  );
}

export function MetricTableSkeleton() {
  return (
    <div className="terminal-card" style={{ padding: "1rem" }}>
      <Skeleton width="30%" height="1rem" style={{ marginBottom: "1rem" }} />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <Skeleton width="40%" height="0.85rem" />
          <Skeleton width="20%" height="0.85rem" />
        </div>
      ))}
    </div>
  );
}
