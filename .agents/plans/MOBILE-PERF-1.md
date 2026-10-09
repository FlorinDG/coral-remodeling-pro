# MOBILE-PERF-1 — the white screen when the mobile office opens (synthesis, Planner 2026-10-09)

Florin: "open mobile app - wait 7 seconds in front of a white screen". Priority: secondary (Florin 2026-10-09). This
is the study; nothing is built yet.

## Why the screen is WHITE (not a skeleton)

`app/[locale]/m/loading.tsx` (the shimmer) sits INSIDE the `m/layout.tsx` segment. A loading file only covers the
segment's page, never its own layout. While `m/layout.tsx` awaits, nothing of `/m` streams, so the phone shows white
until the layout has finished every step below.

## What `m/layout.tsx` awaits, in order, on every open

1. `auth()` (JWT, cheap).
2. `tenant.findUnique` (about 50 columns).
3. `provisionLockedDatabases`: tenant read again + a `findMany` of the bound databases. About 2 queries on the
   healthy path.
4. `reconcileSystemSchemas`: a `findMany` of EVERY database with its full `properties` JSON, plus updates when
   needed. It is memoized per server instance, so it runs on every COLD start, and Vercel cold starts are frequent
   for a phone app opened a few times a day.
5. `getGlobalDatabases()`: `IS_LAZY_DATA_ENABLED` is `=== 'true'` (off unless the env sets it), so this is
   `findMany({ include: { pages: true } })`. That is **every database with every record, blocks included**. All of
   it is serialized into the page and sent to the phone, which parses it and hydrates it into the store.
6. `getGlobalPageIndex()`: a second pass over every record (id, title), plus users and the HR database.

All of this runs one after another. The dashboard page (`m/page.tsx`) then adds a tenant read and its own counts.
On the client: the root layout ships all message namespaces, and `GlobalDatabaseSyncer` waits for the IndexedDB
persist to finish before merging the server data. The office app (app.) has no service worker (only WorkHub
registers one), so every open is a full network load.

**Most likely cause:** step 5, on a cold start, with step 4. The cost grows with the tenant's data, and invoices and
quotes carry large `blocks` JSON. This is a reading of the code; it is not measured yet.

## What can be optimised, in order of gain ÷ effort

| # | Change | Gain | Effort | Note |
|---|---|---|---|---|
| 0 | **Measure first.** Server timing per step in `m/layout` (logged to Vercel), plus the RSC payload size of `/m`. | — | S | Confirms the ranking before anything is built. |
| 1 | **The shell first.** Move the data loading out of the layout into a streamed child (Suspense), so the header, the bottom bar and the shimmer render at once. | White → skeleton immediately | S–M | Perceived wait drops to about 1 s even before anything gets faster. |
| 2 | **No pages in the layout.** The mobile screens already read through `usePagesOf` (MOBILE-REACT-1), which asks for the pages it needs. Load schemas + index only (the lazy path). | Largest real gain: payload and DB time scale down from "everything" | M | This is R2-4's direction ("INDEX + WORKING SET", delete `IS_LAZY_DATA_ENABLED` rather than toggle it). Do it there, not as a mobile-only fork. |
| 3 | **Run independent reads in parallel.** The tenant read, schemas and index don't depend on each other. | 30–50% of the server time | S | `Promise.all`; provisioning stays first. |
| 4 | **Provisioning/reconcile off the request path.** Run them on sign-in, deploy or tenant change, or keep a cheap "schema version" check so the full reconcile only runs when the kernel version moved. | Removes the cold-start penalty | M | Canonical: kernel stays the authority, only the trigger moves. |
| 5 | **Messages per namespace** for `/m` (Mobile + the few shared ones) instead of all. | Smaller JS/JSON | S | |
| 6 | **A service worker / app shell for the office app** (like WorkHub's). | Instant repeat opens, offline shell | M | Only after 1–2, or it caches a slow shell. |

## Recommendation

Do 0 → 1 → 3 now: small, safe, and they remove the white screen. Fold 2 into R2-4 (the store redesign) as decided;
it's the real fix and must not be built twice. 4 and 6 come after.

## Open — Florin

- Go for 0 + 1 + 3 as one small item?
- R2-7 (what defines a working set) is still Florin's decision, and item 2 depends on it.
