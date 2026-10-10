# REMIND-1 — reminders that fire: tasks and calendar (Planner plan, 2026-10-10)

**Florin 2026-10-10:** "is this the cron reminders we actually want in our erp connected to tasks and calendar?" —
"THEY BELONG IN THE SOFTWARE. canonical build. no corners cut."

## What exists (and never ran)
`api/cron/reminders` (112 lines) is NOT in `vercel.json`: nothing it does has ever fired. It reads every `GlobalPage` of
every tenant on raw prisma, and:
- **task reminders:** `prop-task-reminder` (`opt-rem-morning` = the due day's morning, `opt-rem-day-before`) against
  `prop-task-due` — the field the task screens (`/m/tasks`) already let people set;
- **🔔 marks:** a text search for `<date> 🔔` in properties and blocks (`GlobalMentionDateInterceptor`, grid cells);
- the day is the SERVER's (`format(new Date())`, UTC on Vercel); the recipient is "a user with role admin/owner"
  (role names the platform doesn't use) instead of the task's assignee.
Calendar events (`model Event`) have no reminder at all.

## Canonical build
- **Kernel:** nothing new — the business day (`zonedParts`, `addDaysYmd`) and the task schema's reminder options.
- **Core `lib/records/reminders.ts` (pure):** `reminderFiresOn(record, kind, businessDay): boolean` — ONE rule per
  reminder source: task (`prop-task-reminder` × `prop-task-due`, skipping done/dropped), calendar event (its start
  minus the event's reminder offset, by calendar day / business hour), 🔔 mark (a date cell or mention carrying the
  flag, parsed by `date-cell` / `grid-cell`, never a JSON text search). `reminderRecipients(record)` = assignees, else
  the creator.
- **Door `lib/data/reminders.ts`:** per tenant, the task database by `logicalKey` and the tenant's events, through the
  tenant-scoped client (`systemScope` per tenant, never a cross-tenant `findMany`); notify via `lib/notifications`
  (in-app + mail per the user's notification settings). Idempotent: a `ReminderSent` key (record · kind · day) so a
  re-run never sends twice. **Schema (Florin pushes):** `ReminderSent` model + scope-rules + isolation census;
  `Event.reminderMinutes`.
- **Cron:** `api/cron/reminders` = `isCronRequest` + the door, nothing else. In `vercel.json` hourly; the door sends a
  morning reminder when the BUSINESS hour reaches 07:00 (no UTC offset arithmetic), so DST needs nothing.
- **UI:** the calendar event form gets the reminder select; the task's stays.
- **Tests (throw proofs):** core rule per source (incl. 23:30 UTC = next Brussels day), the idempotency key, the cron
  refuses without its secret, no cross-tenant query (census).
