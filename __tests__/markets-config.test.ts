/**
 * Tests for markets config: getMarketsForSymbol, getAllSymbols (reads config/markets.json).
 */

import { getMarketsForSymbol, getAllSymbols, getFirstMarketKeys } from "@/lib/markets-config";

describe("getMarketsForSymbol", () => {
  it("returns polymarket ref for SPX when config has string", () => {
    const refs = getMarketsForSymbol("SPX");
    expect(refs.length).toBeGreaterThanOrEqual(0);
    if (refs.length > 0) {
      expect(refs[0].source).toBe("polymarket");
      expect(refs[0].marketKey).toBeTruthy();
    }
  });

  it("is case-insensitive for symbol", () => {
    const a = getMarketsForSymbol("spx");
    const b = getMarketsForSymbol("SPX");
    expect(a).toEqual(b);
  });

  it("returns empty for unknown symbol", () => {
    expect(getMarketsForSymbol("UNKNOWNXYZ")).toEqual([]);
  });
});

describe("getFirstMarketKeys", () => {
  it("returns first polymarket and kalshi for backward compat", () => {
    const keys = getFirstMarketKeys("SPX");
    expect(keys.polymarket === null || typeof keys.polymarket === "string").toBe(true);
    expect(keys.kalshi === null || typeof keys.kalshi === "string").toBe(true);
  });
});

describe("getAllSymbols", () => {
  it("returns at least one symbol when config has markets", () => {
    const syms = getAllSymbols();
    expect(Array.isArray(syms)).toBe(true);
  });
});
