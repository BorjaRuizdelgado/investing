"""
crypto_fetcher.py – Fetch crypto options data from the Deribit public API.

Deribit is the largest crypto options exchange and provides a free public
API (no key required) for crypto option chains.  At the time of writing
BTC and ETH have active options; the code discovers available currencies
dynamically so new listings are picked up automatically.

This module exposes `CryptoMarketData`, which mirrors the `MarketData`
interface so the rest of the codebase (analysis, charts, app) can work
transparently with crypto underlyings.
"""

import requests
import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, timezone
from functools import lru_cache


# ======================================================================
# Discover which Deribit currencies have live option instruments
# ======================================================================

@lru_cache(maxsize=1)
def _deribit_option_currencies() -> set[str]:
    """
    Query the Deribit public API for all currencies, then keep only those
    that have at least one live (non-expired) option instrument.

    The result is cached for the lifetime of the process.
    """
    base = "https://www.deribit.com/api/v2/public"
    try:
        resp = requests.get(f"{base}/get_currencies", timeout=10)
        resp.raise_for_status()
        currencies = [c["currency"] for c in resp.json().get("result", [])]
    except Exception:
        # Fallback to known supported currencies if the API is unreachable
        return {"BTC", "ETH"}

    active: set[str] = set()
    for cur in currencies:
        try:
            r = requests.get(
                f"{base}/get_instruments",
                params={"currency": cur, "kind": "option", "expired": "false"},
                timeout=10,
            )
            r.raise_for_status()
            if r.json().get("result"):
                active.add(cur)
        except Exception:
            continue

    return active if active else {"BTC", "ETH"}


# ======================================================================
# Known crypto symbols (for fast, offline-first detection)
# ======================================================================

# Common crypto symbols users might type.  If a symbol is in this set we
# *check* Deribit; if it's not here the ticker goes straight to yfinance.
# This avoids the API round-trip for obvious stock tickers like AAPL.
_LIKELY_CRYPTO = {
    "BTC", "ETH", "SOL", "XRP", "BNB", "MATIC", "DOGE", "ADA", "AVAX",
    "DOT", "LINK", "LTC", "UNI", "ATOM", "FIL", "APT", "ARB", "OP",
    "NEAR", "PAXG", "USDC", "USDT", "USDE",
}


