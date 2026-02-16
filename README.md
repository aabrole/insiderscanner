# TradingView Prediction Markets Indicator

Show **Polymarket** and **Kalshi** prediction market probabilities on TradingView for the symbol you have open (e.g. **SPY** or **SPX**). When you open a chart for SPY or SPX, the indicator automatically looks up the prediction markets configured for that symbol and displays Yes/No probabilities in a table on the chart.

## How it works

1. **Chart symbol** – You open a chart for a symbol (e.g. `SPY`, `SPX`).
2. **Backend** – The indicator calls your backend with that symbol: `GET /api/prediction?symbol=SPY`.
3. **Config** – The backend uses `config/markets.json` to map `SPY` (or `SPX`) to Polymarket event slugs and/or Kalshi event/market tickers.
4. **Data** – The backend fetches live probabilities from Polymarket and Kalshi (no API keys needed for public market data).
5. **Display** – The indicator shows the probabilities (e.g. “65% Yes”) and the market question in a table on the chart.

## Quick start

### 1. Deploy the backend (Vercel, free)

```bash
cd /path/to/insiderscanner
npm install
npx vercel
```

Follow the prompts and note your deployment URL (e.g. `https://insiderscanner-xxx.vercel.app`).

### 2. Configure symbols and markets

Edit **`config/markets.json`** to map chart symbols to prediction markets:

- **polymarket**: Event slug from Polymarket (from the URL, e.g. `spx-up-or-down-on-december-31-2025`).
- **kalshi**: Event or market ticker from Kalshi (e.g. from their API or docs). Use `null` if you only use one source.

Example for SPY/SPX (same Polymarket event for both):

```json
{
  "SPY": {
    "polymarket": "spx-up-or-down-on-december-31-2025",
    "kalshi": null
  },
  "SPX": {
    "polymarket": "spx-up-or-down-on-december-31-2025",
    "kalshi": null
  }
}
```

Redeploy after changing the config:

```bash
npx vercel --prod
```

### 3. Add the indicator on TradingView

1. Open [TradingView](https://www.tradingview.com) and open a chart for **SPY** or **SPX** (or any symbol you added to `config/markets.json`).
2. Open the **Pine Editor** (bottom of the screen).
3. Create a new indicator and paste the contents of **`tradingview/prediction_markets.pine`**.
4. Save and add to chart.
5. In the indicator settings, set **Backend base URL** to your Vercel URL (e.g. `https://insiderscanner-xxx.vercel.app`) with no trailing slash.
6. (Optional) Leave **Symbol override** empty to use the chart symbol, or set it to a key from `markets.json` (e.g. `SPX`) to force that market.

The indicator table shows two links: **SPX-style stats** (the predictions page) and **Single symbol API** (raw JSON for the chart symbol). Open either in your browser to see live data; Pine cannot fetch external URLs.

### 4. View SPX prediction stats (like Polymarket)

Open **`https://your-app.vercel.app/predictions.html`** in a browser. You get a grid of prediction markets (default topic: **spx**) with:

- Question title  
- **X% Up / X% Down / X% Yes** (live odds)  
- **$XX Vol.** and **$XX Liq.**  
- Links to Polymarket for each market  

Change the topic input (e.g. `btc`, `trump`) and click **Load** to see other prediction markets. Use this page alongside TradingView for the same kind of stats as [Polymarket’s SPX page](https://polymarket.com/predictions/spx).

## Project layout

```
insiderscanner/
├── api/
│   ├── prediction.ts       # GET /api/prediction?symbol=SPY
│   └── predictions-list.ts # GET /api/predictions-list?topic=spx
├── config/
│   └── markets.json        # Symbol → Polymarket slug / Kalshi ticker
├── tradingview/
│   └── prediction_markets.pine
├── predictions.html        # SPX-style stats page (Polymarket-like grid)
├── package.json
├── vercel.json
└── README.md
```

## API

- **GET /api/prediction?symbol=SPY**  
  Returns JSON:
  - `symbol`: requested symbol
  - `polymarket`: `{ "yes", "no", "question" }` if configured and fetched
  - `kalshi`: `{ "yes", "no", "question" }` if configured and fetched

- **GET /api/predictions-list?topic=spx**  
  Returns a list of Polymarket markets for the topic (e.g. `spx`, `btc`):
  - `topic`: requested topic
  - `markets`: array of `{ question, yesPct, outcomeLabel, volume, liquidity, slug, url }`  
  Used by `predictions.html` to show SPX-style stats.

No API keys are required for Polymarket or Kalshi public market data.

## Finding Polymarket and Kalshi identifiers

- **Polymarket**: Open the event page; the slug is in the URL:  
  `https://polymarket.com/event/spx-up-or-down-on-december-31-2025` → slug = `spx-up-or-down-on-december-31-2025`.
- **Kalshi**: Use their API or docs for event/market tickers (e.g. `GET /events` or `GET /markets`) and put the ticker in `markets.json` under `kalshi`.

## Note on TradingView HTTP

The Pine script uses `request.http()` to call your backend. Behavior and availability can depend on your TradingView plan. If the table shows “Set Backend base URL” or never updates:

1. Confirm the backend works by opening in a browser:  
   `https://your-app.vercel.app/api/prediction?symbol=SPY`
2. Ensure the symbol (e.g. SPY, SPX) exists in `config/markets.json` and that the Polymarket slug (and Kalshi ticker if used) is correct.
