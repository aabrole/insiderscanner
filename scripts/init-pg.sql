-- Run once in Vercel Postgres (Storage → Postgres → Query) or via CLI.
-- Table for prediction market snapshots (time-series storage).

CREATE TABLE IF NOT EXISTS prediction_snapshots (
  id         BIGSERIAL PRIMARY KEY,
  ts         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  symbol     TEXT NOT NULL,
  source     TEXT NOT NULL CHECK (source IN ('polymarket', 'kalshi')),
  market_key TEXT NOT NULL,
  question   TEXT,
  yes        NUMERIC(10,6) NOT NULL,
  no         NUMERIC(10,6) NOT NULL,
  volume     NUMERIC(20,4),
  liquidity  NUMERIC(20,4)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_series
  ON prediction_snapshots (symbol, source, market_key, ts DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_ts ON prediction_snapshots (ts DESC);

COMMENT ON TABLE prediction_snapshots IS 'Time-series of prediction market odds for chart overlays';
