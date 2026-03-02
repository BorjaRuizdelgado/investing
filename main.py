#!/usr/bin/env python3
"""
main.py – CLI entry point for the options-implied price forecast tool.

Usage:
    python main.py AAPL
    python main.py TSLA --expiry 2
    python main.py SPY  --all-expiries --save
"""

import argparse
import sys
from pathlib import Path

from data_fetcher import MarketData, get_market_data
from analysis import (
    implied_distribution,
    expected_move,
    bull_bear_probabilities,
    percentile_levels,
    max_pain,
    iv_smile,
)
from visualize import plot_full_analysis


def analyse_expiry(market: MarketData, expiry: str, r: float, save: bool):
    """Run the full analysis pipeline for a single expiration."""
    spot = market.spot_price
    dte = market.days_to_expiry(expiry)
    T = dte / 365.0

    print(f"\n{'='*60}")
    print(f"  {market.ticker_symbol}  |  Expiry: {expiry}  |  Spot: ${spot:,.2f}")
    print(f"  Days to expiry: {dte:.0f}  |  r = {r:.2%}")
    print(f"{'='*60}")

    # 1. Fetch options chain
    chain = market.options_chain(expiry)
    calls, puts = chain["calls"], chain["puts"]
    print(f"  Calls: {len(calls)} strikes  |  Puts: {len(puts)} strikes")

    # 1b. Fetch historical prices (past N days = days to expiry, min 30)
    hist_days = max(int(dte), 30)
    history = market.historical_prices(hist_days)
    print(f"  Historical prices: {len(history)} days")

    # 2. Implied distribution (Breeden-Litzenberger)
    try:
        dist = implied_distribution(calls, spot, r, T, puts=puts)
    except ValueError as e:
        print(f"  ⚠ Skipping {expiry}: {e}")
        return

    # 3. Expected move
    em = expected_move(calls, puts, spot)

    # 4. Bull / bear probabilities
    probs = bull_bear_probabilities(dist, spot)

    # 5. Percentile levels
    pctiles = percentile_levels(dist)

    # 6. Max pain
    mp = max_pain(calls, puts)

    # 7. IV smile data
    iv_df = iv_smile(calls, puts, spot)

    # --- Print summary ------------------------------------------------
    print(f"\n  Expected (mean) price:  ${dist['mean']:>10,.2f}")
    print(f"  Median price:          ${dist['median']:>10,.2f}")
    print(f"  Std deviation:         ${dist['std']:>10,.2f}")
    print(f"  Skewness:              {dist['skew']:>+10.3f}")
    print()
    print(f"  ATM straddle:          ${em['straddle']:>10,.2f}")
    print(f"  Expected move:         ±${em['move_abs']:>9,.2f}  ({em['move_pct']:.1f}%)")
    print(f"  Range:                 ${em['lower']:>10,.2f}  –  ${em['upper']:,.2f}")
    print(f"  Max pain:              ${mp:>10,.2f}" if mp == mp else "  Max pain:              N/A")
    print()
    print(f"  P(above spot):         {probs['prob_above']*100:>9.1f}%")
    print(f"  P(below spot):         {probs['prob_below']*100:>9.1f}%")
    print()
    for p, val in sorted(pctiles.items()):
        print(f"  {p:>3}th percentile:      ${val:>10,.2f}")

    # --- Plot ---------------------------------------------------------
    save_path = None
    if save:
        out_dir = Path("output")
        out_dir.mkdir(exist_ok=True)
        save_path = out_dir / f"{market.ticker_symbol}_{expiry}.png"

    plot_full_analysis(
        ticker=market.ticker_symbol,
        expiry=expiry,
        spot=spot,
        dist=dist,
        em=em,
        probs=probs,
        pctiles=pctiles,
        mp=mp,
        iv_df=iv_df,
        calls=calls,
        puts=puts,
        history=history,
        days_to_expiry=dte,
        save_path=save_path,
    )


def main():
    parser = argparse.ArgumentParser(
        description="Options-Implied Price Forecast – see where the market thinks a stock is going."
    )
    parser.add_argument("ticker", help="Ticker symbol (e.g. AAPL, TSLA, SPY, BTC, ETH)")
    parser.add_argument(
        "--expiry", type=int, default=0,
        help="Expiration index (0 = nearest, 1 = next, …). Default: 0"
    )
    parser.add_argument(
        "--all-expiries", action="store_true",
        help="Analyse all available expiration dates"
    )
    parser.add_argument(
        "--save", action="store_true",
        help="Save plots to output/ instead of displaying"
    )
    args = parser.parse_args()

    print(f"\nFetching data for {args.ticker.upper()} …")
    market = get_market_data(args.ticker)

    expirations = market.expirations
    if not expirations:
        print(f"No options data found for {args.ticker.upper()}.")
        sys.exit(1)

    print(f"Available expirations: {', '.join(expirations)}")

    # Risk-free rate
    r = MarketData.risk_free_rate()
    print(f"Risk-free rate (13w T-bill): {r:.2%}")

    # Filter out expirations with < 1 day remaining (already expired today)
    valid_expirations = [e for e in expirations if market.days_to_expiry(e) >= 1]
    if not valid_expirations:
        valid_expirations = list(expirations)  # fallback to all

    if args.all_expiries:
        for exp in valid_expirations:
            try:
                analyse_expiry(market, exp, r, args.save)
            except Exception as e:
                print(f"  ⚠ Error on {exp}: {e}")
    else:
        idx = min(args.expiry, len(valid_expirations) - 1)
        analyse_expiry(market, valid_expirations[idx], r, args.save)

    print("\nDone.")


if __name__ == "__main__":
    main()
