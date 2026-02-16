# TradingView Prediction Markets Indicator

Show **Polymarket** and **Kalshi** prediction market probabilities on TradingView. Two modes:

- **TradingView.com (Pine)** – Table and links only; Pine cannot fetch external URLs, so the indicator shows a table with links you open in a browser for live data.
- **Self-hosted /chart** – Full TradingView Charting Library with a custom datafeed: prediction probabilities as **plotted time-series overlays** in a separate pane.

## Why Pine cannot do this directly

Pine Script on TradingView.com runs in a sandbox and **cannot perform HTTP requests to arbitrary URLs**. So you cannot “fetch from your API” inside the script to draw live series on the chart. The existing `tradingview/prediction_markets.pine` indicator therefore only displays a table and links; opening the links in a browser is the way to see live odds.

**Charting Library + datafeed** solves this: you host the chart yourself (`/chart`), use TradingView’s Charting Library with a **custom UDF datafeed** that talks to your backend. The datafeed serves historical and live-ish probability bars (from stored snapshots), so the chart can plot them as real time-series overlays.

---

## What works where

| Feature | TradingView.com (Pine) | Self-hosted /chart |
|--------|-------------------------|---------------------|
| Table with links to API/stats | ✅ | — |
| Plotted probability time-series | ❌ | ✅ |
| Multiple markets per symbol | Links only | ✅ Overlays |
| ROC / derived indicators | ❌ | ✅ (API + optional UI) |

---

## Quick start (existing behavior)

### 1. Deploy (Vercel)

