# Next.js 16 notes — deferral of `cacheComponents` and `unstable_instant`

This project runs on **Next.js 16.2.9**. As of that release there are two opt-in
features that are relevant to us. After reading the in-tree docs at
`node_modules/next/dist/docs/01-app/...`, we have **deliberately not enabled
either** yet. This file documents why and what the migration path looks like
when we do.

## TL;DR

| Feature | Enabled? | Why |
|---|---|---|
| `experimental.cacheComponents` | ❌ | The 8 API routes use `export const dynamic = 'force-dynamic'`. With `cacheComponents`, that segment config is **removed** in favor of `use cache` + `cacheLife`. The app has no inter-route navigation, so the benefit is zero and the migration is a 4-hour refactor. |
| `unstable_instant` | ❌ | Per the docs, `unstable_instant` **cannot be used in Client Components** (`src/app/page.tsx` is `'use client'`). The only server-rendered file is `src/app/layout.tsx`, which has no useful work to do. |

## What `cacheComponents` actually buys us

From the in-tree docs:

> When `cacheComponents` is enabled, route segment configs like `dynamic`,
> `revalidate`, and `fetchCache` are replaced by `use cache` and `cacheLife`.

In practice this is **Partial Prerendering (PPR) by default** plus the React
`<Activity>` component for state preservation during client-side navigation.
This is huge for multi-route apps with mixed static/dynamic content.

For `Neighborhood Now`:
- The entire UI is one page (`src/app/page.tsx`).
- All data fetching happens **client-side** via the `/api/*` routes.
- There are no inter-route navigations to make instant.

So PPR's static shell is exactly the `<header>` and the empty `<div>` that
already renders instantly. Enabling `cacheComponents` would not measurably
improve time-to-first-byte or time-to-interactive for this app.

## What `unstable_instant` actually buys us

From the in-tree docs:

> The `unstable_instant` route segment config opts a route into validation for
> instant client-side navigations.

This is a build-time validator that fails the build if a `<Suspense>` boundary
would block navigation. There are no navigations to make instant in this app,
so adding the export would be theater.

The docs are also explicit that `unstable_instant` throws in Client Components
— the page would refuse to build.

## When to revisit

Re-evaluate when **any** of the following become true:

1. A second page is added (e.g. `/corpus/[address]`, `/about`, `/methodology`).
2. We want to add `loading.tsx` boundaries that prefetch the static shell.
3. The `/api/report` route's average latency exceeds 500ms and we want the
   HTML shell to be served from the edge cache while data streams in.
4. Upstash KV or Vercel KV is added and we want to cache upstream responses
   with `'use cache: remote'`.

## Migration checklist (when we do)

- [ ] Add `experimental: { cacheComponents: true }` to `next.config.ts`.
- [ ] In every route under `src/app/api/*/route.ts`, **remove** `export const
      dynamic = 'force-dynamic'`. Replace with a top-level `use cache` directive
      if and only if the response can be safely cached.
- [ ] Add `export const unstable_instant = { prefetch: 'static' }` to
      `src/app/layout.tsx` (server component, valid location).
- [ ] Wrap any `usePathname` / `useSearchParams` calls in `<Suspense>`.
- [ ] Set a `cacheLife` profile for the corpus and report routes.
- [ ] Audit headers (`X-Census-Key`, etc.) — `use cache` is sensitive to
      request headers, so per-key cache partitions need to be defined.
