import type { NextApiRequest, NextApiResponse } from "next";
import pmxt from "pmxtjs";

function setCors(res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

type MarketRow = {
  question: string;
  yesPct: number;
  outcomeLabel: string;
  volume: number;
  liquidity: number;
  slug: string;
  url: string;
};

function outcomeLabel(market: { up?: { label?: string }; down?: { label?: string }; yes?: { label?: string } }): string {
  if (market.up) return "Up";
  if (market.down) return "Down";
  return market.yes?.label ?? "Yes";
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

  const topic = (typeof req.query.topic === "string" ? req.query.topic.trim() : "spx").toLowerCase();
  const limit = Math.min(Number(req.query.limit) || 25, 50);

  try {
    const poly = new pmxt.Polymarket();
    const events = await poly.fetchEvents({ query: topic, limit });
    const rows: MarketRow[] = [];

    for (const event of events) {
      const markets = event.markets ?? [];
      for (const m of markets) {
        const yesPct = m.yes?.price != null ? Number(m.yes.price) : 0;
        const vol = Number(m.volume) || Number(m.volume24h) || 0;
        const liq = Number(m.liquidity) || 0;
        rows.push({
          question: m.title || event.title,
          yesPct: Number.isFinite(yesPct) ? yesPct : 0,
          outcomeLabel: outcomeLabel(m),
          volume: vol,
          liquidity: liq,
          slug: event.slug ?? m.marketId ?? "",
          url: event.url || `https://polymarket.com/event/${event.slug || ""}`,
        });
      }
    }

    setCors(res);
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ topic, markets: rows });
  } catch {
    setCors(res);
    res.status(500).json({ error: "Server error", topic });
  }
}
