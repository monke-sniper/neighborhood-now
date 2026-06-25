# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-25

### Added
- Production hardening pass.
- `/api/health` endpoint with uptime, build SHA, and corpus count.
- `LRU-bounded TTLCache` (max 200 entries) for `/api/report` and `/api/compare`.
- 62 new unit and integration tests across hooks, components, and API routes.
  Coverage: lines 70% → 79%, functions 62% → 72%.
- `docs/NEXT-16-NOTES.md` documenting deferral of `cacheComponents` and
  `unstable_instant` (see file for rationale).
- `.github/dependabot.yml` (weekly, grouped, with majors excluded from
  auto-merge).
- `.github/CODEOWNERS`, `pull_request_template.md`, `ISSUE_TEMPLATE/*.yml`.
- `SECURITY.md` with disclosure policy and threat model.
- `CHANGELOG.md` (this file).

### Changed
- `vercel.json`: added `Strict-Transport-Security`, `Content-Security-Policy`,
  `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, and
  `X-DNS-Prefetch-Control` headers. Bumped `chat` and `recommend`
  `maxDuration` from 10s to 30s.
- `.gitignore`: `coverage/` is now ignored (was never tracked, but ESLint
  picked up a stale `coverage/block-navigation.js`).
- `eslint.config.mjs`: added `coverage/**` to `globalIgnores`.
- `vitest.config.ts`: now also discovers `tests/**/*.test.tsx` (component
  tests) and uses `happy-dom` for files with a `// @vitest-environment
  happy-dom` comment.

### Fixed
- 8 ESLint warnings resolved (3 unused symbols, 5 `react-hooks/exhaustive-deps`
  by refactoring `MapView` and `CompareMap` to a `useLatest` ref pattern).

### Removed
- Unused: `NeighborhoodReport` import in `NewsTicker.tsx`,
  `ringPolygon` in `ScoreRadar.tsx`, `fmtAnomalySignal` in `verdict.ts`,
  and the now-unused `Anomaly` import in `verdict.ts`.

## Earlier history

See `git log` for the pre-1.0 hackathon history (anomaly z-score fix,
corpus-backed demo mode, verdict pills, share URLs, compare map, news ticker,
self-pid-safe dev runner, offline corpus regen).
