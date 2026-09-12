# CORAL — PROMOTION PLAN · `develop` → `main` — Planner 2026-09-12

**Florin: *"main is indeed by now so far behind the apps don't look alike anymore."***

**99 commits.** Every client-facing money path changed: `send-invoice.ts`, `send-quote.ts`, `peppol/send`, `financials/export`. This is not a routine promotion, and it is the riskiest thing on the horizon. **Florin executes every step; the Planner does not push, deploy or migrate.**

---

## 1 · THE GOOD NEWS FIRST — the database is probably not the risk

`git diff main..develop -- prisma/schema.prisma` → **+56 lines**, and only **two** migration files:
```
20260728233504_add_audit_log    ALTER ClockEntry ADD editedAfterApproval; CREATE TABLE AuditLog
20260729074100_add_series_id    ALTER ScheduledShift ADD seriesId; CREATE INDEX
```
**Both were already applied to production by hand** (the Neon SQL run on 2026-08-18, and the `SCHED-SERIES-ID` work). The Prisma baseline was verified closed — `migrate diff` returned *"This is an empty migration"*.

The other schema additions (`blocksVersion`, `accountantExportedAt`, `costRateApplied`, `RateChangeAudit`, `projectId`, `billable`, `source`, `costRatePrevious`, `createdBy`) reached the live database earlier via `db push` — which is the loophole `HR-6` closed.

**So the live DB is likely AHEAD of `main`'s schema and already matches `develop`'s.** That is the safe direction: extra columns are invisible to older code.

- [ ] **P-1 · Verify, do not assume.** Against production: `npx prisma migrate status`, then `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma`. **Expected: no pending migrations, empty diff.** Anything else and promotion stops until it is understood.

**The real risk is behaviour, not schema.**

---

## 2 · WHAT CHANGES FOR YOU ON DAY ONE — read this list before promoting

Ordered by how likely it is to surprise you at the wrong moment.

### 🟥 2.1 · Accountant-exported records become read-only
`EXPORT-LOCK-CORE` blocks edits to any record with `accountantExportedAt = true`, at all three server write doors. **The census counted 92 already-stamped records** (71 invoices without documents + 21 with). The morning after promotion, editing one of those is **refused with a named error**.

That is correct and it is what you asked for — but **nothing today prevents it, so you may be used to doing it.** Exempt fields: `accountantExportedAt` itself, relation properties, and the three `ARCHIVE_FIELDS`.

### 🟥 2.2 · Sending an invoice can now FAIL where it previously succeeded
`DOC-ARCH-1` archives the PDF **before** transmitting, and **aborts the send if archiving fails**. New failure mode on your most critical path. Deliberate — we do not send a document we cannot keep — but if Vercel Blob has a bad minute, the invoice does not go out. Previously it would have.

### 🟧 2.3 · Your clients start receiving attachments they were not getting
`ATT-1/2/3` + `BLOB-1`: selected annexes were being **silently dropped**; now they are actually attached. Any template or habit built around "I'll send the plans separately" now double-sends.

### 🟧 2.4 · The accountant export is all-or-nothing
`BLOB-4` strict: one unreadable document aborts the whole export, naming the record. The census says **no record would trigger this today** (zero class E/F) — but it is new behaviour at quarter end, when you are in a hurry.

### 🟧 2.5 · Mobile navigation changes under your thumb
`TASK-M6` **swapped the Clients tab for Tasks**. Muscle memory will miss. Clients is still reachable, just not where it was.

### 🟨 2.6 · Smaller, but visible
`R3-A3` — an unmapped database link now shows an **error toast** instead of silently landing on a mock page · `R3-A4` — hidden columns now **stay hidden**, so views may look different from what you remember · `MAIL-1/4` — error toasts now name the real cause instead of "mislukt" · `OVL-*` — paste/cut inside a modal no longer writes into the grid behind it · `TASK-M8` — **recurring tasks will compute different next dates**; month-end recurrences that had drifted (31 Jan → 3 Mar → 3 Apr) will snap back to correct, so some dates move.

---

## 3 · GATES — all must be green before promoting

