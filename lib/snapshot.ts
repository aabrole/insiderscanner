/**
 * Snapshot normalization and dedup logic for prediction time-series.
 */

import type { Source } from "./markets-config";
import type { FetchedOdds } from "./fetchers";

export type SnapshotRow = {
  ts: Date;
  symbol: string;
  source: Source;
  marketKey: string;
  question: string;
  yes: number;
  no: number;
  volume: number | null;
  liquidity: number | null;
};

/** Normalize fetched odds into a snapshot row (no id/ts yet; caller sets ts). */
export function normalizeSnapshot(
  symbol: string,
  source: Source,
  marketKey: string,
  odds: FetchedOdds,
  ts: Date = new Date()
): SnapshotRow {
  const yes = clampProb(odds.yes);
  const no = clampProb(odds.no);
  return {
    ts,
    symbol: symbol.toUpperCase(),
    source,
    marketKey,
    question: odds.question ?? "",
    yes,
    no,
    volume: odds.volume != null && Number.isFinite(odds.volume) ? odds.volume : null,
    liquidity: odds.liquidity != null && Number.isFinite(odds.liquidity) ? odds.liquidity : null,
  };
}

function clampProb(p: number): number {
  if (!Number.isFinite(p)) return 0;
  return Math.max(0, Math.min(1, p));
}

/** Dedup: consider identical if yes/no match within tolerance and within time window (minutes). */
const TOLERANCE = 1e-6;
const DEDUP_WINDOW_MINUTES = 2;

export function shouldInsert(
  candidate: SnapshotRow,
  last: SnapshotRow | null
): boolean {
  if (!last) return true;
  const windowMs = DEDUP_WINDOW_MINUTES * 60 * 1000;
  if (candidate.ts.getTime() - last.ts.getTime() < windowMs) {
    if (Math.abs(candidate.yes - last.yes) <= TOLERANCE && Math.abs(candidate.no - last.no) <= TOLERANCE) {
      return false;
    }
  }
  return true;
}
