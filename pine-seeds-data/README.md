# Prediction Markets Pine Seeds

This repo publishes **prediction market probabilities** as daily OHLCV CSVs so they can be consumed in **TradingView** via **Pine Seeds** and plotted with a Pine Script indicator using `request.seed()`.

Pine on TradingView.com cannot call external APIs. Data is therefore published into this repo (CSV files), and TradingView pulls from Pine Seeds–connected repositories. This pipeline updates the CSVs **5 times per US trading day** at fixed times (America/New_York).

## Setup

### 1. Clone or fork this repo

```bash
git clone https://github.com/YOUR_ORG/pine-seeds-data.git
cd pine-seeds-data
```

### 2. Configure markets

Edit **`config/markets.json`**. Each entry defines one series to publish:

| Field | Description |
|-------|-------------|
| `symbol_group` | Label (e.g. SPX) for your reference. |
| `exchange` | `polymarket` or `kalshi`. |
| `slug` | Event/market slug or id used by pmxt (e.g. Polymarket event slug from the URL). |
| `outcome` | `YES`, `NO`, or exact outcome label. |
| `output_csv_name` | CSV filename without `.csv` (e.g. `PM_SPX_UP_TODAY_YES`). |

Example with one market:

```json
{
  "markets": [
    {
      "symbol_group": "SPX",
      "exchange": "polymarket",
      "slug": "spx-up-or-down-on-december-31-2025",
      "outcome": "YES",
      "output_csv_name": "PM_SPX_UP_TODAY_YES"
    }
  ]
}
```

Add more objects to `markets` to publish more series.

### 3. Install Python and pmxt (for local runs)

The Python pmxt SDK uses a Node-based sidecar for API calls. Install both:

```bash
pip install pmxt
npm install -g pmxtjs   # sidecar starts automatically on first use
```

### 4. Run the publisher locally (optional)

```bash
python3 scripts/publish.py
```

This fetches current odds via pmxt, updates or appends today’s row in each CSV, and leaves the repo dirty for you to commit and push.

### 5. GitHub Actions (automated publish)

The workflow **`.github/workflows/publish.yml`**:

- Runs **every 10 minutes** on weekdays.
- Uses a **time gate** so it only publishes at these **America/New_York** times (DST-safe):
  - **09:30:00**
  - **10:52:30**
  - **12:15:00**
  - **13:37:30**
  - **15:00:00**
- In the publish window it runs `scripts/publish.py`, then commits and pushes any CSV changes.

No extra secrets are required for push if the job uses the default `GITHUB_TOKEN` and the repo allows write access for the workflow.

## CSV format

Each CSV has a header and one row per day:

```text
date,open,high,low,close,volume
2025-12-31,52.30,52.30,52.30,52.30,1000
```

- **date**: ISO date `YYYY-MM-DD`.
- **open, high, low, close**: Probability 0–100. For a single snapshot per day, open = high = low = close.
- **volume**: Optional liquidity/volume proxy from the market, or `0`.

Rows are kept sorted by date ascending. If today’s row exists it is updated; otherwise it is appended.

## How to find Pine Seeds symbols in TradingView

1. Your repo must be connected to TradingView as a **Pine Seeds** data source (contact [pine.seeds@tradingview.com](mailto:pine.seeds@tradingview.com) for existing/reopened programs).
2. Symbol format is usually: **`SEED_<OWNER>_<REPO_SUFFIX>:<OUTPUT_CSV_NAME>`**
   - Example: repo `github.com/you/prediction-markets-seeds`, CSV `PM_SPX_UP_TODAY_YES.csv`  
     → symbol might be **`SEED_YOU_PREDICTION_MARKETS_SEEDS:PM_SPX_UP_TODAY_YES`** (exact name depends on TradingView’s mapping).
3. In TradingView, open **Symbol Search** and type the full seed symbol, or add it via “Add symbol” on the chart.
4. Note: Pine Seeds data **does not appear in the main symbol search** until the repo is connected and symbols are registered; see TradingView’s Pine Seeds docs.

## How updates work (5 snapshots per day)

- The workflow runs every 10 minutes on weekdays.
- It only **publishes** (runs the script and pushes) when the current time in **America/New_York** falls in a **±2 minute** window around:
  - 09:30, 10:52:30, 12:15, 13:37:30, 15:00.
- So you get at most **5 updated rows per day** (one per slot). TradingView syncs from the repo on their schedule; there can be a delay before new data appears on the chart.

