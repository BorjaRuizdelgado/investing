import React from 'react'

export default function DisclaimerPage() {
  return (
    <section className="legal-page">
      <div className="section-heading">
        <h1>Disclaimer</h1>
        <p>Read this before relying on any output from this tool.</p>
      </div>

      <div className="terminal-card legal-card">
        <p>
          This software is an independent browser-based research tool. It is not affiliated with,
          endorsed by, or sponsored by Yahoo, Yahoo Finance, Bloomberg, Bybit, or any issuer,
          exchange, broker, or data vendor.
        </p>
        <p>
          Market prices, options chains, analyst fields, financial statement fields, and related
          information displayed in this application are obtained from public third-party sources,
          including Yahoo Finance endpoints accessed through a stateless proxy, and may be delayed,
          stale, incomplete, inaccurate, inconsistent, or unavailable.
        </p>
        <p>
          All scores, labels, scenarios, ranges, charts, and derived analytics shown in this app are
          heuristic outputs generated from third-party data and local calculations. They are
          inherently approximate, may contain errors, and should not be treated as statements of
          fact, guarantees, forecasts, recommendations, or professional advice.
        </p>
        <p>
          Nothing in this application constitutes investment advice, financial advice, tax advice,
          legal advice, accounting advice, brokerage advice, fiduciary advice, or a solicitation,
          recommendation, endorsement, or offer to buy or sell any security, derivative,
          cryptoasset, or financial instrument.
        </p>
        <p>
          You are solely responsible for independently verifying any data, assumptions,
          calculations, and conclusions before making decisions or taking action. Use of this
          software is entirely at your own risk.
        </p>
        <p>
          This software is provided on an &quot;as is&quot; and &quot;as available&quot; basis,
          without warranties of any kind, express or implied, including without limitation
          warranties of accuracy, completeness, merchantability, fitness for a particular purpose,
          non-infringement, or uninterrupted availability.
        </p>
        <p>
          To the maximum extent permitted by applicable law, the author and contributors disclaim
          all liability for any direct, indirect, incidental, consequential, special, exemplary,
          regulatory, tax, contractual, tort, or other loss or damage arising out of or related to
          the use of, inability to use, or reliance on this application or any data or analysis
          displayed by it.
        </p>
      </div>
    </section>
  )
}
