# CORAL — NOTIFICATIONS — one service, three transports — Planner 2026-09-21

**Florin, 2026-09-21:**
> *"Can we scaffold? Build notif as kernel/core service and once seraph assigns a service worker the tenant uses their notif system. At that point it is irrelevant whether it is fully centralized or we split it per module, ERP, functionality, whatever criteria."*

**Yes — and the scaffold collapses three separate specs into one.** Decision `#1` recorded: **assignee only, and the system keeps a log of it.**

---

## 🔵 THE INSIGHT — notification and messaging are the same problem
Three specs currently describe three delivery mechanisms as if they were three features:

| Spec | Says |
|---|---|
| `REM-3` | Web Push for task reminders |
| `SMS-1…3` (`coral-sms-transport.md`) | a provider-agnostic SMS module, 2FA first |
| `TASK-M15` | an email digest on Resend |

**They are one L1 service with three L0 transports.** *"Tell this person something"* is the capability; **the channel is a routing detail.** Built separately they would be three subscription models, three failure paths, three logs — and the second one would copy the first.

**Which is exactly Florin's point:** once the service exists, *"it is irrelevant whether it is fully centralized or split per module"*, because nothing above the service knows how delivery happens.

---

# THE WALK DOWN THE STACK

## L0 · KERNEL — transports only. No business meaning.
```ts
export interface NotificationTransport {
    deliver(target: DeliveryTarget, payload: NotificationPayload): Promise<DeliveryResult>;
}
```
- [ ] **`lib/notify/transports/push.ts`** — `web-push` + VAPID. **The receiving half already exists**: `sw-workhub.js:115` has a working `push` handler and `:129` a `notificationclick`. **Missing: the `web-push` dependency, VAPID keys, and subscription storage.**
- [ ] **`lib/notify/transports/email.ts`** — wraps the existing Resend path.
- [ ] **`lib/notify/transports/sms.ts`** — **this IS `SMS-1`'s `MessagingProvider`** (Sweego). Same rule as `BLOB-3`: **nothing outside the transport imports the provider SDK.**
- [ ] A transport knows **nothing** about tasks, invoices, tenants or reminders. **Given a target and a payload, deliver or fail with a named error.**

## L1 · ERP CORE — the service everything calls
```ts
notify({ userId, type, title, body, entity, href, channels? }): Promise<NotifyResult>
```
- [ ] 🔴 **In-app is ALWAYS written, first, and is the record.** The **`Notification` table already exists** (`schema.prisma:932`) with `tenantId · userId · type · title · body · entityType · entityId · href · readAt`. **Reuse it. Do not create a second table.**
- [ ] **Push/SMS/email are ADDITIVE.** They can be denied, throttled or silently dropped by an OS — **the in-app row is the one thing always true.**
- [ ] 🔴 **The log Florin asked for = delivery outcome per channel**, recorded against that notification: `attempted · delivered · denied · failed`, with a reason. **Three fields on `Notification`, additive migration.**
  **Without it, "the reminder never arrived" is unanswerable** — and that is the complaint a notification system exists to prevent.
