# CORAL — TASK REMINDERS — an alert at the moment, not a digest — Planner 2026-09-13

**Florin:** *"I don't need a digest, I need an alert/notification triggered by the task as a reminder. Digest is useless pollution."*

**This supersedes `TASK-M15`.** The digest is withdrawn, not amended.

> 🔻 **PLANNER ERROR, OWNED.** On 2026-09-12 I offered three options and recommended the email digest, reasoning that it *"uses infrastructure that exists and already works."* **That was optimising for cheapness of delivery instead of for what a reminder is.** A digest is a report you must remember to read; a reminder interrupts you at the moment it matters. **One does not degrade gracefully into the other** — a digest of things you already missed is pollution, exactly as Florin says. The correct question was never "what is cheapest to send" but **"what does the user have to do for this to work?"** — and the answer must be *nothing*.

---

## 🔴 THE EXISTING ROUTE HAS FOUR DEFECTS BEYOND THE DIGEST QUESTION

`src/app/api/cron/reminders/route.ts` — **it is not registered in `vercel.json` and has never run.** That is lucky, because it would not have survived contact with real data.

### D1 · It loads every page of every tenant, unfiltered 🟥
```ts
const pages = await prisma.globalPage.findMany({
    include: { database: { select: { tenantId: true } } }
});          // ← no `where`. THE WHOLE TABLE, ALL TENANTS.
...
const pageText = JSON.stringify({ props: page.properties, blocks: page.blocks });
```
Then it **serialises every page to a string**, including `blocks`. On your data today this is slow; on a multi-tenant install it is an out-of-memory crash on a schedule. **It is also an `R1` violation in its purest form: a cross-tenant full scan with no scoping at the boundary.**

### D2 · It matches reminders by substring on serialised JSON 🟥
```ts
const hasMentionReminder = pageText.includes(`${todayStr} ${reminderFlag}`);   // '13/09/2026 🔔'
```
**Any occurrence of that date next to a bell emoji, anywhere in any property or any block, fires a reminder.** A pasted note, a quoted client email, a completed checklist item. This is not a query; it is a guess.

### D3 · Nothing records that a reminder was sent 🟥
**No idempotency stamp.** Run the cron twice — a retry, a redeploy, a manual trigger — and every reminder fires again. **A reminder system you cannot trust not to repeat itself gets muted within a week,** which is the same outcome as not having one.

### D4 · It notifies the wrong person, in the wrong language 🟧
`role: { in: ['admin','owner'] }` → the **tenant owner**, not the task's assignee. And `href` hardcodes `/nl/`. For you today those coincide; for a crew member they do not.

**None of this is salvageable by adding a cron entry. The route is rewritten.**

---

## THE MODEL — a reminder is an INSTANT and a DELIVERY, not a category

Today `prop-task-reminder` is a 3-option select: `none` · `morning of due date` · `1 day before`. **That is a digest's model** — a bucket, resolved once a day. Florin asked for an alert *triggered by the task*.

- [ ] **`REM-1` · `prop-task-remind-at` — a stored UTC instant.** The select becomes a convenience for *computing* it (`morning of`, `1 day before`, `1 hour before`, **`custom time`**), but **what is stored is the instant**. One representation. The select alone can never express "Thursday 14:00".
- [ ] **🔴 Timezone: compute in the user's local zone, store UTC.** Belgium is UTC+1/+2. **Storing a local wall-clock time means every reminder shifts by an hour twice a year** — and the shift lands silently on tasks created before the change. Store the instant; render local.
- [ ] **`prop-task-reminded-at` — set when delivery succeeds.** The sweep selects `remind-at <= now AND reminded-at IS NULL`. **This is the whole idempotency story, and it is not optional** (`D3`).
- [ ] Changing the due date or the reminder **clears `reminded-at`**; completing or dropping the task **cancels** it. A reminder for a task you already finished is the pollution Florin is describing.
- [ ] **Recurring tasks:** the reminder is recomputed with the next occurrence (`TASK-M14` anchor). **Do not carry `reminded-at` forward.**

## THE SWEEP — `REM-2` 🟥

