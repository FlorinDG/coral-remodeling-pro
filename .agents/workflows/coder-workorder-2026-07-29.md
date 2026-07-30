# CODER WORK ORDER — 2026-07-29 (supersedes 07-28)

Work top-down. One concern per commit. Detail is in the linked spec — this is the order and the acceptance bar.

## ⚠️ UNCOMMITTED WORK ALREADY IN THE TREE (commit this first, don't redo it)
Planner changes sitting in the working tree, verified working:
- **`src/lib/block-tree-dnd.ts`** — **data-loss fix**: `buildBlocks` was resetting `children: []` on every item, so a leaf line's subcomponents were deleted by any drag. Now preserved for non-containers. *(This is what caused the `Verplaatsen mislukt: document integriteit geschonden` toast — the invariant was correctly blocking the drop.)*
- **`src/lib/invoice-totals.ts`** + **`block-tree-dnd.ts`** — `import type { Block }` (type-only imports; required to load outside Next, and what `isolatedModules` expects).
- **`tsconfig.json`** — added `"tests"` to `exclude`. **Required**: without it the test files fail `tsc --noEmit` and break the build gate.
- **`tests/`** — new characterization harness, **55 tests green**, zero new dependencies (Node 22 built-in runner + type stripping):
  ```
  node --experimental-strip-types --import ./tests/register.mjs --test tests/
  ```
- **Delete these two stray files** (Planner created them probing permissions, cannot unlink from the sandbox): `.git/_writetest`, `src/_writetest`.

---

# BATCH A — CLIENT-FACING AND ACTIVELY WRONG 🟥🟥

### A1 · Email attachments are silently dropped
`coral-email-attachments-bug.md` — **a real customer received an invoice whose body said files were attached, with no files.**
`send-invoice.ts:58` and `send-quote.ts:58` call `head(key)` from `@vercel/blob` with a **pathname**; that function needs a **URL**, so it throws, the `catch` logs to console, and the mail sends with the PDF only.
- **ATT-1** add `read(key): Promise<Buffer>` to `lib/storage` (resolve pathname → blob via `vercelList({ prefix: key, limit: 1 })`, then fetch `downloadUrl ?? url`). **Nothing outside `lib/storage` may import `@vercel/blob`.**
- **ATT-2** both send actions use `storage.read(key)`; keep the `t_${tenantId}/` tenant check.
- **ATT-3** **fail loudly** — abort the send naming the file(s), or require explicit confirmation of what will be omitted. Never send a partial mail silently.
- **ATT-4** success toast lists attached filenames; record them on the sent document.

### A2 · Memory → forced reloads
`coral-memory-investigation.md`. Not a leak — the client holds the whole tenant (**9,776 pages incl. block trees**) and `persist` re-serialises all of it on **every** store mutation, unthrottled.
- **MEM-1 first** — debounce `idbStorage.setItem` (~1–2 s trailing, flush on `visibilitychange`/`beforeunload`). ~15 lines, biggest win per risk, should also cut general sluggishness.
- **MEM-2** stop persisting `blocks` for non-dirty pages (keep them for dirty pages so unsynced edits stay protected).
- **MEM-3** `getGlobalDatabases` must stop `include: { pages: true }` for every database — schemas + counts, pages only for the active database.
- **MEM-4** listener leaks: `app/[locale]/layout.tsx` (+3/−0), `TimelineView.tsx` (+2/−1, leaks per mount).

### A3 · AI Document Import never hands back
`coral-receipt-bulk.md` → PART 4b. The pipeline is **correct and complete** (stub → upload → scan → `reviewStatus` set with reason). Only the client handoff is missing: no `onComplete` prop, store never updated, no navigation, and it shows a generic `Done` while discarding the scan's real verdict.
- **RCPT-L4b-1..5** — `onComplete`, live store update, show `Klaar` / `Na te kijken — <reason>`, a "Bekijk in Inbox (N)" action, localise.

---

# BATCH B — SILENT WRONGNESS FOUND BY SWEEP 🟥🟧
`coral-regression-sweep-2026-07-29.md`
- **B1** 5th identity bug — `app/actions/timesheets.ts:141` keys `empMap` by `e.id`, looks up by `s.userId` ⇒ **raw cuids in the project-detail shift list**. Use `e.userId` / the shared resolver.
- **B2** three more invisible classes — `GlobalDatabaseSyncer.tsx:255` (`border-brand-500`, `bg-brand-900`, `bg-brand-50`). No `tailwind.config`, no `brand` palette ⇒ they emit nothing. Then **grep the repo for `*-brand-[0-9]` and remove all**.
- **B3** `.catch(() => [])` still live — `useWorkerSchedules.ts:35` (same shape as the bug that hid every shift) and `useTasks.ts:173`.
- **B4** **silent deletes** — `store.ts:584, 605, 1415, 1437`: `deleteGlobalPage`/`deleteGlobalDatabase` failures swallowed. The row leaves the UI while the record survives on the server.
- **B5/B6** 115 snake_case leftovers in `components/time-tracker/`; `status === 'leave' || 'Leave'` casing.

