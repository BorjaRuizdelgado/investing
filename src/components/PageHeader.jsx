import React from "react";

export default function PageHeader({ eyebrow, title, description, actions = null }) {
  return (
    <header className="page-header">
      {eyebrow ? <div className="page-eyebrow">{eyebrow}</div> : null}
      <div className="page-header-row">
        <div>
          <h1>{title}</h1>
          {description ? <p className="subtitle">{description}</p> : null}
        </div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </div>
    </header>
  );
}
