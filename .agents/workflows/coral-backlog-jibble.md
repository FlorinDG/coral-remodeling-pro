# CORAL — BACKLOG FROM THE JIBBLE REVIEW — Florin 2026-10-02

Source: Planner's comparison (chat 2026-10-02) of Jibble (time & attendance) with CoralOS; Florin's decisions
below. Rows also in `coral-roadmap.xlsx` (Source = this review).

## Planned
- **`OFFLINE-1`** — offline clocking + **visible sync state per item, plus a banner** while anything is unsynced.
  Builds on the kernel offline queue; the queued intent carries its own time (CE-TIME-1). Lesson from Jibble's
  reviews: sync delays are their most common complaint — make the state visible, never silent.
- **`PAYROLL-1`** — export to the **social secretariat**; **no payroll math in-house**; a **flag for the
  self-employed** (kept out of the payroll export).
- **`GEO-2`** — **our own explanation before the permission prompt**: what is recorded (location at clock-in /
  clock-out only), why, and nothing in between — shown before the OS asks.

## Later
- **`TEAM-1`** — teams; a **foreman** role in `HrTeamMember`; **shift → team fan-out**; the **foreman enters the
  crew's hours**.
- **`KIOSK-1`** — a shared on-site device (PIN / QR / NFC).
- **`REPORT-1`** — planned vs actual; attendance (late / absent / no-show). The data exists.
- **`HR-LIVE-1`** — who is in now — on the **HR dashboard**, **not** the WorkHub.
- **`AI-1`** — Claude assistant over the tenant's data — **after R1**.

## Rejected
- **Face recognition** (and selfie clock-in) — biometrics are GDPR special-category data; little value next to the
  signature + location record.
- **Live location** — *it gets promoted to the single source of truth and conflicts with signed hours.* The record
  stays: location at clock events only (GEO-1).

## Where we stay ahead (keep it that way)
Signed work order + lock + frozen evidence · tasks per shift with crew progress · hours → invoice inside the ERP ·
audited edits with reasons · shift-link reconciliation · five crew languages · "record, never block" geofencing
(Jibble users complain about geofences blocking clock-ins).
