# CORAL — PROMOTION PLAN · `develop` → `main` — Planner 2026-09-12

**Florin: *"main is indeed by now so far behind the apps don't look alike anymore."***

**114 commits** (measured 2026-09-13; the plan was drafted at 99). Every client-facing money path changed: `send-invoice.ts`, `send-quote.ts`, `peppol/send`, `financials/export`. This is not a routine promotion, and it is the riskiest thing on the horizon. **Florin executes every step; the Planner does not push, deploy or migrate.**

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

### 🟥 2.7 · THE REMINDER DIGEST WILL NEVER FIRE — *found 2026-09-13, not yet fixed*
`src/app/api/cron/reminders/route.ts` was built by `TASK-M15` and works if called. **`vercel.json` declares only two crons** — `trial-check` and `invoice-overdue`. **`reminders` is not registered, so nothing will ever call it.**

The code is correct, the tests pass, and the feature does nothing. This is the exact case `TASK-M15` opened with: *a reminder that does not fire is worse than no reminder at all* — because you stop keeping the list in your head.

**🔻 SUPERSEDED 2026-09-13 — Florin: *"I don't need a digest, I need an alert/notification triggered by the task as a reminder. Digest is useless pollution."*** See `coral-task-reminders.md`.

**🟢 DO NOT REGISTER THE CRON. The unregistered route is now a piece of luck, not a defect** — it has never run, and it would not have survived real data. Reviewing it turned up four further problems, the worst being an **unfiltered `globalPage.findMany()` across every tenant** which then `JSON.stringify`s each page, and a **reminder test that substring-matches a date next to a 🔔 anywhere in any property or block.** Registering it would put a cross-tenant full scan on a schedule.

- [x] **Nothing to add to `vercel.json` before the merge.** The digest is withdrawn; the route is rewritten under `REM-1…4` **after** promotion.
- [ ] 🛑 **FLORIN, BLOCKING for `REM-2`: which Vercel plan?** Minute-level crons need **Pro**; Hobby is ~once daily — and **a once-daily sweep is a digest under another name.**

---

## 3 · GATES — all must be green before promoting

- [x] **G-1 · `LAZY-1…4` complete — ✅ MET, and in a way that makes promotion SAFER than planned.**
  `LAZY-4` set the flag to **opt-in**: `IS_LAZY_DATA_ENABLED = process.env.NEXT_PUBLIC_LAZY_DATA === 'true'` (`feature-flags.ts:85`). **Lazy loading is OFF unless explicitly switched on.** So the 16 exposed surfaces hydrate fully and behave exactly as they do on `main` today — the regression is **neutralised**, and promoting no longer risks them.
  ⚠️ **Be clear about what this means: the regression is MASKED, not resolved.** `LAZY-2` built the accessor (`usePagesOf` / `useLabelsOf`), but **only `TaskModuleShell` consumes it.** The other ~15 surfaces still read the old way. **Turning the flag back on would break them again.**
  ⚠️ **And the cost: `MEM-3`'s entire benefit is switched off.** We are back to full hydration — 52 MB payload, the 307 MB invocation baseline. Production is no worse than today (`main` never had `MEM-3`), but the memory work is banked, not realised. See `LAZY-5`.
- [x] **Phase 2 complete** — `2.1`–`2.5`/`TS-1` (`66ef43a`, `62865a7`, `896f38f`, `afbf405`), `2.6`–`2.10` (`1c25ee6`, `2ffcb1a`), `2.10-b` desktop subtasks (`3d9995a`), `2.11`–`2.15` app-shell hardening (`3b8f773`). Verified against the repo: 7 importers of `lib/tasks/subtasks.ts`, one `useScrollLock`, one shared `FileViewer`, z-scale `chrome 40 / overlay 60`, tenant prefix assert unchanged.
- [ ] **G-2 · Florin has actually used `/m/tasks`.** Not "it matches the spec" — "I would trust it with my week."
  **Status 2026-09-13: close, but not yet met.** Five real defects were found by *using* it, and all five are fixed — *"major improvement"*. **But the fixes are hours old.** The gate is a week's use, not a good first impression; the first pass through this module produced five findings, and the second pass is worth having before 114 commits go to `main`. **Use it for the working days of the staging pass** — that satisfies `G-2` and `G-6` in the same elapsed time rather than in series.
- [x] **G-3 · `npm run test:compile` clean · full suite green — ✅ MET (2026-09-13).**
  **Measured 2026-09-13: `116 tests · 116 pass · 0 fail`.** `i18n` missing keys, `Tasks.Hr` deduplication, and Romanian parity all resolved (`I18N-1..3`). All four locales (`en`, `nl`, `fr`, `ro`) in 100% lockstep parity (846 keys each). `npm run test:compile` (`tsc --noEmit`) passes cleanly with 0 errors.
- [x] **G-4 · `P-1` DB verification — ✅ CLEAN (Florin ran it, 2026-09-13).**
  `prisma migrate status` → 3 migrations found, no pending, no failed. `migrate diff` against the live datasource → **`"This is an empty migration."`** — Prisma's literal output for **no drift**.
  **Production's structure matches `schema.prisma` exactly.**
  🔻 **Planner correction:** I predicted drift, reasoning that 55 models across 3 migrations (last one `20260729…`) implied history advanced by `db push`. **That inference was wrong.** It is the same mistake as the retracted `C1` blocker and the 38 `t-*` records: **inferring the state of data from the shape of the code.** The census answers; the code shape only raises the question. The suspicion was worth stating — it is exactly what `P-1` exists to catch — but it should have been stated as a question, which is how it was run, and the answer is a clean bill.
