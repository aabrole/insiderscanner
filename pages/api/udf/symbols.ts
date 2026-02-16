/**
 * UDF resolve symbol. GET /api/udf/symbols?symbol=PM:SPX:polymarket:slug:YES
 * Format: PM:SYMBOL:SOURCE:marketKey:OUTCOME (OUTCOME = YES | NO)
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getMarketsForSymbol } from "@/lib/markets-config";

function setCors(res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
}

function parsePMSymbol(ticker: string): { symbol: string; source: string; marketKey: string; outcome: string } | null {
  const parts = ticker.split(":");
  if (parts.length !== 5 || parts[0] !== "PM") return null;
  const [, symbol, source, marketKey, outcome] = parts;
  if (!symbol || !source || !marketKey || !outcome) return null;
  if (source !== "polymarket" && source !== "kalshi") return null;
  if (outcome !== "YES" && outcome !== "NO") return null;
  return { symbol: symbol.toUpperCase(), source, marketKey, outcome };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).end();
  }
  setCors(res);

  const symbolParam = typeof req.query.symbol === "string" ? req.query.symbol : null;
  if (!symbolParam) {
    return res.status(400).json({ error: "Missing symbol" });
  }

  const parsed = parsePMSymbol(symbolParam);
  if (!parsed) {
    return res.status(400).json({ error: "Invalid PM symbol; use PM:SYMBOL:SOURCE:marketKey:YES|NO" });
  }

  const refs = getMarketsForSymbol(parsed.symbol);
  const allowed = refs.some((r) => r.source === parsed.source && r.marketKey === parsed.marketKey);
  if (!allowed) {
    return res.status(404).json({ error: "Market not configured" });
  }

  const name = `PM ${parsed.symbol} ${parsed.marketKey} ${parsed.outcome}`;
  res.setHeader("Content-Type", "application/json");
  res.status(200).json({
    name,
    exchange: "Prediction",
    full_name: symbolParam,
    description: name,
    type: "index",
    session: "24x7",
    timezone: "Etc/UTC",
    ticker: symbolParam,
    minmov: 1,
    pricescale: 100,
    has_intraday: true,
    supported_resolutions: ["1", "5", "15", "60", "1D"],
    volume_precision: 0,
    data_status: "streaming",
  });
}
