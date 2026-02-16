/**
 * UDF-compatible datafeed for TradingView Charting Library.
 * Runs in browser; fetches from same-origin /api/udf/*.
 */

const getBase = () => (typeof window !== "undefined" ? window.location.origin : "");

export type UDFBar = { time: number; open: number; high: number; low: number; close: number };

export function createUDFDatafeed() {
  const base = getBase();
  return {
    onReady(callback: (config: Record<string, unknown>) => void) {
      fetch(`${base}/api/udf/config`)
        .then((r) => r.json())
        .then((config) => callback(config))
        .catch(() => callback({ supported_resolutions: ["1", "5", "15", "60", "1D"] }));
    },
    resolveSymbol(
      symbolName: string,
      onResolve: (symbolInfo: Record<string, unknown>) => void,
      onError: (err: string) => void
    ) {
      fetch(`${base}/api/udf/symbols?symbol=${encodeURIComponent(symbolName)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Not found"))))
        .then(onResolve)
        .catch(() => onError("Invalid symbol"));
    },
    getBars(
      symbolInfo: Record<string, unknown>,
      resolution: string,
      periodParams: { from: number; to: number; countBack: number; firstDataRequest: boolean },
      onResult: (bars: UDFBar[] | [], meta: { noData: boolean }) => void,
      onError: (err: string) => void
    ) {
      const ticker = symbolInfo.ticker as string;
      const from = periodParams.from;
      const to = periodParams.to;
      const url = `${base}/api/udf/history?symbol=${encodeURIComponent(ticker)}&from=${from}&to=${to}&resolution=${resolution}`;
      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          if (data.s === "no_data" || !data.t) {
            onResult([], { noData: true });
            return;
          }
          const bars: UDFBar[] = (data.t as number[]).map((t: number, i: number) => ({
            time: t,
            open: (data.o as number[])[i]!,
            high: (data.h as number[])[i]!,
            low: (data.l as number[])[i]!,
            close: (data.c as number[])[i]!,
          }));
          onResult(bars, { noData: bars.length === 0 });
        })
        .catch(() => onError("Failed to load bars"));
    },
    subscribeBars() {},
    unsubscribeBars() {},
  };
}
