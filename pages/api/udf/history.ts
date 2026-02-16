/**
 * UDF history. GET /api/udf/history?symbol=PM:...&from=UNIX&to=UNIX&resolution=1
 * Returns bars { t, o, h, l, c } (t in seconds; o,h,l,c = probability 0–100).
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getMarketsForSymbol } from "@/lib/markets-config";
import { getSeries } from "@/lib/db";
import type { Source } from "@/lib/markets-config";

function setCors(res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
}

function parsePMSymbol(ticker: string): { symbol: string; source: Source; marketKey: string; outcome: string } | null {
  const parts = ticker.split(":");
  if (parts.length !== 5 || parts[0] !== "PM") return null;
  const [, symbol, source, marketKey, outcome] = parts;
  if (!symbol || !source || !marketKey || !outcome) return null;
  if (source !== "polymarket" && source !== "kalshi") return null;
  if (outcome !== "YES" && outcome !== "NO") return null;
  return { symbol: symbol.toUpperCase(), source: source as Source, marketKey, outcome };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).end();
  }
  setCors(res);

  const symbolParam = typeof req.query.symbol === "string" ? req.query.symbol : null;
  const from = typeof req.query.from === "string" ? parseInt(req.query.from, 10) : 0;
  const to = typeof req.query.to === "string" ? parseInt(req.query.to, 10) : 0;
  const resolution = typeof req.query.resolution === "string" ? req.query.resolution : "1";
  const resMinutes = parseInt(resolution, 10) || 1;

  if (!symbolParam || !Number.isFinite(from) || !Number.isFinite(to)) {
    return res.status(400).json({ error: "Missing symbol, from, or to" });
  }

  const parsed = parsePMSymbol(symbolParam);
  if (!parsed) {
    return res.status(400).json({ s: "no_data" });
  }

  const refs = getMarketsForSymbol(parsed.symbol);
  const allowed = refs.some((r) => r.source === parsed.source && r.marketKey === parsed.marketKey);
  if (!allowed) {
    return res.status(200).json({ s: "no_data" });
  }

  const fromMs = from * 1000;
  const toMs = to * 1000;

  try {
    const bars = await getSeries(parsed.symbol, parsed.source, parsed.marketKey, fromMs, toMs, resMinutes);

    // UDF: close = yes probability (0–100) for YES, or 100-yes for NO
    const udfBars = bars.map((b) => {
      const c = parsed.outcome === "YES" ? b.close : 100 - b.close;
      return {
        t: b.time,
        o: c,
        h: c,
        l: c,
        c,
      };
    });

    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ s: "ok", t: udfBars.map((b) => b.t), o: udfBars.map((b) => b.o), h: udfBars.map((b) => b.h), l: udfBars.map((b) => b.l), c: udfBars.map((b) => b.c) });
  } catch {
    res.status(200).json({ s: "no_data" });
  }
}
