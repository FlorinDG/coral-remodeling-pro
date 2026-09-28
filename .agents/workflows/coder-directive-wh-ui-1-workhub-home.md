# CORAL — CODER DIRECTIVE — `WH-UI-1` · the WorkHub home screen — Florin 2026-09-28

> **Florin:** *"Time Off goes to nav, and the shift entries get out of their container to nicely fill the page. the so called shift info under the clock button goes away, and the clock button itself goes to bottom, as a fallback to clock without shift. look at the css and fix it also."*

**The crew's home screen is their schedule.** Clocking in happens *from a shift* — which only became possible when `WORKHUB-CLOCKLINK` restored the shift↔entry relation. **The standalone clock button is now a fallback, and the layout should say so.**

---

# 1 · LAYOUT — as specified

| | |
|---|---|
| **Time Off** | moves to the bottom nav. **`QuickLinks` is deleted from the home screen.** 🟨 It also carries a **My Profile** link — decide: nav, Menu, or gone. **Report which.** |
| **"Today's Shift 1:00 PM – 5:00 PM"** | **removed.** The schedule below already says it, better. |
| **The hero section** | `Index.tsx:51` — `text-center mb-8 md:mb-16 lg:mb-20`. **Gone**, with the clock button out of it. |
| **The clock button** | 🔴 **FIXED above the bottom nav, always visible.** *(Florin revised this — the earlier 'no sticky button' instruction is withdrawn.)* See §6. |
| **The schedule** | **fills the page.** It is the content, not a card among cards. |

---

# 2 · THE CONTAINER — a card inside a card inside a padded page

```
workhub/page.tsx:20     <div className="max-w-4xl mx-auto px-4 py-4">     ← page padding
MySchedule.tsx:291      <Card>                                            ← outer card
MySchedule.tsx:292        <CardHeader>  "My Schedule · 14 shifts · …"
MySchedule.tsx:313        <CardContent className="p-0">
MySchedule.tsx:320          <div className="space-y-0 md:space-y-3 p-0 md:p-4">
MySchedule.tsx:46             <Card className="rounded-none border-x-0 border-t-0 border-b md:rounded-xl …">
```

🔴 **The shift cards are already built to bleed edge-to-edge on mobile** — `rounded-none border-x-0` — **and then the page's `px-4` and the outer `Card` put them back in a box.** The intent is in the code and the wrapper defeats it.

- [ ] **On mobile the shift list runs full-bleed.** Either drop `px-4` from the workhub page wrapper for this screen, or let the schedule break out of it. **Do not add negative margins** — fix the wrapper.
- [ ] **Remove the outer `<Card>` around the schedule on mobile.** The header ("My Schedule · 14 shifts…") stays as a plain heading. 🟨 **Keep the card on `md:` and up** — it reads correctly on a desktop.
- [ ] **No nested scroll.** The page scrolls; the list does not scroll inside a fixed-height box.
- [ ] **`max-w-4xl` stays** — it only matters on tablet and desktop.

---

# 3 · 🔴 A KERNEL GAP HIDING IN THE CSS PASS

**Six components hand-roll an American time format:**
```
ClockButton.tsx:198        ScheduleTable.tsx:39        ScheduleCalendar.tsx:25
AllSchedulesView.tsx:14    DailySummary.tsx:42
```
```ts
const ampm = hour >= 12 ? 'PM' : 'AM';
const hour12 = hour % 12 || 12;
return `${hour12}:${minutes} ${ampm}`;
```

**This is a Belgian business whose crews read Dutch, French, Romanian and Russian.** `LOC-1` established European formats — `DEFAULT_LOCALE = 'nl-BE'`, `WEEK_STARTS_ON = 1`, `formatDate` → `DD/MM/YYYY` — and `tests/date-format.test.ts` asserts them.

## Why six copies exist
`src/lib/format/date.ts` exports `formatDate`, `formatDateTime`, `formatDateLong`, `formatMonthYear`, `resolveLocale`. 🔴 **There is no `formatTime`.** The formatter does not cover *"render `13:00` from a `HH:mm` string"*, so six components improvised — and all six improvised American.

