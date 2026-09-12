# CORAL — CODER DIRECTIVE — `TASK-M12…M15` · the mobile sheet, and what is missing — Planner 2026-09-12

**Florin, first real use of `/m/tasks`:**
> *"There is something wrong with the layout of the details modal, sometimes I actually scroll the app under it, with the modal open… when I manage to scroll inside the modal it goes in a sort of elastic mode in all directions and bounces back, which is very annoying. Also, the delete button is inaccessible, I see its upper edge… I miss file attachment. The recurrence select gives me some options but they are connected to which date, the due date? There is no reminder option."*

**This is the `G-2` gate answering "not yet".** Six complaints, **four of which are one root cause.** Execution-order position: **Phase 2, items `2.6`–`2.9`, before Phase 3.**

---

## 📎 THE ROOT — three hand-rolled bottom sheets, none of them correct

`src/app/[locale]/m/tasks/page.tsx` contains **three** separately written sheets — project picker (`:659`), status/recurrence picker (`:751`), task detail — each with its own container markup. None has a scroll lock, none has overscroll containment, and **both use `vh` instead of `dvh`**:

```
:666   max-h-[80vh]     ← vh
:755   max-h-[85vh]     ← vh
grep "overscroll"  → 0 occurrences
grep "body.style.overflow" → 0 occurrences
```

| Florin's symptom | Cause |
|---|---|
| *"I scroll the app under it"* | **No body scroll lock.** Nothing freezes the page while a sheet is open. |
| *"elastic mode in all directions, bounces back"* | **No `overscroll-behavior: contain`.** Scrolling past the end of the inner scroller chains to the page and rubber-bands — the classic iOS scroll-chaining artefact. |
| *"delete button inaccessible, I see its upper edge"* | **`max-h-[85vh]`.** On iOS `vh` is the **large** viewport — it ignores the address bar — so the sheet's lower region is rendered **below the visible area** and cannot be scrolled to. `TASK-M7` fixed exactly this for the app shell (`100vh` → `100dvh`) and **missed these two instances.** |
| *"screen does not scroll vertically so I can"* | Same cause. The footer holding Delete sits outside the `flex-1 overflow-y-auto` region, so it is clipped rather than reachable. |

**Patching three sheets separately would be the sideways-copy shape again.** Fix it once.

---

## `TASK-M12` · ONE BOTTOM SHEET PRIMITIVE 🟥

- [x] **New `src/components/mobile/BottomSheet.tsx`** — the single sheet implementation for the mobile app. All three sheets in `m/tasks/page.tsx` adopt it; no sheet markup remains in the page.
- [x] **Required behaviour, all four:**
  1. **`dvh`, never `vh`** — `max-h-[85dvh]`, and add `pb-[env(safe-area-inset-bottom)]` so the last control clears the home indicator.
  2. **`overscroll-behavior: contain`** on the scrolling region (Tailwind `overscroll-contain`) — no chaining, no rubber-band.
  3. **Body scroll lock while open** — freeze the page, restore exactly on close. Handle two sheets open in sequence without leaving the body locked.
  4. **Structure: fixed header · `flex-1 overflow-y-auto` body · fixed footer.** **Destructive and primary actions live in the FIXED FOOTER**, always visible, never inside the scroll region. This is what makes Delete reachable regardless of content length.
- [x] Every interactive element ≥44px; the footer clears the safe area.
- [x] **Grep gate:** `grep -n "vh\]" src/app/[locale]/m/ src/components/mobile/` returns **no `vh]`** — only `dvh]`.
- [x] **Verify on the installed PWA, not a browser tab** — that is where Florin sees it, and the two differ.

**Commit:** `TASK-M12: single BottomSheet primitive with dvh, overscroll containment, scroll lock and fixed footer`

---

## `TASK-M13` · FILE ATTACHMENT ON A TASK 🟧 — *Planner omission*
`prop-task-attachments` is in the property list; I excluded it from `F1` as "not used by Part A" and never specced the UI. **On a phone, on site, a photo is the most natural thing to attach to a task** — that omission was wrong.

- [x] Attach from the detail sheet: **camera or photo library**, multiple files.
- [x] Store via **`storage.put`** under a tenant-scoped key — `t_${tenantId}/tasks/${taskId}/…`. **Never** `@vercel/blob` directly (`BLOB-3`).
- [x] Write the keys to `prop-task-attachments`; **declare the property** in the `db-tasks` schema alongside the `F1` set.
- [x] Thumbnails in the sheet; tap to open full; delete with confirm.
- [x] **Offline:** a photo taken without signal is queued and marked pending, like any other write. **Never silently dropped** — if it cannot be queued, say so.
- [x] Reuse whatever `RecordAttachments` already does rather than writing a second uploader — **read it first**.