- [ ] **Rewrite the route.** Query **only** `db-tasks` pages with a due reminder — `where` on the database and the property, **never a full-table `findMany`** (`D1`), **never a JSON substring match** (`D2`).
- [ ] **Scope per tenant explicitly**, and process tenants independently so one tenant's failure does not stop the others. **Log the failure loudly — do not swallow it.** ERROR-SURFACING DIRECTIVE.
- [ ] Deliver to the task's **assignee**, falling back to the owner only if unassigned (`D4`). Locale from the user, not hardcoded.
- [ ] **Stamp `reminded-at` only after delivery reports success.** Stamping first repeats `BLOB-4`'s defect — recording a promise you did not keep.
- [x] ✅ **UNBLOCKED — Vercel plan is PRO (Florin, 2026-09-13):** *"We are developing commercial software."* Minute-level cron is available, so **real per-task reminders are deliverable.** The fallback discussion is closed; no digest-in-disguise.
- [ ] **Sweep every 5 minutes: `*/5 * * * *`.** Not every minute.
  **Why 5 and not 1:** the sweep runs 288 times a day instead of 1,440, and **a reminder that is up to 5 minutes late is indistinguishable from one that is on time** — nobody sets a task alert expecting second precision. Every-minute buys nothing a user can perceive and costs 5× the invocations on a plan you pay for. **If a use case ever needs the minute, change one number.**
- [ ] **The sweep must be cheap enough to run 288×/day** — that is `D1`'s real bill. A query bounded by `remind-at <= now AND reminded-at IS NULL` returns **almost always zero rows**; an unfiltered `findMany` would run the whole table 288 times a day. **The indexed query is not an optimisation here, it is the feature working at all.**
- [ ] **Add an index** covering the reminder sweep predicate. Confirm with `EXPLAIN` that it is used — an unindexed scan 288×/day is the same defect with a `where` clause in front of it.
- [ ] The existing `🔔` date-mention behaviour is a **separate feature** (`GlobalMentionDateInterceptor`). **Do not delete it** — move it to its own route, or gate it, but it must not share the task sweep's query.

## DELIVERY — `REM-3` 🟥 — **Web Push, and the ground is now prepared**

*"Alert/notification"* on a phone means a **lock-screen notification**. Nothing else qualifies: email needs you to be reading email, and an in-app badge needs you to open the app — which is the failure mode of the digest.

- [ ] **Web Push.** Requires: `web-push` **(not installed)**, VAPID keys, a subscription store, a permission flow, and **`public/sw.js` becoming a real service worker — it is 27 lines of pass-through today.**
- [ ] **🟢 What changed since this was deferred:** on iOS, Web Push works **only for home-screen-installed PWAs** — and after `TASK-M18` the Tasks app **is** one, with its own scope and its own storage container. **The blocker that made this expensive has already been removed by work you have shipped.**
- [ ] **Ask permission at the moment it earns the right** — when the user sets their first reminder — **never on first launch.** A denied permission on iOS is difficult to recover, and a cold prompt is how you get denied.
- [ ] **Second channel, free: the in-app `Notification` table already exists** (`lib/notifications.ts`, `createNotification`). Write there **always**, push **additionally**. Push can be denied or silently dropped by the OS; the in-app record is the one that is always true, and it is what makes "did it fire?" answerable.
- [ ] **Email per reminder is NOT the fallback.** Florin has ruled on this: *"digest is useless pollution"*, and one email per task is worse. **Email stays for invoices and quotes.**
- [ ] **If push is not granted, say so where the reminder is set** — *"Reminders will only show inside the app until you allow notifications."* **Never let the user set a reminder that silently cannot be delivered.**

## MOBILE UI — `REM-4` 🟧
- [ ] Reminder control in the detail sheet, next to due date: **None · At due time · 1 hour before · Morning of · 1 day before · Custom…**
- [ ] **Show the resolved instant in words** — *"Reminds you Thursday 13 Sept, 08:00"* — the same rule as `TASK-M14`. A reminder you cannot predict is one you do not trust.
- [ ] A reminder with **no due date** and no custom time is meaningless: require one or disable the control with a reason. **No silent no-op.**
- [ ] en/nl/fr/ro.

---

## WITHDRAWN
- [ ] **`TASK-M15` email digest — REMOVED, not disabled.** Delete `sendTaskDigestEmail` and the digest block in the cron route. **Dead code that "might be useful later" is the `Tasks.Hr` duplicate in a different file.**
- [ ] **Do not add `reminders` to `vercel.json` until `REM-2` is rewritten.** Registering the current route would run `D1` against production on a schedule.

## PROHIBITIONS
- **No unfiltered `globalPage.findMany()`.** Ever.
- **No JSON substring matching** to decide whether something fires.
- **No delivery without an idempotency stamp.**
- **No stamping before delivery succeeds.**
- **No permission prompt on first launch.**
- **No email fallback for task reminders.**
- **No hardcoded locale in an href.**

## GATES
- A reminder set for **2 minutes from now** arrives on the **installed PWA lock screen**, once.
- Run the cron **three times in a row** → **still one notification.**
- Complete the task before it fires → **nothing arrives.**
- Change the due date → the reminder moves, and fires at the new time.
- A task in another tenant is **never** touched by the sweep — assert on the query, not on the result.
- Deny push permission → the sheet **says so**, and the in-app notification still appears.
- `npm run test:compile` · full suite green.
