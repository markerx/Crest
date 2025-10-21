# FINRA Analytics

A browser-first investment analysis application that provides real-time, research-grade insights from FINRA equity data endpoints, including short interest, Reg SHO daily short-sale volume, threshold lists, and OTC summaries.

## Features

- **Comprehensive Short Interest Analysis**: Semi-monthly short position data with Days-to-Cover, % of Float Short, and trend analysis
- **Daily Short Sale Flow**: Reg SHO daily short sale volume with ratios, Z-scores, and statistical anomaly detection
- **Threshold List Tracking**: Monitor securities with persistent delivery failures under Regulation SHO
- **Derived Metrics**: Automatic calculation of DTC, momentum scores, rolling averages, and trend breaks
- **Auditable Data**: Every metric links back to raw FINRA datasets with full provenance
- **Fast & Resilient**: Three-tier caching strategy with graceful degradation

## Architecture

### Frontend
- **Next.js 14** (App Router) with TypeScript
- **TanStack Query** for data fetching and caching
- **Recharts** for time-series visualization
- **Zod** for runtime schema validation
- **Tailwind CSS** for styling

### Backend
- **Next.js API Routes** for FINRA gateway with OAuth 2.0 authentication
- **Redis** for hot response caching
- **PostgreSQL with TimescaleDB** for time-series analytics
- **Kestra** for batch orchestration and backfills

### Data Pipeline
1. FINRA API client with automatic token refresh and retry logic
2. Response normalization and validation
3. Raw payload storage with content hashing
4. Derived metrics computation
5. Multi-tier caching (edge, Redis, database)

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for local development)
- FINRA API credentials (obtain from [FINRA API Developer Center](https://developer.finra.org/APICredentials))

### Quick Start

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your FINRA API credentials:
   ```
   FINRA_CLIENT_ID=your_client_id
   FINRA_CLIENT_SECRET=your_client_secret
   ```

3. **Start services with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

   This starts:
   - PostgreSQL (TimescaleDB) on port 5432
   - Redis on port 6379
   - Next.js dev server on port 3000

4. **Access the application:**
   Open [http://localhost:3000](http://localhost:3000)

### Development without Docker

```bash
# Start Redis and Postgres separately, then:
npm run dev
```

## Project Structure

```
finra-analytics/
├── app/
│   ├── api/finra/           # API routes (Reg SHO, Short Interest, Threshold)
│   ├── ticker/[symbol]/     # Ticker detail pages
│   ├── layout.tsx
│   ├── page.tsx
│   └── providers.tsx        # TanStack Query provider
├── components/
│   ├── charts/              # Recharts visualization components
│   ├── ticker/              # Ticker overview component
│   └── screener/            # Stock screener component
├── lib/
│   ├── cache/               # Redis cache layer
│   ├── db/                  # Database schemas (SQL)
│   ├── finra/               # FINRA API client & normalization
│   ├── metrics/             # Derived metrics calculation
│   ├── types/               # TypeScript types & Zod schemas
│   └── hooks/               # React Query hooks
├── kestra/                  # Kestra workflow definitions
├── docker-compose.yml
├── Dockerfile.dev
└── README.md
```

## API Endpoints

### GET `/api/finra/regsho`
Fetch Reg SHO daily short sale volume data.

**Query Parameters:**
- `symbol` (required): Stock ticker
- `from` (optional): Start date (YYYY-MM-DD)
- `to` (optional): End date (YYYY-MM-DD)

**Example:**
```bash
curl "http://localhost:3000/api/finra/regsho?symbol=NVDA"
```

### GET `/api/finra/shortinterest`
Fetch consolidated short interest (semi-monthly).

**Query Parameters:**
- `symbol` (required): Stock ticker
- `from` (optional): Start date
- `to` (optional): End date

### GET `/api/finra/threshold`
Fetch Reg SHO threshold securities list.

**Query Parameters:**
- `symbol` (optional): Filter by ticker (omit for full list)
- `from` (optional): Start date
- `to` (optional): End date

## Database Schema

The application uses PostgreSQL with TimescaleDB for optimal time-series performance. Key tables:

- `finra_raw`: Immutable raw API snapshots with content hashing
- `fact_short_interest`: Semi-monthly short interest positions
- `fact_short_sales_daily`: Daily short sale volume (Reg SHO)
- `dim_threshold_status`: Threshold list status per symbol/date
- `metrics_daily`: Derived daily metrics (ratios, Z-scores, rolling averages)
- `metrics_semimonthly`: Derived SI metrics (DTC, % Float Short, trends)

See `lib/db/schema.sql` for complete DDL.

## Caching Strategy

Three-tier caching for optimal performance:

1. **Edge Cache** (CDN): 5-15 min TTL for GET responses
2. **Redis**: Hot symbols (S&P 500), 5-10 min TTL
3. **Database**: Historical analytics and backfills

Cache keys follow the pattern: `{dataset}:{symbol}:{from}:{to}`

## Batch Jobs

Kestra workflows in `kestra/` directory:

- **daily-backfill.yml**: Nightly updates for watchlist symbols
  - Runs at 7 AM and 4:30 PM ET on weekdays
  - Fetches Reg SHO, threshold list, short interest
  - Computes derived metrics
  - Pre-warms cache

To enable Kestra:
```bash
docker-compose --profile orchestration up -d
```

Access Kestra UI at [http://localhost:8080](http://localhost:8080)

## Derived Metrics

### Days-to-Cover (DTC)
```
DTC = Short Interest / 30-day Average Daily Volume
```

### % of Float Short
```
% Float = (Shares Short / Free Float Shares) × 100
```
*Requires external fundamentals feed for float data*

### Short-Sale Ratio (SSR)
```
SSR = Short Sale Volume / Total Volume
```

### Short Sale Z-Score
Standardized short sale volume against 60-day baseline:
```
Z = (X - μ) / σ
```

### Momentum Score
Composite indicator (-100 to +100) combining:
- Z-score contribution (±40 points)
- Threshold status (+20 points)
- Threshold streak (up to +40 points)

## FINRA Data Sources

All data from [FINRA API Developer Center](https://developer.finra.org):

1. **Consolidated Short Interest** (semi-monthly)
2. **Reg SHO Daily Short Sale Volume**
3. **Threshold Securities List**
4. **OTC Transparency Weekly/Monthly Aggregates**

### Rate Limits
- Synchronous: 1200 requests/minute per IP
- Asynchronous: 20 requests/minute per dataset per account

### Payload Limits
- Synchronous: 5,000 records or 3MB
- Asynchronous: 100,000 records, no size limit

## Compliance & Attribution

- Clear labeling: "Reg SHO daily volume ≠ outstanding short interest"
- FINRA attribution displayed on all data views
- Abide by FINRA API Terms of Service
- No credentials shared; respect rate limits

## Roadmap

- [ ] Screener filters and saved screens
- [ ] Alert system (email, Slack, webhook)
- [ ] Float & ADV from external fundamentals provider
- [ ] Venue decomposition (TRF/ORF splits)
- [ ] Securities-lending data integration
- [ ] Backtesting framework

## Contributing

This is a prototype MVP. To extend:

1. Add external data sources (float, borrow rates)
2. Implement screener backend with PostgreSQL queries
3. Build alert engine with idempotent delivery
4. Add user authentication for saved watchlists
5. Optimize with DuckDB for analytical queries

## License

MIT License - see LICENSE file

## Disclaimer

This platform is for informational and research purposes only. Not financial advice. Data is cached and may have delays. Past performance does not indicate future results.

---

Built with the [FINRA API](https://developer.finra.org) | [Documentation](./FINRA_API_Documentation.md)