class CryptoMarketData:
    """Wraps the Deribit public API to provide crypto options & price data."""

    BASE_URL = "https://www.deribit.com/api/v2/public"

    def __init__(self, ticker: str):
        self.currency = self._normalize(ticker)
        self.ticker_symbol = ticker.upper()
        self._spot_price: float | None = None
        self._instruments: list[dict] | None = None
        self._book_summaries: list[dict] | None = None

    # ------------------------------------------------------------------
    # Crypto detection
    # ------------------------------------------------------------------

    @staticmethod
    def _strip_suffix(ticker: str) -> str:
        """Strip common fiat/stablecoin suffixes: BTC-USD → BTC."""
        t = ticker.upper().strip()
        for suffix in ("-USDT", "-USD", "-PERP", "USDT", "USD"):
            if t.endswith(suffix):
                t = t[: -len(suffix)]
                break
        return t

    @classmethod
    def _normalize(cls, ticker: str) -> str:
        """
        Map user input like 'BTC', 'BTC-USD', 'BTCUSDT' → 'BTC'.
        Raises ValueError if the currency has no options on Deribit.
        """
        base = cls._strip_suffix(ticker)
        supported = _deribit_option_currencies()
        if base in supported:
            return base
        raise ValueError(
            f"No crypto options available for '{ticker}'. "
            f"Deribit currently lists options for: "
            f"{', '.join(sorted(supported))}."
        )

    @classmethod
    def is_crypto(cls, ticker: str) -> bool:
        """
        Return True if *ticker* is a crypto symbol with live options
        on Deribit.

        Uses a two-step check:
        1. Fast offline filter – is this a plausible crypto symbol?
        2. If yes, verify against the Deribit API (cached).
        """
        base = cls._strip_suffix(ticker)
        if base not in _LIKELY_CRYPTO:
            return False
        return base in _deribit_option_currencies()

    # ------------------------------------------------------------------
    # Deribit API helpers
    # ------------------------------------------------------------------

    def _get(self, endpoint: str, params: dict | None = None) -> dict:
        """Call a Deribit public endpoint and return the 'result' payload."""
        resp = requests.get(
            f"{self.BASE_URL}/{endpoint}",
            params=params or {},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            raise RuntimeError(f"Deribit API error: {data['error']}")
        return data["result"]

    def _fetch_instruments(self) -> list[dict]:
        if self._instruments is None:
            self._instruments = self._get(
                "get_instruments",
                {"currency": self.currency, "kind": "option", "expired": "false"},
            )
        return self._instruments

    def _fetch_book_summaries(self) -> list[dict]:
        if self._book_summaries is None:
            self._book_summaries = self._get(
                "get_book_summary_by_currency",
                {"currency": self.currency, "kind": "option"},
            )
        return self._book_summaries

    # ------------------------------------------------------------------
    # Spot price
    # ------------------------------------------------------------------

    @property
    def spot_price(self) -> float:
        """Current index price in USD."""
        if self._spot_price is None:
            result = self._get(
                "get_index_price",
                {"index_name": f"{self.currency.lower()}_usd"},
            )
            self._spot_price = float(result["index_price"])
        return self._spot_price

    # ------------------------------------------------------------------
    # Historical prices (via yfinance – supports BTC-USD / ETH-USD)
    # ------------------------------------------------------------------

    def historical_prices(self, days: int) -> pd.DataFrame:
        """Fetch *days* of daily OHLCV history from Yahoo Finance."""
        yf_ticker = yf.Ticker(f"{self.currency}-USD")
        hist = yf_ticker.history(period=f"{days + 5}d")
        if hist.empty:
            return pd.DataFrame(columns=["Open", "High", "Low", "Close", "Volume"])
        return hist.tail(days)[["Open", "High", "Low", "Close", "Volume"]]

    # ------------------------------------------------------------------
    # Expirations
    # ------------------------------------------------------------------

    @property
    def expirations(self) -> tuple[str, ...]:
        """Available option expiration dates as YYYY-MM-DD strings."""
        instruments = self._fetch_instruments()
        expiries: set[str] = set()
        for inst in instruments:
            ts = inst["expiration_timestamp"] / 1000
            exp_date = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
            expiries.add(exp_date)
        return tuple(sorted(expiries))

    def days_to_expiry(self, expiry: str) -> float:
        """Calendar days from now until *expiry*."""
        exp_date = datetime.strptime(expiry, "%Y-%m-%d")
        delta = exp_date - datetime.now()
        return max(delta.days + delta.seconds / 86_400, 1 / 365)

    # ------------------------------------------------------------------
    # Options chain
    # ------------------------------------------------------------------

    def options_chain(self, expiry: str) -> dict[str, pd.DataFrame]:
        """
        Return {'calls': DataFrame, 'puts': DataFrame} for *expiry*.

        Columns match `MarketData.options_chain` output:
            strike, bid, ask, mid, lastPrice, impliedVolatility,
            volume, openInterest, inTheMoney
        """
        instruments = self._fetch_instruments()
        book_summaries = self._fetch_book_summaries()
        book_map = {b["instrument_name"]: b for b in book_summaries}

        spot = self.spot_price

        calls_rows: list[dict] = []
        puts_rows: list[dict] = []

        for inst in instruments:
            # Match expiry date
            ts = inst["expiration_timestamp"] / 1000
            inst_exp = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
            if inst_exp != expiry:
                continue

            name = inst["instrument_name"]
            strike = float(inst["strike"])
            opt_type = inst["option_type"]  # "call" or "put"

            book = book_map.get(name, {})

            # Deribit quotes prices as a fraction of the underlying
            bid_frac = book.get("bid_price") or 0
            ask_frac = book.get("ask_price") or 0
            mark_frac = book.get("mark_price") or 0
            last_frac = book.get("last") or mark_frac

            # Convert to USD
            bid = (bid_frac * spot) if bid_frac else 0.0
            ask = (ask_frac * spot) if ask_frac else 0.0
            last_price = (last_frac * spot) if last_frac else 0.0
            mid = ((bid + ask) / 2) if (bid > 0 and ask > 0) else last_price

            # If mid is still zero, use mark price
            if mid <= 0:
                mid = (mark_frac * spot) if mark_frac else 0.0

            iv = (book.get("mark_iv", 0) or 0) / 100  # Deribit IV is in %
            oi = book.get("open_interest", 0) or 0
            vol = book.get("volume", 0) or 0

            itm = (opt_type == "call" and strike < spot) or (
                opt_type == "put" and strike > spot
            )

            row = {
                "strike": strike,
                "bid": bid,
                "ask": ask,
                "mid": mid,
                "lastPrice": last_price,
                "impliedVolatility": iv,
                "volume": vol,
                "openInterest": oi,
                "inTheMoney": itm,
            }

            if opt_type == "call":
                calls_rows.append(row)
            else:
                puts_rows.append(row)

        empty_cols = [
            "strike", "bid", "ask", "mid", "lastPrice",
            "impliedVolatility", "volume", "openInterest", "inTheMoney",
        ]
        calls = (
            pd.DataFrame(calls_rows).sort_values("strike").reset_index(drop=True)
            if calls_rows
            else pd.DataFrame(columns=empty_cols)
        )
        puts = (
            pd.DataFrame(puts_rows).sort_values("strike").reset_index(drop=True)
            if puts_rows
            else pd.DataFrame(columns=empty_cols)
        )
        return {"calls": calls, "puts": puts}

    # ------------------------------------------------------------------
    # Risk-free rate (same T-bill proxy as MarketData)
    # ------------------------------------------------------------------

    @staticmethod
    def risk_free_rate() -> float:
        """Approximate risk-free rate from the 13-week Treasury bill yield."""
        try:
            irx = yf.Ticker("^IRX")
            hist = irx.history(period="5d")
            if not hist.empty:
                return float(hist["Close"].iloc[-1]) / 100.0
        except Exception:
            pass
        return 0.05
