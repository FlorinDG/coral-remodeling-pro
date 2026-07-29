# CORAL — TIMESHEET ENTRY DETAIL + ADMIN INTERVENTION — Planner spec 2026-07-28

> ## ✅ SCHEMA IS ALREADY APPLIED IN PRODUCTION (Planner ran it in the Neon console, 2026-07-28 23:27, at Florin's instruction)
> **Do NOT run any migration command. The database is already ahead of `schema.prisma`.**
> Applied and verified in prod:
> - **`AuditLog`** table — 11 columns (`id`, `tenantId`, `actorUserId`, `entityType`, `entityId`, `action`, `field`, `before`, `after`, `reason`, `createdAt`) + 3 indexes (PK, `(tenantId, entityType, entityId)`, `(tenantId, createdAt)`).
> - **`ClockEntry.editedAfterApproval`** `BOOLEAN NOT NULL DEFAULT false` — all 20 existing rows defaulted to `false`, no nulls.
> Pre-check confirmed neither object existed beforehand; nothing was overwritten. Purely additive.
>
> ### YOUR NEXT STEPS (in this order)
> 1. Append the `AuditLog` model and `editedAfterApproval Boolean @default(false)` to `prisma/schema.prisma` so the file **describes what already exists**.
> 2. Commit a **matching migration file** so repo history and the database agree — this drift is what caused the 2026-07-27 outage.
> 3. `npx prisma generate`, then build and deploy.
>
> ### ⛔ DO NOT
> - **No `prisma db push`, `migrate dev`, `migrate deploy`, `migrate reset`, `--force-reset`, `--accept-data-loss`.** The DB is ahead of the schema file; those commands would reconcile in the wrong direction and can drop the objects just created.
> - Don't re-create the table or column — they exist.
>
> Everything below (TSD-1 … TSD-7) is unchanged and remains the spec to build.

**Florin:** *"We need to add a stop clock / clock out manually into the timesheet actions — my account is still clocked in and admin has no way to intervene. […] Click an entry in the table to expand and see and edit all those details, with a guard: if hours are approved, direct editing is not accessible — I need to go to Settings and turn the edit capability on. This to avoid accidental edits."*
**Reference:** Connecteam's timesheet row detail (screenshot). Take the **level of detail**, not the layout.

---

## WHY THIS MATTERS
An admin currently **cannot intervene on a clock entry at all**. A worker who forgets to clock out leaves an entry running indefinitely; there is no way to close it, correct a time, or fix an attribution. The reports API already flags `missing clock-out` (`timesheet-reports/route.ts:160`) — it can *report* the problem it can't *fix*.
The API is already capable: `PUT /api/hr/clock-entries` accepts `clockOutTime` (`[entity]/route.ts:554`) and even closes the linked shift (`:581`). **There is simply no UI.**

---

## STATE VERIFIED
- Expandable **groups** exist (`page.tsx:53`) but **no per-row expansion**.
- Row actions are approve/deny only (`:236/239`).
- `settings/hr` exists — the natural home for the edit-capability toggle.
- **No overtime concept** in this system (decided) ⇒ **omit** Connecteam's Regular/Overtime split entirely.

---

## BUILD

### TSD-1 · EXPANDABLE ROW DETAIL 🟧
Click a row → it **expands inline** (not a modal — Florin: *"click an entry in the table to expand"*). Contents:
- **Times:** clock-in, clock-out (or **`Loopt nog`**), computed duration, break deducted (+ the `noBreak` flag), showing *which* rule produced the number so a total is never unexplained.
- **Locations:** clock-in and clock-out coordinates → **map pin + resolved address**, plus the geofence verdict (inside/outside/not captured). Two separate points — a shift that starts on site and ends elsewhere is exactly what an admin needs to see.
- **Attribution:** project (or **`Niet toegewezen`**), linked shift, billable/internal.
- **Content:** description/task notes, **photos/media** captured at clock-in/out (thumbnails, click to enlarge).
- **Provenance:** source (`Geklokt` / `Handmatig` / `Aangepast`), created by, created at.
- **Approval:** status, approver, approval timestamp, and the **reason flags** (`late` · `manual` · `off-geofence` · `missing clock-out`).
- **Audit trail:** every prior admin edit — who, when, field, before → after.

