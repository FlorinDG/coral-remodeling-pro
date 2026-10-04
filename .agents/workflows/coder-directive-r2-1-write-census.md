# CODER DIRECTIVE — R2-1 prep · the WRITE CENSUS + one honest backoff test

**Planner 2026-10-02. Item 1 is READ-ONLY (a report, no code). Item 2 is tests only.**
**Report: `.agents/reports/R2-1-CENSUS.md` per `coder-report-protocol.md` — §3a (THROW PROOF) and §3b (a fence is a wall) are binding.**
Spec: `coral-r2-write-path.md` §R2-1 ("the 30 direct prisma writes are migrated or justified in writing, one by one").

## 1 · The census — every direct write to `GlobalPage`, one row each
Measured today: **33 calls in 18 files**:
```bash
grep -rn "prisma\.globalPage\.\(create\|update\|upsert\|delete\|createMany\|updateMany\|deleteMany\)\|tx\.globalPage\.\(create\|update\|upsert\|delete\)" src
```
Also find writes the grep misses (aliased clients: `client.globalPage.`, `db.globalPage.`, `(prisma as any).globalPage`) and list them.

For **each** call, one row in §8 of the report:

| # | file:line | function / route | op | what it writes (properties / blocks / both / delete) | tenant check before it (file:line or **NONE**) | OCC (baseUpdatedAt / blocksVersion: yes/no) | system-write tag (`lastEditedBy` value) | audit row (yes/no) | caller(s) — who triggers it | proposed fate: **adapter** (calls the future `saveRecord`) / **delete** (duplicate door) / **justified** (why it must stay direct) |
|---|---|---|---|---|---|---|---|---|---|---|

Rules:
- **Facts from the code at your Start SHA**, `file:line` for every claim. "tenant check" means a check that the page's database belongs to the caller's tenant **before** the write — name the line, or write **NONE**. A NONE is the most valuable finding in this report; do not soften it.
- The "proposed fate" is a proposal; the Planner decides. One sentence of reasoning each.
- 🛑 **No change to `src/`** — not one character. Found a bug? §10 (noticed, out of scope).

## 2 · The backoff test that tests a copy
`tests/write-path-store.test.ts` — the test "exponential backoff delay calculation doubles…" asserts its **own** `3000 * Math.pow(2, n)`, not the store's (`store.ts:614`, `:622`). Replace it with a test that drives the real `_processSyncQueue` with a failing `saveGlobalPage` stub and **Node's mock timers** (`import { mock } from 'node:test'`; `mock.timers.enable({ apis: ['setTimeout'] })`) and asserts the real waits (3000 → 6000 → …) by advancing the clock.
- THROW PROOF (§3a): change `3000` to `2000` in `store.ts:614`, show the test fail, restore (`git checkout -- src/components/admin/database/store.ts`), show green.
- If mock timers cannot reach it without changing `src/`: **STOPPED for item 2** (§3b) — say why in §11. Do not copy the formula again.

## 🛑 FENCE
`src/**` read-only (item 2's mutation is the throw proof only, restored) · `prisma/**` · `package.json` / lock files · `tests/alias-hooks.mjs` / `tests/register.mjs`.

## Done when
- §8: all 33 (+ any aliased) writes, every column filled; a summary line: N with NONE tenant check · N without OCC · N without audit.
- item 2: the real-store backoff test with its THROW PROOF in §6, or STOPPED with the reason.
- `node --import ./tests/register.mjs --test 'tests/*.test.ts'` green.
