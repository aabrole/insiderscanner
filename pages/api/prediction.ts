import type { NextApiRequest, NextApiResponse } from "next";
import { getFirstMarketKeys } from "@/lib/markets-config";
import { fetchPolymarket, fetchKalshi } from "@/lib/fetchers";

function setCors(res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "https://www.tradingview.com");
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

  const { polymarket: pmKey, kalshi: kalshiKey } = getFirstMarketKeys(symbol);
  if (!pmKey && !kalshiKey) {
    setCors(res);
    return res.status(404).json({ error: "No market for symbol", symbol });
  }

  const result: { symbol: string; polymarket?: { yes: number; no: number; question: string }; kalshi?: { yes: number; no: number; question: string } } = { symbol };

  if (pmKey) {
    const data = await fetchPolymarket(pmKey);
    if (data) result.polymarket = { yes: data.yes, no: data.no, question: data.question };
  }
  if (kalshiKey) {
    const data = await fetchKalshi(kalshiKey);
    if (data) result.kalshi = { yes: data.yes, no: data.no, question: data.question };
  }

  if (!result.polymarket && !result.kalshi) {
    setCors(res);
    return res.status(502).json({ error: "Could not fetch prediction data", symbol });
  }

  setCors(res);
  res.setHeader("Content-Type", "application/json");
  res.status(200).json(result);
}
