# Neighborhood Now

`Next.js 16` `TypeScript` `Tailwind 4` `MapLibre GL` `151 tests`

> Type an address. See what is happening. Know where it is going.

Neighborhood intelligence platform. Enter an address and get a full report: livability score, anomaly alerts, two-year forecast, what-if scenarios, AI chat, and side-by-side comparison of two addresses. Data from OpenStreetMap, Toronto permits, Toronto 311 service requests, optional US Census + air quality, optional Ollama Cloud chat.

---

## Features

**Neighborhood DNA Radar** — 9-axis animated SVG radar of score components. Toggle any what-if scenario and the polygon morphs to a new dashed-amber shape. Zero extra dependencies.

**JUST-IN News Ticker** — Bloomberg-style marquee scrolling top anomalies as headlines with live timestamps. Server component, zero hydration cost.

**Side-by-Side Compare** — two pins, two radius circles, color-coded permit markers (teal / amber). Drop-in comparison view.

**Verdict Pills** — plain-language labels (`GENTRIFICATION FRONT-RUNNER`, `TRANSIT DESERT`, `FOOD DESERT`, `GREEN OASIS`, etc.) with one-line data-backed explanations.

**What-If Simulator** — 6 scenarios (new subway, bike lanes, grocery store, park, density increase, transit cuts). Impacts are grounded in the current score breakdown. Stackable and composable.

**Shareable URLs** — encodes the report state into the query string. One-click copy, X.com share. Page rehydrates on load.

**Offline Mode** — toggle `[CORPUS]` in the header to serve precomputed reports from disk. No API keys, no network. 10 demo addresses + 4 compare pairs included.

**Privacy-First API Keys** — zero server-side keys. Users add their own Ollama / Census / OpenWeather keys via the Settings panel. Keys live in `localStorage` and travel per-request as `X-*-Key` headers.

---

## Demo

Try it without any API keys — the corpus mode ships 10 precomputed reports:

```
http://localhost:3000/?a=CN+Tower,+Toronto&demo=1
http://localhost:3000/?a=CN+Tower,+Toronto&b=Liberty+Village,+Toronto&demo=1&mode=compare
http://localhost:3000/?a=CN+Tower,+Toronto&r=5000
http://localhost:3000/?a=Bloor-Yonge,+Toronto&b=Rexdale,+Etobicoke,+Toronto&demo=1&mode=compare
http://localhost:3000/?a=The+Beaches,+Toronto&b=King-Bay,+Toronto&demo=1&mode=compare
```

Open `http://localhost:3000` and enter an address. Click `[ CORPUS ]` in the header to switch to the offline dataset. Try `CN Tower, Toronto` for a representative report.

---

## Quick Start

```bash
git clone https://github.com/monke-sniper/neighborhood-now.git
cd neighborhood-now
npm install
npm run dev
```

> `npm run dev` uses a self-pid-safe dev runner (`scripts/dev.mjs`) that kills stale `node.exe` processes holding the port, clears a corrupt `.next/` cache, and starts a clean dev server. Use `npm run dev:clean` to force-clear the cache.

For the production path:

```bash
npm run build
npm start
```

---

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

`/api/compare?a=X&b=Y` runs the orchestrator twice in parallel and returns a delta response.

`/api/corpus?address=X` reads precomputed JSON from `public/data/corpus/`. When the `[CORPUS]` toggle is on, the report hooks hit this endpoint first and fall back to the live orchestrator on 404.

---

## API Reference

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/report?address=X[&radius=1000..5000][&synth=1][&debug=1]` | Full neighborhood report |
| `GET` | `/api/compare?a=X&b=Y[&radius=][&synth=1]` | Two-address comparison |
| `GET` | `/api/corpus?address=X` | Precomputed report from corpus (404 if absent) |
| `POST` | `/api/anomalies` | `Anomaly[]` from permit, complaint, amenity, and score data |
| `POST` | `/api/forecast` | `Trend[]` from historical series |
| `POST` | `/api/whatif` | `ScenarioResult` from current breakdown + scenario ID |
| `POST` | `/api/chat` | AI chat answer + model used |
| `POST` | `/api/recommend` | AI recommendations + thinking trace |

---

## Configuration

### Environment Variables

| Variable | Required | Default | Purpose |
|----------|:--------:|---------|---------|
| `OLLAMA_API_KEY` | no | — | Bearer token for Ollama Cloud chat |
| `OLLAMA_BASE_URL` | no | `https://ollama.com` | Ollama endpoint. Use `http://localhost:11434` for local |
| `OLLAMA_MODEL` | no | `gpt-oss:20b` | Model name |
| `CENSUS_KEY` | no | — | US Census ACS 5-year API key |
| `OPENWEATHER_KEY` | no | — | OpenWeatherMap API key |
| `TORONTO_311_RESOURCE_ID` | no | — | Live CKAN resource ID (otherwise uses bundled static file) |
| `PORT` | no | `3000` | Dev server port |

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Self-pid-safe dev runner on :3000 |
| `npm run dev:3030` | Dev runner on :3030 |
| `npm run dev:clean` | Dev runner, force-clears `.next/` |
| `npm run build` | Production build (Turbopack) |
| `npm start` | Run production build |
| `npm test` | Run all vitest tests |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check (strict mode) |
| `npm run calibrate` | Re-capture Toronto benchmarks from live APIs |
| `npm run verify` | Spawn dev server, hit demo addresses, write verification corpus |
| `npm run regen:corpus` | Regenerate offline corpus from synthetic data (no network) |

---

