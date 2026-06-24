# Neighborhood Now

> **Type an address. See what's happening. Know where it's going.**

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org) [![React 19](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org) [![MapLibre](https://img.shields.io/badge/MapLibre_GL-5-1a73e8)](https://maplibre.org)

## 🔗 Quick links

| | | |
|---|---|---|
| 🚀 **[Live demo](#demo)** | 📺 **[2-min video](#demo)** | 🏆 **[Devpost](#demo)** |
| ⚡ **[Quick start](#quick-start)** | 🏗️ **[Architecture](#architecture)** | ⭐ **[GitHub repo](https://github.com/monke-sniper/neighborhood-now)** |
| 🧪 **[Try these addresses](#demo)** | 🎨 **[Customize it](#customization)** | 🩹 **[Troubleshooting](#troubleshooting)** |

---

## 👋 Hi, this is Neighborhood Now

We built this in 48 hours for **FutureHacks 2026** to answer one deceptively simple question: *what's this neighborhood becoming?*

Not what it looks like right now (Google Maps can do that). Not what it scored last year (Walk Score can do that). **Where it's heading.** The thing nobody tells you.

So we wired up the open data — building permits, 311 complaints, OpenStreetMap amenities — and bolted on three things nobody else has:

- 🔍 **Anomaly detection** that flags what's *changing* (z-score statistics, no hand-waving)
- 📈 **A 2-year forecast** drawn from real history (linear regression, with honest confidence bands)
- 🧪 **What-if simulations** so you can ask "what would a subway station do to this score?" and get a number back

Type an address. The future is in there somewhere.

---

## What it does

- 🟢 **Livability score** — a 0–100 rating across five dimensions: amenity density, transit access, food access, green space, and development activity
- 🚨 **Anomaly alerts** — statistical z-score flags spikes in permits or complaints against a rolling 6-month baseline. If a neighborhood is changing under your feet, you'll know
- 📈 **2-year forecast** — ordinary-least-squares regression on 12 months of history, extrapolated forward with R² confidence bands. The chart shows you whether the trend is real or noise
- 🧪 **What-if simulator** — toggle a new subway station, park, development, or grocery store and watch the score move. Useful for both city planners and curious neighbors
- 💬 **AI chat** — ask natural-language questions about the neighborhood, answered only from the data on the page (no hallucinated numbers)

---

## Demo

- 🌐 **Live URL:** _drop your deployed link here_
- 📺 **2-min demo video:** _drop your Devpost video link here_
- 🏆 **Devpost submission:** _drop your Devpost URL here_

### 🧪 Try these addresses (Toronto — pre-tuned for the demo)

- `123 Queen St W, Toronto`
- `CN Tower, Toronto`
- `Kensington Market, Toronto`
- `Scarborough Town Centre, Toronto`

The app works globally — type any address on Earth and you'll get a report. The demo addresses are just where the numbers look the most dramatic.

---

## 📸 Screenshots

Drop your screenshots/GIFs into a `docs/` folder and reference them here.

```
[screenshot: report view — map + score + amenity counts]
[screenshot: anomaly list with severity badges]
[screenshot: 2-year forecast chart]
```

---

## ⚡ Quick start

You'll need **Node.js 20.9 or newer** and **npm 10+**. That's it.

### 1. Get the code

```bash
git clone https://github.com/monke-sniper/neighborhood-now.git
cd neighborhood-now
npm install
```

### 2. Set up your environment (optional but recommended)

```bash
cp .env.example .env.local
```

Open `.env.local` in your editor and fill in any keys you have. **The app works with zero keys** — geocoding, OSM amenities, building permits, and 311 complaints all run from free public sources. Keys just unlock the optional features:

| Key | What it unlocks | Without it |
|---|---|---|
| `OLLAMA_API_KEY` | AI chat | Chat politely says "AI not configured" |
| `CENSUS_KEY` | US demographic data | Census section is skipped |
| `OPENWEATHER_KEY` | Air quality (PM2.5) | Air section is skipped |

**Where to get the keys (all free, all under 2 minutes):**
- 🤖 **Ollama Cloud** → https://ollama.com/settings/keys
- 🇺🇸 **US Census** → https://api.census.gov/data/key_signup.html
- 🌤️ **OpenWeather** → https://openweathermap.org/api

### 3. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Type an address. You should see the report load in about 5 seconds. 🎉

### 4. Ship it to production

```bash
npm run build
npm start
```

That's it. Drop the `.next/` output on any Node host (Vercel, Railway, Fly.io, your own box).

---

## 🔐 Environment variables

| Variable | Required? | Default | What it does |
|---|:---:|---|---|
| `OLLAMA_API_KEY` | optional | _(empty)_ | Bearer token for the Ollama Cloud chat API |
| `OLLAMA_BASE_URL` | optional | `https://ollama.com` | Ollama endpoint — swap to `http://localhost:11434` for local Ollama |
| `OLLAMA_MODEL` | optional | `gpt-oss:20b` | Model name. Try `gpt-oss:20b` (balanced) or `llama3.2:3b` (lighter) |
| `CENSUS_KEY` | optional | _(empty)_ | US Census ACS 5-year API key (US addresses only) |
| `OPENWEATHER_KEY` | optional | _(empty)_ | OpenWeatherMap key (air quality) |
| `PORT` | optional | `3000` | Dev server port |

**About the map:** No key required. MapLibre GL renders the CARTO dark-matter basemap, which is free for non-commercial use. If CARTO ever blocks you, swap the style URL (see [Customization](#customization)).

---

## 🛠️ Available scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server with hot reload on `:3000` |
| `npm run build` | Production build (Turbopack) — exits cleanly when done |
| `npm start` | Run the production build you just made |
| `npm run lint` | Run ESLint with the Next.js config |
| `npm run typecheck` | Run `tsc --noEmit` (strict mode) — should always be clean |

---

## 🏗️ Architecture

Here's what happens when you type an address and hit Analyze:

```
address string
   │
   ▼
[ Nominatim ] ──► {lat, lon, display_name}      (1 req/sec, cached 24h)
   │
   ├──► [ Overpass ]    ──► amenities, transit, landuse     (live, radius 1.5km)
   ├──► [ BuildData ]   ──► permits[] (filtered by 500m)   (live, cached 1h)
   ├──► [ 311 File ]    ──► complaints[]                    (file snapshot, 1.5km)
   ├──► [ Census ]      ──► demographics                    (US only, optional)
   └──► [ OpenWeather ] ──► air quality                     (optional)
   │
   ▼
[ score engine ]       ──► LivabilityScore (0–100, 5 components)
[ anomalies engine ]   ──► Anomaly[]   (z-score, |z|>2 warn, |z|>3 critical)
[ forecast engine ]    ──► Trend[]     (OLS regression, R² confidence)
[ whatif engine ]      ──► ScenarioResult[] (toggleable, client-side deltas)
   │
   ▼
UI: Map | ReportCard | AnomalyList | ForecastChart | WhatIfSimulator | ChatBox
```

The orchestrator (`/api/report`) uses `Promise.allSettled` so a single broken upstream never kills the whole report. If Census is down, you still get the OSM, permits, and 311 data.

---

## 📁 Project structure

```
.
├── data/
│   └── toronto-311.json            # 44-record snapshot — edit to refresh
├── public/                         # static assets
├── src/
│   ├── app/
│   │   ├── api/                    # 5 route handlers
│   │   │   ├── report/route.ts     # GET  /api/report?address=X
│   │   │   ├── anomalies/route.ts  # POST /api/anomalies
│   │   │   ├── forecast/route.ts   # POST /api/forecast
│   │   │   ├── whatif/route.ts     # POST /api/whatif
│   │   │   └── chat/route.ts       # POST /api/chat
│   │   ├── layout.tsx              # root layout, dark theme
│   │   ├── page.tsx                # main page, holds report state
│   │   └── globals.css             # Tailwind 4 + dark tokens
│   ├── components/                 # 7 UI components
│   │   ├── AddressInput.tsx
│   │   ├── MapView.tsx             # MapLibre GL
│   │   ├── ReportCard.tsx
│   │   ├── AnomalyList.tsx
│   │   ├── ForecastChart.tsx       # Recharts
│   │   ├── WhatIfSimulator.tsx
│   │   └── ChatBox.tsx
│   └── lib/
│       ├── api/                    # 6 data fetchers
│       ├── engine/                 # 4 analysis engines
│       ├── utils/                  # geo + cache helpers
│       ├── config.ts
│       └── types.ts
├── .env.example
├── next.config.ts
├── package.json
└── tsconfig.json                   # strict mode
```

---

## 🛠️ API endpoints

| Method | Path | Purpose | Example |
|---|---|---|---|
| `GET` | `/api/report` | Full neighborhood report (the orchestrator) | `/api/report?address=CN+Tower+Toronto` |
| `POST` | `/api/anomalies` | Detect anomalies from signals | `{ "signals": [{ "name": "permits", "current": 7, "baseline": 2.1, "unit": "permits" }] }` |
| `POST` | `/api/forecast` | Forecast from history | `{ "series": [{ "name": "permits", "history": [1,2,3,4,5,6] }] }` |
| `POST` | `/api/whatif` | Simulate a scenario | `{ "current": { ... }, "scenarioId": "subway" }` |
| `POST` | `/api/chat` | AI chat over the report | `{ "question": "Is this good for families?", "report": { ... } }` |

All POST endpoints expect JSON. All endpoints return JSON. The orchestrator uses `Promise.allSettled` so partial upstream failures degrade gracefully.

---

## 🧠 How the engines work

**Score** (`src/lib/engine/score.ts`) — counts amenities, transit stops, and grocery stores in a 1.5 km radius, normalizes each to 0–100 against Toronto baselines, and computes a weighted average using weights from `src/lib/config.ts` (amenity 25%, transit 25%, food 20%, green 15%, development 15%).

**Anomalies** (`src/lib/engine/anomalies.ts`) — Poisson-approximation z-score: `z = (current - baseline) / √baseline`. |z| > 2 → warning, |z| > 3 → critical. Info-level signals are dropped, results sorted by |z| descending. The math is in the file, it's about 20 lines.

**Forecast** (`src/lib/engine/forecast.ts`) — ordinary-least-squares linear regression on the 12-month history. R² drives the confidence bucket: > 0.7 high, > 0.4 medium, else low. Requires at least 3 months of data; otherwise returns the current value with `confidence: 'low'`.

**What-if** (`src/lib/engine/whatif.ts`) — 4 hard-coded scenarios (subway, park, development, grocery), each with a `Partial<ScoreBreakdown>` impact. The simulator applies the impact (clamped 0–100) and re-runs the weighted total. Runs client-side — no network round-trip, instant feedback.

---

## 🎨 Customization

**Add a what-if scenario.** Open `src/lib/engine/whatif.ts` and append:
```typescript
{ id: 'bike_lanes', name: 'New bike lanes', emoji: '🚴',
  description: 'Protected lanes on main streets',
  impact: { transitScore: 10, greenSpace: 5 } }
```
Save. Refresh. Your new card is in the simulator.

**Change the score weights.** Open `src/lib/config.ts`:
```typescript
weights: { amenityDensity: 0.25, transitScore: 0.25, foodAccess: 0.20,
           greenSpace: 0.15, development: 0.15 }
```
If you live in a transit desert, bump `transitScore` up. If you care more about food access, bump `foodAccess`. The total is a weighted average, so the weights should sum to 1.0.

**Swap the map style.** Edit `STYLE_URL` in `src/components/MapView.tsx`. Some free options:
- `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json` (default — dark)
- `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json` (CARTO light)
- `https://tiles.openfreemap.org/styles/positron` (OpenFreeMap light)
- `https://demotiles.maplibre.org/style.json` (MapLibre demo — works offline, ugly)

**Refresh the 311 dataset.** Replace `data/toronto-311.json` with new records. Same shape: `{ id, type, date, lat, lon, status }`. Keep it under ~5 MB for snappy filtering.

---

## 🩹 Troubleshooting

**The dev server says port 3000 is already in use.**
Another Next.js (or Node) process is squatting on the port. Kill it: `npx kill-port 3000` on macOS/Linux, or `Stop-Process -Name node -Force` on Windows. Then `npm run dev` again. The script doesn't auto-pick a different port because surprises are bad.

**The 311 complaints section shows 0 complaints.**
That's expected outside Toronto. The 311 data is a static file snapshot (`data/toronto-311.json`) covering downtown Toronto. To extend coverage, download a snapshot for your area and replace the file (see [Customization](#customization)).

**AI chat says "AI not configured".**
You didn't set `OLLAMA_API_KEY` in `.env.local`. Get one at https://ollama.com/settings/keys, paste it in, restart the dev server.

**Chat returns 401 or "model not found".**
Two common causes: (1) the model name in `.env.local` doesn't match one you have access to on Ollama Cloud — try `gpt-oss:20b` (default, free tier); (2) your key is from a different account than the model was provisioned to.

**The Census section is hidden.**
Census only runs for US coordinates. If you're in Toronto, it gets skipped (correctly). To test, type a US address like `Times Square, New York` — but you'll also need a valid `CENSUS_KEY`.

**The map shows a gray rectangle.**
MapLibre needs internet to fetch the CARTO style and tiles. Check your network and the browser console for CORS or 404 errors. The app will not crash if the map fails — the rest of the report still renders.

**`npm run typecheck` is angry.**
Run `npx tsc --noEmit --pretty` to see the exact line numbers. Everything in this repo is strict — missing types, implicit `any`, unused locals all fail. That's a feature, not a bug.

**BuildData API is slow or rate-limiting.**
The BuildData cache is 1 hour. If you're hammering it, requests will queue. If it goes down entirely, the report still works — permits are just skipped, and OSM construction tags fill in the gap.

---

## ⚠️ Known limitations

We're being honest about these:

- **311 data is a static file** (44 records, Toronto). For other cities or live data, replace `data/toronto-311.json` or wire a real API endpoint in `src/lib/api/complaints.ts`.
- **Forecast needs 3+ months of history.** Fewer than that and you get the current value back with low confidence. That's the honest answer when there's not enough data.
- **Ollama Cloud has free-tier rate limits.** Heavy demo traffic can hit 429. For unlimited, switch to local Ollama by setting `OLLAMA_BASE_URL=http://localhost:11434` and running `ollama serve` with the model pulled.
- **Score baselines are tuned for Toronto.** Other cities will score lower until you adjust the constants in `src/lib/engine/score.ts`. We left them magic-numbered for transparency — change them, see what happens.
- **No mobile optimization.** The layout is desktop-first. It'll work on mobile, but it's not pretty. Resize the browser to verify on your target device before submitting.

---

## 📦 Tech stack

| Package | Version | Role |
|---|---|---|
| `next` | 16.2.9 | React framework, App Router, Turbopack, route handlers |
| `react` | 19.2.4 | UI runtime |
| `typescript` | ^5 | Strict mode (`strict: true`) |
| `tailwindcss` | ^4 | Styling, `@theme` dark tokens |
| `maplibre-gl` | ^5.0.0 | Map rendering (no API key, no quota) |
| `recharts` | ^3.9.0 | Forecast line chart |
| `eslint` | ^9 | Linting with `eslint-config-next` |

Data sources: OpenStreetMap (Overpass + Nominatim), BuildData.ca (Toronto permits), Toronto 311 (file snapshot), US Census ACS, OpenWeatherMap air pollution, Ollama Cloud (gpt-oss:20b). All free tiers.

---

## 🙏 Acknowledgements

This thing is stitched together from a lot of generous open data. Thank you to:

- **OpenStreetMap** contributors — for the global amenity dataset
- **BuildData.ca** — for Toronto building permit exports
- **City of Toronto** — for the 311 service request data
- **CARTO** — for the free dark-matter basemap style
- **Ollama** — for the local + cloud LLM runtime
- **US Census Bureau** — for the American Community Survey
- **OpenWeather** — for the air-quality API

And to the FutureHacks 2026 organizers for the push.

---

© 2026 — All rights reserved.
