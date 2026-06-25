# Neighborhood Now — FutureHacks 2026

> Type an address. See what is happening. Know where it is going.

A neighborhood intelligence platform. Type an address, get a full report: livability score, anomaly alerts, two-year forecast, what-if scenarios, AI chat, and side-by-side comparison of two addresses. Live data from OpenStreetMap, Toronto permits, Toronto 311 service requests, optional US Census + air quality, optional Ollama Cloud chat.

**Try it locally:** the app is on a single page (`/`). Toggle `[CORPUS]` in the header to use precomputed reports when the public APIs are down (great for the recording). Click `[ SHARE ]` to get a URL you can hand to anyone — it rehydrates the report on load.

## Quick Start (local)

```bash
git clone https://github.com/monke-sniper/neighborhood-now.git
cd neighborhood-now
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and enter an address. Try `CN Tower, Toronto` for a representative report. Click `[ CORPUS ]` in the header to switch to the offline precomputed dataset.

> **Why `npm run dev` and not `npx next dev`?** Our dev runner (`scripts/dev.mjs`) kills any stale `node.exe` holding the port, clears a corrupt `.next/`, and starts a clean dev server. It is **self-pid safe** (does not kill itself). Use `npm run dev:clean` to force-clear the cache.

## Demo URLs (offline, corpus-backed)

```
http://localhost:3000/?a=CN+Tower,+Toronto&demo=1
http://localhost:3000/?a=CN+Tower,+Toronto&b=Liberty+Village,+Toronto&demo=1&mode=compare
http://localhost:3000/?a=CN+Tower,+Toronto&r=5000
http://localhost:3000/?a=Bloor-Yonge,+Toronto&b=Rexdale,+Etobicoke,+Toronto&demo=1&mode=compare
http://localhost:3000/?a=The+Beaches,+Toronto&b=King-Bay,+Toronto&demo=1&mode=compare
```

## WOW features

- **Neighborhood DNA radar** — 9-axis animated radar of the score components. Toggle any what-if scenario and the polygon morphs to a new dashed-amber shape. Pure SVG, no extra deps.
- **JUST-IN news ticker** — top-of-page Bloomberg-style marquee that scrolls the top anomalies as headlines with live timestamps. Server component, zero hydration cost.
- **Side-by-side compare map** — two pins + two radius circles + color-coded permit markers (A=teal, B=amber).
- **Verdict pills** — plain-language labels (`[ GENTRIFICATION FRONT-RUNNER ]`, `[ TRANSIT DESERT ]`, `[ FOOD DESERT ]`, `[ GREEN OASIS ]`, etc.) with one-line "WHY" explanations. Mounted at the top of every report.
- **Shareable URLs** — `[ SHARE ]` button encodes the report state into the query string. The page rehydrates on load. One-click copy + X.com share.
- **Per-school counterfactual** — for each school, computes the marginal impact on the total via a single analytic pass. Panel renders them sorted.
- **Demo corpus + offline mode** — `npm run regen:corpus` writes precomputed `/api/report` responses to `public/data/corpus/*.json`. 10 demo addresses + 4 compare pairs are committed.
- **In-browser API key settings** — zero server-side keys. Users add their own Ollama/Census/OpenWeather keys via Settings; keys live in `localStorage` and travel per-request as `X-*-Key` headers.
- **Terminal aesthetic** — JetBrains Mono, pure black, teal `#5eead4` accents, sharp borders, top status bar with live clock and source health.

## Production build

```bash
npm run build
npm start
```

The production build is **the recommended demo path** — Turbopack's dev server has a known hot-reload bug that can serve 500 on `/` after a few minutes of editing. `npm start` after `npm run build` is rock solid.

## Environment Variables

| Variable | Required | Default | Purpose |
|---|:---:|---|---|
| `OLLAMA_API_KEY` | no | _(empty)_ | Bearer token for Ollama Cloud chat |
| `OLLAMA_BASE_URL` | no | `https://ollama.com` | Ollama endpoint. Use `http://localhost:11434` for local |
| `OLLAMA_MODEL` | no | `gpt-oss:20b` | Model name. `gpt-oss:20b` (balanced) or `llama3.2:3b` (lighter) |
| `CENSUS_KEY` | no | _(empty)_ | US Census ACS 5-year API key |
| `OPENWEATHER_KEY` | no | _(empty)_ | OpenWeatherMap API key for air quality |
| `TORONTO_311_RESOURCE_ID` | no | _(empty)_ | When set, fetches live Toronto 311 data from CKAN `datastore_search` instead of the bundled static file |
| `PORT` | no | `3000` | Dev server port |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Self-pid-safe dev runner on :3000 |
| `npm run dev:3000` | Alias for `npm run dev` |
| `npm run dev:3030` | Dev runner on :3030 |
| `npm run dev:clean` | Dev runner, force-clears `.next/` first |
| `npm run build` | Production build (Turbopack) |
| `npm start` | Run the production build |
| `npm test` | Run all vitest tests |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check (strict mode) |
| `npm run calibrate` | Re-capture Toronto benchmarks from live APIs |
| `npm run verify` | Spawn dev server, hit 4 demo addresses + a compare demo, write `verification/*.json` and `public/data/corpus/*.json` |
| `npm run regen:corpus` | Regenerate the offline corpus from `?synth=1` (no network required) |

## Tests

Tests run against in-memory data only — no network, fast (~400 ms), deterministic.

| File | Tests | What it covers |
|---|---:|---|
| `tests/score.test.ts` | 18 | Score, ranking, presence renormalization, 9-component shape, `nowMs` |
| `tests/anomalies.test.ts` | 5 | Z-score thresholds, sort order, baseline fallback, 30d surge, gentrification pressure, category tags |
| `tests/forecast.test.ts` | 11 | EWMA for n<6, OLS for n≥6, hard floor, confidence bands, R² |
| `tests/whatif.test.ts` | 10 | 6 scenarios, grounded impacts, clamp, 9-component shape |
| `tests/recommend.test.ts` | 14 | JSON extraction, scenario-id validation, weakest-component fallback |
| `tests/amenity.test.ts` | 20 | `pickName`, `hasRealName`, kind-label derivation |
| `tests/overpass.test.ts` | 6 | Query shape, removed patterns, 12-kinds coverage |
| `tests/explain.test.ts` | 15 | 9 explanations, weights, contributions, radius scaling |
| `tests/forecast-template.test.ts` | 6 | Benchmark template + sparse data |
| `tests/skeleton.test.ts` | 2 | Module exports |
| `tests/api.test.ts` | 5 | `/api/report` happy path + 400 + debug + shape + radius |
| (others) | 30 | compose, errors, http, ollama, timeseries, analyzeSchools |

End-to-end: `npm run regen:corpus` regenerates 10 singles + 4 compares into `public/data/corpus/`. The `[CORPUS]` toggle in the header serves them.

## Architecture

```
address string
    │
    ▼
[ Nominatim ] ──► {lat, lon, display_name}
    │
    ├──► [ Overpass ]   ──► amenities, transit, landuse   (parallel mirrors, Promise.any)
    ├──► [ BuildData ]  ──► permits[]                     (1h cache)
    ├──► [ 311 ]        ──► complaints[]                  (live CKAN or static file)
    ├──► [ Census ]     ──► demographics                  (US only, bbox-FIPS lookup)
    └──► [ OpenWeather ]──► air quality                   (optional)
    │
    ▼
[ score engine ]       ──► LivabilityScore (0-100, 9 components, percentile-ranked)
[ anomalies engine ]   ──► Anomaly[]   (z-score, |z|>1.8 warn, |z|>3 critical, category-tagged)
[ forecast engine ]    ──► Trend[]     (EWMA n<6, OLS n≥6, 1σ bands)
[ whatif engine ]      ──► ScenarioResult[] (6 scenarios, grounded, stackable)
[ school analyzer ]    ──► SchoolImpact[]  (per-school counterfactual, O(N))
[ verdict engine ]     ──► Verdict[]       (plain-language labels)
    │
    ▼
NeighborhoodReport → {single mode | compare mode (a + b + delta)}
    │
    ▼
UI: VerdictPills | Map (with radius circle) | ReportCard | ScoreRadar (DNA) | AnomalyList | NewsTicker | SchoolsPanel | ForecastChart | WhatIfSimulator | RecommendationsPanel | ChatBox | ComparisonView (with CompareMap)
```

The orchestrator at `/api/report` uses `Promise.race` against a deadline and falls back gracefully when any single upstream is down.

`/api/compare?a=X&b=Y` runs the orchestrator twice in parallel and returns a delta response. The UI swaps between single and compare via the header toggle.

`/api/corpus?address=X` reads precomputed JSON from `public/data/corpus/`. When the header `[CORPUS]` toggle is on, `useReportState` and `useCompareState` hit this endpoint first and fall back to the live orchestrator on 404.

## Engine Reference

**Score** (`src/lib/engine/score.ts`) — counts amenities + permits in a configurable radius, normalizes each component via `((actual - p10) / (p90 - p10)) × 100` against the live Toronto benchmarks, then computes a presence-aware weighted total. Weights from `src/lib/config.ts`:

```typescript
weights: { amenityDensity: 0.18, transitScore: 0.18, foodAccess: 0.14,
           greenSpace: 0.10, development: 0.10, civicScore: 0.075,
           cultureScore: 0.075, recreationScore: 0.075, serviceScore: 0.075 }
```

The sum (0.965) is intentional — components with no data (e.g. a Census-less US address) are excluded and the total renormalizes over the present subset. `presence` is reported in the response.

**Anomalies** (`src/lib/engine/anomalies.ts`) — 12+ signal sources (5 score components, 7 amenity counts, plus optional permits/311/air/census) scored with Poisson-approximation z-score `z = (current - baseline) / √baseline` against the citywide p50 baseline. Tagged with `category: 'gentrification' | 'livability' | 'quality-of-life' | 'environment'`. Sorted by |z| descending.

**Forecast** (`src/lib/engine/forecast.ts`) — exponential-weighted moving average for short series (n = 3..5), OLS regression for longer series (n ≥ 6), with 1σ residual-based confidence bands at 6/12/24 month horizons. R² drives the confidence label: ≥0.7 high, ≥0.4 medium, otherwise low. Hard-floored to never drop more than 30% from the current value.

**What-if** (`src/lib/engine/whatif.ts`) — 6 scenarios. Each impact is a constant or a function of the current breakdown, so a subway in a transit-poor area produces a larger delta than one in a transit-rich area. `composeScenarios` stacks multiple scenarios. Client-safe (no upstream deps).

**Verdict** (`src/lib/engine/verdict.ts`) — 11 plain-language verdicts generated by rules over the breakdown + anomalies. Each verdict has a `key`, `label`, `short`, `emoji`, and a one-line `reason` that surfaces the actual numbers.

**School analyzer** (`src/lib/engine/score.ts:analyzeSchools`) — for each school, computes the marginal impact on the total via a single analytic pass. No second `computeBreakdown` call per school.

## Project Structure

```
.
├── data/                              # Reference inputs (not currently used at runtime)
├── public/data/
│   ├── toronto-311.json               # Static downtown records (legacy, kept for back-compat)
│   ├── toronto-311-downtown.json      # Static downtown records
│   ├── toronto-311-citywide.json      # Static citywide records (default fallback)
│   └── corpus/                        # Precomputed demo reports (committed)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── report/route.ts        # GET  /api/report?address=X[&radius=][&synth=1]
│   │   │   ├── compare/route.ts       # GET  /api/compare?a=X&b=Y[&radius=][&synth=1]
│   │   │   ├── corpus/route.ts        # GET  /api/corpus?address=X (precomputed)
│   │   │   ├── anomalies/route.ts     # POST /api/anomalies
│   │   │   ├── forecast/route.ts      # POST /api/forecast
│   │   │   ├── whatif/route.ts        # POST /api/whatif
│   │   │   ├── chat/route.ts          # POST /api/chat
│   │   │   └── recommend/route.ts     # POST /api/recommend
│   │   ├── layout.tsx                 # Root layout, dark theme
│   │   ├── page.tsx                   # Main page, single + compare modes, URL rehydration
│   │   └── globals.css                # Tailwind 4 + dark tokens
│   ├── components/
│   │   ├── AddressInput.tsx
│   │   ├── AmenityList.tsx
│   │   ├── AnomalyList.tsx
│   │   ├── ChatBox.tsx
│   │   ├── CompareMap.tsx             # Side-by-side map with radius circles
│   │   ├── ComparePanel.tsx
│   │   ├── ComparisonView.tsx
│   │   ├── ForecastChart.tsx
│   │   ├── MapView.tsx
│   │   ├── NewsTicker.tsx             # JUST-IN marquee
│   │   ├── RadiusSelect.tsx
│   │   ├── RecommendationsPanel.tsx
│   │   ├── ReportCard.tsx
│   │   ├── ReportSkeleton.tsx
│   │   ├── ScoreBar.tsx
│   │   ├── ScoreRadar.tsx             # Neighborhood DNA 9-axis radar
│   │   ├── SchoolsPanel.tsx
│   │   ├── SettingsPanel.tsx
│   │   ├── ShareButton.tsx            # Shareable URL + copy + X
│   │   ├── Skeleton.tsx
│   │   ├── VerdictPills.tsx           # Plain-language labels
│   │   └── WhatIfSimulator.tsx
│   ├── hooks/
│   │   ├── useClock.ts                # 1s clock, client component
│   │   ├── useCompareState.ts         # compare fetch + status FSM, useCorpus support
│   │   ├── useReportState.ts          # address → report with retry + corpus fallback
│   │   └── useWhatIfState.ts          # active scenarios + composed
│   └── lib/
│       ├── api/                       # Data fetchers (7 modules)
│       ├── engine/                    # Pure analysis engines (anomalies, score, forecast, whatif, verdict, ...)
│       ├── llm/                       # Shared Ollama HTTP + header reader
│       ├── prompts/                   # Chat + recommend system prompts
│       ├── utils/                     # geo, cache, amenity, share
│       ├── config.ts                  # weights, mirrors, radii, cache TTLs
│       ├── errors.ts                  # UpstreamError
│       ├── http.ts                    # postJson/httpText with timeouts
│       ├── keys.ts                    # localStorage client-keys abstraction
│       ├── logger.ts                  # structured logger (no secrets)
│       ├── synthetic.ts               # Offline-corpus SPECS + buildSyntheticReport
│       └── types.ts                   # shared types
├── tests/                            # 17 files, 151 tests
├── scripts/
│   ├── calibrate.mjs                  # Re-capture Toronto benchmarks
│   ├── verify.mjs                     # Spawn dev server, hit 4 demo addresses, write verification + corpus
│   ├── regen-corpus.mjs               # Regenerate offline corpus from ?synth=1
│   ├── dev.mjs                        # Self-pid-safe dev runner
│   └── screenshot.mjs
├── .env.example
├── next.config.ts                     # optimizePackageImports for recharts + maplibre-gl
├── tsconfig.json                     # strict mode
├── plan.md                           # Hackathon build plan (this session)
└── README.md                         # You are here
```

## API Reference

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/report?address=X[&radius=1000..5000][&synth=1][&debug=1]` | Full neighborhood report |
| `GET` | `/api/compare?a=X&b=Y[&radius=][&synth=1]` | Two-address comparison |
| `GET` | `/api/corpus?address=X` | Precomputed report from `public/data/corpus/` (404 if absent) |
| `POST` | `/api/anomalies` | `{ permitsLast30d, permitsLast6m, complaintsLast30d, complaintsLast90d, amenityCounts, scoreBreakdown, airQuality?, census? }` → `Anomaly[]` |
| `POST` | `/api/forecast` | `{ series: [{ name, history: number[] }] }` → `Trend[]` |
| `POST` | `/api/whatif` | `{ current: ScoreBreakdown, scenarioId: string }` → `ScenarioResult` |
| `POST` | `/api/chat` | `{ question, report }` → `{ answer, modelUsed }` |
| `POST` | `/api/recommend` | `{ report }` → `{ recommendations, thinking, ideas, modelUsed }` |

## Customization

**Add a what-if scenario.** Edit `src/lib/engine/whatif.ts` and append to `SCENARIOS`:
```typescript
{ id: 'bike_lanes', name: 'New bike lanes', emoji: 'B',
  description: 'Protected lanes on main streets',
  impact: { transitScore: 10, greenSpace: 5 } }
```

**Add a verdict.** Edit `src/lib/engine/verdict.ts` and append to the `deriveVerdicts` rules.

**Adjust score weights.** Edit `weights` in `src/lib/config.ts`. Weights should sum to ≈1.0; the score renormalizes over present components.

**Change the map style.** Edit `STYLE_URL` in `src/components/MapView.tsx`. The default is CARTO dark-matter (free for non-commercial use).

**Refresh the 311 dataset.** Either re-run `npm run calibrate` to regenerate Toronto benchmarks, or set `TORONTO_311_RESOURCE_ID` to a real CKAN resource id to pull live data.

**Tune anomaly thresholds.** Edit the `ZSCORE_THRESHOLD` constant in `src/lib/engine/anomalies.ts`. Defaults: 1.8 warning, 3.0 critical.

## Troubleshooting

- **Port 3000 is in use.** `Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force`. macOS/Linux: `lsof -ti :3000 | xargs -r kill -9`.
- **Dev server returns 500 on `/`.** Use `npm run build && npm start` for the production path. If dev is in a bad state: `npm run dev:clean` (kills processes, clears `.next/`, restarts).
- **311 complaints section is empty.** The static dataset covers 6 Toronto neighborhoods. For citywide live data, set `TORONTO_311_RESOURCE_ID`. Outside the calibrated neighborhoods, the demo corpus (`[CORPUS]`) provides precomputed reports.
- **AI chat returns "not configured".** Add `OLLAMA_API_KEY` in `.env.local` (server) or the Settings panel (per-browser, via `X-Ollama-Key` header).
- **Census section doesn't appear.** Census is US-only and requires `CENSUS_KEY`. The bbox FIPS lookup covers ~20 major metros; addresses outside return `null` (the section is gracefully hidden).
- **The map shows a blank gray rectangle.** MapLibre needs network access to fetch tiles. The rest of the report still renders if the map fails.

## Known Limitations

- 311 dataset is citywide (~100 records across 6 neighborhoods) — not the full Toronto open-data feed. For a live feed, set `TORONTO_311_RESOURCE_ID`.
- Census coverage is a hand-coded bbox table for ~20 US metros. Other US addresses return `null` and the section is hidden.
- Forecast requires at least 3 months of history. Below that, it returns the current value with `confidence: 'low'`.
- Score baselines are tuned for Toronto. Other cities will score lower until `npm run calibrate` is run against a different region.
- The layout is desktop-first. Mobile renders but is not optimized.
- Turbopack dev server has a known hot-reload cache bug; use `npm start` for the demo.

## Tech Stack

| Package | Version | Role |
|---|---|---|
| `next` | 16.2.9 | React framework, App Router, Turbopack |
| `react` | 19.2.4 | UI runtime |
| `typescript` | ^5 | Strict mode |
| `tailwindcss` | ^4 | Styling, `@theme` dark tokens |
| `maplibre-gl` | ^5.0.0 | Map rendering, no API key |
| `recharts` | ^3.9.0 | Forecast chart |
| `eslint` | ^9 | Linting |
| `vitest` | ^4.1.9 | Test runner |
| `playwright` | ^1.61.1 | E2E screenshots (dev) |

## License

All rights reserved.
