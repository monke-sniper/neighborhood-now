# Security Policy

## Supported versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Email **security@neighborhood.now** (or DM the maintainer on the contact listed
in `package.json` / `README.md`) with:

1. A short description of the vulnerability.
2. A reproduction (PoC, screenshot, or curl trace).
3. The impact you believe it has.

We aim to acknowledge within 2 business days and to ship a fix or mitigation
within 14 days, depending on severity and complexity. We follow responsible
disclosure: we ask that you give us a reasonable window before publishing
details.

## What this app does and does not collect

- **No server-side telemetry.** There are no analytics SDKs, no Sentry, no
  Datadog. Logs go to stdout/stderr and are Vercel function logs in production.
- **No server-side API keys.** Every third-party key (Ollama, US Census,
  OpenWeather) is supplied by the user in the in-app Settings panel and stored
  in `localStorage` as `nn:keys:v1`. The server reads them from request
  headers per call.
- **No persistent user data.** Reports are computed on demand and cached for 5
  minutes in module memory. Nothing is written to a database.

## Threat model (out of scope)

- Compromise of the user's own browser or device (a malicious browser extension
  can read `localStorage`).
- Compromise of a user's Ollama / Census / OpenWeather account — the user
  supplies those keys directly.
- A malicious address string designed to crash the Overpass query — the route
  has a hard 9.5s deadline that drops to corpus fallback.