- [x] **G-1 · `LAZY-1…4` complete — ✅ MET, and in a way that makes promotion SAFER than planned.**
  `LAZY-4` set the flag to **opt-in**: `IS_LAZY_DATA_ENABLED = process.env.NEXT_PUBLIC_LAZY_DATA === 'true'` (`feature-flags.ts:85`). **Lazy loading is OFF unless explicitly switched on.** So the 16 exposed surfaces hydrate fully and behave exactly as they do on `main` today — the regression is **neutralised**, and promoting no longer risks them.
  ⚠️ **Be clear about what this means: the regression is MASKED, not resolved.** `LAZY-2` built the accessor (`usePagesOf` / `useLabelsOf`), but **only `TaskModuleShell` consumes it.** The other ~15 surfaces still read the old way. **Turning the flag back on would break them again.**
  ⚠️ **And the cost: `MEM-3`'s entire benefit is switched off.** We are back to full hydration — 52 MB payload, the 307 MB invocation baseline. Production is no worse than today (`main` never had `MEM-3`), but the memory work is banked, not realised. See `LAZY-5`.
- [x] **Phase 2 complete** — `2.1`–`2.5`/`TS-1` all landed (`66ef43a`, `62865a7`, `896f38f`, `afbf405`).
- [ ] **G-2 · Florin has actually used `/m/tasks`.** Not "it matches the spec" — "I would trust it with my week."
- [ ] **G-3 · `npm run test:compile` clean · full suite green** except the known `i18n` red, which is itself worth fixing first (`I18N-MISSING-KEYS`) so the baseline is honestly green.
- [ ] **G-4 · `P-1` DB verification clean.**
- [ ] **G-5 · Neon snapshot taken immediately before**, and PITR window confirmed. `pd.md` DATA-SAFETY.
- [ ] **G-6 · A staging pass on `release/*`.** There is a `staging` branch on the remote and `pd.md` Rule 8 specifies it. **99 commits is exactly the case that branch exists for.** Do not go `develop` → `main` directly.

---

## 4 · SEQUENCE

```
1. Finish Phase 1 + Phase 2            (in progress)
2. Fix the i18n red so the gate is honest
3. cut release/2026-09 from develop
4. deploy release/* to staging, run §5 with real data
5. Neon snapshot
6. merge release/* → main, deploy
7. watch §6 for 48h
```

**Do not batch a hotfix into this.** If something needs fixing during the release pass, it goes on `develop` and gets cherry-picked deliberately — not merged in because it is convenient.

---

## 5 · THE STAGING PASS — the things that must be exercised with real data

1. **Send an invoice by email** with two annexes → three attachments arrive → **the PDF is archived** and `receiptUrl` survives a reload *after the sync queue drains* (the `D1` clobber case).
2. **Send via Peppol** → same archive, document accepted.
3. **Edit an accountant-exported record** → refused, with the blocked field named. Then edit a *non*-exported one → works.
4. **Accountant export** for a real period → completes, PDFs present, and the stamps land **only after** the ZIP exists.
5. **Open a quote from an emailed link in a fresh browser** → renders (this is a `LAZY-1` class-A surface — it fails on `develop` today).
6. **`bordereau/[id]` and `po/[id]`** cold, in a new tab → complete documents.
7. **Cmd+K** finds a record in a database not opened this session.
8. **Mobile:** capture a task, assign a project, complete it; check the nav swap; confirm the installed PWA does not jump.
9. **A recurring task with a month-end date** → next occurrence is correct, and note which existing tasks shift.

---

## 6 · AFTER PROMOTION — watch for 48 hours

Vercel runtime logs for `[ExportLocked]` (expected, but the volume tells you whether the lock is too tight in practice) · failed invoice sends (`DOC-ARCH-1` abort path) · `storage.put` failures · any `usePagesOf` dev warning that escaped to production.

## 7 · ROLLBACK

Code is a revert of the merge commit and a redeploy — **cheap, and it is the reason the gates are about behaviour rather than data.** The database is **not** rolled back: every schema change in this set is **additive**, so older code ignores the new columns. `accountantExportedAt` stamps and archived PDFs written under the new code remain valid and harmless under the old.

**The one irreversible thing is an email that went out.** That is why §5.1–5.2 are exercised on staging with a test address, not in production.

---

## THE HONEST SUMMARY
The schema is almost certainly fine. The 99 commits are mostly fixes. **The risk is that four money paths changed at once and you will meet the new behaviour in the middle of a working day.** §2 exists so you meet it here instead.

**And the hard gate is `G-1`:** `develop` currently has 16 broken surfaces that work fine in production today. Promoting before Phase 1 finishes would be a straight downgrade.
