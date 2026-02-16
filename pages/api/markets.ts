/**
 * GET /api/markets?symbol=SPX
 * Returns available prediction markets for the symbol (for UI selection on /chart).
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getMarketsForSymbol } from "@/lib/markets-config";

export type MarketOption = {
  source: "polymarket" | "kalshi";
  marketKey: string;
  label: string; // for display; can be question or slug
};

function setCors(res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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
  if (!symbol) {
    setCors(res);
    return res.status(400).json({ error: "Missing symbol" });
  }

  const refs = getMarketsForSymbol(symbol);
  const markets: MarketOption[] = refs.map((r) => ({
    source: r.source,
    marketKey: r.marketKey,
    label: r.marketKey, // UI can replace with question from series if needed
  }));

  setCors(res);
  res.setHeader("Content-Type", "application/json");
  res.status(200).json({ symbol, markets });
}
