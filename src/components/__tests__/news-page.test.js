import { describe, expect, it } from 'vitest'

import { countSentiments, filterArticles, normalizeArticles, timeAgo } from '../NewsPage.jsx'

describe('NewsPage helpers', () => {
  it('normalizes partial API records into render-safe articles', () => {
    const articles = normalizeArticles([
      {
        title: '  Earnings beat expectations  ',
        source: '',
        feed: 'yahoo',
        sentiment: 'bullish',
        url: '',
      },
    ])

    expect(articles).toEqual([
      expect.objectContaining({
        title: 'Earnings beat expectations',
        source: 'Unknown source',
        feed: 'yahoo',
        sentiment: 'neutral',
        url: '',
      }),
    ])
    expect(articles[0].id).toContain('Earnings beat expectations')
  })

  it('filters safely by sentiment and search query', () => {
    const articles = normalizeArticles([
      { title: 'Strong guidance', source: 'Reuters', sentiment: 'positive' },
      { title: null, source: null, sentiment: 'negative' },
    ])

    expect(filterArticles(articles, 'positive', 'guidance')).toHaveLength(1)
    expect(filterArticles(articles, 'all', 'unknown')).toHaveLength(1)
    expect(filterArticles(articles, 'negative', '')[0].title).toBe('Untitled headline')
  })

  it('counts only normalized sentiment buckets', () => {
    const articles = normalizeArticles([
      { title: 'Good', sentiment: 'positive' },
      { title: 'Bad', sentiment: 'negative' },
      { title: 'Odd', sentiment: 'unexpected' },
    ])

    expect(countSentiments(articles)).toEqual({
      positive: 1,
      neutral: 1,
      negative: 1,
    })
  })

  it('formats relative publish times and ignores invalid dates', () => {
    const now = new Date('2026-04-27T12:00:00Z').getTime()

    expect(timeAgo('2026-04-27T11:55:00Z', now)).toBe('5m ago')
    expect(timeAgo('2026-04-27T09:00:00Z', now)).toBe('3h ago')
    expect(timeAgo('not-a-date', now)).toBe('')
  })
})