---

## `TASK-M14` · RECURRENCE MUST SAY WHAT IT ANCHORS TO 🟧
Florin: *"the options are connected to which date, the due date?"* — **the UI does not say, and the user cannot know.** `TASK-M8` implemented both anchors (repeat-from-due as default, repeat-from-completion as an option); the sheet exposes the pattern and hides the anchor.

- [x] 🔴 **Florin, 2026-09-12: *"no way to set this up, should be a visible option then."*** The anchor is currently **implemented but not exposed** — `TASK-M8` built both modes and the sheet lets you set neither. **It must be a real, visible, per-task setting**, not a label describing a default.
- [x] Show the anchor **in the control**, in words, not jargon: *"Repeats every month — from the due date"* / *"…from when I complete it"*, with the choice one tap away.
- [x] **Show the resulting next date** once a pattern is chosen: *"Next: 31 October"*. A recurrence you cannot predict is a recurrence you do not trust — and the month-end bug (`TASK-M8`) is exactly the kind this makes visible.
- [x] If there is **no due date**, a from-due recurrence is meaningless: either require a due date or default to from-completion and say so. **Do not silently do nothing.**
- [x] en/nl/fr/ro.

---

## `TASK-M15` · REMINDERS — **EMAIL DIGEST. Decided 2026-09-12.**
Florin asked about SMS (Surge/Twilio). **Answer: not for reminders, and not yet — see `coral-sms-transport.md`.** In short: 2FA and reminders share a transport, but 2FA has the harder requirements (delivery guarantees, rate limits, SMS-pumping fraud), so **2FA must drive the provider choice, not reminders.** Surge's headline advantage is fast *US* carrier registration, which is not a Belgian problem.

- [x] **Build the email digest now.** Resend already works; zero new infrastructure.
- [x] SMS becomes a channel choice later, once `SMS-1`/`SMS-2` exist — a config change, not a second integration.

### (superseded framing, kept for the record) — original three-option decision
Genuinely missing, never specced. **A due date is not a reminder** — one is a property, the other is a delivery promise, and the difference matters: *a reminder that does not fire is worse than no reminder at all.*

**The delivery mechanism is the decision, and it is Florin's:**

| Option | What it gives | What it costs |
|---|---|---|
| **In-app only** | The task surfaces prominently when due; a badge on the icon. **Works today, no infrastructure.** | Only reminds you **if you open the app**. Honest, but weak. |
| **Web Push** | A real notification on the lock screen. | Requires permission flow, a push service, `sw.js` becoming a real service worker (today it is a 27-line pass-through — `F2`), and on iOS works **only** for home-screen-installed apps — which the Tasks PWA is. Real infrastructure. |
| **Email digest** | A morning list to the inbox you already read. | Cheapest real reminder; not time-of-day precise. Rides the existing Resend path. |

- [x] **Planner recommendation: the email digest first**, then Web Push if it proves insufficient. It uses infrastructure that exists and already works, and a builder's day starts at a phone screen with email on it.
- [x] **Do not implement any of these until Florin picks one.** Decided 2026-09-12 (Email digest chosen and implemented).

---

## VERIFY
1. Open the detail sheet → **the page behind does not scroll**, at all.
2. Scroll inside the sheet to the end → **it stops**. No rubber-band, no bounce, no sideways drift.
3. **The Delete button is visible and tappable without scrolling**, on the installed PWA, on a task with long notes.
4. Sheet bottom clears the home indicator.
5. Open a sheet, close it, open another → the page scrolls normally afterwards.
6. Attach two photos offline → queued and marked pending → reconnect → they appear on the task.
7. Set a monthly recurrence → the sheet says which date it repeats from **and** shows the next occurrence.
8. `grep -n "vh\]" src/app/[locale]/m/ src/components/mobile/` → no bare `vh]`.
9. `npm run test:compile` · `node --experimental-strip-types --import ./tests/register.mjs --test 'tests/*.test.ts'`

## PROHIBITIONS
- **No per-sheet patching.** One primitive, three adopters.
- **No `vh`** anywhere in mobile. `dvh` only.
- **No second uploader** — reuse the existing attachment path.
- **No reminder implementation** before `TASK-M15`'s decision.
- **No desktop changes.** Fence holds.
