import React, { useState, useRef, useEffect, useCallback } from 'react'
import { fetchSearch } from '../lib/fetcher.js'

const TYPE_LABELS = { EQUITY: 'Stock', ETF: 'ETF', CRYPTOCURRENCY: 'Crypto', MUTUALFUND: 'Fund', INDEX: 'Index' }

/**
 * Autocomplete ticker search input.
 *
 * Props:
 *  - value / onChange: controlled input text
 *  - onSelect(symbol): called when user picks a result
 *  - placeholder, ariaLabel
 *  - inputRef: optional ref forwarded to <input>
 *  - className: optional extra className on wrapper
 */
export default function TickerSearch({
  value,
  onChange,
  onSelect,
  placeholder = 'Search by name or ticker…',
  ariaLabel = 'Ticker symbol',
  inputRef: externalRef,
  className = '',
}) {
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [userTyping, setUserTyping] = useState(false)
  const timerRef = useRef(null)
  const wrapperRef = useRef(null)
  const internalRef = useRef(null)
  const inputEl = externalRef || internalRef

  // Debounced search
  const search = useCallback((q) => {
    clearTimeout(timerRef.current)
    if (!q || q.length < 1) {
      setResults([])
      setOpen(false)
      return
    }
    timerRef.current = setTimeout(async () => {
      try {
        const data = await fetchSearch(q)
        setResults(data.results || [])
        setOpen(data.results?.length > 0)
        setActiveIdx(-1)
      } catch {
        setResults([])
        setOpen(false)
      }
    }, 250)
  }, [])

  // When value changes from user typing, trigger search
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: debounced fetch updates results
  useEffect(() => { if (userTyping) search(value) }, [value, search, userTyping])

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleKeyDown(e) {
    if (!open || results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => (i < results.length - 1 ? i + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (i > 0 ? i - 1 : results.length - 1))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      pick(results[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function pick(item) {
    setOpen(false)
    setResults([])
    setUserTyping(false)
    onSelect(item.symbol)
  }

  return (
    <div className={`ticker-search ${className}`} ref={wrapperRef}>
      <input
        ref={inputEl}
        type="text"
        value={value}
        onChange={(e) => {
          setUserTyping(true)
          onChange(e.target.value.toUpperCase())
        }}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck="false"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-activedescendant={activeIdx >= 0 ? `ts-item-${activeIdx}` : undefined}
      />
      {open && results.length > 0 && (
        <ul className="ticker-search__dropdown" role="listbox">
          {results.map((r, i) => (
            <li
              key={r.symbol}
              id={`ts-item-${i}`}
              role="option"
              aria-selected={i === activeIdx}
              className={`ticker-search__item${i === activeIdx ? ' ticker-search__item--active' : ''}`}
              onMouseDown={() => pick(r)}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span className="ticker-search__symbol">{r.symbol}</span>
              <span className="ticker-search__name">{r.name}</span>
              <span className="ticker-search__type">{TYPE_LABELS[r.type] || r.type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
