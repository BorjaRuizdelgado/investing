/**
 * /sitemap.xml — dynamic sitemap with popular tickers.
 */

export const SITEMAP_TICKERS = [
  // Mega-cap & popular stocks
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'BRK-B', 'AVGO', 'JPM',
  'LLY', 'V', 'UNH', 'MA', 'XOM', 'COST', 'HD', 'PG', 'JNJ', 'ABBV',
  'NFLX', 'CRM', 'BAC', 'AMD', 'ORCL', 'ADBE', 'KO', 'PEP', 'TMO', 'MRK',
  'ACN', 'CSCO', 'WMT', 'ABT', 'LIN', 'PM', 'MCD', 'DIS', 'NOW', 'IBM',
  'GE', 'ISRG', 'INTU', 'QCOM', 'TXN', 'AMGN', 'HON', 'CAT', 'AMAT', 'BKNG',
  'GS', 'AXP', 'UBER', 'MS', 'BLK', 'SBUX', 'PFE', 'SYK', 'SCHW', 'LOW',
  'DE', 'GILD', 'MDLZ', 'REGN', 'PANW', 'CB', 'ADI', 'VRTX', 'SO', 'CME',
  'BX', 'LRCX', 'PYPL', 'MU', 'PLTR', 'COIN', 'SOFI', 'RIVN', 'LCID', 'ARM',
  'SNOW', 'CRWD', 'DDOG', 'NET', 'ZS', 'MRVL', 'ABNB', 'DASH', 'RBLX', 'U',
  'SHOP', 'SQ', 'ROKU', 'SNAP', 'PINS', 'HOOD', 'MARA', 'RIOT', 'SMCI', 'AI',
  // ETFs
  'SPY', 'QQQ', 'IWM', 'DIA', 'VOO', 'VTI', 'ARKK', 'XLF', 'XLE', 'XLK',
  'SOXL', 'TQQQ', 'SQQQ', 'VXX', 'UVXY', 'GLD', 'SLV', 'TLT', 'HYG', 'EEM',
  // Crypto
  'BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'LINK', 'MATIC',
]

export const COMPARE_PAIRS = [
  'AAPL/MSFT', 'TSLA/RIVN', 'NVDA/AMD', 'GOOGL/META', 'AMZN/WMT',
  'SPY/QQQ', 'NFLX/DIS', 'JPM/GS', 'V/MA', 'BTC/ETH',
]

export function buildSitemap(origin) {
  const today = new Date().toISOString().slice(0, 10)
  const urls = [
    `<url><loc>${origin}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${origin}/disclaimer</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.3</priority></url>`,
    `<url><loc>${origin}/donate</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.3</priority></url>`,
    `<url><loc>${origin}/screener</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`,
    `<url><loc>${origin}/compare</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>`,
    ...COMPARE_PAIRS.map(
      (pair) =>
        `<url><loc>${origin}/compare/${pair}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.6</priority></url>`,
    ),
    ...SITEMAP_TICKERS.map(
      (t) =>
        `<url><loc>${origin}/${t}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`,
    ),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`
}
