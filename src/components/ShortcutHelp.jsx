import React from "react";

const SHORTCUTS = [
  { keys: "/", desc: "Focus search" },
  { keys: "Esc", desc: "Blur search / close modal" },
  { keys: "1-7", desc: "Switch tabs" },
  { keys: "\u2190 \u2192", desc: "Previous / next tab" },
  { keys: "?", desc: "Toggle this help" },
];

export default function ShortcutHelp({ onClose }) {
  return (
    <div className="shortcut-overlay" onClick={onClose}>
      <div className="shortcut-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcut-modal__header">
          <h3>Keyboard Shortcuts</h3>
          <button className="shortcut-modal__close" onClick={onClose}>&times;</button>
        </div>
        <table className="shortcut-modal__table">
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.keys}>
                <td><kbd>{s.keys}</kbd></td>
                <td>{s.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