## FIX — at the definition, not the six call sites
- [ ] **Add `formatTime` to `src/lib/format/date.ts`**, beside the others:
  ```ts
  /** 'HH:mm' (24h, locale-aware). Accepts 'HH:mm', 'HH:mm:ss', a Date, or an ISO string. */
  export function formatTime(t: string | Date | null | undefined, locale?: string | null): string;
  ```
- [ ] **All six call it.** Delete every hand-rolled `ampm` / `hour12` block.
- [ ] **Extend `tests/date-format.test.ts`**: `'13:00'` → `'13:00'`, midnight → `'00:00'`, noon → `'12:00'`, and **never `AM`/`PM` in any output**.
- [ ] 🛑 **Do not fix the format string in six places.** One function, six callers. *(`pd.md` 4w, question 2.)*

---

# 4 · THE NAV
- [ ] **Time Off joins the bottom nav.**
- [ ] 🔴 **`Files` appears while loading and disappears once loaded** *(Florin's screenshots: 5 items, then 4)*. It is unconditional in the `WorkHubShell` array at line 31, so something filters it after the tenant resolves. **Find the gate and report it.** A nav that changes shape mid-load reads as a bug.
- [ ] **The header shows `WorkHub · User` before the name loads.** Render nothing, or the skeleton — not a placeholder word that looks like a real value.
- [ ] **Replace the blank white screen + centred spinner with a skeleton** of the schedule. On a phone on site, a blank screen reads as broken.

---

# 5 · THE SHIFT ENTRY — decided, in this pass

🔴 **The word "Shift" is deleted. The project name takes its place.**

```
┌──────────────────────────────────────────────┐
│  Herman Van Beek — Kitchen remodelling       │  ← project name, primary line
│  📍 Kerkstraat 14, 2000 Antwerpen            │  ← address, TAPPABLE → nav app
│  🕐 09:00 – 17:00              Tue, 22 Sep   │  ← time + date
└──────────────────────────────────────────────┘
```

- [ ] **Primary line — a THREE-STEP fallback chain, in order** *(Florin 2026-09-28)*:
  1. **The project name** — `ScheduledShift.projectId` → the project page → `properties.title`
  2. **else the description** — `ScheduledShift.shiftName`, else `ScheduledShift.notes`
  3. **else the localized word "shift"** — key `schedule.shiftFallback`, in all five locales
  🛑 **Step 3 is a LOCALIZED KEY, never the literal string `Shift`.** A Romanian crew member reads *tură*, not *Shift*.
  🟨 **Report which field you took as "description"** — the model has both `shiftName` and `notes`, and only one of them is what a scheduler actually types.
- [ ] **Second line = the address**, from the project page's `location` property. **A tappable link that opens the native map app:**
  ```
  https://maps.google.com/?q=<encodeURIComponent(address)>
  ```
  Opens Apple Maps on iOS and Google Maps on Android. 🛑 **Not a `geo:` URI** — inconsistent on iOS Safari.
  **No address → omit the line entirely.** Do not render an empty pin.
- [ ] **Keep the borders between entries.** `border-b` stays; that separation is wanted.
- [ ] 🔴 **TEXT SIZE: start from the OS default (1rem / 16px) and work outward.** The current type is too small.
  Project name **≥ 1rem, semibold**; address and time may step down, **never below 0.875rem**.
  🛑 **No `text-xs` on the crew's primary content.** They read this outdoors, in gloves, on a cracked screen.

---

# 6 · THE CLOCK BUTTON — fixed, stateful, localized

- [ ] **Fixed directly above the bottom nav, always visible**, on every scroll position of the home screen.
  Give the page bottom padding so the last shift entry is never hidden under it.
- [ ] **Two states, by whether a shift is available now:**

| State | Colour | Label key |
|---|---|---|
| a shift is available | 🟢 **`var(--persian-green)` — `#339989`** | `schedule.clockIntoShift` |
| no shift | 🟠 **`var(--tawny)` — `#d75d00`** | `schedule.clockInWithoutShift` |

## 🔴 FIRST: THE PALETTE DOES NOT EXIST IN CODE
```
tawny · persian-green · eerie-black · baby-powder · eggshell   →  0 occurrences in src/
```
**The brand palette is a design decision that lives nowhere as code.** What exists instead:
```
#d35400   368   ← an orange that is NOT tawny        (ERP surfaces)
#d75d00   158   ← tawny, correct                      (portal, login, Hero, Navbar)
orange-*  522   ← Tailwind's orange scale
emerald-* 210   ← Tailwind green, where the palette says persian-green
```
🔴 **Two brand oranges are hardcoded, and the ERP uses the wrong one.** The public site got it right by hand; the ERP drifted, because there was no token to disagree with.

- [ ] **Define the palette ONCE in `src/app/globals.css`, before anything else in this directive:**
  ```css
  :root {
      --tawny:         #d75d00;
      --eerie-black:   #13140d;
      --persian-green: #339989;
      --baby-powder:   #f1f5f2;
      --eggshell:      #faf3dd;
  }
  ```
- [ ] **The new button is the FIRST correct consumer.** 🛑 **No hex literal, no `emerald-*`, no `orange-*` in this component.**
- [ ] 🛑 **Do NOT convert the other 1,258 sites in this pass.** That is `DS-1`, its own job — and a find-and-replace across two oranges would be exactly the mistake this directive exists to avoid.
- [ ] 🟨 **`--brand-color` defaults to `#d35400`** (`WorkHubShell:58`) — the wrong orange, tenant-overridable. **Leave it alone here; report it.** Whether the tenant brand should default to tawny is Florin's call.

## Layout references — look before inventing
This is an **agenda list**: one row per commitment, primary identity first, location second, time third. **Look at how a calendar day-view, a delivery-driver app or a rota app renders a shift row** before designing one. The pattern to copy: *what · where · when*, in that order, with the action fixed and reachable by thumb.

---

# VERIFY — on a phone, not a desktop viewport
1. **Home:** the schedule fills the width, full-bleed on mobile, **no nested scrollbar**, no outer card.
2. **No "Today's Shift" block.** No Quick Access section.
3. **The clock button is fixed above the nav and visible at every scroll position.** The last shift entry is not hidden behind it.
3b. **`--persian-green` with `schedule.clockIntoShift` when a shift is available; `--tawny` with `schedule.clockInWithoutShift` when not.** Verify the rendered hex is `#339989` / `#d75d00` — not `emerald-600`, not `#d35400`. Both render correctly in **all five locales** — check `ro` and `ru` for overflow.
3c. **The no-shift path still creates an ad-hoc shift** *(`WH-13`: load-bearing, must not regress)*.
3d. **The shift entry shows the project name and a tappable address.** Tapping opens the native map app on a real phone — **not a browser tab**.
4. **Clocking in from a shift card still works** and still highlights the card *(`WORKHUB-CLOCKLINK`)*.
5. **Every time on every workhub screen is 24-hour.** 🔴 **`grep -rn "ampm\|hour12" src/components/time-tracker` returns nothing.**
6. **The nav does not change shape** between loading and loaded.
7. `md:` and up still reads correctly — this is a mobile-first change, not a desktop regression.
8. `npm run test:compile` exit 0 · `test:lint` exit 0 · suite exit 0, **including the new `formatTime` assertions**.

## PROHIBITIONS
- 🛑 **No restyle beyond this.** `WH-7` rebuilds the three shift-editor files; visual work on them now is done twice.
- 🛑 **No negative margins to escape the page padding.** Fix the wrapper.
- 🛑 **No English literals.** Every visible string is a key, in five locales.
- 🛑 **No `text-xs` on primary crew content.**
- 🛑 **No colour literal in the new component.** Palette tokens only.
