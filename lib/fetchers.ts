/**
 * Shared fetchers for Polymarket and Kalshi.
 * Used by pages/api/prediction.ts and by cron snapshot job.
 */

export type FetchedOdds = {
  yes: number;
  no: number;
  question: string;
  volume?: number;
  liquidity?: number;
};

export async function fetchPolymarket(slug: string): Promise<FetchedOdds | null> {
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
    const volume = typeof market.volume === "string" ? parseFloat(market.volume) : Number(market.volume);
    const liquidity = typeof market.liquidity === "string" ? parseFloat(market.liquidity) : Number(market.liquidity);
    return {
      yes: Number.isFinite(yes) ? yes : 0,
      no: Number.isFinite(no) ? no : 1 - yes,
      question: market.question ?? event.title ?? "",
      volume: Number.isFinite(volume) ? volume : undefined,
      liquidity: Number.isFinite(liquidity) ? liquidity : undefined,
    };
  } catch {
    return null;
  }
}

export async function fetchKalshi(ticker: string): Promise<FetchedOdds | null> {
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
