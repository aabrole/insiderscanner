/**
 * Shared markets config loader.
 * Supports multiple markets per symbol; backward compatible with single string values.
 */

import path from "path";
import fs from "fs";

export type Source = "polymarket" | "kalshi";

/** One market reference (slug or ticker) for a symbol */
export type MarketRef = { source: Source; marketKey: string };

/** Entry per symbol: arrays of market refs (or legacy single string) */
export type SymbolEntry = {
  polymarket: string | string[] | null;
  kalshi: string | string[] | null;
};

export type MarketsConfig = Record<string, SymbolEntry>;

function loadRaw(): MarketsConfig {
  const configPath = path.join(process.cwd(), "config", "markets.json");
  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as MarketsConfig;
}

/** Normalize value to array of non-empty strings */
function toKeys(v: string | string[] | null): string[] {
  if (v == null) return [];
  const a = Array.isArray(v) ? v : [v];
  return a.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
}

/**
 * Returns all market refs for a symbol (for cron/series).
 * Backward compatible: "polymarket": "slug" => [{ source: "polymarket", marketKey: "slug" }].
 */
export function getMarketsForSymbol(symbol: string): MarketRef[] {
  const config = loadRaw();
  const entry = config[symbol?.toUpperCase()];
  if (!entry) return [];

  const refs: MarketRef[] = [];
  for (const key of toKeys(entry.polymarket)) {
    refs.push({ source: "polymarket", marketKey: key });
  }
  for (const key of toKeys(entry.kalshi)) {
    refs.push({ source: "kalshi", marketKey: key });
  }
  return refs;
}

/** All symbols that have at least one market */
export function getAllSymbols(): string[] {
  const config = loadRaw();
  return Object.keys(config).filter((sym) => {
    const entry = config[sym];
    return toKeys(entry.polymarket).length > 0 || toKeys(entry.kalshi).length > 0;
  });
}

/** Get config for existing API: first polymarket and first kalshi (backward compat) */
export function getFirstMarketKeys(symbol: string): { polymarket: string | null; kalshi: string | null } {
  const refs = getMarketsForSymbol(symbol);
  let polymarket: string | null = null;
  let kalshi: string | null = null;
  for (const r of refs) {
    if (r.source === "polymarket" && polymarket == null) polymarket = r.marketKey;
    if (r.source === "kalshi" && kalshi == null) kalshi = r.marketKey;
  }
  return { polymarket, kalshi };
}