### TSD-2 · ADMIN ACTIONS 🟥 — the missing capability
Available from the expanded row (and, for the first one, directly in the row's action menu):
- **`Klok stopzetten` (force clock-out)** — for entries with no `clockOutTime`. Prompts for the end time, defaulting to **now**, with quick options (*now* · *end of scheduled shift* · *manual*). Sets `source = 'aangepast'`, records who forced it, and closes the linked shift (the API already does this at `:581`). **This is the item Florin needs today.**
- **Edit clock-in / clock-out times** (with validation: out > in; flag implausible durations rather than blocking).
- **Adjust break** / toggle `noBreak`.
- **Reassign project**, toggle **billable**.
- **Edit description.**
- **Delete entry** — explicit confirmation stating what is being deleted (worker, date, hours).
Every one of these writes an **audit entry**. An admin-modified timesheet must be able to explain itself later.

### TSD-3 · 🔒 EDIT GUARD ON APPROVED ENTRIES 🟥 (Florin's requirement — deliberate friction)
**Approved entries are read-only by default.** No inline edit affordances at all — not disabled-looking buttons, genuinely absent.
- To edit one, an admin must enable **Settings → HR → "Allow editing approved hours"**. Going somewhere else to unlock is the point: it makes an edit to payroll-relevant data a decision, not a slip.
- While enabled: a **persistent warning banner** on the timesheets page — and **the banner IS the off switch** (Florin, 2026-07-28). **Clicking the banner reverts the setting and removes itself.** No navigating back to Settings, no separate control: the warning and the remedy are the same object.
  - Render it as a real `<button>` (keyboard-focusable, `aria-pressed`), not a `div` with an `onClick`. Cursor + hover state must make it obviously clickable.
  - Copy states the action: NL *"Bewerken van goedgekeurde uren staat AAN — klik om uit te schakelen"* · EN *"Editing of approved hours is ON — click to turn off"*.
  - **No confirmation on click.** Re-locking is always the safe direction; friction belongs only on unlocking. Deliberately asymmetric: **hard to unlock, trivial to re-lock.**
- **✅ AUTO-EXPIRY — DECIDED (Florin, 2026-07-28).** The banner handles *"I can see it's on"*; expiry handles *"I walked away with it on"*. Together the guard can never quietly become the default state.
  - **Default 30 minutes**, and **also expires on logout / tenant switch / impersonation change** (a persisted unlock must never survive a session boundary — standing tenant rule).
  - **Show the remaining time in the banner** — *"…staat AAN — verloopt over 24 min — klik om nu uit te schakelen"*. An invisible countdown is a surprise; a visible one is a control.
  - **Warn at 5 minutes remaining** (banner shifts tone, no modal).
  - **⚠️ Expiry must never discard typed work.** If it lapses while an edit panel is open with unsaved changes: keep the panel and the entered values **on screen**, switch it to read-only, and show *"The edit window expired — unlock again to save"*. Do **not** close the panel, clear the fields, or silently fail the save. (Standing rule: no silent loss.)
  - Expiry is enforced **server-side too** — a stale client must not be able to write to an approved entry after the window closes. Store the unlock's expiry with the setting and check it on the write path.
- **Owner/admin only** — never a foreman.
- Editing an approved entry **always** writes an audit entry, and should mark the entry as `edited-after-approval` so it's visible in reports and exports. Optionally require re-approval.
- **Force clock-out on an open entry is NOT affected** — an open entry can't have been approved, so it needs no unlock. Don't let the guard block the thing Florin needs.

### TSD-4 · HEADER TOTALS (from the reference, adapted) 🟨
Connecteam shows aggregate stats above the table. Ours already has StatCards; consider adding **worked days** and **total break time** to the existing four. **Do not** add Regular/Overtime/Pay-per-date — no overtime concept, and pay belongs to the cost-rate work (TS-8), not this screen.

---

## TSD-5 · AUDIT — ONE SHARED `AuditLog` TABLE, **NOT** a JSON column 🟥
**Coder proposed `auditTrail Json? @default("[]")` on `ClockEntry`. Rejected.** Four reasons, the first decisive:
1. **Appending to a JSON array is read-modify-write** — the exact concurrency class that consumed 2026-07-27 (OCC-9→15). Two admins editing, or an admin plus a background write, and audit entries are **silently clobbered**. An audit trail that can lose entries is not an audit trail.
2. **Not queryable.** *"Every admin edit this month"* / *"who changed this rate"* would mean scanning every row's JSON.
3. **Audit is needed in at least four places already** — admin timesheet edits (TSD-2), cost-rate restamps (TS-8), invoice protests (PROT-6), data migrations. Per-entity JSON = four implementations that drift apart. *(The `LEAVE-MODEL-DUPLICATION` lesson.)*
4. **A new table is still additive** — nothing existing is touched, fully compliant with the data-safety rule — and it satisfies `pd.md` checklist #12 (`tenantId` + actor per row) natively.

**Schema (additive; reviewable SQL, Florin runs it, column before deploy):**
```prisma
model AuditLog {
  id           String   @id @default(cuid())
  tenantId     String
  actorUserId  String
  entityType   String   // 'clockEntry' | 'article' | 'expense' | 'globalPage' …
  entityId     String
  action       String   // 'update' | 'forceClockOut' | 'approve' | 'unapprove' | 'delete' | 'restampRate'
  field        String?  // null for whole-record actions
  before       Json?
  after        Json?
  reason       String?  // e.g. 'edited-after-approval'
  createdAt    DateTime @default(now())

  @@index([tenantId, entityType, entityId])
  @@index([tenantId, createdAt])
}
```
- **One write helper** (`recordAudit(...)`) used by every path — never inline appends.
- Writes happen **in the same transaction** as the change, so a change can never exist without its audit row.
- Render the entry's history in TSD-1 by querying `entityType='clockEntry' AND entityId=<id>`.

## TSD-6 · UNLOCK TOKEN — COOKIE IS FINE, BUT BIND IT AND SIGN IT 🟥
The cookie approach is **approved in principle** — an ephemeral grant is a better fit than a persistent DB setting, which would quietly become the default state. Three conditions:
1. **Bind to `tenantId` + `userId`, verified against the session on every write.** A bare `timesheet_unlock=<expiry>` **survives a tenant switch in the same browser** — unlock in tenant A, switch to B, still unlocked. That breaks `pd.md` checklist #11 outright. Payload must carry `{ tenantId, userId, exp }` and the write path must confirm both match the current session.
2. **Make it unforgeable** — **sign it (HMAC with `AUTH_SECRET`)** or issue an opaque server-side token. `HttpOnly` stops JavaScript reading the cookie; it does **not** stop someone crafting it with `curl`. Practical risk is low (only admins can edit anyway), but "properly gated" was the requirement, and a forgeable gate undermines the audit story it exists to protect.
3. **Clear it explicitly** on logout, tenant switch, and impersonation start+stop — do not rely on session-cookie expiry alone.
- Server-side check on the write path is authoritative; the client countdown is a courtesy, never the enforcement.

## TSD-7 · CORRECTIONS TO THE COder PLAN 🟧
- **Expiry must NOT "block submission".** The plan's verification says *"let the timer run down to see it block submission"* — that is the silent-loss failure this spec forbids. On expiry with an open panel: **keep the panel and every entered value on screen**, switch to read-only, show *"The edit window expired — unlock again to save"*. Never close the panel, clear fields, or fail the save quietly.
- **Add an `edited-after-approval` marker** on the entry (property or derived from `AuditLog`), surfaced in the table, reports and exports. A post-approval edit must be visible downstream, not only in a detail panel.
- **State explicitly that force clock-out is NOT gated.** An open entry cannot be approved, so it passes today — write it down so nobody later adds a blanket admin-edit gate and breaks the one capability Florin actually needs.
- **Settings toggle returns the user to where they came from**, not always to timesheets.
- **PATCH is the correct interception point** — verified: `hr-api.ts:35` uses `PATCH` and `[entity]/route.ts:486` exports it.

## TENANT + RBAC
- All reads/writes `WHERE tenantId = <session>`; the settings toggle is per-tenant.
- Workforce users never see the edit affordances or other workers' entries; foremen see their team but **cannot** unlock approved editing.
- Photos/locations served through the authenticated file route with a tenant check.

## VERIFY
1. An entry with no clock-out shows **`Loopt nog`** and offers **`Klok stopzetten`**; using it closes the entry, sets the end time, marks it adjusted, and closes the linked shift.
2. Clicking a row expands it in place; both locations resolve to addresses; photos render; the audit trail lists prior edits.
3. An **approved** entry shows **no** edit controls. Enabling the setting reveals them **and** shows the banner; editing writes an audit entry and marks the entry edited-after-approval.
4. Disabling the setting (or its expiry) restores read-only immediately.
5. A foreman sees their team's entries but no unlock and no edit controls.
6. **Audit:** every admin edit, force-clock-out, approval and un-approval writes an `AuditLog` row with tenant + actor; the row appears in the entry's history; the change and its audit row commit together (kill the process mid-write — neither should exist alone).
7. **Unlock binding:** unlock in tenant A, switch to tenant B → **still locked** in B. Log out and back in → locked. Tamper with the cookie value → rejected.
8. **Expiry with unsaved work:** open an edit panel, type changes, let the window lapse → panel and values remain on screen, read-only, with *"unlock again to save"*. **Nothing is discarded.**
9. **`edited-after-approval`** shows on the entry in the table, the report grouping, and the XLSX/CSV/PDF exports.
