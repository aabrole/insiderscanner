import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import fs from "fs";

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

async function fetchPolymarket(slug: string): Promise<{ yes: number; no: number; question: string } | null> {
  try {
    const res = await fetch(`https://gamma-api.polymarket.com/events/slug/${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    const event = await res.json();
    const markets = event.markets ?? event;
    const market = Array.isArray(markets) ? markets[0] : markets;
    if (!market) return null;
    const outcomes = typeof market.outcomes === "string" ? JSON.parse(market.outcomes) : market.outcomes;
    const prices = typeof market.outcomePrices === "string" ? JSON.parse(market.outcomePrices) : market.outcomePrices;
    if (!outcomes?.length || !prices?.length) return null;
    const yesIdx = outcomes.findIndex((o: string) => o === "Yes" || o === "yes");
    const noIdx = outcomes.findIndex((o: string) => o === "No" || o === "no");
    const yes = yesIdx >= 0 ? parseFloat(prices[yesIdx]) : parseFloat(prices[0]);
    const no = noIdx >= 0 ? parseFloat(prices[noIdx]) : yesIdx === 0 ? parseFloat(prices[1]) : parseFloat(prices[0]);
    return {
      yes: Number.isFinite(yes) ? yes : 0,
      no: Number.isFinite(no) ? no : 1 - yes,
      question: market.question ?? event.title ?? "",
    };
  } catch {
    return null;
  }
}

async function fetchKalshi(ticker: string): Promise<{ yes: number; no: number; question: string } | null> {
  try {
    const base = "https://api.elections.kalshi.com/trade-api/v2";
    const eventRes = await fetch(`${base}/events/${encodeURIComponent(ticker)}`);
    if (eventRes.ok) {
      const event = await eventRes.json();
      const markets = event.markets ?? [];
      const m = Array.isArray(markets) ? markets[0] : event;
      const yes = m?.yes_bid != null ? (m.yes_bid + (m.yes_ask ?? m.yes_bid)) / 2 / 100 : m?.last_price != null ? m.last_price / 100 : null;
      if (yes != null && Number.isFinite(yes)) {
        return { yes, no: 1 - yes, question: event.title ?? m?.title ?? "" };
      }
    }
    const marketRes = await fetch(`${base}/markets/${encodeURIComponent(ticker)}`);
    if (!marketRes.ok) return null;
    const m = await marketRes.json();
    const yes = m.yes_bid != null ? (m.yes_bid + (m.yes_ask ?? m.yes_bid)) / 2 / 100 : m.last_price != null ? m.last_price / 100 : null;
    if (yes == null || !Number.isFinite(yes)) return null;
    return { yes, no: 1 - yes, question: m.title ?? m.question ?? "" };
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

  const result: { symbol: string; polymarket?: { yes: number; no: number; question: string }; kalshi?: { yes: number; no: number; question: string } } = { symbol };

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