## How the indicator lives and runs on TradingView

The indicator is **not** hosted by TradingView. It lives as a file in this repo (**`prediction_markets_seed.pine`**). You use it by **copying the script into TradingView** and saving it there:

| Where | What |
|-------|------|
| **This repo** | Source of truth: `prediction_markets_seed.pine` (versioned, shareable). |
| **TradingView** | You paste the code into the Pine Editor, save the indicator (to your account), then add it to a chart. It then runs on TradingView and reads data via `request.seed()` from the Pine Seeds symbol on that chart. |

So: **data** flows from this repo’s CSVs → Pine Seeds → TradingView (as a symbol). **Logic** flows from this repo’s `.pine` file → you paste into Pine Editor → runs as an indicator on the chart.

---

## How to use this indicator on TradingView

1. **Get the script**  
   Open [prediction_markets_seed.pine](prediction_markets_seed.pine) in this repo and copy all of its contents (or use the raw file link and copy from there).

2. **Create the indicator in TradingView**  
   - Go to [TradingView](https://www.tradingview.com) → open a chart.  
   - Open the **Pine Editor** tab at the bottom.  
   - Click **Open** → **New blank indicator**.  
   - Paste the copied code, then click **Save** and give it a name (e.g. “Prediction Markets (Pine Seeds)”).  
   The indicator is now saved to your TradingView account and will appear under **Indicators** → **My scripts**.

3. **Add the Pine Seeds symbol to the chart**  
   The indicator needs a **seed symbol** on the chart so `request.seed()` has data to read.  
   - Use **Symbol Search** (or Add symbol) and enter your seed symbol, e.g. `SEED_OWNER_REPO:PM_SPX_UP_TODAY_YES`.  
   - Either set that as the chart’s main symbol or add it as an extra symbol/panel.  
   (If your repo isn’t connected to Pine Seeds yet, you won’t see data until that’s set up.)

4. **Add the indicator to the chart**  
   - **Indicators** → **My scripts** → choose your saved “Prediction Markets (Pine Seeds)” indicator.  
   It will plot in a separate pane and read the seed data from the chart.

5. **Set the indicator inputs**  
   In the indicator’s **Settings** → **Inputs**:  
   - **Pine Seed source**: the repo id TradingView gave you (e.g. `seed_owner_repo`).  
   - **Pine Seed symbol**: the CSV name without `.csv` (e.g. `PM_SPX_UP_TODAY_YES`).  
   These must match the seed symbol on the chart so `request.seed(source, symbol, "close")` loads the right series.

After that, the script runs entirely on TradingView: it only reads from the seed symbol via `request.seed()`; it does not call any external URLs.

---

## What the indicator plots

- **Probability** (0–100) from seed `close`.
- **Smoothed (EMA)** of probability.
- **ROC** (rate of change) of probability.
- **Regime shading**: bear &lt; 40, neutral 40–60, bull &gt; 60 (thresholds are configurable).
- **Alert conditions**: threshold crosses (bear/bull) and ROC spikes.

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| No data on chart | Confirm the seed symbol is correct and the repo is connected to Pine Seeds. Ensure the CSV has rows for the dates you’re viewing and that TradingView has synced. |
| Workflow doesn’t publish | Check Actions logs: “Time gate” step must print “In publish window.” Only then does “Run publisher” run. Verify timezone (America/New_York) and schedule (weekdays). |
| Publisher fails in Actions | Ensure `pip install pmxt` succeeds and `config/markets.json` is valid. Check logs for fetch errors (slug, exchange, network). |
| Push permission denied | Use a token with write access (e.g. `GITHUB_TOKEN` with default permissions or a PAT) and that the workflow has permission to push to the branch. |

## File layout

```text
.github/workflows/publish.yml   # Scheduled run + time gate
config/markets.json             # Market definitions
scripts/publish.py              # Fetch via pmxt, update CSVs
scripts/timegate.py             # NY time window check
PM_*.csv                        # One CSV per market (created/updated by script)
prediction_markets_seed.pine    # Pine Script v5 indicator
README.md                       # This file
```

## Limitation: Pine Seeds availability

TradingView has **suspended creation of new Pine Seeds repositories**. Existing connected repos continue to work. If you need access or a new repo connected, contact [pine.seeds@tradingview.com](mailto:pine.seeds@tradingview.com) or use the form linked in [Pine Seeds documentation](https://github.com/tradingview-pine-seeds/docs).
