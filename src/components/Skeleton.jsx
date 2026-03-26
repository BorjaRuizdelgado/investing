import React from "react";

export default function Skeleton({ width = "100%", height = "1rem", style, className = "" }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height, ...style }}
    />
  );
}
