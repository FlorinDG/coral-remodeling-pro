# CODER DIRECTIVE — R2-5 · pin the write path BEFORE anyone moves it

**Planner 2026-10-01. Tests only. One commit set. Report: `.agents/reports/R2-5.md` per `coder-report-protocol.md`.**
Spec: `coral-r2-write-path.md` §R2-5 (order: **R2-5 → R2-1 → R2-2 → R2-3 → R2-4**). Harness rules: `tests/README.md`
(Node test runner, type-stripping, `@/` alias via `tests/register.mjs` — **zero new dependencies**).

> **These pin CURRENT behaviour, not desired behaviour.** A test that documents a known defect is named
> `KNOWN DEFECT: …` and asserts what happens today — never what should happen. Do not fix anything.

## What to pin (each a `describe`, in `tests/write-path-*.test.ts`)
1. **OCC accept / reject** — the server-side version check in the write doors
   (`src/app/actions/pages.ts` `createPageServerFirst` / `updatePageServerFirst`,
   `src/app/actions/global-databases.ts` `saveGlobalPage` / `saveGlobalPagesBatch`):
   matching `baseUpdatedAt` / `blocksVersion` → accepted; stale → the conflict shape returned today.
   If the decision lives inline in a server action that touches Prisma, pin the **pure part** you can
   reach; list what you could not reach in the report.
2. **Field merge** — two concurrent edits of DIFFERENT fields of one row: what lands today.
3. **Single-flight** — `store.ts` `loadDatabasePages` returns the in-flight promise for a second call (`inFlightPageLoads`).
4. **Sync queue retry / backoff** — `store.ts` around `syncQueue` (`:235-284` per `ground-zero-triage.md`): delays and give-up rule.
5. **Dirty pages are never evicted** — `hydrateDatabases` and `loadDatabasePages` keep a page that is in `syncQueue`
   (local properties kept, `baseUpdatedAt` / `blocksVersion` taken from the server — OCC-13).
6. **`partialize`** — what is persisted to IndexedDB: only dirty pages, blocks only when `dirtyBaseBlocks`.

## How
- Prefer pure functions. If store logic is only reachable through the zustand store, drive the store
  directly (`useDatabaseStore.getState()` / `setState`) with stubbed IndexedDB (`idb-keyval`) and
  stubbed server actions — **stubs live in `tests/`**, never in `src/`.
- 🛑 **No change to `src/`** — not even an `export`. If a behaviour cannot be reached without one, write
  it down in the report (file:line, what export would make it testable) — the Planner decides.

## 🛑 FENCE
- `src/**` read-only · `prisma/**` · `package.json` / lock files · `.github/**` · `tests/register.mjs` / `tests/alias-hooks.mjs`
  (if the harness genuinely needs a hook, report it).

## Done when
- `node --import ./tests/register.mjs --test 'tests/*.test.ts'` green, new files included
- `tests/README.md` table gains one row per new file (what it pins)
- report: every behaviour in the list → test name, or "not reachable without <export> at file:line"