## Customization

**Add a what-if scenario.** Edit `src/lib/engine/whatif.ts` and append to `SCENARIOS`:

```typescript
{ id: 'bike_lanes', name: 'New bike lanes', emoji: 'B',
  description: 'Protected lanes on main streets',
  impact: { transitScore: 10, greenSpace: 5 } }
```

**Add a verdict.** Edit `src/lib/engine/verdict.ts` and append to the `deriveVerdicts` rules.

**Adjust score weights.** Edit `weights` in `src/lib/config.ts`. Weights should sum to ≈1.0; the score renormalizes over present components.

**Change the map style.** Edit `STYLE_URL` in `src/components/MapView.tsx`. Default is CARTO dark-matter (free for non-commercial use).

**Tune anomaly thresholds.** Edit `ZSCORE_THRESHOLD` in `src/lib/engine/anomalies.ts`. Defaults: 1.8 warning, 3.0 critical.

---

## Engine Reference

**Score** (`src/lib/engine/score.ts`) — counts amenities + permits within a configurable radius, normalizes each component via `((actual - p10) / (p90 - p10)) × 100` against live Toronto benchmarks, then computes a presence-aware weighted total.

```typescript
weights: { amenityDensity: 0.18, transitScore: 0.18, foodAccess: 0.14,
           greenSpace: 0.10, development: 0.10, civicScore: 0.075,
           cultureScore: 0.075, recreationScore: 0.075, serviceScore: 0.075 }
```

Sum is 0.965 intentionally — components with no data are excluded and the total renormalizes over the present subset.

**Anomalies** (`src/lib/engine/anomalies.ts`) — 12+ signal sources scored with Poisson-approximation z-score `z = (current - baseline) / √baseline` against the citywide p50 baseline. Tagged with category: `gentrification`, `livability`, `quality-of-life`, `environment`.

**Forecast** (`src/lib/engine/forecast.ts`) — EWMA for short series (n = 3..5), OLS regression for longer series (n ≥ 6), with 1σ residual-based confidence bands at 6/12/24 month horizons. Hard-floored to never drop more than 30% from the current value.

**What-if** (`src/lib/engine/whatif.ts`) — 6 scenarios. Each impact is a constant or function of the current breakdown. `composeScenarios` stacks multiple scenarios. Client-safe (no upstream deps).

**Verdict** (`src/lib/engine/verdict.ts`) — 11 plain-language verdicts generated by rules over the breakdown + anomalies. Each has a `key`, `label`, `short`, `emoji`, and data-backed `reason`.

---

## Testing

151 tests across 17 files. Runs against in-memory data only — no network, ~400 ms, deterministic.

```bash
npm test
```

End-to-end verification: `npm run regen:corpus` regenerates 10 singles + 4 compares into `public/data/corpus/`.

---

## Tech Stack

| Package | Version | Role |
|---------|---------|------|
| `next` | 16.2.9 | React framework, App Router, Turbopack |
| `react` | 19.2.7 | UI runtime |
| `typescript` | ^5 | Strict type safety |
| `tailwindcss` | ^4 | Styling, dark tokens |
| `maplibre-gl` | ^5.0.0 | Map rendering (no API key required) |
| `recharts` | ^3.9.0 | Forecast chart |
| `vitest` | ^4.1.9 | Test runner |
| `playwright` | ^1.61.1 | E2E screenshots |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Port 3000 in use | `Get-Process -Name node \| Stop-Process -Force` (Windows) or `lsof -ti :3000 \| xargs -r kill -9` (macOS/Linux) |
| Dev server returns 500 on `/` | `npm run dev:clean` or use `npm run build && npm start` |
| 311 section empty | Set `TORONTO_311_RESOURCE_ID` for live data, or use `[CORPUS]` mode |
| AI chat returns "not configured" | Add `OLLAMA_API_KEY` in `.env.local` or the Settings panel |
| Census section missing | US-only, requires `CENSUS_KEY`. Bbox FIPS covers ~20 major metros |
| Map shows blank gray tile | MapLibre needs network access. Report still renders without it |

---

## Project Structure

```
├── public/data/
│   ├── toronto-311.json              # Static citywide records
│   └── corpus/                        # Precomputed demo reports (committed)
├── src/
│   ├── app/
│   │   ├── api/                       # 8 API routes (report, compare, corpus, anomalies, forecast, whatif, chat, recommend)
│   │   ├── page.tsx                   # Main page, single + compare modes, URL rehydration
│   │   └── globals.css                # Tailwind 4 + dark tokens
│   ├── components/                    # 20 React components
│   ├── hooks/                         # 4 custom hooks (clock, report state, compare state, what-if state)
│   └── lib/
│       ├── api/                       # Data fetchers (7 modules)
│       ├── engine/                    # Pure analysis engines (score, anomalies, forecast, whatif, verdict, ...)
│       ├── utils/                     # geo, cache, amenity, share
│       └── config.ts                  # weights, mirrors, radii, cache TTLs
├── tests/                             # 17 files, 151 tests
├── scripts/                           # Dev runner, calibrate, verify, corpus regen
├── .env.example
├── next.config.ts
└── tsconfig.json                      # strict mode
```

---

## Contributing

1. Open an issue to discuss the change before submitting a PR.
2. Ensure `npm run lint` and `npm test` pass.
3. New features should include tests. The test suite runs in-memory — no setup required.
4. Keep the score engine pure: no side effects, no I/O.
5. PRs that break the corpus demo format should update `scripts/regen-corpus.mjs`.

---

## License

All rights reserved.
