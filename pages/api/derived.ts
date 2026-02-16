/**
 * GET /api/derived?symbol=SPX&marketKey=...&source=polymarket
 * Optional: smoothed probability, ROC, z-score of ROC, divergence vs SPX returns.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getMarketsForSymbol } from "@/lib/markets-config";
import { getSeries } from "@/lib/db";
import type { Source } from "@/lib/markets-config";

function setCors(res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "OPTIONS") {
    setCors(res);
    return res.status(204).end();
  }
  if (req.method !== "GET") {
    setCors(res);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const symbol = typeof req.query.symbol === "string" ? req.query.symbol.trim().toUpperCase() : null;
  const marketKey = typeof req.query.marketKey === "string" ? req.query.marketKey.trim() : null;
  const source = (typeof req.query.source === "string" ? req.query.source.toLowerCase() : null) as Source | null;

  if (!symbol || !marketKey || !source || (source !== "polymarket" && source !== "kalshi")) {
    setCors(res);
    return res.status(400).json({ error: "Missing or invalid symbol, marketKey, or source" });
  }

  const refs = getMarketsForSymbol(symbol);
  const allowed = refs.some((r) => r.source === source && r.marketKey === marketKey);
  if (!allowed) {
    setCors(res);
    return res.status(404).json({ error: "Market not configured for symbol" });
  }

  const now = Date.now();
  const fromMs = now - 7 * 24 * 60 * 60 * 1000;

  try {
    const bars = await getSeries(symbol, source, marketKey, fromMs, now, 15);
    const closes = bars.map((b) => b.close);

    // Smoothed: 3-point SMA of close
    const smoothWindow = 3;
    const smoothed: number[] = [];
    for (let i = 0; i < closes.length; i++) {
      const start = Math.max(0, i - smoothWindow + 1);
      const slice = closes.slice(start, i + 1);
      smoothed.push(mean(slice));
    }

    // ROC (rate of change): (close - close_prev) / close_prev
    const roc: number[] = [0];
    for (let i = 1; i < closes.length; i++) {
      const prev = closes[i - 1]!;
      roc.push(prev === 0 ? 0 : (closes[i]! - prev) / prev);
    }

    const rocStd = std(roc);
    const zScore = rocStd === 0 ? 0 : (roc[roc.length - 1]! - mean(roc)) / rocStd;

    // Divergence: placeholder (would need SPX price series; return null or 0)
    const divergence = null;

    setCors(res);
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({
      symbol,
      source,
      marketKey,
      current: closes.length ? closes[closes.length - 1]! : null,
      smoothed: smoothed.length ? smoothed[smoothed.length - 1]! : null,
      roc: roc.length ? roc[roc.length - 1]! : null,
      rocZScore: zScore,
      divergence,
      barsUsed: bars.length,
    });
  } catch (e) {
    setCors(res);
    res.status(500).json({ error: "Derived fetch failed", message: String(e) });
  }
}
