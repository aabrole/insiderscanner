#!/usr/bin/env python3
"""
Pine Seeds publisher: fetch prediction market probabilities via pmxt, update CSV files
(date, open, high, low, close, volume). Single snapshot per run => open=high=low=close.
Runs from GitHub Actions at 5 fixed times per US trading day (America/New_York).
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime

try:
    import pmxt
except ImportError:
    print("ERROR: pmxt not installed. Run: pip install pmxt")
    sys.exit(1)

# Repo root (parent of scripts/)
REPO_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = REPO_ROOT / "config" / "markets.json"


def load_config() -> list[dict]:
    with open(CONFIG_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return data.get("markets", [])


def get_probability(exchange_name: str, slug: str, outcome: str) -> tuple[float | None, float | None]:
    """
    Fetch market via pmxt and return (probability 0-100, volume_or_zero).
    outcome: "YES", "NO", or exact outcome label.
    """
    exchange_name = exchange_name.lower()
    if exchange_name == "polymarket":
        exchange = pmxt.Polymarket()
    elif exchange_name == "kalshi":
        exchange = pmxt.Kalshi()
    else:
        print(f"  WARN: unknown exchange {exchange_name}, skipping")
        return None, None

    try:
        markets = exchange.fetch_markets(slug=slug)
    except Exception as e:
        print(f"  ERROR: fetch_markets({slug!r}) failed: {e}")
        return None, None

    if not markets:
        print(f"  WARN: no markets for slug {slug!r}")
        return None, None

    market = markets[0]
    outcome_upper = outcome.upper()
    price = None
    volume = 0.0

    if outcome_upper == "YES" and hasattr(market, "yes") and market.yes:
        price = getattr(market.yes, "price", None)
        volume = getattr(market, "volume", 0) or getattr(market, "volume24h", 0) or 0
    elif outcome_upper == "NO" and hasattr(market, "no") and market.no:
        price = getattr(market.no, "price", None)
        volume = getattr(market, "volume", 0) or getattr(market, "volume24h", 0) or 0
    else:
        for o in getattr(market, "outcomes", []) or []:
            label = getattr(o, "label", None) or getattr(o, "name", "")
            if (label or "").strip().upper() == outcome_upper or (label or "").strip() == outcome:
                price = getattr(o, "price", None)
                break
        volume = getattr(market, "volume", 0) or getattr(market, "volume24h", 0) or 0

    if price is None:
        print(f"  WARN: outcome {outcome!r} not found for {slug}")
        return None, None

    prob_pct = round(float(price) * 100.0, 2)
    prob_pct = max(0.0, min(100.0, prob_pct))
    try:
        vol_num = float(volume)
    except (TypeError, ValueError):
        vol_num = 0.0
    return prob_pct, vol_num


def read_csv(path: Path) -> list[dict]:
    """Read CSV with header date,open,high,low,close,volume. Return list of row dicts."""
    if not path.exists():
        return []
    rows = []
    with open(path, encoding="utf-8") as f:
        lines = [ln.strip() for ln in f if ln.strip()]
    if not lines:
        return []
    header = [h.strip() for h in lines[0].split(",")]
    for line in lines[1:]:
        parts = [p.strip() for p in line.split(",")]
        rows.append(dict(zip(header, parts)))
    return rows


def write_csv(path: Path, rows: list[dict], header: list[str]) -> None:
    """Write rows to CSV, sorted by date ascending."""
    rows_sorted = sorted(rows, key=lambda r: r.get("date", ""))
    with open(path, "w", encoding="utf-8") as f:
        f.write(",".join(header) + "\n")
        for r in rows_sorted:
            f.write(",".join(str(r.get(h, "")) for h in header) + "\n")


HEADER = ["date", "open", "high", "low", "close", "volume"]


def update_or_append_row(rows: list[dict], date: str, close: float, volume: float) -> list[dict]:
    """If date exists, update that row; else append. Single snapshot => o=h=l=c."""
    close_str = f"{close:.2f}"
    vol_str = f"{volume:.0f}"
    new_row = {"date": date, "open": close_str, "high": close_str, "low": close_str, "close": close_str, "volume": vol_str}
    out = []
    found = False
    for r in rows:
        if r.get("date") == date:
            out.append(new_row)
            found = True
        else:
            out.append(r)
    if not found:
        out.append(new_row)
    return out


def main() -> int:
    print("Pine Seeds publisher starting")
    if not CONFIG_PATH.exists():
        print(f"ERROR: config not found at {CONFIG_PATH}")
        return 1

    markets = load_config()
    if not markets:
        print("No markets in config, nothing to do")
        return 0

    today = datetime.utcnow().strftime("%Y-%m-%d")
    published = []

    for m in markets:
        symbol_group = m.get("symbol_group", "?")
        exchange = m.get("exchange", "polymarket")
        slug = m.get("slug") or m.get("market_id")
        outcome = m.get("outcome", "YES")
        output_name = m.get("output_csv_name")
        if not slug or not output_name:
            print(f"  SKIP: missing slug/market_id or output_csv_name: {m}")
            continue

        csv_path = REPO_ROOT / f"{output_name}.csv"
        print(f"  Fetching {symbol_group} {exchange} {slug} outcome={outcome} -> {output_name}.csv")

        prob, vol = get_probability(exchange, slug, outcome)
        if prob is None:
            continue

        rows = read_csv(csv_path)
        rows = update_or_append_row(rows, today, prob, vol)
        write_csv(csv_path, rows, HEADER)
        published.append(f"{output_name}.csv close={prob:.2f} vol={vol:.0f}")

    if not published:
        print("Nothing published (all fetches failed or skipped)")
        return 0
    print("Published:", "; ".join(published))
    return 0


if __name__ == "__main__":
    sys.exit(main())
