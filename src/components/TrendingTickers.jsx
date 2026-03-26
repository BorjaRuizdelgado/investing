import React, { useState, useEffect } from 'react'
import { fetchTrending } from '../lib/fetcher.js'
import { fmt } from '../lib/format.js'

function TrendingCard({ symbol, name, price, changePct, onClick }) {
  const positive = changePct >= 0
  return (
    <button className="trending-card" onClick={() => onClick(symbol)}>
      <span className="trending-card-symbol">{symbol}</span>
      <span className="trending-card-name">{name}</span>
      <span className="trending-card-price">{fmt(price)}</span>
      <span className={`trending-card-change ${positive ? 'positive' : 'negative'}`}>
        {positive ? '+' : ''}
        {changePct.toFixed(2)}%
      </span>
    </button>
  )
}

const INITIAL_SHOW = 4

export default function TrendingTickers({ onTickerClick }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAllStocks, setShowAllStocks] = useState(false)
  const [showAllCrypto, setShowAllCrypto] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchTrending()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="trending trending--loading">
        <div className="spinner" />
      </div>
    )
  }

  if (!data || (!data.stocks?.length && !data.crypto?.length)) return null

  // Deduplicate by symbol (backend should already handle this, but guard against edge cases)
  const dedup = (arr) => {
    if (!arr) return []
    const seen = new Set()
    return arr.filter((item) => {
      if (seen.has(item.symbol)) return false
      seen.add(item.symbol)
      return true
    })
  }
  const stocks = dedup(data.stocks)
  const crypto = dedup(data.crypto)

  const visibleStocks = showAllStocks ? stocks : stocks.slice(0, INITIAL_SHOW)
  const visibleCrypto = showAllCrypto ? crypto : crypto.slice(0, INITIAL_SHOW)

  return (
    <div className="trending">
      {stocks.length > 0 && (
        <div className="trending-section">
          <h3 className="trending-section-title">Trending Stocks</h3>
          <div className="trending-grid">
            {visibleStocks.map((s) => (
              <TrendingCard key={s.symbol} onClick={onTickerClick} {...s} />
            ))}
          </div>
          {stocks.length > INITIAL_SHOW && !showAllStocks && (
            <button className="trending-more" onClick={() => setShowAllStocks(true)}>
              More stocks
            </button>
          )}
        </div>
      )}
      {crypto.length > 0 && (
        <div className="trending-section">
          <h3 className="trending-section-title">Top Crypto</h3>
          <div className="trending-grid">
            {visibleCrypto.map((c) => (
              <TrendingCard key={c.symbol} onClick={onTickerClick} {...c} />
            ))}
          </div>
          {crypto.length > INITIAL_SHOW && !showAllCrypto && (
            <button className="trending-more" onClick={() => setShowAllCrypto(true)}>
              More crypto
            </button>
          )}
        </div>
      )}
    </div>
  )
}
