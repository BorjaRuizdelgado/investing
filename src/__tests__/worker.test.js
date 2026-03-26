import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock the worker handler by importing the default export.
// We stub global fetch() so no real HTTP calls are made.
// ---------------------------------------------------------------------------

// Minimal Yahoo Finance mock responses
const YF_OPTIONS = {
  optionChain: {
    result: [
      {
        expirationDates: [1720000000],
        quote: {
          symbol: 'AAPL',
          regularMarketPrice: 150,
          shortName: 'Apple Inc.',
          marketCap: 2500000000000,
        },
        options: [
          {
            calls: [
              {
                strike: 150,
                bid: 4,
                ask: 5,
                lastPrice: 4.5,
                impliedVolatility: 0.25,
                volume: 100,
                openInterest: 500,
                inTheMoney: false,
              },
            ],
            puts: [
              {
                strike: 150,
                bid: 3,
                ask: 4,
                lastPrice: 3.5,
                impliedVolatility: 0.26,
                volume: 80,
                openInterest: 400,
                inTheMoney: false,
              },
            ],
          },
        ],
      },
    ],
  },
}

const YF_CHART = {
  chart: {
    result: [
      {
        meta: { symbol: 'AAPL' },
        timestamp: [1700000000, 1700086400],
        indicators: {
          quote: [
            {
              open: [148, 149],
              high: [151, 152],
              low: [147, 148],
              close: [150, 151],
              volume: [1000000, 1100000],
            },
          ],
        },
      },
    ],
  },
}

const YF_RATE = {
  chart: {
    result: [
      {
        indicators: {
          quote: [{ close: [5.2, 5.1] }],
        },
      },
    ],
  },
}

const YF_TRENDING = {
  finance: { result: [{ quotes: [{ symbol: 'AAPL' }] }] },
}

const YF_QUOTE = {
  quoteResponse: {
    result: [
      {
        symbol: 'AAPL',
        shortName: 'Apple Inc.',
        regularMarketPrice: 150,
        regularMarketChange: 1.5,
        regularMarketChangePercent: 1.0,
        marketCap: 2500000000000,
      },
      {
        symbol: 'BTC-USD',
        shortName: 'Bitcoin USD',
        regularMarketPrice: 65000,
        regularMarketChange: 500,
        regularMarketChangePercent: 0.77,
        marketCap: 1200000000000,
      },
    ],
  },
}

const YF_SUMMARY = {
  quoteSummary: {
    result: [
      {
        defaultKeyStatistics: {},
        financialData: {},
        incomeStatementHistory: { incomeStatementHistory: [] },
        balanceSheetHistory: { balanceSheetStatements: [] },
        cashflowStatementHistory: { cashflowStatements: [] },
      },
    ],
  },
}

// Crumb auth stubs
const CRUMB_TEXT = 'testcrumb123'

function mockFetchImpl(url) {
  const u = typeof url === 'string' ? url : url.toString()

  // Auth flow
  if (u.includes('fc.yahoo.com')) {
    return Promise.resolve(
      new Response('', { status: 302, headers: { 'set-cookie': 'A3=d=test; path=/' } }),
    )
  }
  if (u.includes('getcrumb')) {
    return Promise.resolve(new Response(CRUMB_TEXT, { status: 200 }))
  }

  // YF API endpoints
  if (u.includes('/v7/finance/options/')) {
    return Promise.resolve(new Response(JSON.stringify(YF_OPTIONS), { status: 200 }))
  }
  if (u.includes('/v10/finance/quoteSummary/')) {
    return Promise.resolve(new Response(JSON.stringify(YF_SUMMARY), { status: 200 }))
  }
  if (u.includes('/v8/finance/chart/') && u.includes('IRX')) {
    return Promise.resolve(new Response(JSON.stringify(YF_RATE), { status: 200 }))
  }
  if (u.includes('/v8/finance/chart/')) {
    return Promise.resolve(new Response(JSON.stringify(YF_CHART), { status: 200 }))
  }
  if (u.includes('/v1/finance/trending/')) {
    return Promise.resolve(new Response(JSON.stringify(YF_TRENDING), { status: 200 }))
  }
  if (u.includes('/v7/finance/quote')) {
    return Promise.resolve(new Response(JSON.stringify(YF_QUOTE), { status: 200 }))
  }

  return Promise.resolve(new Response('Not found', { status: 404 }))
}

// Import worker handler
let worker
beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn(mockFetchImpl))
  // Re-import to reset auth cache
  const mod = await import('../worker.js')
  worker = mod.default
})

// Mock env with ASSETS
const mockAssets = {
  fetch: () => Promise.resolve(new Response('not found', { status: 404 })),
}

async function callWorker(path) {
  const request = new Request(`https://test.example.com${path}`)
  return worker.fetch(request, { ASSETS: mockAssets })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Worker /api/options', () => {
  it('returns valid structure', async () => {
    const res = await callWorker('/api/options?ticker=AAPL')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('ticker')
    expect(data).toHaveProperty('price')
    expect(data).toHaveProperty('expirations')
    expect(Array.isArray(data.expirations)).toBe(true)
  })

  it('returns 400 for missing ticker', async () => {
    const res = await callWorker('/api/options')
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid ticker', async () => {
    const res = await callWorker('/api/options?ticker=!!BAD!!')
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Invalid ticker')
  })
})

describe('Worker /api/chain', () => {
  it('returns calls+puts arrays', async () => {
    const res = await callWorker('/api/chain?ticker=AAPL&exp=1720000000')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.calls)).toBe(true)
    expect(Array.isArray(data.puts)).toBe(true)
  })

  it('returns 400 for missing params', async () => {
    const res = await callWorker('/api/chain?ticker=AAPL')
    expect(res.status).toBe(400)
  })
})

describe('Worker /api/history', () => {
  it('returns OHLCV bars', async () => {
    const res = await callWorker('/api/history?ticker=AAPL&days=60')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('bars')
    expect(Array.isArray(data.bars)).toBe(true)
    if (data.bars.length > 0) {
      expect(data.bars[0]).toHaveProperty('open')
      expect(data.bars[0]).toHaveProperty('close')
      expect(data.bars[0]).toHaveProperty('volume')
    }
  })

  it('returns 400 for invalid days', async () => {
    const res = await callWorker('/api/history?ticker=AAPL&days=999')
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative days', async () => {
    const res = await callWorker('/api/history?ticker=AAPL&days=-5')
    expect(res.status).toBe(400)
  })
})

describe('Worker /api/rate', () => {
  it('returns a number', async () => {
    const res = await callWorker('/api/rate')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(typeof data.rate).toBe('number')
  })
})

describe('Worker /api/trending', () => {
  it('returns stocks+crypto arrays', async () => {
    const res = await callWorker('/api/trending')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('stocks')
    expect(data).toHaveProperty('crypto')
    expect(Array.isArray(data.stocks)).toBe(true)
    expect(Array.isArray(data.crypto)).toBe(true)
  })
})

describe('CORS headers', () => {
  it('all API responses include CORS headers', async () => {
    for (const path of ['/api/options?ticker=AAPL', '/api/rate']) {
      const res = await callWorker(path)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    }
  })

  it('OPTIONS returns CORS preflight headers', async () => {
    const request = new Request('https://test.example.com/api/options', { method: 'OPTIONS' })
    const res = await worker.fetch(request, { ASSETS: mockAssets })
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET')
  })
})
