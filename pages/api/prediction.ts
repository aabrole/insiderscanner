import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import fs from "fs";
import pmxt from "pmxtjs";

function setCors(res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "https://www.tradingview.com");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

type MarketConfig = { polymarket: string | null; kalshi: string | null };
type MarketsConfig = Record<string, MarketConfig>;

function getConfig(): MarketsConfig {
  const configPath = path.join(process.cwd(), "config", "markets.json");
  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as MarketsConfig;
}

type PriceResult = { yes: number; no: number; question: string };

async function fetchPolymarket(slug: string): Promise<PriceResult | null> {
  try {
    const poly = new pmxt.Polymarket();
    const markets = await poly.fetchMarkets({ slug });
    const market = Array.isArray(markets) ? markets[0] : markets;
    if (!market) return null;
    const yes = market.yes?.price != null ? Number(market.yes.price) : 0;
    const no = market.no?.price != null ? Number(market.no.price) : 1 - yes;
    return {
      yes: Number.isFinite(yes) ? yes : 0,
      no: Number.isFinite(no) ? no : 1 - yes,
      question: market.title ?? "",
    };
  } catch {
    return null;
  }
}

async function fetchKalshi(ticker: string): Promise<PriceResult | null> {
  try {
    const kalshi = new pmxt.Kalshi();
    let markets = await kalshi.fetchMarkets({ slug: ticker, limit: 1 });
    if (!markets?.length) markets = await kalshi.fetchMarkets({ query: ticker, limit: 1 });
    const market = Array.isArray(markets) ? markets[0] : markets;
    if (!market) return null;
    const yes = market.yes?.price != null ? Number(market.yes.price) : 0;
    const no = market.no?.price != null ? Number(market.no.price) : 1 - yes;
    return {
      yes: Number.isFinite(yes) ? yes : 0,
      no: Number.isFinite(no) ? no : 1 - yes,
      question: market.title ?? "",
    };
  } catch {
    return null;
  }
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

  let config: MarketsConfig;
  try {
    config = getConfig();
  } catch {
    setCors(res);
    return res.status(500).json({ error: "Config not found" });
  }

  const entry = config[symbol];
  if (!entry) {
    setCors(res);
    return res.status(404).json({ error: "No market for symbol", symbol });
  }

  const result: { symbol: string; polymarket?: PriceResult; kalshi?: PriceResult } = { symbol };

  if (entry.polymarket) {
    const data = await fetchPolymarket(entry.polymarket);
    if (data) result.polymarket = data;
  }
  if (entry.kalshi) {
    const data = await fetchKalshi(entry.kalshi);
    if (data) result.kalshi = data;
  }

  if (!result.polymarket && !result.kalshi) {
    setCors(res);
    return res.status(502).json({ error: "Could not fetch prediction data", symbol });
  }

  setCors(res);
  res.setHeader("Content-Type", "application/json");
  res.status(200).json(result);
}
