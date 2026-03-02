"""
data_fetcher.py – Fetch options chain and market data from Yahoo Finance.
"""

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta


class MarketData:
    """Wraps yfinance to provide clean options & stock data."""

    def __init__(self, ticker: str):
        self.ticker_symbol = ticker.upper()
        self.yf_ticker = yf.Ticker(self.ticker_symbol)
        self._spot_price = None

    # ------------------------------------------------------------------
    # Spot price
    # ------------------------------------------------------------------
    @property
    def spot_price(self) -> float:
        """Current (last) price of the underlying."""
        if self._spot_price is None:
            info = self.yf_ticker.fast_info
            self._spot_price = float(info.get("lastPrice", info.get("previousClose", 0)))
        return self._spot_price

    # ------------------------------------------------------------------
    # Historical prices
    # ------------------------------------------------------------------
    def historical_prices(self, days: int) -> pd.DataFrame:
        """
        Fetch *days* calendar-days of historical OHLCV data.

        Returns DataFrame with columns: Date, Open, High, Low, Close, Volume.
        The index is a DatetimeIndex.
        """
        # yfinance "period" is calendar days, but we pad a bit to be safe
        hist = self.yf_ticker.history(period=f"{days + 5}d")
        if hist.empty:
            return pd.DataFrame(columns=["Open", "High", "Low", "Close", "Volume"])
        # Keep only last *days* rows
        hist = hist.tail(days)
        return hist[["Open", "High", "Low", "Close", "Volume"]]

    # ------------------------------------------------------------------
    # Expirations
    # ------------------------------------------------------------------
    @property
    def expirations(self) -> tuple[str, ...]:
        """All available option expiration dates (YYYY-MM-DD strings)."""
        return self.yf_ticker.options

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

        Each DataFrame has columns:
            strike, bid, ask, mid, lastPrice, impliedVolatility,
            volume, openInterest, inTheMoney
        """
        chain = self.yf_ticker.option_chain(expiry)
        calls = self._clean(chain.calls)
        puts = self._clean(chain.puts)
        return {"calls": calls, "puts": puts}

    # ------------------------------------------------------------------
    # Risk-free rate proxy (13-week T-bill via ^IRX)
    # ------------------------------------------------------------------
    @staticmethod
    def risk_free_rate() -> float:
        """
        Approximate risk-free rate from the 13-week Treasury bill yield.
        Falls back to 5 % if data is unavailable.
        """
        try:
            irx = yf.Ticker("^IRX")
            hist = irx.history(period="5d")
            if not hist.empty:
                # ^IRX is quoted as a percentage
                return float(hist["Close"].iloc[-1]) / 100.0
        except Exception:
            pass
        return 0.05  # fallback

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------
    @staticmethod
    def _clean(df: pd.DataFrame) -> pd.DataFrame:
        """Add a mid-price column and sort by strike."""
        df = df.copy()
        df["mid"] = (df["bid"] + df["ask"]) / 2.0
        # Where bid/ask is 0, fall back to lastPrice
        mask = (df["bid"] == 0) | (df["ask"] == 0)
        df.loc[mask, "mid"] = df.loc[mask, "lastPrice"]
        df = df.sort_values("strike").reset_index(drop=True)
        return df
