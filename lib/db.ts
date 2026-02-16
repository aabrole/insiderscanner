/**
 * Vercel Postgres access for prediction_snapshots.
 * Requires POSTGRES_URL (or Vercel env) and table created via scripts/init-pg.sql.
 */

import { sql } from "@vercel/postgres";
import type { SnapshotRow } from "./snapshot";
import type { Source } from "./markets-config";

/** Insert one snapshot. */
export async function insertSnapshot(row: SnapshotRow): Promise<void> {
  await sql`
    INSERT INTO prediction_snapshots (ts, symbol, source, market_key, question, yes, no, volume, liquidity)
    VALUES (${row.ts}, ${row.symbol}, ${row.source}, ${row.marketKey}, ${row.question}, ${row.yes}, ${row.no}, ${row.volume}, ${row.liquidity})
  `;
}

/** Fetch latest snapshot for (symbol, source, market_key) to dedup. */
export async function getLatestSnapshot(
  symbol: string,
  source: Source,
  marketKey: string
): Promise<SnapshotRow | null> {
  const result = await sql`
    SELECT ts, symbol, source, market_key, question, yes, no, volume, liquidity
    FROM prediction_snapshots
    WHERE symbol = ${symbol} AND source = ${source} AND market_key = ${marketKey}
    ORDER BY ts DESC
    LIMIT 1
  `;
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    ts: new Date(row.ts as string | Date),
    symbol: row.symbol as string,
    source: row.source as Source,
    marketKey: row.market_key as string,
    question: row.question ?? "",
    yes: Number(row.yes),
    no: Number(row.no),
    volume: row.volume != null ? Number(row.volume) : null,
    liquidity: row.liquidity != null ? Number(row.liquidity) : null,
  };
}

/** Series for chart: OHLC-like bars (time ms, open/high/low/close = yes*100). */
export type SeriesBar = {
  time: number; // Unix ms
  open: number;
  high: number;
  low: number;
  close: number; // yes probability 0–100
};

export async function getSeries(
  symbol: string,
  source: Source,
  marketKey: string,
  fromMs: number,
  toMs: number,
  resolutionMinutes: number = 1
): Promise<SeriesBar[]> {
  const fromDate = new Date(fromMs);
  const toDate = new Date(toMs);

  const result = await sql`
    SELECT ts, yes
    FROM prediction_snapshots
    WHERE symbol = ${symbol} AND source = ${source} AND market_key = ${marketKey}
      AND ts >= ${fromDate} AND ts <= ${toDate}
    ORDER BY ts ASC
  `;

  const points = result.rows.map((r) => ({
    ts: new Date(r.ts).getTime(),
    yes: Number(r.yes) * 100,
  }));

  if (resolutionMinutes <= 0 || points.length === 0) {
    return points.map((p) => ({
      time: Math.floor(p.ts / 1000),
      open: p.yes,
      high: p.yes,
      low: p.yes,
      close: p.yes,
    }));
  }

  const bucketMs = resolutionMinutes * 60 * 1000;
  const buckets = new Map<number, number[]>();
  for (const p of points) {
    const key = Math.floor(p.ts / bucketMs) * bucketMs;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p.yes);
  }

  const bars: SeriesBar[] = [];
  for (const [t, values] of buckets.entries()) {
    const open = values[0]!;
    const close = values[values.length - 1]!;
    const high = Math.max(...values);
    const low = Math.min(...values);
    bars.push({
      time: Math.floor(t / 1000),
      open,
      high,
      low,
      close,
    });
  }
  bars.sort((a, b) => a.time - b.time);
  return bars;
}

/** Last snapshot time per (symbol, source, market_key) for status. */
export async function getLastSnapshotTimes(): Promise<Array<{ symbol: string; source: string; market_key: string; ts: Date }>> {
  const result = await sql`
    SELECT DISTINCT ON (symbol, source, market_key) symbol, source, market_key, ts
    FROM prediction_snapshots
    ORDER BY symbol, source, market_key, ts DESC
  `;
  return result.rows.map((r: Record<string, unknown>) => ({
    symbol: r.symbol,
    source: r.source,
    market_key: r.market_key,
    ts: new Date(r.ts as string | Date),
  }));
}
