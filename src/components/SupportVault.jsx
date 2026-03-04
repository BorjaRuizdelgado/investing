import React, { useRef, useState } from "react";

const WALLET_ADDRESSES = {
  btc: "bc1q9zl47s30lqqwp8xq6s4spfctdwv5fa7dfrwwem",
  eth: "0x0E2191806D126E94e57093cf7501564F75D2319e",
  sol: "P4QW7tvXA1knQWA5oLdJ9UYZ1WZS2JTVT42HpEqgGDG",
};

const LABELS = {
  btc: "Bitcoin (BTC)",
  eth: "Ethereum (ETH)",
  sol: "Solana (SOL)",
};

/**
 * Collapsible crypto donation section.
 * Wallet addresses match borjaruizdelgado.com.
 */
export default function SupportVault() {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);

  function handleToggle() {
    setOpen(ref.current?.open || false);
  }

  return (
    <details ref={ref} className="support-vault" onToggle={handleToggle}>
      <summary className="support-vault__summary" aria-expanded={open}>
        {open ? "Close tip jar" : "Open tip jar"}
      </summary>
      <div className="support-vault__body">
        <h3 className="support-vault__title">Support</h3>
        <p className="support-vault__line">
          On this page you will find not a single paywall, popup, cookie banner,
          or anything trying to mess with your privacy.
        </p>
        <p className="support-vault__line">
          Choose a chain and keep this operation suspiciously well funded:
        </p>

        <div className="support-vault__wallets">
          {Object.entries(WALLET_ADDRESSES).map(([key, address]) => (
            <div className="support-vault__wallet" key={key}>
              <p className="support-vault__wallet-label">{LABELS[key]}</p>
              <code className="support-vault__address">{address}</code>
            </div>
          ))}
        </div>

        <p className="support-vault__note">
          Donations fund research, device optimization, and long-term
          maintenance.
        </p>
      </div>
    </details>
  );
}
