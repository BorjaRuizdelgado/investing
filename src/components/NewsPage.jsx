import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { fetchNews } from '../lib/fetcher.js'

const FILTERS = ['all', 'positive', 'neutral', 'negative']
const FEED_LABELS = { yahoo: 'Yahoo Finance', google: 'Google News' }

function timeAgo(isoDate) {
  if (!isoDate) return ''
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(isoDate).toLocaleDateString()
}

function SentimentBadge({ sentiment }) {
  return (
    <span className={`news-sentiment news-sentiment--${sentiment}`}>
      {sentiment === 'positive' ? '▲' : sentiment === 'negative' ? '▼' : '—'}{' '}
      {sentiment}
    </span>
  )
}

function FeedBadge({ feed }) {
  return <span className={`news-feed-badge news-feed-badge--${feed}`}>{FEED_LABELS[feed] || feed}</span>
}

function NewsArticle({ article }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="news-article"
    >
      {article.thumbnail && (
        <div className="news-article__thumb">
          <img
            src={article.thumbnail}
            alt=""
            loading="lazy"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        </div>
      )}
      <div className="news-article__body">
        <h3 className="news-article__title">{article.title}</h3>
        <div className="news-article__meta">
          <span className="news-article__source">{article.source}</span>
          <span className="news-article__time">{timeAgo(article.published)}</span>
          <SentimentBadge sentiment={article.sentiment} />
          <FeedBadge feed={article.feed} />
        </div>
      </div>
    </a>
  )
}

export default function NewsPage({ ticker }) {
  const [news, setNews] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const loadNews = useCallback(async () => {
    if (!ticker) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchNews(ticker)
      setNews(data)
    } catch (err) {
      setError(err.message || 'Failed to load news')
    } finally {
      setLoading(false)
    }
  }, [ticker])

  useEffect(() => {
    loadNews()
  }, [loadNews])

  const filtered = useMemo(() => {
    if (!news?.articles) return []
    let items = news.articles
    if (filter !== 'all') {
      items = items.filter((a) => a.sentiment === filter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.source.toLowerCase().includes(q),
      )
    }
    return items
  }, [news, filter, searchQuery])

  const sentimentCounts = useMemo(() => {
    if (!news?.articles) return { positive: 0, neutral: 0, negative: 0 }
    const counts = { positive: 0, neutral: 0, negative: 0 }
    for (const a of news.articles) {
      if (counts[a.sentiment] !== undefined) counts[a.sentiment]++
    }
    return counts
  }, [news])

  if (loading) {
    return (
      <section className="terminal-section">
        <div className="section-heading"><h2>News</h2></div>
        <div className="news-loading">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="news-skeleton">
              <div className="news-skeleton__title" />
              <div className="news-skeleton__meta" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="terminal-section">
        <div className="section-heading"><h2>News</h2></div>
        <div className="terminal-card">
          <p className="terminal-copy" style={{ color: 'var(--red)' }}>
            {error}
          </p>
          <button className="news-retry-btn" onClick={loadNews}>
            Retry
          </button>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="terminal-section">
        <div className="section-heading">
          <h2>News</h2>
            <p>Latest headlines and sentiment for {ticker} aggregated from Yahoo Finance, Google News, and Finnhub.</p>
        </div>

        {/* Sentiment summary bar */}
        <div className="news-sentiment-bar">
          <div className="news-sentiment-bar__segment news-sentiment-bar__segment--positive"
            style={{ flex: sentimentCounts.positive || 0 }}>
            {sentimentCounts.positive > 0 && (
              <span>▲ {sentimentCounts.positive}</span>
            )}
          </div>
          <div className="news-sentiment-bar__segment news-sentiment-bar__segment--neutral"
            style={{ flex: sentimentCounts.neutral || 0 }}>
            {sentimentCounts.neutral > 0 && (
              <span>— {sentimentCounts.neutral}</span>
            )}
          </div>
          <div className="news-sentiment-bar__segment news-sentiment-bar__segment--negative"
            style={{ flex: sentimentCounts.negative || 0 }}>
            {sentimentCounts.negative > 0 && (
              <span>▼ {sentimentCounts.negative}</span>
            )}
          </div>
        </div>

        {/* Filter controls */}
        <div className="news-controls">
          <div className="news-filters">
            {FILTERS.map((f) => (
              <button
                key={f}
                className={`news-filter-btn${filter === f ? ' news-filter-btn--active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== 'all' && (
                  <span className="news-filter-btn__count">
                    {sentimentCounts[f] ?? 0}
                  </span>
                )}
              </button>
            ))}
          </div>
          <input
            type="text"
            className="news-search"
            placeholder="Filter headlines…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </section>

      {/* Article list */}
      <section className="terminal-section">
        {filtered.length === 0 ? (
          <div className="terminal-card">
            <p className="terminal-copy" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              {news?.articles?.length
                ? 'No headlines match your filter.'
                : `No news found for ${ticker}.`}
            </p>
          </div>
        ) : (
          <div className="news-list">
            {filtered.map((article, i) => (
              <NewsArticle key={`${article.feed}-${i}`} article={article} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}
