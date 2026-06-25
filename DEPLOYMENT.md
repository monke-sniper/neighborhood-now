# Deployment Guide

This guide covers deploying **Neighborhood Now** to Vercel. The app is designed for zero-config deployment with **no server-side API keys required** — every user provides their own keys via the in-app Settings panel.

## Table of contents

- [One-click deploy](#one-click-deploy)
- [Manual deploy](#manual-deploy)
- [API key safety model](#api-key-safety-model)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Production checklist](#production-checklist)

## One-click deploy

The fastest way to deploy. Click the button, accept the defaults, and you're done.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmonke-sniper%2Fneighborhood-now)

The deploy wizard will:
1. Fork the repo into your GitHub account
2. Create a new Vercel project pointing at the fork
3. Build with the default settings — **no environment variables required**
4. Issue a `*.vercel.app` URL in ~90 seconds

After deployment, visit the URL and click the `[ SETTINGS // API KEYS ]` panel in the header to add your Ollama key (and optional Census / OpenWeather keys). Everything else works out of the box.

## Manual deploy

If you want to deploy from your own fork or branch:

1. **Push your fork to GitHub.**
2. **Sign in to [vercel.com](https://vercel.com)** with the same GitHub account.
3. Click **Add New → Project**.
4. Select the `neighborhood-now` repository.
5. Vercel auto-detects Next.js — leave the framework preset as **Next.js**.
6. **Environment Variables section: leave empty.** Do not add any keys here.
7. Click **Deploy**. The build takes ~60–90 seconds.
8. Click **Visit** when the deployment completes.

### Connecting a custom domain

1. In the Vercel dashboard, open your project.
2. Go to **Settings → Domains**.
3. Enter your domain (e.g. `neighborhood.example.com`).
4. Follow Vercel's DNS instructions. SSL is automatic.

## API key safety model

**The application ships with no API keys.** Every optional integration that requires a key (Ollama, US Census, OpenWeather) is supplied by the end user at request time, never by the server operator.

### How it works

```
┌────────────┐  X-Ollama-Key   ┌────────────┐  Bearer <key>   ┌──────────┐
│  Browser   │ ───────────────►│  Vercel    │ ───────────────►│  Ollama  │
│ localStorage│  (per request)  │  Function  │  (per request)  │   API    │
└────────────┘                  └────────────┘                  └──────────┘
```

- Keys live in `localStorage` under the namespace `nn:keys:v1`. They are never sent to the server except as `X-Ollama-Key`, `X-Census-Key`, or `X-Weather-Key` request headers.
- The server reads each header, uses the value for **that one upstream API call**, then discards it. No persistence, no logging, no caching.
- Vercel function logs only show the request method, URL, status, and duration. They do not include request headers.
- The Vercel project has **no environment variables** for any of these keys. The deployer (you) cannot leak what they do not have.

### What is on the server

| Variable | Set on Vercel? | Purpose |
|---|:---:|---|
| `OLLAMA_API_KEY` | **No** | Per-user, sent via `X-Ollama-Key` |
| `OLLAMA_BASE_URL` | No | Per-user, sent via `X-Ollama-Base` (default `https://ollama.com`) |
| `OLLAMA_MODEL` | No | Per-user, sent via `X-Ollama-Model` (default `gpt-oss:20b`) |
| `CENSUS_KEY` | **No** | Per-user, sent via `X-Census-Key` (US addresses only) |
| `OPENWEATHER_KEY` | **No** | Per-user, sent via `X-Weather-Key` |

If you set none of these in Vercel, the deployed app works for everything except the AI chat (which prompts the user to add a key) and the optional US Census and air-quality layers.

### How to add a key as a user

1. Open the deployed site.
2. Click the `[ SETTINGS // API KEYS ]` panel in the header.
3. Paste an Ollama API key (get one at [ollama.com/settings/keys](https://ollama.com/settings/keys)).
4. Optionally fill in Census and OpenWeather keys.
5. Click `[ SAVE ]`. The keys are stored in your browser only.
6. AI chat, recommendations, and the optional layers now work for you.

Clearing your browser data, switching browsers, or using a different device requires re-entering the keys — by design.

## Configuration

All configuration is in `src/lib/config.ts` and `vercel.json`.

### `vercel.json`

| Setting | Value | Reason |
|---|---|---|
| `functions.*.maxDuration` | 10 s | Vercel Hobby plan caps serverless functions at 10 s. The AI chat responds in 3–6 s for typical prompts, so this fits. |
| `headers.X-Content-Type-Options` | `nosniff` | Prevent MIME-sniffing attacks. |
| `headers.X-Frame-Options` | `DENY` | Prevent clickjacking via iframe embedding. |
| `headers.Referrer-Policy` | `strict-origin-when-cross-origin` | Tighten referrer leakage. |
| `headers.Permissions-Policy` | geolocation, mic, camera disabled | The app uses no browser sensors. |

### `src/lib/config.ts`

| Setting | Default | Notes |
|---|---|---|
| `overpass.defaultRadius` | 3000 m | 3 km search radius. |
| `overpass.allowedRadii` | `[1000, 2000, 3000, 5000]` | User-selectable in the UI. |
| `overpass.timeoutSec` | 25 s | Per Overpass mirror. |
| `cache.reportTtlMs` | 5 min | In-process; does not persist across cold starts. |

## Troubleshooting

### The AI chat shows "AI not configured"

This is the expected message when no key is set. Click the Settings panel in the header and add your Ollama key.

### "FUNCTION_INVOCATION_TIMEOUT" or 504 errors

The serverless function exceeded the 10 s Hobby plan limit. Two options:
1. **Reduce the Ollama model** in the Settings panel to a smaller model (e.g. `llama3.2:3b` instead of `gpt-oss:20b`).
2. **Upgrade to Vercel Pro** ($20/mo) and bump `maxDuration` in `vercel.json` to 60.

### "Cannot find module 'fs'" or "build failed"

This is from the `src/lib/api/complaints.ts` module. It should use `fetch('/data/toronto-311.json')`, not `fs.readFile`. Verify the file is at `public/data/toronto-311.json`.

### "Overpass rate limit" or 429 errors

The public Overpass API limits anonymous requests. Three mirrors are configured with automatic fallback. If all three fail, the request returns `sources.overpass = 'failed'`. Mitigation:
- Wait a few minutes and retry.
- Set up a self-hosted Overpass instance and update `CONFIG.overpass.url`.
- The app degrades gracefully: failed Overpass means the score uses prior data.

### The 311 layer shows zero complaints

The 311 file (`public/data/toronto-311.json`) contains 44 records covering downtown Toronto. Outside that area, the count is zero. Replace the file to extend coverage.

### Score looks wrong for a non-3km radius

Benchmarks were calibrated at 1.5 km. For other radii, the score engine scales benchmarks by area ratio `(radius/1500)²`. Percentile ranking is preserved but absolute values are approximate. Run `npm run calibrate` locally to re-capture at 3 km, then commit the updated `src/lib/engine/benchmarks.ts`.

### Map shows a blank rectangle

MapLibre needs network access to fetch the CARTO basemap. Verify the browser can reach `https://basemaps.cartocdn.com/`. The app does not crash if the map fails; the rest of the report still renders.

## Production checklist

Before sharing your deployment with users:

- [ ] Visit the deployed URL and confirm the report loads for `CN Tower, Toronto`
- [ ] Click Settings, add an Ollama key, send a chat message, confirm the response
- [ ] In Vercel dashboard, open **Logs** and confirm no `X-Ollama-Key` appears in any log line
- [ ] Run `git log -p --all -- '*.env*'` locally to confirm no key ever landed in git
- [ ] Test from a mobile device — the layout is responsive
- [ ] If using a custom domain, confirm SSL is active (https, padlock icon)
- [ ] (Optional) Add a `robots.txt` and `sitemap.xml` for SEO

## Rollback

Vercel keeps the last 30 deployments. To roll back:

1. Vercel dashboard → Project → Deployments
2. Find the last known-good deployment
3. Click the three-dot menu → **Promote to Production**

Or, to roll back in code:

```bash
git checkout v1.0-stable
vercel --prod
```

## Local production build

To verify the build works the same way Vercel builds it:

```bash
npm run build
npm start
```

The output is a standard Next.js Node.js build that runs on any Node 20.9+ host.
