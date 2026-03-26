import React, { useState, useEffect } from 'react'

export default function WatchlistPage({ watchlist, onAnalyse }) {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!watchlist.tickers.length) {
      setQuotes([])
      return
    }

    let cancelled = false
    setLoading(true)

    fetch(`/api/quotes?tickers=${encodeURIComponent(watchlist.tickers.join(','))}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setQuotes(data.quotes || [])
      })
      .catch(() => {
        if (!cancelled) setQuotes([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [watchlist.tickers])

  return (
    <div>
      <h1>Watchlist</h1>
      <p className="subtitle">Your saved tickers. Click to analyse.</p>

      {watchlist.tickers.length === 0 && (
        <div className="watchlist-empty">
          <p>No tickers in your watchlist yet.</p>
          <p>Search for a ticker and click the star to add it.</p>
        </div>
      )}

      {loading && watchlist.tickers.length > 0 && (
        <div className="loading">
          <div className="spinner" />
          <span>Fetching quotes...</span>
        </div>
      )}

      {!loading && watchlist.tickers.length > 0 && (
        <div className="watchlist-grid">
          {watchlist.tickers.map((ticker) => {
            const q = quotes.find((x) => x.ticker === ticker || x.symbol === ticker)
            return (
              <div
                key={ticker}
                className="terminal-card watchlist-card"
                onClick={() => onAnalyse(ticker)}
              >
                <div className="watchlist-card__header">
                  <div className="terminal-eyebrow">{ticker}</div>
                  <button
                    className="watchlist-card__remove"
                    onClick={(e) => {
                      e.stopPropagation()
                      watchlist.remove(ticker)
                    }}
                    title="Remove from watchlist"
                  >
                    &times;
                  </button>
                </div>
                {q ? (
                  <>
                    <div className="trending-card-name">{q.name || ticker}</div>
                    <div className="trending-card-price">${q.price?.toFixed(2)}</div>
                    <div
                      className={`trending-card-change ${q.changePct >= 0 ? 'positive' : 'negative'}`}
                    >
                      {q.changePct >= 0 ? '+' : ''}
                      {q.changePct?.toFixed(2)}%
                    </div>
                  </>
                ) : (
                  <div className="terminal-caption" style={{ marginTop: '0.5rem' }}>
                    {loading ? 'Loading...' : 'Quote unavailable'}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
