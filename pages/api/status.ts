/**
 * GET /api/status - Last snapshot times and polling health (for /chart status component).
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getLastSnapshotTimes } from "@/lib/db";

function setCors(res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
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

  try {
    const last = await getLastSnapshotTimes();
    const now = Date.now();
    const POLL_INTERVAL_MS = (Number(process.env.SNAPSHOT_POLL_INTERVAL_MINUTES) || 5) * 60 * 1000;
    const healthy = last.every((r) => now - r.ts.getTime() < POLL_INTERVAL_MS * 2);

    setCors(res);
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({
      ok: true,
      lastSnapshots: last.map((r) => ({ symbol: r.symbol, source: r.source, market_key: r.market_key, ts: r.ts.toISOString() })),
      healthy: last.length > 0 ? healthy : null,
      pollIntervalMinutes: Number(process.env.SNAPSHOT_POLL_INTERVAL_MINUTES) || 5,
    });
  } catch (e) {
    setCors(res);
    res.status(500).json({ ok: false, error: String(e) });
  }
}
