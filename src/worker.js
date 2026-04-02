/**
 * Cloudflare Worker — API proxy for Yahoo Finance + Bybit (crypto options).
 *
 * Routing:
 *   - Crypto tickers (BTC, ETH, SOL, XRP, DOGE …) → Bybit public API (no auth)
 *   - Everything else                              → Yahoo Finance (cookie+crumb auth)
 *
 * Routes:
 *   GET /api/options?ticker=AAPL        → expirations + spot price
 *   GET /api/chain?ticker=AAPL&exp=…    → option chain for one expiry
 *   GET /api/history?ticker=AAPL&days=60 → OHLCV history
 *   GET /api/rate                        → risk-free rate (^IRX)
 *   Everything else                      → static assets (SPA)
 */

import { isCrypto, isBybitSupported, isDeribitSupported, normalizeTicker, stripCryptoSuffix } from './lib/tickers.js'
import { validateTicker, validateDays, logError, CORS_HEADERS, jsonResp, rateLimit } from './worker/utils.js'
import { fetchYF } from './worker/yahoo.js'
import { handleOptions } from './worker/handlers/options.js'
import { handleChain } from './worker/handlers/chain.js'
import { handleHistory } from './worker/handlers/history.js'
import { handleRate } from './worker/handlers/rate.js'
import { handleCashflow } from './worker/handlers/cashflow.js'
import { handleCryptoOptions, handleCryptoChain, handleCryptoHistory, handleDeribitOptions, handleDeribitChain } from './worker/handlers/crypto.js'
import { handleSentiment } from './worker/handlers/sentiment.js'
import { handleTrending } from './worker/handlers/trending.js'
import { handleScreener } from './worker/handlers/screener.js'
import { isCrawler, fetchQuickQuote, buildCrawlerHtml, buildCompareCrawlerHtml } from './worker/seo.js'
import { buildSitemap } from './worker/sitemap.js'

