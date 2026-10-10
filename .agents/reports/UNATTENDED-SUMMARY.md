# Unattended night — 2026-10-09 23:33 → 2026-10-10 07:33 (Planner) — FINAL

Stopped 07:5x: the Planner's runs ended (job a5caebe5 deleted), `UNATTENDED: OFF` in CODER-QUEUE § STATUS. 17 runs; develop = main at the end (apart from this stop commit).

Per-run detail: `UNATTENDED-LOG.md`. Everything below is on **main** unless marked otherwise. Every promotion was
green on CI and the Vercel preview, on the exact SHA.

## 🔴 Security — fixed and live (all found tonight)
| Fix | What was open | Commit |
|---|---|---|
| **CRM-SCOPE-1** | 6 lead / booking server actions had NO sign-in check — anyone could change or delete any tenant's leads and bookings, in bulk | faed90fa |
| **CMS-SCOPE-1** | 4 website-content actions (update / delete services and projects) — same: no check, by id | b07d368b |
| **PORTAL-SCOPE-1** | `/admin/portals/<id>` showed any tenant's client portal (updates, documents, messages) to anyone signed in | b07d368b |
| **PEPPOL-SCOPE-1** | the Peppol send looked the invoice up by the body's id alone — another tenant's id would file the PDF in that tenant's archive and mark its invoice sent | b0d56c51 |
| **MAIL-OAUTH-1** | the Gmail callback trusted `state` = tenant id (anyone could attach a mailbox to another tenant); the upsert by email moved another tenant's mailbox | 2285ac84 |
| **New guard** | a test: every exported server action calls a session guard | b07d368b |

The sweep covered every server action, every API route handler and every data door. The rest was verified guarded.

## Correctness — live
- **The accountant export** stamps all documents and their audit entries in ONE transaction again (a batch door,
  `saveRecords`). 1ba04b61
- **Dates are the Brussels business day, not UTC** (between 00:00 and 02:00 they were yesterday):
  - the Peppol default invoice / due dates, the quote → invoice date, the due-date fallback, the paid date, the
    vorderingsstaat;
  - the store's automations (now on the ONE `calculateDueDate`);
  - tasks (today, quick-add offsets, recurrence);
  - the HR dashboard's "this week";
  - the calendar's new-task default and the CSV file date.

  A ratchet keeps the financial code at zero and the rest at 17, which may only go down.
- **VAT regime** named in core everywhere (no `'21'` / `'medecontractant'` literals outside it). 39a0bcb7
- **The coder's REVIEW-FIX-1 reviewed + accepted.** Develop was red ~25 min because the coder pushed a failing suite;
  the cause was my directive placing the palette in a hook, fixed by moving it to core (99795b8a).

## 🟡 Waiting for you
1. **PR #2 — TipTap (EDITOR-1)**, a package change. Green: build + preview; mergeable. Try on the preview:
   - type in a free-text block for more than 5 s (the text must stay);
   - bold or a list, then the PDF;
   - library search in a line description.

   Then merge.
2. **`npm audit`: 37 existing findings, 5 critical in `@auth/core`** (the sign-in library). None from TipTap. Upgrading
   is your call (a package push).
3. **`emergency-access`**: the token travels in the URL (logs) and attempts are not limited. Is
   `EMERGENCY_ACCESS_TOKEN` set in Vercel? If unused, remove the route.
4. **Public lead / booking forms** take the tenant from the request body, so anyone can drop spam into any tenant's
   list (create only, no read). The fix binds each website to its tenant: a WEBSITES decision.
5. **`cron/reminders`** is not scheduled in `vercel.json`, so it never runs. If it should: it loads every page of every
   tenant and uses the UTC day. Keep or remove?
6. **Earlier questions still open:**
   - bank reconciliation: CODA upload or a PSD2 feed;
   - architects' meetstaat formats and BIM depth;
   - the MOBILE-1 journal roles and site visit;
   - the R2-7 working set (gates MOBILE-PERF-1 step 4).

## 🟢 Planned for a daytime slot (built only where clock-in can be tested)
- **HR-ENTITY-SERAPH** — the HR route onto the seraph (39 raw calls censused).
- **SCHED-WINDOW-1** — the scheduler loads ALL shifts and time-off with a 9 s timeout: a slow-growing outage for office
  AND crew. A date window per screen.

Do these two together, with one preview test of clock-in.

## The coder
It never ran: its cron wasn't started. Four rows are GO:
- LOC-NEW-1;
- BOUNDARY-1 (plan only);
- GRID-REPLACE-5 M5 (package);
- DB-HEADER-1 M5.

To start it, have it create its worktree and its cron per `coder-cron-protocol.md`.
