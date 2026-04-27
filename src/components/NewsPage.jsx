import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { fetchNews } from '../lib/fetcher.js'

const FILTERS = ['all', 'positive', 'neutral', 'negative']
const FEED_LABELS = { yahoo: 'Yahoo Finance', google: 'Google News' }
const DEFAULT_COUNTS = { positive: 0, neutral: 0, negative: 0 }
const SENTIMENTS = new Set(['positive', 'neutral', 'negative'])

function safeText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function normalizeSentiment(sentiment) {
  return SENTIMENTS.has(sentiment) ? sentiment : 'neutral'
}

export function timeAgo(isoDate, now = Date.now()) {
  if (!isoDate) return ''
  const timestamp = new Date(isoDate).getTime()
  if (!Number.isFinite(timestamp)) return ''
  const diff = now - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(isoDate).toLocaleDateString()
}

export function normalizeArticles(articles = []) {
  if (!Array.isArray(articles)) return []

  return articles.map((article, index) => {
    const title = safeText(article?.title, 'Untitled headline')
    const source = safeText(article?.source, 'Unknown source')
    const feed = safeText(article?.feed, 'unknown')
    const published = safeText(article?.published, '')
    const url = safeText(article?.url, '')

    return {
      title,
      source,
      feed,
      published,
      url,
      thumbnail: safeText(article?.thumbnail, ''),
      sentiment: normalizeSentiment(article?.sentiment),
      id: url || `${feed}-${source}-${title}-${published}-${index}`,
    }
  })
}

export function filterArticles(articles, filter, searchQuery) {
  let items = articles
  if (filter !== 'all') {
    items = items.filter((article) => article.sentiment === filter)
  }

  const query = searchQuery.trim().toLowerCase()
  if (query) {
    items = items.filter(
      (article) =>
        article.title.toLowerCase().includes(query) || article.source.toLowerCase().includes(query),
    )
  }

  return items
}

export function countSentiments(articles) {
  const counts = { ...DEFAULT_COUNTS }
  for (const article of articles) {
    if (counts[article.sentiment] !== undefined) counts[article.sentiment] += 1
  }
  return counts
}

function SentimentBadge({ sentiment }) {
  return (
    <span className={`news-sentiment news-sentiment--${sentiment}`}>
      {sentiment === 'positive' ? '▲' : sentiment === 'negative' ? '▼' : '—'} {sentiment}
    </span>
  )
}

function FeedBadge({ feed }) {
  return (
    <span className={`news-feed-badge news-feed-badge--${feed}`}>{FEED_LABELS[feed] || feed}</span>
  )
}

function NewsArticle({ article }) {
  const content = (
    <>
      {article.thumbnail && (
        <div className="news-article__thumb">
          <img
            src={article.thumbnail}
            alt=""
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
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
    </>
  )

  if (!article.url) {
    return <article className="news-article">{content}</article>
  }

  return (
    <a href={article.url} target="_blank" rel="noopener noreferrer" className="news-article">
      {content}
    </a>
  )
}

export default function NewsPage({ ticker }) {
  const requestIdRef = useRef(0)
  const [news, setNews] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const loadNews = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    const nextTicker = safeText(ticker)

    if (!nextTicker) {
      setNews(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await fetchNews(nextTicker)
      if (requestIdRef.current === requestId) setNews(data)
    } catch (err) {
      if (requestIdRef.current === requestId) {
        setError(err.message || 'Failed to load news')
      }
    } finally {
      if (requestIdRef.current === requestId) setLoading(false)
    }
  }, [ticker])

  useEffect(() => {
    loadNews()
    return () => {
      requestIdRef.current += 1
    }
  }, [loadNews])

  const articles = useMemo(() => normalizeArticles(news?.articles), [news])
  const filtered = useMemo(
    () => filterArticles(articles, filter, searchQuery),
    [articles, filter, searchQuery],
  )
  const sentimentCounts = useMemo(() => countSentiments(articles), [articles])

  const sentimentTotal =
    sentimentCounts.positive + sentimentCounts.neutral + sentimentCounts.negative

  if (loading) {
    return (
      <section className="terminal-section">
        <div className="section-heading">
          <h2>News</h2>
        </div>
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
        <div className="section-heading">
          <h2>News</h2>
        </div>
        <div className="terminal-card">
          <p className="terminal-copy" style={{ color: 'var(--red)' }}>
            {error}
          </p>
          <button type="button" className="news-retry-btn" onClick={loadNews}>
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
          <p>
            Latest headlines and sentiment for {ticker} aggregated from Yahoo Finance and Google
            News.
          </p>
        </div>

        {sentimentTotal > 0 && (
          <div className="news-sentiment-bar">
            <div
              className="news-sentiment-bar__segment news-sentiment-bar__segment--positive"
              style={{ flex: sentimentCounts.positive || 0 }}
            >
              {sentimentCounts.positive > 0 && <span>▲ {sentimentCounts.positive}</span>}
            </div>
            <div
              className="news-sentiment-bar__segment news-sentiment-bar__segment--neutral"
              style={{ flex: sentimentCounts.neutral || 0 }}
            >
              {sentimentCounts.neutral > 0 && <span>— {sentimentCounts.neutral}</span>}
            </div>
            <div
              className="news-sentiment-bar__segment news-sentiment-bar__segment--negative"
              style={{ flex: sentimentCounts.negative || 0 }}
            >
              {sentimentCounts.negative > 0 && <span>▼ {sentimentCounts.negative}</span>}
            </div>
          </div>
        )}

        <div className="news-controls">
          <div className="news-filters">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={`news-filter-btn${filter === f ? ' news-filter-btn--active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== 'all' && (
                  <span className="news-filter-btn__count">{sentimentCounts[f] ?? 0}</span>
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

      <section className="terminal-section">
        {filtered.length === 0 ? (
          <div className="terminal-card">
            <p
              className="terminal-copy"
              style={{ textAlign: 'center', color: 'var(--text-muted)' }}
            >
              {articles.length ? 'No headlines match your filter.' : `No news found for ${ticker}.`}
            </p>
          </div>
        ) : (
          <div className="news-list">
            {filtered.map((article) => (
              <NewsArticle key={article.id} article={article} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}
