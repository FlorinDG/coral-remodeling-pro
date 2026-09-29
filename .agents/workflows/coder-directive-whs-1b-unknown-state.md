# CORAL — CODER DIRECTIVE — `WHS-1b` · the clock never acts on unknown state — Planner 2026-09-30

```
BLAST RADIUS — only these files may change in this pass:
  src/app/api/hr/[entity]/route.ts                      (POST, entity === 'clock-entries' ONLY)
  src/components/time-tracker/hooks/useClockEntries.ts
  src/components/time-tracker/components/ClockButton.tsx
  src/components/time-tracker/hooks/useScheduledShifts.ts
  src/components/time-tracker/hooks/useTimer.ts
  src/components/time-tracker/components/MySchedule.tsx
  src/components/time-tracker/i18n/locales/en.json
  src/components/time-tracker/i18n/locales/nl.json
  src/components/time-tracker/i18n/locales/fr.json
  src/components/time-tracker/i18n/locales/ro.json        (added at implementation)
  src/lib/hr-api.ts                                        (added at implementation — see §6)
Anything else: STOP AND REPORT. Do not change it, even if it is wrong.
A better idea is a report, not a commit.
No branch move, no promotion, no deploy, no migration run, NO SCHEMA CHANGE.
```

**Follows `WHS-1` (`aff03a0`), verified by the Planner against the code.** §1–§4 landed as specified. **The terminal-state timeouts introduced two new ways to record wrong hours.** That is what this pass closes.

---

# 0 · 🔴 FLORIN MEASURES FIRST — read only, Neon editor
```sql
-- Users with more than one OPEN clock entry right now. Expected: zero rows.
SELECT "tenantId", "userId", count(*) AS open_entries, min("clockInTime"), max("clockInTime")
FROM "ClockEntry" WHERE "clockOutTime" IS NULL
GROUP BY "tenantId", "userId" HAVING count(*) > 1;
```
🟨 **Any row here is live damage from the defect in §1. Report it; do not clean it.** Cleanup is a Florin decision.

---

# 1 · 🔴 A SLOW NETWORK CAN CLOCK A WORKER IN TWICE

```ts
// ClockButton.tsx — after WHS-1
const tEntries = setTimeout(() => setEntriesTimedOut(true), 5000);
const isAwaitingInitialEntries = entriesLoading && !entriesTimedOut;
// useClockEntries.ts:48 — activeEntry = entries.find(e => !e.clockOutTime) || null
//   entries defaults to [] while loading AND on error
```
**After 5 s the button stops waiting and renders as "Clock in" — with `activeEntry === null` because the list has not arrived, not because the worker is clocked out.** A worker who is already clocked in taps it → **a second open `ClockEntry`**. The same happens on a failed entries query (`entries` defaults to `[]`).

🔴 **And the server does not stop it.** `POST /api/hr/clock-entries` (`[entity]/route.ts` ~450–540) has **no check for an existing open entry.** Two open entries = hours counted twice on a payroll surface.

## THE DECISION — the server is the authority; the client never guesses
- [ ] 🔴 **SERVER:** in POST, when `entity === 'clock-entries'` **and the new record has no `clockOutTime`**, look up an open entry for `(tenantId, userId)`. **If one exists: return `409` with `{ error: 'already_clocked_in', entry: <the open entry> }`.** Do not create.
  - 🟢 Entries created **with** a `clockOutTime` (manual entry, late entry) are **not** affected — they are closed records.
  - 🛑 **Do not auto-close the existing entry. Do not merge.** Refuse and name it. *(pd.md: invariants abort.)*
- [ ] **CLIENT (`useClockEntries`):** on that 409, **adopt the returned entry** into the query cache as the active entry and resolve as success-with-notice. The worker sees *"You were already clocked in since HH:mm"* — **localised, time via `formatTime`, never `toISOString()`.**
- [ ] **CLIENT (`ClockButton`):** entries **failed or timed out** is **not** "clocked out". Render a terminal state that **still offers clock-in** *(the server now makes that safe)* with a visible note: *status could not be confirmed.* 🛑 **Never render the clocked-out UI from an empty list you did not successfully load.**

---

# 2 · 🔴 THE 3 s SHIFTS TIMEOUT CREATES A DUPLICATE SHIFT

`ClockButton` stops waiting on shifts after **3 s**; `useScheduledShifts` allows each call **9 s**. Between 3 and 9 s, `getTodayShift()` returns `null` **because shifts have not arrived** → clock-in takes the no-shift path → `createUserShift()` → **a user shift beside the real scheduled one**, and the hours attach to the wrong shift/project.

## THE DECISION
- [ ] 🔴 **Delete `shiftsTimedOut` and its 3 s timer.** The terminal branch for shifts is **`useScheduledShifts` settling** — it is already bounded by its own 9 s `withTimeout`. **One timeout, owned by the fetch, not a second one guessed by the consumer.**
- [ ] **The no-shift path is taken only when shifts SETTLED:** either fulfilled with no shift today, or **failed** (`failedEndpoints.includes('shifts')`). **Never while still loading.**
- [ ] 🛑 **Do not lower the 9 s.** Do not add a third timeout anywhere.

---