- [ ] **Channel selection lives here**, from user preference + notification type. **A caller may hint, never dictate.**
- [ ] **Assignee only** (decision #1). Not the owner, not the whole tenant. *(If an escalation rule is ever wanted, it lives here — **one place**, not per module.)*

## ⛨ SERAPH — the subscription registry is a book fact
> *"Once seraph assigns a service worker the tenant uses their notif system."*

- [ ] **`PushSubscription`** — endpoint, keys, **user**, **tenant**, scope (`/m/tasks`, `/workhub`, …), device label, created, last-seen. **Additive model.**
- [ ] **Which endpoints may receive a tenant's notifications is a resolution fact** — the same category as *"which database id for this logical key"*. It **fails closed**: an unresolvable or foreign subscription is **never** delivered to.
- [ ] **This answers decision `#2` by making it irrelevant**, exactly as Florin said: a subscription **records its own scope**, the registry holds them all, and delivery is a lookup. **Whether one service worker serves everything or one per module is then a deployment detail, not an architecture.**
- [ ] ⚠️ **The one real sub-decision:** one user with both PWAs installed on one device = **two subscriptions = two buzzes for one reminder.** Dedupe by device at registration, or accept it. **Small, but decide it once here rather than discover it on a phone.**
- [ ] Subscriptions **expire and get pruned** — endpoints die silently, and a dead endpoint returning `410` must remove itself.

## 🔵 TOPICS — routing by subscription, not by fan-out (Florin, 2026-09-21)
> *"The reminder/notif should contain some indication of what it is, origin, type, something that categorizes it, so that the PWA can accept related notif/reminders for this user in specific. And any other PWA installed must report to the service worker which notifs it is open for, and avoid pinging every time the notif needs to be routed."*

**This is a topic model, and it is the right one.** Without it, delivery is a fan-out: every installed PWA wakes for every notification and discards what is not its business — **which costs a push, a device wake and a buzz, for nothing.**

- [ ] 🟢 **The taxonomy already half-exists.** `lib/notifications.ts` defines `QUOTE_ACCEPTED · QUOTE_VIEWED · INVOICE_PAID · INVOICE_OVERDUE · INVOICE_SENT · CREDIT_NOTE · PEPPOL_RECEIVED`, plus `DATE_REMINDER` from the cron. **Namespace them** — `tasks.reminder`, `invoices.overdue`, `quotes.accepted`, `hr.shift`, `peppol.received` — and the `type` column carries the topic.
- [ ] **Each subscription declares the topics it accepts** at registration: the Tasks PWA takes `tasks.*`, WorkHub takes `hr.*` and `invoices.*`. **Stored on the subscription, in the registry.**
- [ ] 🔴 **The filter is applied SERVER-SIDE, at routing.** A service worker that receives and discards has already spent the push and already woken the phone. **Florin's point exactly: do not ping to then ignore.**
- [ ] **This also settles the double-buzz sub-decision above.** Two PWAs on one device no longer collide, because a task reminder matches only the Tasks subscription. **Dedupe stops being needed — the topics do it.**
- [ ] **A topic with no matching subscription still writes the in-app record.** It is not lost, just not pushed. *(And an unmatched topic is worth surfacing: it usually means a module shipped a type nobody subscribes to.)*
- [ ] Topics are **declared in one place** and validated — 🛑 **no free-text `type` strings.** That is how the current set became a loose list in a comment.

## ⛨ MODULE GATE — channel entitlement
- [ ] Push and in-app: **all tiers.** SMS: **metered**, so it follows `SMS-3`'s per-tenant opt-in and cost ceiling. **Enforced here, not in the transport.**

## L2 / L3 · MODULES — they only ever call `notify()`
- [ ] Tasks reminders · invoice overdue · Peppol received · quote accepted · trial ending — **all become `notify()` calls.** Several already write to the `Notification` table directly (`lib/notifications.ts`); **they migrate to the service.**
- [ ] 🛑 **No module imports a transport.** Grep gate.

## L4 · LEAF
- [ ] **Permission prompt when the user sets their first reminder** — never on first launch. A cold prompt is how you get denied, and on iOS a denial is hard to recover.
- [ ] **If push is denied, say so where the reminder is set** — *"Reminders will only appear inside the app."* **Never let someone set a reminder that silently cannot be delivered.**
- [ ] Notification centre reads the `Notification` table — **already built.**

---

## 🟢 WHAT THIS BUYS
- **`REM-3`, `SMS-1…3` and `TASK-M15` stop being three features.** One service, three transports, one log.
- **2FA later rides the same SMS transport** — which was `coral-sms-transport.md`'s whole argument, now for free.
- **The email digest already works on Resend** and becomes one channel rather than a special case.

## ORDER
1. **`notify()` + in-app + delivery log** (L1, on the existing table) — **useful immediately**, independent of push.
2. **Subscription registry** (seraph) — with `R1`, since it is a book fact.
3. **Push transport** (L0) — small; the service worker half already exists.
4. **SMS transport** — when `SMS-0`'s Belgian delivery test is done.
5. **Modules migrate to `notify()`** — one at a time.

**Step 1 is not blocked by `R1`, `R5` or the reminder engine.** It is the scaffold Florin asked for, and everything later plugs into it.

---

## 🔐 ASIDE, RECORDED SEPARATELY — session lifetime in an installed PWA
> **Florin:** *"An installed PWA can be considered safe for removing the inactivity gate — browser tab sessions expire and need relogin."*

**The intent is right and the reasoning is half-right.** An installed PWA is a deliberate act on a personal device, and it carries the **native-app expectation**: nobody accepts being logged out of their own phone. **Forcing a re-login on a roof, in the rain, with gloves on, is a worse outcome than the risk it prevents.**

### 🔴 But the mechanism has a trap
**"Installed" is client-reported.** `display-mode: standalone` is asserted by the browser to the page, and anything the client asserts can be forged. **A longer session must never be granted because the client claimed to deserve one** — that is the AUTHORITY DIRECTIVE (`pd.md`): *asked for, never asserted.*

- [ ] **Bind the longer lifetime to something the server established**, not to a flag the page sends — a session minted through the install/registration flow and marked server-side, or a device-bound credential. **The client may hint; the server decides.**

### 🔴 And it must depend on REACH, not on installation
**The gate protects against a lost or borrowed phone.** What matters is what that session can touch:

| Session | Inactivity gate |
|---|---|
| **Workforce / tenant user, own tenant, own tasks** | **Drop it.** Native-app expectation, and the device lock screen is the real control. |
| **Operator** — can act inside client tenants | **Keep it, and make it short.** A lost phone is access to *other companies'* commercial data. |
| **System admin** — platform-wide | **Keep it, shortest of all.** `coral-impersonation.md` already says admin sessions are short, not long. |

**So the rule is: the gate is a function of what the session can reach.** A crew member's Tasks PWA and an operator's Tasks PWA look identical on the home screen and must not behave identically.

- [ ] **Not scheduled.** Belongs with `coral-impersonation.md` and the `R1` work, since it is the same question — *what may this actor do* — asked about time instead of scope.

---

## PROHIBITIONS
- **No second notification table.**
- **No module importing a transport.**
- **No delivery without an in-app record.**
- **No provider SDK outside its transport.**
- **No push subscription resolved outside the seraph.**