// ======================================================================
// Main handler
// ======================================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    // Rate-limit API routes per client IP
    if (url.pathname.startsWith('/api/')) {
      const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown'
      if (!rateLimit(ip)) {
        return jsonResp({ error: 'Too many requests — please try again shortly' }, 429)
      }
    }

    try {
      if (url.pathname === '/api/options') {
        const raw = url.searchParams.get('ticker')
        if (!raw) return jsonResp({ error: 'ticker required' }, 400)
        const ticker = validateTicker(raw)
        if (!ticker) return jsonResp({ error: 'Invalid ticker' }, 400)
        const norm = normalizeTicker(ticker)
        if (isCrypto(ticker)) {
          // Try Bybit first for coins with known options support
          if (isBybitSupported(norm)) {
            try {
              const resp = await handleCryptoOptions(norm)
              const body = await resp.clone().json()
              if (body.expirations && body.expirations.length > 0) return resp
            } catch {
              /* Bybit failed, fall through */
            }
          }
          // Try Deribit as second source (BTC, ETH, SOL)
          if (isDeribitSupported(norm)) {
            try {
              const resp = await handleDeribitOptions(norm)
              const body = await resp.clone().json()
              if (body.expirations && body.expirations.length > 0) return resp
            } catch {
              /* Deribit failed, fall through */
            }
          }
          // Fall back to Yahoo Finance (fundamentals + spot price; no options for most crypto)
          return await handleOptions(`${norm}-USD`)
        }
        return await handleOptions(norm)
      }

      if (url.pathname === '/api/chain') {
        const rawT = url.searchParams.get('ticker')
        const exp = url.searchParams.get('exp')
        if (!rawT || !exp) return jsonResp({ error: 'ticker and exp required' }, 400)
        const ticker = validateTicker(rawT)
        if (!ticker) return jsonResp({ error: 'Invalid ticker' }, 400)
        const norm = normalizeTicker(ticker)
        if (isCrypto(ticker)) {
          if (/^\d+$/.test(exp)) {
            // Unix timestamp — convert to ISO date, try Bybit → Deribit → YF
            const expDate = new Date(Number(exp) * 1000).toISOString().slice(0, 10)
            if (isBybitSupported(norm)) {
              try {
                const resp = await handleCryptoChain(norm, expDate)
                const body = await resp.clone().json()
                if ((body.calls && body.calls.length > 0) || (body.puts && body.puts.length > 0))
                  return resp
              } catch {
                /* fall through */
              }
            }
            if (isDeribitSupported(norm)) {
              try {
                const resp = await handleDeribitChain(norm, expDate)
                const body = await resp.clone().json()
                if ((body.calls && body.calls.length > 0) || (body.puts && body.puts.length > 0))
                  return resp
              } catch {
                /* fall through */
              }
            }
            return await handleChain(`${norm}-USD`, exp)
          }
          // Date string — try Bybit first, then Deribit
          if (isBybitSupported(norm)) {
            try {
              const resp = await handleCryptoChain(norm, exp)
              const body = await resp.clone().json()
              if ((body.calls && body.calls.length > 0) || (body.puts && body.puts.length > 0))
                return resp
            } catch {
              /* fall through */
            }
          }
          if (isDeribitSupported(norm)) {
            return await handleDeribitChain(norm, exp)
          }
          return await handleCryptoChain(norm, exp)
        }
        return await handleChain(norm, exp)
      }

      if (url.pathname === '/api/history') {
        const rawH = url.searchParams.get('ticker')
        if (!rawH) return jsonResp({ error: 'ticker required' }, 400)
        const ticker = validateTicker(rawH)
        if (!ticker) return jsonResp({ error: 'Invalid ticker' }, 400)
        const days = validateDays(url.searchParams.get('days') || '60')
        if (!days) return jsonResp({ error: 'Invalid days parameter (must be 1-365)' }, 400)
        const norm = normalizeTicker(ticker)
        if (isCrypto(ticker)) {
          return await handleCryptoHistory(norm, days)
        }
        return await handleHistory(norm, days)
      }

      if (url.pathname === '/api/rate') {
        return await handleRate()
      }

      if (url.pathname === '/api/cashflow') {
        const rawCf = url.searchParams.get('ticker')
        if (!rawCf) return jsonResp({ error: 'ticker required' }, 400)
        const cfTicker = validateTicker(rawCf)
        if (!cfTicker) return jsonResp({ error: 'Invalid ticker' }, 400)
        if (isCrypto(cfTicker)) return jsonResp({ error: 'Not available for crypto' }, 400)
        return await handleCashflow(cfTicker)
      }

      if (url.pathname === '/api/quotes') {
        const tickers = url.searchParams.get('tickers')
        if (!tickers) return jsonResp({ error: 'tickers required' }, 400)
        const symbols = tickers
          .split(',')
          .slice(0, 20)
          .map((t) => t.trim().toUpperCase())
        // Map crypto tickers to Yahoo format
        const yfSymbols = symbols.map((s) => (isCrypto(s) ? `${stripCryptoSuffix(s)}-USD` : s))
        try {
          const data = await fetchYF(
            `/v7/finance/quote?symbols=${encodeURIComponent(yfSymbols.join(','))}`,
          )
          const results = (data?.quoteResponse?.result || []).map((q) => {
            const sym = q.symbol
            // Map back to original ticker for crypto
            const origTicker =
              sym.endsWith('-USD') && isCrypto(sym.replace('-USD', ''))
                ? sym.replace('-USD', '')
                : sym
            return {
              ticker: origTicker,
              symbol: sym,
              name: q.shortName || q.longName || sym,
              price: q.regularMarketPrice ?? null,
              change: q.regularMarketChange ?? null,
              changePct: q.regularMarketChangePercent ?? null,
            }
          })
          return jsonResp({ quotes: results })
        } catch (err) {
          logError('/api/quotes', err, { ticker: tickers })
          return jsonResp({ error: err.message, quotes: [] }, 500)
        }
      }

      if (url.pathname === '/api/sentiment') {
        const rawS = url.searchParams.get('ticker')
        if (!rawS) return jsonResp({ error: 'ticker required' }, 400)
        const sTicker = validateTicker(rawS)
        if (!sTicker) return jsonResp({ error: 'Invalid ticker' }, 400)
        return await handleSentiment(sTicker)
      }

      if (url.pathname === '/api/trending') {
        return await handleTrending()
      }

      if (url.pathname === '/api/screener') {
        return await handleScreener()
      }

      // Dynamic sitemap with popular tickers so Google discovers more pages
      if (url.pathname === '/sitemap.xml') {
        const xml = buildSitemap(url.origin)
        return new Response(xml, {
          headers: {
            'Content-Type': 'application/xml; charset=UTF-8',
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          },
        })
      }

      // Serve important social/static assets with permissive headers so
      // crawlers and social scrapers reliably fetch images from the edge.
      if (
        url.pathname === '/og-image.jpg' ||
        url.pathname === '/og-image.svg' ||
        url.pathname === '/favicon.png'
      ) {
        const assetRes = await env.ASSETS.fetch(request)
        const headers = new Headers(assetRes.headers)
        // Ensure CORS and a friendly cache policy for social scrapers
        headers.set('Access-Control-Allow-Origin', '*')
        headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
        headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
        if (!headers.get('content-type')) {
          headers.set('content-type', url.pathname.endsWith('.svg') ? 'image/svg+xml' : 'image/png')
        }
        return new Response(assetRes.body, { status: assetRes.status, headers })
      }

      // SPA fallback: serve index.html for any non-API, non-asset path
      // (e.g. /BTC, /SPY) so client-side routing can handle it.
      //
      // For crawlers (Googlebot, etc.), serve dynamic HTML with proper meta
      // tags and content so each ticker page is individually indexable.
      const assetRes = await env.ASSETS.fetch(request)
      if (assetRes.status === 404 && !url.pathname.startsWith('/api/')) {
        // Extract potential ticker from path
        const pathClean = url.pathname.replace(/^\//, '').replace(/\/$/, '')
        const parts = pathClean.split('/')
        const maybeTicker = parts[0] ? decodeURIComponent(parts[0]).toUpperCase() : null
        const reserved = new Set(['DISCLAIMER', 'DONATE', 'WATCHLIST', 'COMPARE', 'SCREENER'])
        const isCompare = maybeTicker === 'COMPARE'
        const compareTickers = isCompare
          ? parts.slice(1).map((p) => decodeURIComponent(p).toUpperCase()).filter(Boolean)
          : []

        // Crawler: compare page
        if (isCrawler(request) && isCompare && compareTickers.length >= 2) {
          const [qA, qB] = await Promise.all([
            fetchQuickQuote(compareTickers[0]).catch(() => null),
            fetchQuickQuote(compareTickers[1]).catch(() => null),
          ])
          const html = buildCompareCrawlerHtml(url, compareTickers[0], compareTickers[1], qA, qB)
          return new Response(html, {
            status: 200,
            headers: { 'Content-Type': 'text/html;charset=UTF-8' },
          })
        }

        // Crawler: ticker page
        if (isCrawler(request) && maybeTicker && !reserved.has(maybeTicker)) {
          const quote = await fetchQuickQuote(maybeTicker).catch(() => null)
          const html = buildCrawlerHtml(url, maybeTicker, quote)
          return new Response(html, {
            status: 200,
            headers: { 'Content-Type': 'text/html;charset=UTF-8' },
          })
        }

        // Crawler: home / reserved pages
        if (isCrawler(request) && (!maybeTicker || reserved.has(maybeTicker))) {
          const html = buildCrawlerHtml(url, null, null)
          return new Response(html, {
            status: 200,
            headers: { 'Content-Type': 'text/html;charset=UTF-8' },
          })
        }

        const indexReq = new Request(new URL('/', url.origin), request)
        const indexRes = await env.ASSETS.fetch(indexReq)

        // Rewrite meta tags for compare pages so Google's JS renderer sees correct values
        if (isCompare && compareTickers.length >= 2) {
          const tA = compareTickers[0]
          const tB = compareTickers[1]
          const canonical = `${url.origin}/compare/${tA}/${tB}`
          const title = `${tA} vs ${tB} — Stock Comparison — Borja Ruizdelgado Investing Tools`
          const desc = `Head-to-head comparison of ${tA} and ${tB}: valuation, growth, quality, risk, momentum scores, relative performance, and key metric spread.`
          let html = await indexRes.text()
          html = html
            .replace(
              /<link rel="canonical"[^>]*>/,
              `<link rel="canonical" href="${canonical}" id="canonical"/>`,
            )
            .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
            .replace(
              /<meta name="description"[^>]*>/,
              `<meta name="description" content="${desc}"/>`,
            )
            .replace(
              /<meta property="og:url"[^>]*>/,
              `<meta property="og:url" content="${canonical}"/>`,
            )
            .replace(
              /<meta property="og:title"[^>]*>/,
              `<meta property="og:title" content="${title}"/>`,
            )
            .replace(
              /<meta property="og:description"[^>]*>/,
              `<meta property="og:description" content="${desc}"/>`,
            )
            .replace(
              /<meta name="twitter:title"[^>]*>/,
              `<meta name="twitter:title" content="${title}"/>`,
            )
            .replace(
              /<meta name="twitter:description"[^>]*>/,
              `<meta name="twitter:description" content="${desc}"/>`,
            )
          return new Response(html, {
            status: 200,
            headers: { 'Content-Type': 'text/html;charset=UTF-8' },
          })
        }

        // Rewrite canonical, title, and meta description so Google's renderer
        // (which fetches as a normal user) sees the correct values for each ticker page.
        if (maybeTicker && !reserved.has(maybeTicker)) {
          const canonical = `${url.origin}/${maybeTicker}`
          const title = `${maybeTicker} Analysis — Borja Ruizdelgado`
          const desc = `${maybeTicker} — valuation, quality, risk, options forecasting, and fundamentals. Free analysis by Borja Ruizdelgado.`
          let html = await indexRes.text()
          html = html
            .replace(
              /<link rel="canonical"[^>]*>/,
              `<link rel="canonical" href="${canonical}" id="canonical"/>`,
            )
            .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
            .replace(
              /<meta name="description"[^>]*>/,
              `<meta name="description" content="${desc}"/>`,
            )
            .replace(
              /<meta property="og:url"[^>]*>/,
              `<meta property="og:url" content="${canonical}"/>`,
            )
            .replace(
              /<meta property="og:title"[^>]*>/,
              `<meta property="og:title" content="${title}"/>`,
            )
            .replace(
              /<meta property="og:description"[^>]*>/,
              `<meta property="og:description" content="${desc}"/>`,
            )
            .replace(
              /<meta name="twitter:title"[^>]*>/,
              `<meta name="twitter:title" content="${title}"/>`,
            )
            .replace(
              /<meta name="twitter:description"[^>]*>/,
              `<meta name="twitter:description" content="${desc}"/>`,
            )
          return new Response(html, {
            status: 200,
            headers: { 'Content-Type': 'text/html;charset=UTF-8' },
          })
        }

        return indexRes
      }
      return assetRes
    } catch (err) {
      logError(url.pathname, err, { ticker: url.searchParams.get('ticker') })
      return jsonResp({ error: err.message }, 500)
    }
  },
}
