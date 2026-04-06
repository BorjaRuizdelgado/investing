import React from 'react'
import { DISCLAIMER_PATH, DONATE_PATH } from '../lib/routes.js'

export default function Footer({ onNavigate }) {
  function go(e, path, pageKey) {
    e.preventDefault()
    onNavigate(path, pageKey)
  }

  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <span className="app-footer__brand">Borja Ruizdelgado</span>
        <nav className="app-footer__links">
          <a href={DISCLAIMER_PATH} onClick={(e) => go(e, DISCLAIMER_PATH, 'disclaimer')}>
            Disclaimer
          </a>
          <a href={DONATE_PATH} onClick={(e) => go(e, DONATE_PATH, 'donate')}>
            Support
          </a>
          <a href="mailto:borjafruizdelgado@gmail.com">Contact</a>
        </nav>
      </div>
    </footer>
  )
}
