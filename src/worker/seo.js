/**
 * SEO: Crawler detection, dynamic meta tags, and social card enrichment.
 */

import { fetchYF } from './yahoo.js'

const CRAWLER_RE =
  /googlebot|bingbot|yandexbot|duckduckbot|slurp|baiduspider|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegram|discord|applebot|ia_archiver|semrushbot|ahrefsbot|mj12bot/i

export function isCrawler(request) {
  const ua = request.headers.get('user-agent') || ''
  return CRAWLER_RE.test(ua)
}

/**
 * Fetch a lightweight quote for social card enrichment.
 * Returns { name, price, changePct } or null on failure.
 */
export async function fetchQuickQuote(ticker) {
  try {
    const data = await fetchYF(`/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`)
    const q = data?.quoteResponse?.result?.[0]
    if (!q) return null
    return {
      name: q.shortName || q.longName || ticker,
      price: q.regularMarketPrice ?? null,
      changePct: q.regularMarketChangePercent ?? null,
    }
  } catch {
    return null
  }
}

/**
 * Build an HTML page with dynamic meta tags for a specific ticker,
 * so crawlers index meaningful content for each route.
 */
export function buildCrawlerHtml(url, ticker, quote) {
  const origin = url.origin
  const qName = quote?.name || ticker
  const qPrice = quote?.price != null ? `$${quote.price.toFixed(2)}` : null
  const title = ticker
    ? `${qName} (${ticker}) Analysis — Borja Ruizdelgado`
    : 'Borja Ruizdelgado — Free Options & Stock Analysis Tools'
  const description = ticker
    ? qPrice
      ? `${qName} at ${qPrice} — valuation, quality, risk, options forecasting, and fundamentals. Free analysis by Borja Ruizdelgado.`
      : `${qName} — valuation, quality, risk, options forecasting, and fundamentals. Free analysis by Borja Ruizdelgado.`
    : 'Free investing tools by Borja Ruizdelgado: options-implied price forecasts, stock fundamentals, valuation scoring, and crypto analysis.'
  const canonical = ticker ? `${origin}/${ticker}` : `${origin}/`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${title}</title>
  <meta name="description" content="${description}"/>
  <meta name="author" content="Borja Ruizdelgado"/>
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large"/>
  <link rel="canonical" href="${canonical}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${canonical}"/>
  <meta property="og:title" content="${title}"/>
  <meta property="og:description" content="${description}"/>
  <meta property="og:image" content="${origin}/og-image.jpg"/>
  <meta property="og:site_name" content="Borja Ruizdelgado — Investing Tools"/>
  <meta name="twitter:card" content="${ticker ? 'summary' : 'summary_large_image'}"/>
  <meta name="twitter:title" content="${title}"/>
  <meta name="twitter:description" content="${description}"/>
  ${ticker ? '' : `<meta name="twitter:image" content="${origin}/og-image.jpg"/>`}
  <script type="application/ld+json">
  {
    "@context":"https://schema.org",
    "@type":"WebApplication",
    "name":"Borja Ruizdelgado — Investing Tools",
    "url":"${origin}/",
    "description":"${description}",
    "applicationCategory":"FinanceApplication",
    "operatingSystem":"Web",
    "author":{"@type":"Person","name":"Borja Ruizdelgado","url":"https://borjaruizdelgado.com"}
  }
  </script>
  ${
    ticker
      ? `<script type="application/ld+json">
  {
    "@context":"https://schema.org",
    "@type":"WebPage",
    "name":"${title}",
    "url":"${canonical}",
    "description":"${description}",
    "isPartOf":{"@type":"WebSite","name":"Borja Ruizdelgado — Investing Tools","url":"${origin}/"},
    "about":{"@type":"FinancialProduct","name":"${ticker}","url":"${canonical}"},
    "breadcrumb":{"@type":"BreadcrumbList","itemListElement":[
      {"@type":"ListItem","position":1,"name":"Home","item":"${origin}/"},
      {"@type":"ListItem","position":2,"name":"${ticker}","item":"${canonical}"}
    ]}
  }
  </script>`
      : ''
  }
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
  ${
    ticker
      ? `<p>Analyse <strong>${ticker}</strong> with free tools by Borja Ruizdelgado: options forecasting, fundamental analysis, value scoring, quality metrics, risk assessment, and more.</p>
  <h2>${ticker} Analysis Tools</h2>
  <ul>
    <li><a href="${origin}/${ticker}/overview">${ticker} Overview — Decision snapshot</a></li>
    <li><a href="${origin}/${ticker}/value">${ticker} Valuation — Cheap or expensive</a></li>
    <li><a href="${origin}/${ticker}/quality">${ticker} Quality — Business strength</a></li>
    <li><a href="${origin}/${ticker}/risk">${ticker} Risk — Fragility and downside</a></li>
    <li><a href="${origin}/${ticker}/business">${ticker} Business — Financial trends</a></li>
    <li><a href="${origin}/${ticker}/options">${ticker} Options Forecasting — Market pricing</a></li>
    <li><a href="${origin}/${ticker}/fundamentals">${ticker} Fundamentals — Raw reference data</a></li>
  </ul>`
      : `<h2>Features</h2>
  <ul>
    <li>Options Forecasting — Implied probability distributions, expected move ranges, IV smile</li>
    <li>Stock Fundamentals — P/E, EBITDA, EPS, margins, ROE, analyst price targets</li>
    <li>Support & Resistance — Automatic levels with entry/stop/target suggestions</li>
    <li>Value Analysis — Multiple valuation models</li>
    <li>Quality Scoring — Profitability, growth, financial health</li>
    <li>Risk Analysis — Beta, short interest, volatility</li>
    <li>Crypto Options — BTC, ETH, SOL, XRP, DOGE</li>
  </ul>
  <h2>Popular Tickers</h2>
  <p>
    <a href="${origin}/AAPL">AAPL</a> · <a href="${origin}/TSLA">TSLA</a> ·
    <a href="${origin}/SPY">SPY</a> · <a href="${origin}/MSFT">MSFT</a> ·
    <a href="${origin}/NVDA">NVDA</a> · <a href="${origin}/AMZN">AMZN</a> ·
    <a href="${origin}/BTC">BTC</a> · <a href="${origin}/ETH">ETH</a>
  </p>`
  }
  <p>Created by <a href="https://borjaruizdelgado.com">Borja Ruizdelgado</a></p>
</body>
</html>`
}

/**
 * Build crawler HTML for compare pages (/compare/AAPL/MSFT).
 */
export function buildCompareCrawlerHtml(url, tickerA, tickerB, quoteA, quoteB) {
  const origin = url.origin
  const nameA = quoteA?.name || tickerA
  const nameB = quoteB?.name || tickerB
  const priceA = quoteA?.price != null ? `$${quoteA.price.toFixed(2)}` : null
  const priceB = quoteB?.price != null ? `$${quoteB.price.toFixed(2)}` : null
  const title = `${tickerA} vs ${tickerB} — Stock Comparison — Borja Ruizdelgado Investing Tools`
  const description = priceA && priceB
    ? `Compare ${nameA} (${tickerA}) at ${priceA} vs ${nameB} (${tickerB}) at ${priceB}. Head-to-head valuation, growth, quality, risk, momentum scores, relative performance, and key metric spread.`
    : `Compare ${tickerA} vs ${tickerB}: head-to-head valuation, growth, quality, risk, momentum scores, relative performance chart, and key financial metrics side by side.`
  const canonical = `${origin}/compare/${tickerA}/${tickerB}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${title}</title>
  <meta name="description" content="${description}"/>
  <meta name="author" content="Borja Ruizdelgado"/>
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large"/>
  <link rel="canonical" href="${canonical}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${canonical}"/>
  <meta property="og:title" content="${title}"/>
  <meta property="og:description" content="${description}"/>
  <meta property="og:image" content="${origin}/og-image.jpg"/>
  <meta property="og:site_name" content="Borja Ruizdelgado — Investing Tools"/>
  <meta name="twitter:card" content="summary"/>
  <meta name="twitter:title" content="${title}"/>
  <meta name="twitter:description" content="${description}"/>
  <script type="application/ld+json">
  {
    "@context":"https://schema.org",
    "@type":"WebPage",
    "name":"${title}",
    "url":"${canonical}",
    "description":"${description}",
    "isPartOf":{"@type":"WebSite","name":"Borja Ruizdelgado — Investing Tools","url":"${origin}/"},
    "breadcrumb":{"@type":"BreadcrumbList","itemListElement":[
      {"@type":"ListItem","position":1,"name":"Home","item":"${origin}/"},
      {"@type":"ListItem","position":2,"name":"Compare","item":"${origin}/compare"},
      {"@type":"ListItem","position":3,"name":"${tickerA} vs ${tickerB}","item":"${canonical}"}
    ]}
  }
  </script>
</head>
<body>
  <h1>${tickerA} vs ${tickerB} — Stock Comparison</h1>
  <p>${description}</p>
  <h2>Compare Categories</h2>
  <ul>
    <li>Valuation — Forward P/E, EV/EBITDA, price-to-book</li>
    <li>Growth — Revenue growth, earnings growth</li>
    <li>Quality — Operating margins, ROE, profitability</li>
    <li>Risk — Beta, debt-to-equity, volatility</li>
    <li>Momentum — Sentiment and technical indicators</li>
  </ul>
  <h2>Individual Analysis</h2>
  <ul>
    <li><a href="${origin}/${tickerA}">${nameA} (${tickerA}) Full Analysis</a></li>
    <li><a href="${origin}/${tickerB}">${nameB} (${tickerB}) Full Analysis</a></li>
  </ul>
  <p>Created by <a href="https://borjaruizdelgado.com">Borja Ruizdelgado</a></p>
</body>
</html>`
}
