# OpenCode Build Instructions

You are implementing the **Neighborhood Now** project for FutureHacks 2026.

## Source of Truth

Read these two files first and follow them exactly:
- `FUTUREHACKS.md` — full PR document (architecture, APIs, code, UI spec)
- `PLAN.md` — implementation plan (file order, dependencies, types, functions)

## Tokens & API Keys

If you need any of these, ASK the user before proceeding:
- **OpenAI key** — needed for chat route (or skip and stub it)
- **Ollama** — if using Ollama Cloud, ask for the endpoint URL
- **Census key** — optional, US only
- **OpenWeather key** — optional, air quality data

## Map Library

Do NOT use Mapbox GL — it requires a credit card. Use **MapLibre GL JS** instead:
- `npm install maplibre-gl`
- Import: `import maplibregl from 'maplibre-gl'`
- Import CSS: `import 'maplibre-gl/dist/maplibre-gl.css'`
- Free tiles: `https://tiles.openfreemap.org/styles/liberty` (no key needed)
- Constructor: `new maplibregl.Map({ container, style: 'https://tiles.openfreemap.org/styles/liberty', center, zoom })`
- Drop-in replacement for Mapbox GL — same API surface
- Markers, popups, navigation controls all work the same way

## Build Order

Follow PLAN.md block order exactly. Each block must typecheck before starting the next.

### Block 0 — Read Next.js 16 docs
Read `node_modules/next/dist/docs/` for route handlers, caching, server vs client components, env loading. Next.js 16 has breaking changes from older versions.

### Block 1 — Types & Config (DONE)
Files created: `src/lib/types.ts`, `src/lib/config.ts`, `src/lib/utils/geo.ts`, `src/lib/utils/cache.ts`

### Block 2 — Data Fetchers
Create `src/lib/api/` directory with:
1. `nominatim.ts` — geocoding, TTL cache, 1 req/sec rate limit
2. `overpass.ts` — OSM amenities/buildings/transit/landuse via POST
3. `builddata.ts` — Toronto permits, cache 1hr, filter by 500m
4. `complaints.ts` — Toronto 311 from `https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search`. Pass `resource_id` as param. Filter by distance from center. Return [] on failure.
5. `census.ts` — US demographics, return null if no key
6. `weather.ts` — OpenWeatherMap, return null if no key

Use types from Block 1. Run `npx tsc --noEmit` after each file.

### Block 3 — Analysis Engines
Create `src/lib/engine/` with:
1. `score.ts` — computeBreakdown() + computeTotal(), normalize against Toronto baselines
2. `anomalies.ts` — z-score detection, |z|>3 critical, |z|>2 warning
3. `forecast.ts` — OLS linear regression, R² confidence, require n>=3
4. `whatif.ts` — 4 scenarios (subway, park, development, grocery), simulateWhatIf()

Run `npx tsc --noEmit` after each file.

### Block 4 — API Routes
Create `src/app/api/` with:
1. `report/route.ts` — GET orchestrator: geocode → parallel fetch → score → anomalies → forecast → cache → respond
2. `anomalies/route.ts` — POST, returns Anomaly[]
3. `forecast/route.ts` — POST, returns Trend
4. `whatif/route.ts` — POST, returns ScenarioResult
5. `chat/route.ts` — POST, stub for now (return "AI not configured")

Read Next.js 16 route handler docs first. Run `npx tsc --noEmit` after each file.

### Block 5 — UI Components
Create `src/components/` with:
1. `AddressInput.tsx` — 'use client', search bar, calls /api/report
2. `MapView.tsx` — 'use client', MapLibre GL (NOT mapbox-gl), pin + permit markers. Use free OpenFreeMap tiles.
3. `ReportCard.tsx` — server, score display + amenity counts
4. `AnomalyList.tsx` — server, severity badges + messages
5. `ForecastChart.tsx` — 'use client', Recharts line chart
6. `WhatIfSimulator.tsx` — 'use client', toggle cards, client-side delta calc
7. `ChatBox.tsx` — 'use client', text input + messages, POST to /api/chat

Run `npx tsc --noEmit` after each file.

### Block 6 — Pages & Layout
Replace defaults:
1. `src/app/layout.tsx` — dark theme, Inter font, globals.css import
2. `src/app/globals.css` — Tailwind 4 (@import "tailwindcss"), dark tokens
3. `src/app/page.tsx` — 'use client', holds report state, renders all components
4. `.env.local` — no map token needed (MapLibre uses free tiles). Add COMPLAINTS_URL=https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search and COMPLAINTS_RESOURCE_ID=<uuid from open.toronto.ca>

### Final Check
1. `npx tsc --noEmit` — must be clean
2. `npx next build` — must succeed
3. `npx next dev` — must start without errors
4. List all files with line counts

## Rules
- No comments unless asked
- TypeScript strict mode (already configured)
- Each file must typecheck before moving to the next
- If an API is unavailable, return null or [] gracefully — never crash
- MapLibre GL only — no Mapbox, no API keys for maps
- Free tiles from openfreemap.org — no token needed
- Chat: stub it, don't block on AI provider decision
