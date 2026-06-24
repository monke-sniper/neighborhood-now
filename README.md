# Neighborhood Now

> Type an address. See what is happening. Know where it is going.

Neighborhood Now is a neighborhood intelligence platform built for FutureHacks 2026. It aggregates live data from six open sources, runs statistical analysis to detect anomalies and forecast trends, and presents the result through a conversational interface. One address returns a full report: livability score, anomaly alerts, two-year forecast, what-if scenarios, and AI chat.

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org) [![React 19](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org) [![MapLibre](https://img.shields.io/badge/MapLibre_GL-5-1a73e8)](https://maplibre.org)

**Repository:** [github.com/monke-sniper/neighborhood-now](https://github.com/monke-sniper/neighborhood-now)

## Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Tests](#tests)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Engine Reference](#engine-reference)
- [Customization](#customization)
- [Troubleshooting](#troubleshooting)
- [Known Limitations](#known-limitations)
- [Tech Stack](#tech-stack)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Features

- **Livability score** — 0–100 rating across amenity density, transit access, food access, green space, and development activity. Each component is normalized via `((actual - p10) / (p90 - p10)) × 100` against live Toronto benchmarks captured at build time. Includes a Top 10% / Above average / Average / Below average / Bottom 25% ranking label
- **Anomaly detection** — 12+ signal sources scored with Poisson-approximation z-score against the citywide p50 baseline. Warnings at |z| > 1.8, critical at |z| > 3. Surfaces both over- and under-represented metrics
- **Two-year forecast** — EWMA smoothing for short series (n < 6), ordinary-least-squares regression for longer series (n ≥ 6), with one-sigma confidence bands and a R²-based confidence label
- **What-if simulator** — six scenarios (subway, park, 500-unit development, grocery, school, transit strike). Impacts are grounded in the current state, so a subway in a transit-poor area produces a larger delta than one in a transit-rich area
- **AI chat** — natural-language questions about the neighborhood, answered from the structured report only. Uses Ollama Cloud when `OLLAMA_API_KEY` is set, otherwise returns a stub message
- **Terminal aesthetic** — JetBrains Mono, pure black background, teal `#5eead4` accents, sharp borders, `[BRACKET]` labels, and a top status bar with live clock and source health

## Quick Start

**Requirements:** Node.js 20.9 or newer, npm 10 or newer.

### 1. Clone and install

```bash
git clone https://github.com/monke-sniper/neighborhood-now.git
cd neighborhood-now
npm install
```

### 2. Configure environment (optional)

```bash
cp .env.example .env.local
```

On Windows PowerShell use `Copy-Item .env.example .env.local` instead.

Edit `.env.local` and add any keys you have. The application runs without any keys: geocoding, OpenStreetMap amenities, building permits, and 311 complaints all use free public sources. Keys only enable the optional layers.

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and enter an address. Try `CN Tower, Toronto` for a representative report.

### 4. Production build

```bash
npm run build
npm start
```

The output is a standard Next.js Node.js build that runs on any Node 20.9+ host.

### 5. Other useful commands

```bash
npm test              # run 42 vitest unit + API tests
npm run test:watch    # vitest in watch mode
npm run calibrate     # re-capture Toronto benchmarks from live APIs
npm run verify        # end-to-end: spawn dev server, hit 4 demo addresses, dump verification/*.json
npm run lint          # eslint
npx tsc --noEmit      # type check (no separate script)
```

## Environment Variables

| Variable | Required | Default | Purpose |
|---|:---:|---|---|
| `OLLAMA_API_KEY` | no | _(empty)_ | Bearer token for the Ollama Cloud chat API. Get a key at [ollama.com/settings/keys](https://ollama.com/settings/keys) |
| `OLLAMA_BASE_URL` | no | `https://ollama.com` | Ollama endpoint. Use `http://localhost:11434` for a local Ollama instance |
| `OLLAMA_MODEL` | no | `gpt-oss:20b` | Model name. Recommended: `gpt-oss:20b` (balanced) or `llama3.2:3b` (lighter) |
| `CENSUS_KEY` | no | _(empty)_ | US Census ACS 5-year API key. Get a key at [api.census.gov/data/key_signup.html](https://api.census.gov/data/key_signup.html) |
| `OPENWEATHER_KEY` | no | _(empty)_ | OpenWeatherMap API key for air quality. Get a key at [openweathermap.org/api](https://openweathermap.org/api) |
| `PORT` | no | `3000` | Dev server port |

The map does not require a key. MapLibre GL renders the CARTO dark-matter basemap, which is free for non-commercial use. To change the style, see [Customization](#customization).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server with hot reload on port 3000 |
| `npm run build` | Production build using Turbopack. Exits when complete |
| `npm start` | Run the production build |
| `npm test` | Run vitest unit + API tests (42 tests) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run calibrate` | Re-capture live Toronto benchmarks from Overpass + BuildData + 311 file. Writes `src/lib/engine/benchmarks.ts` |
| `npm run verify` | End-to-end verification: spawns dev server, hits 4 demo addresses, writes `verification/<address>.json`, prints summary, kills server |
| `npm run lint` | Run ESLint with the Next.js configuration |
| `npx tsc --noEmit` | Type check in strict mode (no separate script) |

## Tests

42 tests across 5 files. They run against in-memory data only (no network), so they are fast (~250 ms total) and deterministic.

```bash
npm test
```

| File | Tests | What it covers |
|---|---:|---|
| `tests/score.test.ts` | 14 | Percentile scoring, ranking, clamp behavior, the no-13/100-floor invariant |
| `tests/anomalies.test.ts` | 5 | Z-score thresholds, citywide-baseline fallback, sort order |
| `tests/forecast.test.ts` | 9 | EWMA for n<6, OLS for n≥6, confidence bands, R² thresholds |
| `tests/whatif.test.ts` | 10 | Six scenarios, grounded impacts, clamp behavior |
| `tests/api.test.ts` | 4 | `/api/report` GET handler: 400 on missing address, 200 with body, `?debug=1` shape |

The end-to-end harness lives at `scripts/verify.mjs` and is run separately:

```bash
npm run verify
```

It spawns `next dev` on port 3939, hits `/api/report?address=<each demo>&debug=1` for four addresses, writes `verification/<address>.json`, prints a per-address summary, then kills the server. Used to prove the live system returns varied scores and that no source reports `failed`.

## Architecture

The following diagram describes the data flow from address to rendered report.

```
address string
   │
   ▼
[ Nominatim ] ──► {lat, lon, display_name}      (1 req/sec, cached 24h)
   │
   ├──► [ Overpass ]    ──► amenities, transit, landuse     (live, radius 1.5km, 3 mirrors)
   ├──► [ BuildData ]   ──► permits[] (filtered by 1.5km)   (live, cached 1h)
   ├──► [ 311 File ]    ──► complaints[]                    (file snapshot, 1.5km)
   ├──► [ Census ]      ──► demographics                    (US only, optional)
   └──► [ OpenWeather ] ──► air quality                     (optional)
   │
   ▼
[ score engine ]       ──► LivabilityScore (0-100, 5 components, percentile-ranked)
[ anomalies engine ]   ──► Anomaly[]   (z-score, |z|>1.8 warn, |z|>3 critical)
[ forecast engine ]    ──► Trend[]     (EWMA n<6, OLS n≥6, 1σ bands)
[ whatif engine ]      ──► ScenarioResult[] (6 scenarios, grounded impacts)
   │
   ▼
UI: Map | ReportCard | AnomalyList | ForecastChart | WhatIfSimulator | ChatBox
```

The orchestrator at `/api/report` uses `Promise.allSettled` so that a single failed upstream never blocks the rest of the report. If Census is unavailable, the report still ships with OSM, permit, and 311 data.

## Project Structure

```
.
├── data/
│   └── toronto-311.json            # Static 311 snapshot, replace to refresh
├── public/                         # Static assets
├── src/
│   ├── app/
│   │   ├── api/                    # Route handlers
│   │   │   ├── report/route.ts     # GET  /api/report?address=X
│   │   │   ├── anomalies/route.ts  # POST /api/anomalies
│   │   │   ├── forecast/route.ts   # POST /api/forecast
│   │   │   ├── whatif/route.ts     # POST /api/whatif
│   │   │   └── chat/route.ts       # POST /api/chat
│   │   ├── layout.tsx              # Root layout, dark theme
│   │   ├── page.tsx                # Main page, holds report state
│   │   └── globals.css             # Tailwind 4 + dark tokens
│   ├── components/                 # UI components
│   │   ├── AddressInput.tsx
│   │   ├── MapView.tsx             # MapLibre GL
│   │   ├── ReportCard.tsx
│   │   ├── AnomalyList.tsx
│   │   ├── ForecastChart.tsx       # Recharts
│   │   ├── WhatIfSimulator.tsx
│   │   └── ChatBox.tsx
│   └── lib/
│       ├── api/                    # Data fetchers (6)
│       ├── engine/                 # Analysis engines (4)
│       ├── utils/                  # Geo + cache helpers
│       ├── config.ts
│       └── types.ts
├── .env.example
├── next.config.ts
├── package.json
└── tsconfig.json                   # strict mode
```

## API Reference

| Method | Path | Purpose | Example |
|---|---|---|---|
| `GET` | `/api/report` | Full neighborhood report (orchestrator) | `/api/report?address=CN+Tower+Toronto` |
| `POST` | `/api/anomalies` | Detect anomalies from signals | `{ "signals": [{ "name": "permits", "current": 7, "baseline": 2.1, "unit": "permits" }] }` |
| `POST` | `/api/forecast` | Forecast from time series | `{ "series": [{ "name": "permits", "history": [1,2,3,4,5,6] }] }` |
| `POST` | `/api/whatif` | Simulate a scenario | `{ "current": { ... }, "scenarioId": "subway" }` |
| `POST` | `/api/chat` | AI chat over the report | `{ "question": "Is this good for families?", "report": { ... } }` |

All POST endpoints accept and return JSON. The orchestrator returns a full `NeighborhoodReport` object; see `src/lib/types.ts` for the schema.

## Engine Reference

**Score** (`src/lib/engine/score.ts`) — counts amenities, transit stops, and grocery stores in a 1.5 km radius, normalizes each component via `((actual - p10) / (p90 - p10)) × 100` against the live Toronto benchmarks in `src/lib/engine/benchmarks.ts`, then computes a weighted average using weights from `src/lib/config.ts`: amenity 25%, transit 25%, food 20%, green 15%, development 15%. Returns a `ranking` label of Top 10% / Above average / Average / Below average / Bottom 25%.

**Anomalies** (`src/lib/engine/anomalies.ts`) — twelve plus signal sources (overall + per-metric amenity counts, permits, complaints, optional air and census) scored with Poisson-approximation z-score `z = (current - baseline) / √baseline` against the citywide p50 baseline. Signals with |z| ≤ 1.8 are dropped. Remaining anomalies are sorted by |z| descending.

**Forecast** (`src/lib/engine/forecast.ts`) — exponential-weighted moving average for short series (n = 3..5), ordinary-least-squares regression for longer series (n ≥ 6), with one-sigma residual-based confidence bands at the 6, 12, and 24 month horizons. R² drives the confidence label: above 0.7 is high, above 0.4 is medium, otherwise low.

**What-if** (`src/lib/engine/whatif.ts`) — six scenarios (subway, park, 500-unit development, grocery, school, transit strike). Each impact can be a constant or a function of the current breakdown, so a subway in a transit-poor area produces a larger delta than one in a transit-rich area. The simulator clamps the modified components to 0–100, then re-runs the weighted total. Computation is client-side with no network round-trip.

## Customization

**Add a what-if scenario.** Edit `src/lib/engine/whatif.ts` and append an entry to the `SCENARIOS` array:

```typescript
{
  id: 'bike_lanes',
  name: 'New bike lanes',
  emoji: 'bike',
  description: 'Protected lanes on main streets',
  impact: { transitScore: 10, greenSpace: 5 },
}
```

The new card appears in the simulator on next reload.

**Adjust score weights.** Edit `src/lib/config.ts`:

```typescript
weights: { amenityDensity: 0.25, transitScore: 0.25, foodAccess: 0.20,
           greenSpace: 0.15, development: 0.15 }
```

Weights should sum to 1.0.

**Change the map style.** Edit `STYLE_URL` in `src/components/MapView.tsx`. Some free options:

- `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json` — default dark style
- `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json` — CARTO light
- `https://tiles.openfreemap.org/styles/positron` — OpenFreeMap light
- `https://demotiles.maplibre.org/style.json` — MapLibre demo, works offline

**Refresh the 311 dataset.** Replace `data/toronto-311.json` with new records in the shape `{ id, type, date, lat, lon, status }`. Keep the file under approximately 5 MB for responsive filtering.

**Tune anomaly thresholds.** Edit the constants in `src/lib/engine/anomalies.ts`. The default thresholds are 2 (warning) and 3 (critical) and are documented in the source.

## Troubleshooting

**Port 3000 is already in use.**

Another process is bound to the port. On macOS or Linux, run `npx kill-port 3000`. On Windows, run `Stop-Process -Name node -Force` from PowerShell. Then `npm run dev` again.

**The 311 complaints section shows zero complaints.**

The 311 dataset is a static file (`data/toronto-311.json`) covering downtown Toronto. Outside that geographic area, the result is empty. To extend coverage, replace the file with a snapshot for your area (see [Customization](#customization)).

**The AI chat returns "AI not configured".**

`OLLAMA_API_KEY` is not set. Add it to `.env.local` and restart the dev server. Get a key at [ollama.com/settings/keys](https://ollama.com/settings/keys).

**The AI chat returns 401 or "model not found".**

The most common cause is a mismatch between the model name in `.env.local` and the models provisioned to your Ollama Cloud account. The default `gpt-oss:20b` is available on the free tier. Try `llama3.2:3b` if quota is constrained.

**The Census section does not appear.**

Census is only available for US coordinates. Non-US addresses skip the Census step. To test, enter a US address such as `Times Square, New York` and provide a valid `CENSUS_KEY`.

**The map shows a blank gray rectangle.**

MapLibre requires network access to fetch the basemap style and tiles. Verify connectivity and check the browser console for CORS or 404 errors. The application does not crash if the map fails; the rest of the report still renders.

**`npm run typecheck` reports errors.**

Run `npx tsc --noEmit --pretty` for line numbers. The project uses TypeScript strict mode: missing types, implicit `any`, and unused locals all fail the check.

**The BuildData API is slow or rate-limiting.**

The BuildData response is cached for one hour. If you are running the report rapidly, requests will queue at the upstream. If the upstream is down entirely, the report still completes — permits are skipped and OpenStreetMap construction tags fill the gap.

## Known Limitations

- The 311 dataset is a static file containing 44 records covering downtown Toronto. For other cities or live data, replace `data/toronto-311.json` or implement a real API client in `src/lib/api/complaints.ts`.
- The forecast engine requires at least three months of history. Below that, it returns the current value with `confidence: 'low'`.
- Ollama Cloud imposes rate limits on the free tier. Heavy demo traffic can return HTTP 429. For unlimited usage, run Ollama locally and set `OLLAMA_BASE_URL=http://localhost:11434`.
- Score baselines are tuned for Toronto. Other cities will score lower until the constants in `src/lib/engine/score.ts` are adjusted for the target region.
- The layout is designed for desktop. Mobile rendering works but is not optimized.

## Tech Stack

| Package | Version | Role |
|---|---|---|
| `next` | 16.2.9 | React framework, App Router, Turbopack, route handlers |
| `react` | 19.2.4 | UI runtime |
| `typescript` | ^5 | Strict mode |
| `tailwindcss` | ^4 | Styling, `@theme` dark tokens |
| `maplibre-gl` | ^5.0.0 | Map rendering, no API key required |
| `recharts` | ^3.9.0 | Forecast line chart |
| `eslint` | ^9 | Linting with `eslint-config-next` |

Data sources: OpenStreetMap (Overpass and Nominatim), BuildData.ca (Toronto permits), Toronto 311 (static file snapshot), US Census ACS, OpenWeatherMap air pollution, Ollama Cloud. All free tier.

## Acknowledgements

- OpenStreetMap contributors for the global amenity dataset
- BuildData.ca for Toronto building permit exports
- City of Toronto for the 311 service request data
- CARTO for the free dark-matter basemap style
- Ollama for the local and cloud LLM runtime
- US Census Bureau for the American Community Survey
- OpenWeather for the air-quality API
- FutureHacks 2026 organizers

## License

All rights reserved.
