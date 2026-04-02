import React, { useState, useEffect, useMemo } from 'react'
import { fetchScreener } from '../lib/fetcher.js'
import { fmt } from '../lib/format.js'
import {
  COLLECTIONS,
  SORT_OPTIONS,
  filterStocks,
  extractSectors,
  rangePosition,
  marketCapLabel,
} from '../lib/screener.js'

function ScreenerCard({ stock, onClick, watchlist }) {
  const pos = rangePosition(stock.price, stock.fiftyTwoWeekLow, stock.fiftyTwoWeekHigh)
  const changeCls = stock.changePct > 0 ? 'positive' : stock.changePct < 0 ? 'negative' : ''
  const inWatchlist = watchlist?.has(stock.ticker)

  return (
    <button className="screener-card" onClick={() => onClick(stock.ticker)}>
      <div className="screener-card__head">
        <div className="screener-card__symbol-row">
          <span className="screener-card__symbol">{stock.ticker}</span>
          {stock.sector && <span className="screener-card__sector">{stock.sector}</span>}
        </div>
        {watchlist && (
          <button
            className={`screener-card__star${inWatchlist ? ' screener-card__star--active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              inWatchlist ? watchlist.remove(stock.ticker) : watchlist.add(stock.ticker)
            }}
            aria-label={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            {inWatchlist ? '★' : '☆'}
          </button>
        )}
      </div>
      <div className="screener-card__name">{stock.name}</div>
      <div className="screener-card__price-row">
        <span className="screener-card__price">{fmt(stock.price)}</span>
        {stock.changePct != null && (
          <span className={`screener-card__change ${changeCls}`}>
            {stock.changePct > 0 ? '+' : ''}
            {stock.changePct.toFixed(2)}%
          </span>
        )}
      </div>
      <div className="screener-card__metrics">
        <div className="screener-card__metric">
          <span className="screener-card__metric-label">P / E</span>
          <span className="screener-card__metric-value">
            {stock.trailingPE != null ? stock.trailingPE.toFixed(1) : '—'}
          </span>
        </div>
        <div className="screener-card__metric">
          <span className="screener-card__metric-label">Mkt Cap</span>
          <span className="screener-card__metric-value">{marketCapLabel(stock.marketCap)}</span>
        </div>
        <div className="screener-card__metric">
          <span className="screener-card__metric-label">Div Yield</span>
          <span className="screener-card__metric-value">
            {stock.dividendYield != null ? `${stock.dividendYield.toFixed(2)}%` : '—'}
          </span>
        </div>
      </div>
      {pos != null && (
        <div className="screener-card__range">
          <div className="screener-card__range-labels">
            <span>{fmt(stock.fiftyTwoWeekLow)}</span>
            <span className="screener-card__range-title">52 W</span>
            <span>{fmt(stock.fiftyTwoWeekHigh)}</span>
          </div>
          <div className="screener-card__range-bar">
            <div className="screener-card__range-fill" style={{ '--pos': `${pos}%` }} />
          </div>
        </div>
      )}
    </button>
  )
}

export default function ScreenerPage({ onAnalyse, watchlist }) {
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [activeCollection, setActiveCollection] = useState('all')
  const [activeSectors, setActiveSectors] = useState(new Set())
  const [sortBy, setSortBy] = useState('marketCap')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    let cancelled = false
    fetchScreener()
      .then((data) => {
        if (!cancelled) setStocks(data.stocks || [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const sectors = useMemo(() => extractSectors(stocks), [stocks])

  // Only show collections that have at least 1 match
  const visibleCollections = useMemo(
    () => COLLECTIONS.filter((col) => col.id === 'all' || stocks.some(col.filter)),
    [stocks],
  )

  const filtered = useMemo(
    () => filterStocks(stocks, { collection: activeCollection, sectors: activeSectors, sortBy, sortDir }),
    [stocks, activeCollection, activeSectors, sortBy, sortDir],
  )

  function toggleSector(sector) {
    setActiveSectors((prev) => {
      const next = new Set(prev)
      if (next.has(sector)) next.delete(sector)
      else next.add(sector)
      return next
    })
  }

  function handleSort(id) {
    if (sortBy === id) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortBy(id)
      setSortDir('desc')
    }
  }

  if (loading) {
    return (
      <div className="screener">
        <div className="screener-hero">
          <h1 className="screener-hero__title">Discover</h1>
          <p className="screener-hero__subtitle">Loading the market…</p>
        </div>
        <div className="screener-grid screener-grid--loading">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="screener-card screener-card--skeleton">
              <div className="skeleton-line skeleton-line--short" />
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-line--short" />
              <div className="skeleton-line" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="screener">
        <div className="screener-hero">
          <h1 className="screener-hero__title">Discover</h1>
          <p className="screener-hero__subtitle">Something went wrong — {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="screener">
      <div className="screener-hero">
        <h1 className="screener-hero__title">Discover</h1>
      </div>

      {/* Collections */}
      <div className="screener-collections">
        {visibleCollections.map((col) => (
          <button
            key={col.id}
            className={`screener-collection${activeCollection === col.id ? ' screener-collection--active' : ''}`}
            onClick={() => setActiveCollection(col.id)}
          >
            <span className="screener-collection__icon">{col.icon}</span>
            <span className="screener-collection__label">{col.label}</span>
            <span className="screener-collection__tagline">{col.tagline}</span>
          </button>
        ))}
      </div>

      {/* Sector filters */}
      {sectors.length > 0 && (
        <div className="screener-filters">
          <button
            className={`overlay-pill${activeSectors.size === 0 ? ' overlay-pill--active' : ''}`}
            onClick={() => setActiveSectors(new Set())}
          >
            All Sectors
          </button>
          {sectors.map((s) => (
            <button
              key={s}
              className={`overlay-pill${activeSectors.has(s) ? ' overlay-pill--active' : ''}`}
              onClick={() => toggleSector(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Sort + count */}
      <div className="screener-toolbar">
        <div className="screener-sort">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              className={`screener-sort__btn${sortBy === opt.id ? ' screener-sort__btn--active' : ''}`}
              onClick={() => handleSort(opt.id)}
            >
              {opt.label}
              {sortBy === opt.id && (
                <span className="screener-sort__arrow">{sortDir === 'desc' ? ' ↓' : ' ↑'}</span>
              )}
            </button>
          ))}
        </div>
        <span className="screener-count">
          Showing {filtered.length} of {stocks.length}
        </span>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="screener-empty">
          <p className="screener-empty__text">
            No stocks match these filters — try a different collection or broaden the sectors.
          </p>
        </div>
      ) : (
        <div className="screener-grid">
          {filtered.map((s) => (
            <ScreenerCard key={s.ticker} stock={s} onClick={onAnalyse} watchlist={watchlist} />
          ))}
        </div>
      )}
    </div>
  )
}
