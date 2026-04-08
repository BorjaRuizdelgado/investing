/**
 * /api/news — aggregated news headlines from multiple free sources.
 *
 * Sources:
 *  1. Yahoo Finance (search news endpoint)
 *  2. Google News RSS (ticker-specific feed, parsed as XML)
 *  3. Finnhub (company news, free tier — 60 req/min)
 *
 * Each source is fetched in parallel; failures are silently swallowed so
 * the endpoint always returns whatever headlines it could gather.
 */

import { fetchYF } from '../yahoo.js'
import { cachedJsonResp, logError, UA } from '../utils.js'
import { isCrypto, normalizeTicker } from '../../lib/tickers.js'

// ---- In-memory cache (per-isolate) ----
const newsCache = new Map() // key → { result, expiry }
const NEWS_TTL_MS = 5 * 60 * 1000 // 5 minutes

function cacheKey(ticker) {
  return `news:${ticker}`
}

// ---- Yahoo Finance news ----

async function fetchYahooNews(ticker) {
  try {
    const yfTicker = isCrypto(ticker) ? `${normalizeTicker(ticker)}-USD` : normalizeTicker(ticker)
    const data = await fetchYF(
      `/v1/finance/search?q=${encodeURIComponent(yfTicker)}&quotesCount=0&newsCount=20&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query&newsQueryId=news_cie_ves498`
    )
    const items = data?.news || []
    return items.map((n) => ({
      title: n.title || '',
      url: n.link || '',
      source: n.publisher || 'Yahoo Finance',
      published: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : null,
      thumbnail: n.thumbnail?.resolutions?.[0]?.url || null,
      feed: 'yahoo',
    }))
  } catch (err) {
    logError('/api/news:yahoo', err, { ticker })
    return []
  }
}

// ---- Google News RSS ----

function parseRssItems(xml) {
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const title = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1] || ''
    const link = block.match(/<link>(.*?)<\/link>/)?.[1] || ''
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
    const source = block.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || 'Google News'

    items.push({
      title: decodeXmlEntities(title),
      url: link,
      source,
      published: pubDate ? new Date(pubDate).toISOString() : null,
      thumbnail: null,
      feed: 'google',
    })
  }
  return items
}

function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
}

async function fetchGoogleNews(ticker) {
  try {
    const query = isCrypto(ticker)
      ? `${normalizeTicker(ticker)}+cryptocurrency`
      : `${normalizeTicker(ticker)}+stock`
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': UA },
    })
    if (!res.ok) return []
    const xml = await res.text()
    return parseRssItems(xml).slice(0, 20)
  } catch (err) {
    logError('/api/news:google', err, { ticker })
    return []
  }
}

// ---- Finnhub news (free tier, no API key required for basic company news) ----

async function fetchFinnhubNews(ticker) {
  try {
    // Finnhub free tier requires an API key; skip if not configured
    // Users can set FINNHUB_KEY in wrangler secrets for richer news
    if (isCrypto(ticker)) return [] // Finnhub company news only works for equities

    const norm = normalizeTicker(ticker)
    const today = new Date().toISOString().slice(0, 10)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

    // Use Market Aux free alternative (no key needed) as Finnhub requires auth
    const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(norm)}&from=${thirtyDaysAgo}&to=${today}`
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.slice(0, 15).map((n) => ({
      title: n.headline || '',
      url: n.url || '',
      source: n.source || 'Finnhub',
      published: n.datetime ? new Date(n.datetime * 1000).toISOString() : null,
      thumbnail: n.image || null,
      feed: 'finnhub',
    }))
  } catch (err) {
    logError('/api/news:finnhub', err, { ticker })
    return []
  }
}

// ---- Deduplication ----

function deduplicateNews(articles) {
  const seen = new Set()
  const result = []
  for (const article of articles) {
    // Normalize title for dedup: lowercase, strip extra spaces/punctuation
    const key = article.title
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(article)
  }
  return result
}

// ---- Sentiment tagging (AFINN-165 lexicon via `sentiment` library) ----

import Sentiment from 'sentiment'

const analyzer = new Sentiment()

function tagSentiment(title) {
  const { comparative } = analyzer.analyze(title)
  if (comparative > 0.05) return 'positive'
  if (comparative < -0.05) return 'negative'
  return 'neutral'
}

// ---- Main handler ----

export async function handleNews(ticker) {
  const key = cacheKey(ticker)
  const cached = newsCache.get(key)
  if (cached && Date.now() < cached.expiry) {
    return cachedJsonResp(cached.result, 300)
  }

  // Fetch all sources in parallel — never let one failure block the response
  const [yahoo, google, finnhub] = await Promise.all([
    fetchYahooNews(ticker),
    fetchGoogleNews(ticker),
    fetchFinnhubNews(ticker),
  ])

  // Merge, deduplicate, tag sentiment, sort by date
  const allArticles = [...yahoo, ...google, ...finnhub]
  const unique = deduplicateNews(allArticles)

  // Tag sentiment + sort newest first
  const articles = unique
    .map((a) => ({ ...a, sentiment: tagSentiment(a.title) }))
    .sort((a, b) => {
      if (!a.published) return 1
      if (!b.published) return -1
      return new Date(b.published) - new Date(a.published)
    })

  const result = {
    ticker: normalizeTicker(ticker),
    count: articles.length,
    sources: ['Yahoo Finance', 'Google News', 'Finnhub'].filter((_, i) =>
      [yahoo, google, finnhub][i].length > 0,
    ),
    articles,
  }

  newsCache.set(key, { result, expiry: Date.now() + NEWS_TTL_MS })

  // Prune old entries
  if (newsCache.size > 200) {
    const now = Date.now()
    for (const [k, v] of newsCache) {
      if (now >= v.expiry) newsCache.delete(k)
    }
  }

  return cachedJsonResp(result, 300)
}
