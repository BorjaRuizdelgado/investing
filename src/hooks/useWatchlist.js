import { useState, useCallback } from "react";

const STORAGE_KEY = "watchlist";

function readWatchlist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function writeWatchlist(tickers) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
  } catch {}
}

export default function useWatchlist() {
  const [tickers, setTickers] = useState(readWatchlist);

  const add = useCallback((ticker) => {
    const t = ticker.toUpperCase();
    setTickers((prev) => {
      if (prev.includes(t)) return prev;
      const next = [...prev, t];
      writeWatchlist(next);
      return next;
    });
  }, []);

  const remove = useCallback((ticker) => {
    const t = ticker.toUpperCase();
    setTickers((prev) => {
      const next = prev.filter((x) => x !== t);
      writeWatchlist(next);
      return next;
    });
  }, []);

  const has = useCallback((ticker) => {
    return tickers.includes(ticker.toUpperCase());
  }, [tickers]);

  return { tickers, add, remove, has };
}
