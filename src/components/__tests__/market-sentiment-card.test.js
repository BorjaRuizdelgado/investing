import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

// Tooltip uses createPortal which doesn't exist in server render — stub it
vi.mock('../Tooltip.jsx', () => ({ default: ({ text }) => React.createElement('span', { 'data-tip': text }) }))

import MarketSentimentCard from '../MarketSentimentCard.jsx'

const EQUITY_SENTIMENT = {
  scope: 'equity',
  source: 'house',
  name: 'Ticker Sentiment',
  score: 62,
  classification: 'Greed',
  asOf: '2026-03-29T12:00:00.000Z',
  components: [
    { label: 'Price Momentum', score: 70, detail: 'Close vs 125-day SMA' },
    { label: 'RSI (14)', score: 65, detail: '14-day relative strength index' },
    { label: '52-Week Position', score: 60, detail: 'Price position in 52-week range' },
    { label: 'Volume Pressure', score: 58, detail: '10-day vs 60-day average volume' },
    { label: 'Bollinger %B', score: 62, detail: 'Price position within 20-day Bollinger Bands' },
  ],
  attribution: null,
}

const CRYPTO_SENTIMENT = {
  scope: 'crypto',
  source: 'house',
  name: 'Ticker Sentiment',
  score: 38,
  classification: 'Fear',
  asOf: '2026-03-29T12:00:00.000Z',
  components: [
    { label: 'Price Momentum', score: 35, detail: 'Close vs 125-day SMA' },
    { label: 'RSI (14)', score: 30, detail: '14-day relative strength index' },
    { label: '52-Week Position', score: 40, detail: 'Price position in 52-week range' },
    { label: 'Volume Pressure', score: 45, detail: '10-day vs 60-day average volume' },
    { label: 'Bollinger %B', score: 40, detail: 'Price position within 20-day Bollinger Bands' },
  ],
  attribution: null,
}

describe('MarketSentimentCard — equity sentiment', () => {
  it('renders the card with name and classification', () => {
    const html = renderToStaticMarkup(React.createElement(MarketSentimentCard, { sentiment: EQUITY_SENTIMENT }))
    expect(html).toContain('Ticker Sentiment')
    expect(html).toContain('Greed')
  })

  it('renders the numeric score', () => {
    const html = renderToStaticMarkup(React.createElement(MarketSentimentCard, { sentiment: EQUITY_SENTIMENT }))
    expect(html).toContain('62')
  })

  it('does not render an attribution link for equity (house score)', () => {
    const html = renderToStaticMarkup(React.createElement(MarketSentimentCard, { sentiment: EQUITY_SENTIMENT }))
    expect(html).not.toContain('alternative.me')
  })

  it('applies a positive tone class for greed scores', () => {
    const html = renderToStaticMarkup(React.createElement(MarketSentimentCard, { sentiment: EQUITY_SENTIMENT }))
    expect(html).toContain('score-card--positive')
  })

  it('applies a negative tone class for fear scores (score = 30)', () => {
    const fearSentiment = { ...EQUITY_SENTIMENT, score: 30, classification: 'Fear' }
    const html = renderToStaticMarkup(React.createElement(MarketSentimentCard, { sentiment: fearSentiment }))
    expect(html).toContain('score-card--negative')
  })

  it('applies a neutral tone class for neutral scores (score = 50)', () => {
    const neutralSentiment = { ...EQUITY_SENTIMENT, score: 50, classification: 'Neutral' }
    const html = renderToStaticMarkup(React.createElement(MarketSentimentCard, { sentiment: neutralSentiment }))
    expect(html).toContain('score-card--neutral')
  })
})

describe('MarketSentimentCard — crypto sentiment', () => {
  it('renders name and score', () => {
    const html = renderToStaticMarkup(React.createElement(MarketSentimentCard, { sentiment: CRYPTO_SENTIMENT }))
    expect(html).toContain('Ticker Sentiment')
    expect(html).toContain('38')
    expect(html).toContain('Fear')
  })

  it('does not render an attribution link (same methodology as equity)', () => {
    const html = renderToStaticMarkup(React.createElement(MarketSentimentCard, { sentiment: CRYPTO_SENTIMENT }))
    expect(html).not.toContain('alternative.me')
    expect(html).not.toContain('Source:')
  })
})

describe('MarketSentimentCard — absent / invalid data', () => {
  it('renders nothing when sentiment is null', () => {
    const html = renderToStaticMarkup(React.createElement(MarketSentimentCard, { sentiment: null }))
    expect(html).toBe('')
  })

  it('renders nothing when sentiment is undefined', () => {
    const html = renderToStaticMarkup(React.createElement(MarketSentimentCard, { sentiment: undefined }))
    expect(html).toBe('')
  })

  it('renders nothing when score is NaN', () => {
    const html = renderToStaticMarkup(
      React.createElement(MarketSentimentCard, { sentiment: { ...EQUITY_SENTIMENT, score: NaN } }),
    )
    expect(html).toBe('')
  })
})
