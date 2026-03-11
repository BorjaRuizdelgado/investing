import React, { useRef } from "react";
import { WALLET_ADDRESSES, WALLET_LABELS as LABELS } from "../lib/config.js";

function WalletRow({ label, address }) {
  const ref = useRef(null);
  const [copied, setCopied] = React.useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="donations-wallet">
      <span className="donations-wallet-label">{label}</span>
      <div className="donations-wallet-row">
        <code className="donations-wallet-address" ref={ref}>{address}</code>
        <button className="donations-copy-btn" onClick={handleCopy} aria-label={`Copy ${label} address`}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export default function DonationsPage() {
  return (
    <section className="legal-page">
      <div className="section-heading">
        <h1>Support</h1>
        <p>No paywalls, no ads, no cookie banners — keep it that way.</p>
      </div>

      <div className="terminal-card legal-card">
        <p>
          This is an independent, open-source investing workspace. Everything here is free to use with no
          tracking, no popups, and no monetisation of your data.
        </p>
        <p>
          If it has been useful to you, you can support continued development and hosting by sending
          a tip in crypto. Choose a chain below and copy the address.
        </p>
      </div>

      <div className="donations-wallets">
        {Object.entries(WALLET_ADDRESSES).map(([key, address]) => (
          <WalletRow key={key} label={LABELS[key]} address={address} />
        ))}
      </div>

      <p className="footnote" style={{ marginTop: "1.5rem" }}>
        Donations fund research, device testing, and long-term maintenance. Thank you.
      </p>
    </section>
  );
}
