/**
 * Self-hosted TradingView chart with prediction market overlays.
 * Requires TradingView Charting Library in public/charting_library/ (see README).
 */

import Head from "next/head";
import { useCallback, useEffect, useRef, useState } from "react";
import { createUDFDatafeed } from "@/lib/datafeed";

const CHARTING_LIBRARY_PATH =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_CHARTING_LIBRARY_PATH || "/charting_library/")
    : "/charting_library/";

type MarketOption = { source: string; marketKey: string; label: string };

export default function ChartPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<unknown>(null);
  const [symbol, setSymbol] = useState("SPX");
  const [markets, setMarkets] = useState<MarketOption[]>([]);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [showROC, setShowROC] = useState(false);
  const [status, setStatus] = useState<{ lastTs: string | null; healthy: boolean | null }>({ lastTs: null, healthy: null });
  const [libReady, setLibReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMarkets = useCallback(async (sym: string) => {
    try {
      const res = await fetch(`/api/markets?symbol=${encodeURIComponent(sym)}`);
      const data = await res.json();
      setMarkets(data.markets || []);
      setSelectedMarkets((prev) => prev.filter((m) => (data.markets || []).some((x: MarketOption) => `${x.source}:${x.marketKey}` === m)));
    } catch {
      setMarkets([]);
    }
  }, []);

  useEffect(() => {
    loadMarkets(symbol);
  }, [symbol, loadMarkets]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const last = d.lastSnapshots?.[0];
        setStatus({
          lastTs: last?.ts ?? null,
          healthy: d.healthy ?? null,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const addOverlay = useCallback(() => {
    const first = markets.find((m) => !selectedMarkets.includes(`${m.source}:${m.marketKey}`));
    if (first) setSelectedMarkets((prev) => [...prev, `${first.source}:${first.marketKey}`]);
  }, [markets, selectedMarkets]);

  useEffect(() => {
    if (!containerRef.current) return;
    const script = document.createElement("script");
    script.src = `${CHARTING_LIBRARY_PATH}charting_library.standalone.js`;
    script.async = false;
    script.onload = () => setLibReady(true);
    script.onerror = () => setError("Charting Library not found. Add it to public/charting_library/ (see README).");
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  useEffect(() => {
    if (!libReady || !containerRef.current || typeof window === "undefined") return;
    const tv = (window as unknown as { TradingView: unknown }).TradingView;
    if (!tv?.widget) return;
    const datafeed = createUDFDatafeed();
    try {
      const w = new tv.widget({
        container: containerRef.current,
        datafeed,
        library_path: CHARTING_LIBRARY_PATH,
        symbol: "PM:SPX:polymarket:spx-up-or-down-on-december-31-2025:YES",
        interval: "15",
        fullscreen: false,
        autosize: true,
        theme: "dark",
        locale: "en",
      });
      widgetRef.current = w;
    } catch (e) {
      setError(String(e));
    }
    return () => {
      if (widgetRef.current && typeof (widgetRef.current as { remove?: () => void }).remove === "function") {
        (widgetRef.current as { remove: () => void }).remove();
      }
      widgetRef.current = null;
    };
  }, [libReady]);

  return (
    <>
      <Head>
        <title>Prediction markets chart | Insiderscanner</title>
      </Head>
      <div style={{ display: "flex", minHeight: "100vh", background: "#131722", color: "#d1d4dc" }}>
        <aside style={{ width: 260, padding: 16, borderRight: "1px solid #2a2e39", flexShrink: 0 }}>
          <h2 style={{ fontSize: 14, margin: "0 0 12px 0" }}>Chart</h2>
          <label style={{ display: "block", marginBottom: 8, fontSize: 12 }}>
            Symbol
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              style={{ marginLeft: 8, background: "#1e222d", color: "#d1d4dc", border: "1px solid #2a2e39", padding: 4 }}
            >
              <option value="SPX">SPX</option>
              <option value="SPY">SPY</option>
            </select>
          </label>
          <label style={{ display: "block", marginBottom: 8, fontSize: 12 }}>
            <input type="checkbox" checked={showROC} onChange={(e) => setShowROC(e.target.checked)} /> Show ROC
          </label>
          <p style={{ fontSize: 12, margin: "8px 0" }}>Markets (overlay)</p>
          {markets.map((m) => (
            <label key={`${m.source}:${m.marketKey}`} style={{ display: "block", marginBottom: 4, fontSize: 11 }}>
              <input
                type="checkbox"
                checked={selectedMarkets.includes(`${m.source}:${m.marketKey}`)}
                onChange={(e) =>
                  setSelectedMarkets((prev) =>
                    e.target.checked ? [...prev, `${m.source}:${m.marketKey}`] : prev.filter((x) => x !== `${m.source}:${m.marketKey}`)
                  )
                }
              />{" "}
              {m.marketKey.slice(0, 24)}…
            </label>
          ))}
          <button
            type="button"
            onClick={addOverlay}
            style={{ marginTop: 8, padding: "6px 12px", background: "#2962ff", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
          >
            Add overlay
          </button>
          <div style={{ marginTop: 24, fontSize: 11, color: "#787b86" }}>
            <p style={{ margin: "4px 0" }}>Status</p>
            <p style={{ margin: "4px 0" }}>Last snapshot: {status.lastTs ? new Date(status.lastTs).toLocaleString() : "—"}</p>
            <p style={{ margin: "4px 0" }}>Polling: {status.healthy === true ? "OK" : status.healthy === false ? "Stale" : "—"}</p>
          </div>
        </aside>
        <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {error && (
            <div style={{ padding: 16, background: "#2d2d2d", color: "#f23645" }}>
              {error}
            </div>
          )}
          <div ref={containerRef} style={{ flex: 1, minHeight: 400 }} />
        </main>
      </div>
    </>
  );
}