- [x] **G-5 · Neon snapshot — ✅ TAKEN (Florin, 2026-09-13).** Confirm the PITR window still covers the merge at the moment you merge, not only now.
- [ ] **G-6 · A staging pass on `release/*`.** There is a `staging` branch on the remote and `pd.md` Rule 8 specifies it. **114 commits is exactly the case that branch exists for.** Do not go `develop` → `main` directly.

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

## 4b · STAGING ENVIRONMENT — settled 2026-09-13

- `release/2026-09-13` cut from `develop` and pushed. Preview URL live, **Deployment Protection ON** (so installing it as a PWA may need a bypass token — `G-2`'s mobile item may have to wait for production).
- 🔴 **Found and fixed:** `DATABASE_URL`/`DIRECT_URL` were **All Environments** — *every preview deploy ever made pointed at production data.* Now **Production → production branch, Preview → Neon `staging` branch**, mapped through the Neon↔Vercel integration (the Vercel-side fields are integration-managed and greyed out; the mapping lives on Neon's side).
- [ ] **Verify the split before item 1.** Change something visible on preview → confirm production does **not** show it. **The env var is not proof; the observation is.**
- ⚠️ **A database branch isolates the database and nothing else.** Still shared: **Resend** (email really sends — address test invoices to yourself), **Peppol** (real network, **irreversible**), **Vercel Blob** (same token — staging archives land in the production store).

## 5 · THE STAGING PASS — the things that must be exercised with real data

**Run order: 3 · 4 · 1 · 2 · 5 · 6 · 7 · 8 · 9.** The export lock and the accountant export go first — they are the legally-binding paths, and a failure there means stopping rather than fixing forward.

### RUN LOG — staging pass on `release/2026-09-13`
| | Result |
|---|---|
| **Env isolation** | ✅ Preview → Neon `staging`. Verified by observation: an edit on preview did **not** appear in production. |
| **1 · attachments** | ✅ **Two annexes sent, both arrived.** The `ATT-1/2/3` + `BLOB-1` fix confirmed — these were being silently dropped. |
| **1 · magic link** | ✅ after `CLEAN-6`. Initially 404'd because `NEXT_PUBLIC_APP_URL` fell back to production; **the 404 was isolation working correctly.** Preview-scoped var + redeploy → the document opens. |
| **1 · status / receiptUrl** | 🛑 **BLOCKED — `SEND-1`.** Sync Conflict on send: server writes `receiptUrl`, client then writes `status: opt-sent` against a pre-send snapshot. `coder-directive-send-conflict.md`. **Item 1 is not complete and the `D1` reload check is not yet meaningful.** |
| **2 · Peppol** | ⏸ Not run. **Will fail identically** — `ClientInvoiceEngine.tsx:1108` has the same two-door shape. |
| **3 · export lock** | 🛑 **FAILS — `LOCK-1…4`.** The lock covers `properties` only; **invoice line items live in `blocks` and are unprotected.** Chain confirmed by observation: `vatRegime` reverted on reload (lock fired) · article + quantity persisted (blocks unchecked) · `store.ts:545` swallowed the refusal with a silent retry, so the UI showed success · **`useExportCSV` reads `filteredPages` (client store), so a CSV exported the next day still carried the refused value.** `coder-directive-export-lock-gap.md`. |
| **4 · accountant export** | 🛑 **Two doors.** `/api/financials/export` (server-side, period required, PDFs, `BLOB-4` all-or-nothing) vs the CSV button (client-side, ignores selection, stamps after `link.click()`). Florin selected 10 rows → **86 exported and frozen**, including an `opt-draft`. Folded into `LOCK-3/4`. **Which door survives is Florin's decision.** |
| **5–9** | ⏸ **Unaffected by `SEND-1` or `LOCK-*` — still worth running on the frozen branch before returning to `develop`.** |

### 🔄 REVISED APPROACH — Florin, 2026-09-16: *"We created the new branch for a reason. Let's not modify the app any further before the purpose is realized."*
**Correct, and it overrides my "cherry-pick and restart" instinct.** The release branch is an **observation platform**; its value is that it does not move. Cherry-picking invalidates everything already tested on it, and doing that once per defect is the worst possible loop. **The pass produces a defect LIST, not a green tick.**

So: **collect everything on the frozen branch → fix the batch on `develop` → re-cut → re-run §5 clean.**

### ▶️ ROUTE TO THE MERGE — as of 2026-09-18
| | |
|---|---|
| **1. Close `develop`** | `SEND-1` ✅ (`1bad49b`) · `LOCK-1…5` ✅ (`d07f98b`) · **`LOCK-6`** with the coder · **the selection bug** — still unexplained after full source tracing. **Needs instrumentation, not more reading:** log `selectedRowIds.size` and `pagesToExport.length` at export time. |
| **2. Re-cut** | Fresh `release/2026-09-XX` from `develop`. **New shareable link after the re-cut** — the bypass is per-deployment. |
| **3. Re-run §5 from the top** | Items **1 · 2 · 3 · 4** all failed or were blocked and must be re-tested. **5 · 6** unblock via the share link. **8** likely waits for production — an installed PWA will not carry the bypass cookie into its isolated storage container. **7 · 9** passed; cheap to repeat. |
| **4. Merge** | `main`, then the 48h watch in §6. |
| **5. Then** | `R1` unblocks. `coral-execution-order.md` Phase 3. |

**Judgement call, recorded:** do not test item 4 before `LOCK-6` lands — it changes which button runs the accountant export, so testing it first means testing it twice.

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
The schema is almost certainly fine. The 114 commits are mostly fixes. **The risk is that four money paths changed at once and you will meet the new behaviour in the middle of a working day.** §2 exists so you meet it here instead.

**And the hard gate is `G-1`:** `develop` currently has 16 broken surfaces that work fine in production today. Promoting before Phase 1 finishes would be a straight downgrade.
