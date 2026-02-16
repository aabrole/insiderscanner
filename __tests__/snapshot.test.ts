/**
 * Tests for snapshot normalization and dedup logic.
 */

import { normalizeSnapshot, shouldInsert } from "@/lib/snapshot";
import type { SnapshotRow } from "@/lib/snapshot";

describe("normalizeSnapshot", () => {
  it("clamps yes/no to 0-1", () => {
    const row = normalizeSnapshot("SPX", "polymarket", "slug", { yes: 1.5, no: -0.2, question: "Q" });
    expect(row.yes).toBe(1);
    expect(row.no).toBe(0);
  });

  it("uses volume and liquidity when finite", () => {
    const row = normalizeSnapshot("SPX", "polymarket", "slug", {
      yes: 0.6,
      no: 0.4,
      question: "Q",
      volume: 1000,
      liquidity: 500,
    });
    expect(row.volume).toBe(1000);
    expect(row.liquidity).toBe(500);
  });

  it("sets volume/liquidity to null when missing or non-finite", () => {
    const row = normalizeSnapshot("SPX", "polymarket", "slug", { yes: 0.5, no: 0.5, question: "Q" });
    expect(row.volume).toBeNull();
    expect(row.liquidity).toBeNull();
  });

  it("uppercases symbol", () => {
    const row = normalizeSnapshot("spx", "polymarket", "slug", { yes: 0.5, no: 0.5, question: "" });
    expect(row.symbol).toBe("SPX");
  });
});

describe("shouldInsert", () => {
  const base: SnapshotRow = {
    ts: new Date(1000),
    symbol: "SPX",
    source: "polymarket",
    marketKey: "slug",
    question: "Q",
    yes: 0.6,
    no: 0.4,
    volume: null,
    liquidity: null,
  };

  it("returns true when last is null", () => {
    expect(shouldInsert(base, null)).toBe(true);
  });

  it("returns false when same yes/no within 2 min window", () => {
    const last = { ...base, ts: new Date(1000) };
    const candidate = { ...base, ts: new Date(1000 + 60 * 1000) };
    expect(shouldInsert(candidate, last)).toBe(false);
  });

  it("returns true when yes differs beyond tolerance", () => {
    const last = { ...base, ts: new Date(1000) };
    const candidate = { ...base, ts: new Date(1000 + 60 * 1000), yes: 0.7 };
    expect(shouldInsert(candidate, last)).toBe(true);
  });

  it("returns true when outside 2 min window", () => {
    const last = { ...base, ts: new Date(1000) };
    const candidate = { ...base, ts: new Date(1000 + 3 * 60 * 1000) };
    expect(shouldInsert(candidate, last)).toBe(true);
  });
});
