import React from "react";

export default function Expander({ title, children }) {
  return (
    <details className="expander">
      <summary>{title}</summary>
      <div className="expander-body">{children}</div>
    </details>
  );
}
