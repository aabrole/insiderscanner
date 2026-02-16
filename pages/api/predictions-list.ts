import type { NextApiRequest, NextApiResponse } from "next";

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
    const searchRes = await fetch(
      `https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(topic)}&limit_per_type=${limit}`
    );
    if (!searchRes.ok) {
      setCors(res);
      return res.status(502).json({ error: "Polymarket search failed", topic });
    }
    const data = (await searchRes.json()) as {
      events?: Array<{
        slug: string;
        title: string;
        markets?: Array<{
          question: string;
          outcomes: string;
          outcomePrices: string;
          volume?: string;
          liquidity?: string;
          slug: string;
          closed?: boolean;
        }>;
      }>;
    };
    const events = data.events ?? [];
    const rows: MarketRow[] = [];

    for (const event of events) {
      const markets = event.markets ?? [];
      for (const m of markets) {
        if (m.closed) continue;
        const outcomes = typeof m.outcomes === "string" ? JSON.parse(m.outcomes) : m.outcomes;
        const prices = typeof m.outcomePrices === "string" ? JSON.parse(m.outcomePrices) : m.outcomePrices;
        if (!outcomes?.length || !prices?.length) continue;
        const yesPct = parseFloat(prices[0]);
        const label = outcomes[0] === "Up" ? "Up" : outcomes[0] === "Down" ? "Down" : outcomes[0];
        const vol = parseFloat(m.volume ?? "0") || 0;
        const liq = parseFloat(m.liquidity ?? "0") || 0;
        rows.push({
          question: m.question || event.title,
          yesPct: Number.isFinite(yesPct) ? yesPct : 0,
          outcomeLabel: label,
          volume: vol,
          liquidity: liq,
          slug: m.slug || event.slug,
          url: `https://polymarket.com/event/${event.slug}`,
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