Connect the repo in [Vercel](https://vercel.com). Then:

- **Storage** → create a **Postgres** database and run the SQL in **`scripts/init-pg.sql`** (see [DB setup](#db-setup) below).
- **Settings** → Environment variables: add `CRON_SECRET` (optional; recommended for cron).
- **Settings** → Cron is configured in `vercel.json` (snapshot every 5 min).

Endpoints:

- **/** and **/predictions** → predictions page
- **/api/health** → `{"ok":true}`
- **/api/prediction?symbol=SPY** → single-symbol JSON
- **/api/predictions-list?topic=spx** → list of markets
- **/chart** → Self-hosted chart (requires Charting Library; see [Chart page](#chart-page))
- **/api/series** – time-series bars for chart
- **/api/markets** – markets for a symbol (for UI)
- **/api/derived** – smoothed prob, ROC, z-score
- **/api/status** – last snapshot time, polling health

### 2. Config: `config/markets.json`

Map symbols to Polymarket slugs and/or Kalshi tickers. **Single** market per source (backward compatible):

```json
{
  "SPY": { "polymarket": "spx-up-or-down-on-december-31-2025", "kalshi": null },
  "SPX": { "polymarket": "spx-up-or-down-on-december-31-2025", "kalshi": null }
}
```

**Multiple markets per symbol** (for /chart overlays):

```json
{
  "SPX": {
    "polymarket": [
      "spx-up-or-down-on-december-31-2025",
      "spx-above-6000-by-jan-15"
    ],
    "kalshi": []
  },
  "SPY": {
    "polymarket": ["spx-up-or-down-on-december-31-2025"],
    "kalshi": null
  }
}
```

String and array forms are both supported.

### 3. TradingView.com indicator (table only)

1. Open [TradingView](https://www.tradingview.com), chart **SPY** or **SPX**.
2. Pine Editor → paste **`tradingview/prediction_markets.pine`** → Add to chart.
3. In settings, set **Backend base URL** to your Vercel URL (no trailing slash).

You get a table and links; open the links in a browser for live data (Pine cannot fetch URLs).

---

## DB setup (for time-series and /chart)

1. In Vercel dashboard: **Storage** → **Create Database** → **Postgres**.
2. Connect the project; Vercel adds `POSTGRES_URL` (and related) to env.
3. Run the SQL in **`scripts/init-pg.sql`** in the Postgres query tab (or CLI) to create `prediction_snapshots`.

Cron (`vercel.json`) hits **/api/cron/snapshot** every 5 minutes. It:

- Reads `config/markets.json` and fetches current odds for each symbol/market.
- Inserts a row only if the value changed or outside a short dedup window (to limit DB growth).

Optional env:

- **CRON_SECRET** – If set, cron requests must send `Authorization: Bearer <CRON_SECRET>` (Vercel Cron does this when you set the secret).
- **SNAPSHOT_POLL_INTERVAL_MINUTES** – Default 5; used for dedup window and status health.

---

## Chart page (/chart)

**Requires** [TradingView Charting Library](https://www.tradingview.com/charting-library-docs/) (you must obtain it from TradingView). Then:

1. Place the library in **`public/charting_library/`** (e.g. `charting_library.standalone.js`).
2. Optional: set **NEXT_PUBLIC_CHARTING_LIBRARY_PATH** to your path (default `/charting_library/`).
3. Open **`https://your-app.vercel.app/chart`**.

The page:

- Loads the Charting Library from that path.
- Uses a **UDF datafeed** that calls your app’s `/api/udf/*` (config, symbols, history).
- Prediction series symbol format: **`PM:SYMBOL:SOURCE:marketKey:OUTCOME`**  
  Example: `PM:SPX:polymarket:spx-up-or-down-on-december-31-2025:YES`.

You can add the prediction series like another symbol; it appears as a line (probability 0–100) in a pane. Sidebar: symbol (SPX/SPY), market checkboxes, “Add overlay”, and status (last snapshot time, polling health).

**Main price chart:** The app focuses on prediction overlays. For a real SPX/SPY price series you’d plug in your own datafeed or a provider (e.g. Finnhub UDF); the current setup uses the same datafeed for PM symbols only.

---

## API (summary)

| Endpoint | Purpose |
|----------|--------|
| GET /api/prediction?symbol=SPY | Live odds (first market per source); unchanged. |
| GET /api/predictions-list?topic=spx | Search Polymarket; for predictions page. |
| GET /api/markets?symbol=SPX | List markets for symbol (for /chart UI). |
| GET /api/series?symbol=SPX&marketKey=...&source=polymarket&from=...&to=...&resolution=1 | OHLC-like bars (close = yes % 0–100). |
| GET /api/derived?symbol=SPX&marketKey=...&source=polymarket | Smoothed prob, ROC, z-score, divergence (placeholder). |
| GET /api/status | Last snapshot times and polling health. |
| GET /api/cron/snapshot | Called by Vercel Cron; inserts snapshots. |
| GET /api/udf/config, /api/udf/symbols, /api/udf/history | UDF datafeed for Charting Library. |

---

## Project layout

```
insiderscanner/
├── pages/
│   ├── api/
│   │   ├── health.ts
│   │   ├── prediction.ts
│   │   ├── predictions-list.ts
│   │   ├── predictions.ts
│   │   ├── markets.ts
│   │   ├── series.ts
│   │   ├── derived.ts
│   │   ├── status.ts
│   │   ├── cron/snapshot.ts
│   │   └── udf/ config.ts, symbols.ts, history.ts
│   └── chart/index.tsx
├── lib/
│   ├── db.ts
│   ├── markets-config.ts
│   ├── fetchers.ts
│   ├── snapshot.ts
│   └── datafeed.ts
├── config/markets.json
├── scripts/init-pg.sql
├── tradingview/prediction_markets.pine
├── __tests__/ snapshot.test.ts, markets-config.test.ts
├── vercel.json          # cron + framework
├── next.config.js
└── README.md
```

---

## Tests

```bash
npm test
```

- **snapshot.test.ts** – `normalizeSnapshot`, `shouldInsert` (parsers and dedup).
- **markets-config.test.ts** – `getMarketsForSymbol`, `getFirstMarketKeys`, `getAllSymbols` (reads real `config/markets.json`).

---

## Finding Polymarket and Kalshi identifiers

- **Polymarket**: Slug from the event URL, e.g. `https://polymarket.com/event/spx-up-or-down-on-december-31-2025` → `spx-up-or-down-on-december-31-2025`.
- **Kalshi**: Use their API or docs for event/market tickers; put the ticker in `markets.json` under `kalshi`.

---

## Troubleshooting

- **404 / build** – Framework Preset **Next.js**; no custom Output Directory.
- **Cron 401** – Set `CRON_SECRET` in Vercel and ensure Cron job sends the header.
- **No bars on /chart** – Run `scripts/init-pg.sql`, wait for at least one cron run (or call `/api/cron/snapshot` once with auth), then reload. Use symbol `PM:SPX:polymarket:<slug>:YES` (or NO) with a configured market.
