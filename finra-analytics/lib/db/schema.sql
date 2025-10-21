-- FINRA Analytics Database Schema
-- PostgreSQL with TimescaleDB extension

-- Enable TimescaleDB (if available)
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Raw snapshots (immutable truth layer)
CREATE TABLE IF NOT EXISTS finra_raw (
  id BIGSERIAL PRIMARY KEY,
  dataset TEXT NOT NULL,          -- 'regShoDaily' | 'consolidatedShortInterest' | 'thresholdList' | 'otcSummary'
  as_of_date DATE NOT NULL,
  symbol TEXT NOT NULL,
  payload JSONB NOT NULL,
  pulled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hash BYTEA NOT NULL,            -- SHA256 of payload for deduplication
  UNIQUE(dataset, symbol, as_of_date, hash)
);

CREATE INDEX IF NOT EXISTS idx_finra_raw_symbol_date ON finra_raw(symbol, as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_finra_raw_dataset ON finra_raw(dataset, as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_finra_raw_hash ON finra_raw(hash);

-- Convert to hypertable for better time-series performance
SELECT create_hypertable('finra_raw', 'pulled_at',
  if_not_exists => TRUE,
  migrate_data => TRUE
);

-- Canonical fact: Short Interest (semi-monthly)
CREATE TABLE IF NOT EXISTS fact_short_interest (
  symbol TEXT NOT NULL,
  settlement_date DATE NOT NULL,
  shares_short BIGINT NOT NULL,
  market TEXT,                    -- 'consolidated' | 'otc' | etc
  avg_daily_volume BIGINT,        -- if available from dataset
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(symbol, settlement_date, COALESCE(market, ''))
);

CREATE INDEX IF NOT EXISTS idx_si_symbol_date ON fact_short_interest(symbol, settlement_date DESC);
CREATE INDEX IF NOT EXISTS idx_si_date ON fact_short_interest(settlement_date DESC);

-- Canonical fact: Daily Short Sales (Reg SHO)
CREATE TABLE IF NOT EXISTS fact_short_sales_daily (
  symbol TEXT NOT NULL,
  trade_date DATE NOT NULL,
  short_sale_shares BIGINT NOT NULL,
  short_exempt_shares BIGINT DEFAULT 0,
  total_volume BIGINT,            -- total reported volume if available
  facility TEXT,                  -- FINRA TRF/ORF tag
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(symbol, trade_date, COALESCE(facility, ''))
);

CREATE INDEX IF NOT EXISTS idx_ss_symbol_date ON fact_short_sales_daily(symbol, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_ss_date ON fact_short_sales_daily(trade_date DESC);

-- Dimension: Threshold List Status
CREATE TABLE IF NOT EXISTS dim_threshold_status (
  symbol TEXT NOT NULL,
  trade_date DATE NOT NULL,
  on_threshold BOOLEAN NOT NULL,
  rule TEXT,                      -- e.g., 'Rule 203(c)(6)'
  market TEXT,                    -- 'NYSE' | 'NASDAQ' | etc
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(symbol, trade_date)
);

CREATE INDEX IF NOT EXISTS idx_threshold_symbol_date ON dim_threshold_status(symbol, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_threshold_active ON dim_threshold_status(trade_date DESC) WHERE on_threshold = TRUE;

-- Derived metrics: Daily aggregations
CREATE TABLE IF NOT EXISTS metrics_daily (
  symbol TEXT NOT NULL,
  trade_date DATE NOT NULL,
  short_sale_ratio NUMERIC,        -- short_sale_shares / total_volume
  short_sale_zscore NUMERIC,       -- standardized against 60-day baseline
  rolling_5d NUMERIC,              -- 5-day moving avg of short sales
  rolling_10d NUMERIC,
  rolling_20d NUMERIC,
  on_threshold BOOLEAN DEFAULT FALSE,
  threshold_streak_days INT DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(symbol, trade_date)
);

CREATE INDEX IF NOT EXISTS idx_metrics_daily_symbol ON metrics_daily(symbol, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_date ON metrics_daily(trade_date DESC);

-- Derived metrics: Semi-monthly aggregations (Short Interest enriched)
CREATE TABLE IF NOT EXISTS metrics_semimonthly (
  symbol TEXT NOT NULL,
  settlement_date DATE NOT NULL,
  shares_short BIGINT NOT NULL,
  pct_float_short NUMERIC,         -- requires external float data
  days_to_cover NUMERIC,           -- shares_short / 30d_avg_daily_volume
  trend_3p NUMERIC,                -- 3-period slope of SI
  si_change_pct NUMERIC,           -- % change vs prior settlement
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(symbol, settlement_date)
);

CREATE INDEX IF NOT EXISTS idx_metrics_semi_symbol ON metrics_semimonthly(symbol, settlement_date DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_semi_date ON metrics_semimonthly(settlement_date DESC);

-- Reference: Symbol metadata (for joins and enrichment)
CREATE TABLE IF NOT EXISTS dim_symbols (
  symbol TEXT PRIMARY KEY,
  company_name TEXT,
  exchange TEXT,
  sector TEXT,
  industry TEXT,
  float_shares BIGINT,             -- from external fundamentals provider
  float_source TEXT,               -- e.g., 'IEX' | 'Nasdaq Data Link'
  float_as_of DATE,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_symbols_exchange ON dim_symbols(exchange) WHERE is_active = TRUE;

-- Audit log for API calls and backfills
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  operation TEXT NOT NULL,         -- 'api_fetch' | 'backfill' | 'metric_compute'
  dataset TEXT,
  symbol TEXT,
  date_from DATE,
  date_to DATE,
  status TEXT NOT NULL,            -- 'success' | 'error' | 'partial'
  error_message TEXT,
  duration_ms INT,
  records_processed INT,
  triggered_by TEXT,               -- 'user' | 'cron' | 'api'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_symbol ON audit_log(symbol, created_at DESC);

-- Materialized view: Latest metrics per symbol
CREATE MATERIALIZED VIEW IF NOT EXISTS view_latest_metrics AS
SELECT DISTINCT ON (md.symbol)
  md.symbol,
  md.trade_date,
  md.short_sale_ratio,
  md.short_sale_zscore,
  md.rolling_20d,
  md.on_threshold,
  md.threshold_streak_days,
  ms.shares_short,
  ms.pct_float_short,
  ms.days_to_cover,
  ms.si_change_pct,
  ds.company_name,
  ds.exchange,
  ds.sector
FROM metrics_daily md
LEFT JOIN LATERAL (
  SELECT * FROM metrics_semimonthly
  WHERE symbol = md.symbol AND settlement_date <= md.trade_date
  ORDER BY settlement_date DESC
  LIMIT 1
) ms ON TRUE
LEFT JOIN dim_symbols ds ON md.symbol = ds.symbol
ORDER BY md.symbol, md.trade_date DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_view_latest_symbol ON view_latest_metrics(symbol);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_latest_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY view_latest_metrics;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE finra_raw IS 'Immutable raw API responses from FINRA with content hash for deduplication';
COMMENT ON TABLE fact_short_interest IS 'Semi-monthly short interest positions from FINRA consolidated report';
COMMENT ON TABLE fact_short_sales_daily IS 'Daily short sale volume from Reg SHO reporting';
COMMENT ON TABLE dim_threshold_status IS 'Daily threshold list status per symbol under Reg SHO';
COMMENT ON TABLE metrics_daily IS 'Derived daily metrics: ratios, z-scores, rolling averages';
COMMENT ON TABLE metrics_semimonthly IS 'Derived semi-monthly metrics: DTC, % float short, trends';
COMMENT ON TABLE dim_symbols IS 'Symbol master with fundamentals (float, sector, etc.)';
COMMENT ON TABLE audit_log IS 'Operational audit trail for all data operations';
