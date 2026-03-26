import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// ---- Global error handlers ----
// Structured context for unhandled errors.
// Plug in Sentry, Datadog, or any reporting SDK here later.

window.onerror = (message, source, lineno, colno, error) => {
  console.error('[global:onerror]', {
    message,
    source,
    lineno,
    colno,
    stack: error?.stack,
  })
}

window.onunhandledrejection = (event) => {
  console.error('[global:unhandledrejection]', {
    reason: event.reason?.message || String(event.reason),
    stack: event.reason?.stack,
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