# 3 · A FAILED REFETCH BLANKS A LIST THAT HAD LOADED

`useScheduledShifts.fetchAll`: shifts rejected → `setRawShifts([])`. `ClockButton` refetches after every clock-in, so **one failed refetch empties a week that was on screen.** *(pd.md: "Show stale data.")*
- [ ] **On shifts rejection, leave `rawShifts` as it is.** The banner already says the data could not be refreshed.
- [ ] 🟢 On the very first load there is nothing to keep — the list is empty with a banner, as today.

---

# 4 · STRINGS AND ONE LOST GUARD
- [ ] **Six keys used but defined nowhere** — `schedule.shiftsUnavailableNotice`, `shiftsLoadFailed`, `partialDataNotice`, `shiftsLoadFailedHint`, `unloadedEndpoints`, `partialDataExplanation`. **Add to en/nl/fr** of `src/components/time-tracker/i18n/locales/`. Plus the §1 keys.
- [ ] **`MySchedule`'s endpoint labels (`'Projects'`, `'ERP Projects'`, `'Crew Names'`, `'Time Off'`) are hardcoded** → keys.
- [ ] **`useTimer`: restore `Math.max(0, …)`** on both elapsed computations — the revert dropped it; a device clock behind the server shows negative time.
- [ ] 🛑 **`useTimer` stays per-component.** This is a one-token guard, not a rewrite.

---

# 5 · VERIFY — must be able to catch divergence
1. `grep -n "shiftsTimedOut" src/components/time-tracker/components/ClockButton.tsx` → **0 hits.**
2. `grep -n "setTimeout" src/components/time-tracker/components/ClockButton.tsx` → **only the entries timeout remains** (report the count).
3. `git diff --stat` touches **only** the files in the blast radius.
4. `useTimer.ts` contains **no module-level `let`** (`grep -n "^let " …` → 0).
5. **Clocked in → block `/api/hr/clock-entries` GET in devtools → reload → wait 6 s → tap the button → the server answers 409, the UI shows "already clocked in since …", and the DB still has ONE open entry for that user.** *(Run the §0 query after.)*
6. **Throttle to Slow 3G with a shift scheduled today → tap clock-in at ~5 s → NO user shift is created.** `SELECT count(*) FROM "ScheduledShift" WHERE "userId"=… AND "shiftDate"=<today>` is unchanged.
7. **Load the week, then force `/api/hr/shifts` to 500, clock in → the week stays on screen with a banner.**
8. **Manual entry with in + out times for a worker who is currently clocked in → still created** (closed records are not refused).
9. `test:compile` · `test:lint` · suite — exit 0.

## PROHIBITIONS
- 🛑 **No schema change, no unique index, no migration** — the guard is a server read-then-refuse in this pass. *(A partial unique index is the durable form; it is a Florin decision once §0 is known.)*
- 🛑 **No change to the POST path of any entity other than `clock-entries`.**
- 🛑 **Do not rebuild WorkHub Home (`WH-2`).**

---

# 6 · IMPLEMENTED BY THE PLANNER — 2026-09-30 — what differs from the plan above
- **`src/lib/hr-api.ts` joined the radius.** `hrFetch` threw a bare `Error(message)` and discarded the response body, so the client could not read the 409's `entry`. It now throws `HrApiError` (`status`, `body`) — a subclass of `Error`, so every existing `catch` and `.message` read is unchanged.
- **§2 went one step further, deliberately:** when shifts **failed**, clock-in records the entry **without creating a user shift**. A failed load means we do not know whether a shift exists today; creating one is the same guess as the 3 s timeout. *(4x: the hours are the fact; the entry stands without a shift.)*
- **Open-entry check failure → `503`, named.** Fail closed: the create would hit the same database.
- **`ro.json` got the keys too**, and the endpoint labels became `schedule.endpoint.<name>` keys.
- **Clock-in error toasts in `ClockButton` / `MySchedule` now carry `describeError(err)`** (ERR-1's helper) — these files are fenced from the coder, so they were converted here.

## Noticed, not fixed — recorded
- 🔴 **`tests/i18n.test.ts` scans next-intl only** (`src/messages`, `useTranslations`). **The time-tracker's react-i18next locales have NO guard** — which is how six missing keys shipped in `WHS-1`. → `I18N-TT-1`.
- 🔴 **POST `/api/hr/clock-entries` accepts a client-supplied `userId` from any role.** A workforce user can create an entry for someone else. Checklist item 5 (intra-tenant RBAC, server-side). → `RBAC-CE-1`.
- `[entity]/route.ts` — `AUTH_SECRET || 'fallback-secret-for-dev'` signs the timesheet-unlock cookie. Harmless while `AUTH_SECRET` is set in every environment; a forgeable cookie if it ever is not.
- `[entity]/route.ts:157` — `locked['projects'] || 'db-1'`: a fail-open identity fallback (R1-2) still in the `erp-projects` branch.
- The read-then-refuse guard has a race window (two taps inside one round-trip). **Durable form: a partial unique index `ON "ClockEntry"("tenantId","userId") WHERE "clockOutTime" IS NULL`** — additive, Florin's migration; the open-entries census returned zero rows, so it would apply cleanly today.
