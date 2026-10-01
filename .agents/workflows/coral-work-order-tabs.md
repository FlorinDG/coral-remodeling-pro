# CORAL — EVERYTHING IS A WORK ORDER — the shift opens as a tabbed record — Planner 2026-10-01

Florin, 2026-10-01: *"unify the shift and work order into a common concept. everything is a work order."*
Home stays as it is (shifts, bottom bar, clock with/without shift). **Opening a shift opens the work
order**, with a tab row inside it. Builds on the werkbon walkdown (`coral-walkdown-werkbon-record.md`,
phasing A → B → C+D → E) — this is its crew-facing surface, not a second design.

## The tabs
| Tab | Content | Needs |
|---|---|---|
| **Hours** | entries clocked on this shift + **add hours manually** (the late-entry form, which Florin finds the better form, pre-bound to this shift — the shift stays open until submitted) | no migration |
| **Notes & files** | crew notes + attachments (photos/docs) | attachments: no migration (`ShiftAttachment`, crew file fence allows `shifts`) · crew notes: storage decided by the grain question below |
| **Tasks** | the shift's tasks, worker progress | ✅ reach fixed 2026-10-01 (`task-reach.ts`) |
| **Materials** | materials used — **only when enabled on the shift** (a checkbox in the scheduler) | 🟨 LATER — `MAT-1` |
| **Signature** | the client signs; signing locks the work order | `WB-C` + `WB-D` as one release |
| *(later)* **Form** | a custom form attached in the scheduler (e.g. dial readings in a boiler room) | 🟨 LATER — `FORM-1`, form builder |

## Scheduler additions
- **Execution address** — the address comes from the project; a field on the shift overrides it
  when the work happens elsewhere. `ScheduledShift.siteAddress String?` (additive migration — DB
  first, Florin runs it). The brief reads `siteAddress ?? project address`.
- **Materials** checkbox — `ScheduledShift.materialsEnabled Boolean @default(false)` (same migration).

## 🔴 THE ONE DECISION — the grain of a work order
A shift belongs to **one worker**. The werkbon answers (§10c, §11c, §13a) say **one signature covers
many entries, membership proposed by shift assignment** — i.e. a team on one job signs once.
- **A · work order = the shift.** Simplest; no new table. A team of three on one job → the client signs three times.
- **B · work order = the job; shifts belong to it.** A `WorkOrder` record (this is `WB-B`); each
  crew member's shift points at it. Opening any member's shift shows the SAME notes, files,
  materials and signature; hours stay per person. One signature locks every member's entries — and
  nothing else of their day (§13a).
- Planner recommends **B** — it is what the walkdown answers already describe; A would be rebuilt
  the first time a team works a job.

## Phasing
1. **WO-1** (no migration) — tabbed shift screen in the WorkHub: Hours (+ manual add), Files, Tasks; Signature tab present but inactive.
2. **WO-2** (migration, Florin runs) — `siteAddress`, `materialsEnabled`, + the work-order grain (B: `WorkOrder` + `ScheduledShift.workOrderId`) + crew notes.
3. **WO-3 = WB-C + WB-D** — signing + the freeze, one release.
4. **WO-4 = WB-E** — sending the signed PDF.
5. Later — `MAT-1` materials tab · `FORM-1` form builder.

## Not reordered by this
`GRID-REPLACE` (TanStack, `coral-r3-grid.md`) and the project cockpit stay where the execution order
puts them: after R1 (track-b, waiting on the binding census) and R2. Building the cockpit on today's
grid is the "fix it twice" case.

## GEO-1 · geofencing, barebone — 🟢 Florin 2026-10-01: "yessir" (Google)
- **Record, never block:** at clock-in/out the server computes the distance to the site and stores it with the entry, plus the reverse-geocoded address. Timesheets flag "clocked 1.2 km from site". Hours are always recorded.
- **Coordinates → addresses** for display; raw lat/lng stay as evidence.
- **Site point:** `ScheduledShift.siteAddress ?? project location`, geocoded server-side once and kept.
- **Google Geocoding, server-side key** (Florin sets it in Vercel, restricted to the Geocoding API). Nominatim rejected for production (1 req/s, no SLA, usage policy).
- **GDPR:** position only at clock events, never tracked between; one line telling the crew.
- Needs a second additive migration (entry address + distance, shift site coordinates). After WO-1.