---

# BATCH C — LOCALISATION 🟧
New directive in `pd.md` → **LOCALISATION: A STRING NEVER SHIPS WITHOUT A VALUE**. Rough is fine; absent is a defect.
- **C1** `tests/i18n.test.ts` (already written) currently reports **37 keys referenced in code that exist in no locale file** — incl. 7 in `CreatePortalModal`, 7 invoice status labels in `ClientInvoiceEngine`, the new `Hr.timesheets.*` detail labels, and a malformed `Admin.db.col.`. Fill them in en+nl+fr.
- **C2** configure next-intl `getMessageFallback` → fall back to **English**, never the dotted key path.
- **C3** route the remaining hardcoded strings through `t()` — incl. toasts (`Verplaatsen mislukt: …`), empty states, export labels.
- Parity between en/nl/fr is currently exact (733 keys each); `ro` is 104 behind and tracked, not enforced.

---

# BATCH D — TIMESHEET DETAIL GAPS 🟧
`coral-timesheet-entry-detail.md`. Florin tested it: TSD-1 exists, the rest doesn't.
- **D1 REGRESSION** — the **"view work order" action was absorbed into the detail panel**, so the **A4 exportable werkbon is no longer reachable**. Restore it as its own action; it is a distinct artefact (field-service documentation), not a view state.
- **D2** TSD-2 not built — cannot edit hours, only deny. Add force-clock-out (ungated) + time/break/project/billable edits, each writing an `AuditLog` row **in the same transaction**.
- **D3** TSD-3 not built — no unlock banner, no guard. Approved entries must have **no** edit affordances; unlock via Settings → HR; **the banner itself is the off switch**; 30-min expiry enforced **server-side**; expiry must never discard typed work.
- **D4** the detail panel's sub-labels render as raw keys (`HR.TIMESHEETS.TIMELINE`, `…LOCATIONS`, `…ATTRIBUTION`, `…APPROVAL`, `Hr.timesheets.unassigned`) — part of C1.
- ✅ `AuditLog` table and `ClockEntry.editedAfterApproval` are **already live in production** (applied 2026-07-28 23:27) — see the header of that spec. **Do not run any migration command.**

---

# BATCH E — INFRASTRUCTURE 🟨
- **E1 · Baseline Prisma migrations (Florin runs).** `_prisma_migrations` **does not exist** — migrations have never run here; the schema came from `db push`. Anyone running `migrate deploy` gets a hard failure, and the new `add_audit_log` migration has no `IF NOT EXISTS` so it cannot execute against the current DB. Fix once:
  ```bash
  npx prisma migrate resolve --applied 20260301225314_init_cms
  npx prisma migrate resolve --applied 20260728233504_add_audit_log
  ```
  (writes only to the tracking table, executes no SQL). Also capture `ScheduledShift.seriesId`, applied by hand with no migration file.
- **E2 · Snapshot schedule** (Florin) — PITR is now 2 days; snapshots are still manual.

---

# BATCH F — INVESTIGATE: CRASH AFTER LONG IDLE 🟧 (new, 2026-07-29)
**Florin:** *"if the app is idle for a long time it crashes. Edits after a long idle seem to work but the app just crashes."*

**Get the evidence before theorising** — this is the discipline that was missing during the OCC saga (four theories built from source while the server was logging the answer).
1. When it next happens: **capture the error-boundary text** (`app/global-error.tsx` / `app/[locale]/error.tsx` render on a throw) **and the Vercel runtime log at that timestamp**, plus the browser console.
2. Then diagnose. Established so far: session lifetime is **not** the cause (no short `maxAge`; JWT default), and error boundaries exist — so something **throws during render**, it isn't a silent hang.
3. **Leading hypothesis to test first: Neon compute autosuspend.** On the Launch plan the compute suspends after inactivity; the first query after a long idle hits a cold/dead connection. If a server component or server action throws there, the error boundary is exactly what you'd see. Check Prisma connection handling and whether a retry/warm-up is needed.
4. Secondary: IndexedDB handle invalidated after a long background, so a `persist` write/rehydrate throws. Interacts with **MEM-1** — fix that first, then retest.

---

# STANDING RULES (`pd.md`)
1. **Read back every file you edit** before reporting done — imports, hook imports, declaration order, dangling refs, JSX balance, prop call-sites. Then `tsc --noEmit` + lint. **Report what you verified, not what you intended.** Truncated edit ⇒ say so and stop.
2. **No agent runs a schema-mutating Prisma command.** Emit reviewable SQL. `--accept-data-loss` is a stop sign, not a flag.
3. **DB column first, deploy second.**
4. **Fail loudly.** No `.catch(console.error)` / `.catch(() => [])` on user-visible actions — three of today's findings are that exact pattern.
5. **The user is the authority** — the system surfaces, Florin decides. No hard-coded thresholds, no auto-deciding anything with money, hours or a client attached.
6. **Run the 12-point TENANT + GATING checklist** against every feature before calling it done.
7. **When a guard fires repeatedly, read the runtime evidence before re-modelling the mechanism.**
