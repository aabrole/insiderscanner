/**
 * Cron: poll configured symbols/markets, fetch odds, insert snapshots (with dedup).
 * Invoked by Vercel Cron every 1–5 min. Secure with CRON_SECRET.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getMarketsForSymbol, getAllSymbols } from "@/lib/markets-config";
import { fetchPolymarket, fetchKalshi } from "@/lib/fetchers";
import { normalizeSnapshot, shouldInsert } from "@/lib/snapshot";
import { insertSnapshot, getLatestSnapshot } from "@/lib/db";

const POLL_INTERVAL_MINUTES = Number(process.env.SNAPSHOT_POLL_INTERVAL_MINUTES) || 5;

function isCronAuthorized(req: NextApiRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // allow in dev when not set
  const auth = req.headers.authorization;
  return auth === `Bearer ${secret}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).end();
  }
  if (!isCronAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const now = new Date();
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const symbols = getAllSymbols();
    for (const symbol of symbols) {
      const refs = getMarketsForSymbol(symbol);
      for (const { source, marketKey } of refs) {
        try {
          const odds = source === "polymarket" ? await fetchPolymarket(marketKey) : await fetchKalshi(marketKey);
          if (!odds) {
            errors.push(`${symbol}/${source}/${marketKey}: no data`);
            continue;
          }
          const row = normalizeSnapshot(symbol, source, marketKey, odds, now);
          const last = await getLatestSnapshot(symbol, source, marketKey);
          if (!shouldInsert(row, last)) {
            skipped++;
            continue;
          }
          await insertSnapshot(row);
          inserted++;
        } catch (e) {
          errors.push(`${symbol}/${source}/${marketKey}: ${String(e)}`);
        }
      }
    }

    res.setHeader("Content-Type", "application/json");
    res.status(200).json({
      ok: true,
      ts: now.toISOString(),
      inserted,
      skipped,
      symbols: symbols.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: String(e),
      inserted,
      skipped,
    });
  }
}

export const config = {
  maxDuration: 60,
};
