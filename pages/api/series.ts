/**
 * GET /api/series?symbol=SPX&marketKey=...&source=polymarket&from=...&to=...&resolution=1
 * Returns OHLC-like bars for TradingView datafeed (time in seconds, close = yes probability 0–100).
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

function parseTime(q: unknown): number | null {
  if (q == null) return null;
  const n = typeof q === "string" ? parseInt(q, 10) : Number(q);
  return Number.isFinite(n) ? n : null;
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
  const from = parseTime(req.query.from);
  const to = parseTime(req.query.to);
  const resolution = typeof req.query.resolution === "string" ? parseInt(req.query.resolution, 10) : 1;
  const resolutionMinutes = Number.isFinite(resolution) ? resolution : 1;

  if (!symbol || !marketKey || !source || source !== "polymarket" && source !== "kalshi") {
    setCors(res);
    return res.status(400).json({ error: "Missing or invalid symbol, marketKey, or source (polymarket|kalshi)" });
  }

  const refs = getMarketsForSymbol(symbol);
  const allowed = refs.some((r) => r.source === source && r.marketKey === marketKey);
  if (!allowed) {
    setCors(res);
    return res.status(404).json({ error: "Market not configured for symbol", symbol, marketKey, source });
  }

  // Default range: last 7 days
  const now = Date.now();
  const fromMs = from != null ? (from < 1e12 ? from * 1000 : from) : now - 7 * 24 * 60 * 60 * 1000;
  const toMs = to != null ? (to < 1e12 ? to * 1000 : to) : now;

  try {
    const bars = await getSeries(symbol, source, marketKey, fromMs, toMs, resolutionMinutes);
    setCors(res);
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ symbol, source, marketKey, resolution: resolutionMinutes, bars });
  } catch (e) {
    setCors(res);
    res.status(500).json({ error: "Series fetch failed", message: String(e) });
  }
}
