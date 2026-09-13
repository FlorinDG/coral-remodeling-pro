# CORAL — CODER DIRECTIVE — `TASK-M16…M20` · the Tasks app is not an app yet — Planner 2026-09-13

**Florin, second real use of `/m/tasks` (installed PWA):**
> *"The bouncing around is not yet fixed. The delete button still too low — footer under system bar. App bottom bar should actually go — it's the task manager, but I can navigate the entire app from there, not intended. Top right settings button leads to ERP settings — should contain only task manager settings. The behaviour when opening an attachment is to download it instead of open, and on mobile it just produces a white screen. Would be fine if on desktop would also launch the file viewer."*

**Five complaints. `TASK-M12` was built correctly and still did not work** — because the primitive is right and **the shell underneath it is wrong**. Execution-order position: **Phase 2, items `2.11`–`2.15`**, before `2.10-b`.

> 📅 **Calendar integration is explicitly OUT.** Florin, 2026-09-13: *"Since our calendar module is not yet defined, you will agree that a tasks calendar integration is for a later moment."* **Agreed.** A tasks↔calendar binding written before the calendar module is defined would be built against a shape that does not exist yet, and would have to be unpicked. **Do not add any calendar surface, field, or sync to the Tasks module.** Revisit when the calendar module is specced.

---

## 🔍 WHY `TASK-M12` DID NOT FIX THE SCROLLING — read this before touching anything

`BottomSheet.tsx` is **correct in isolation**. `dvh` ✅ · `overscroll-contain` ✅ · fixed footer ✅ · safe-area padding ✅ · reference-counted lock ✅. The verification passed. **The behaviour did not change, because the sheet is not the thing that scrolls.**

```
MobileShell.tsx:136   <div className="h-[100dvh] flex flex-col overflow-x-hidden">
MobileShell.tsx:169     <main className="flex-1 pb-20 overflow-y-auto overscroll-y-contain">   ← THE SCROLLER
BottomSheet.tsx:43      document.body.style.overflow = 'hidden';                               ← LOCKS THE WRONG ELEMENT
```

**The shell is a fixed-height flex column. `<body>` never scrolls — `<main>` does.** So `document.body.style.overflow = 'hidden'` is a **no-op**, and the page keeps scrolling under the open sheet exactly as before.

**This is the lesson worth more than the fix:** the sheet was verified against its own props, not against the page it opens on. **A scroll lock can only be verified on the element that actually scrolls.**

`document.body.style.touchAction = 'none'` (`:44`) is a **second, separate defect**: it suppresses touch gestures on the whole document, which on iOS also degrades scrolling *inside* the sheet. That is the "elastic, bounces back, fights me" feel. **Remove it** — it is not part of a correct scroll lock.

---

## `TASK-M16` · LOCK THE ELEMENT THAT ACTUALLY SCROLLS 🟥

- [ ] **New `src/components/mobile/useScrollLock.ts`** — one hook, the only scroll lock in the mobile app.
- [ ] It locks **the nearest scrollable ancestor**, resolved at lock time, **not `document.body` by assumption**:
  - walk up from the sheet's container for the first element whose computed `overflow-y` is `auto` or `scroll`;
  - fall back to `document.body` **only** if none is found.
- [ ] Save and restore the element's **exact previous inline `overflow`** — restore the prior value, not `''`. Restoring `''` discards a value the shell may have set.
- [ ] **Preserve scroll position.** Locking must not jump the list to the top; on restore the user is where they were. This is the difference between a lock and a reset.
- [ ] **Keep the reference counting** — it is the one part of the current implementation that is right, and sequential sheets need it.
- [ ] **🔴 Do NOT set `touch-action: none` on `body` or on the locked element.** Remove the existing line. `overscroll-contain` on the sheet body is what stops chaining; `touch-action: none` only breaks the sheet's own scrolling.
- [ ] `BottomSheet.tsx` calls the hook and contains **no lock logic of its own**.
- [ ] **Grep gate:** `grep -rn "body.style.overflow\|touchAction" src/components/mobile/ src/app/[locale]/m/` → **only inside `useScrollLock.ts`.**

**VERIFY — on the installed PWA, not a browser tab:**
1. Open the detail sheet on a **long** task list → drag the area behind the sheet → **nothing behind moves at all.**
2. Scroll to the bottom inside the sheet and keep dragging → **it stops dead.** No rubber-band, no bounce, no sideways drift.
3. Close the sheet → the list is **exactly where it was**, and scrolls normally.
4. Open sheet → open a second sheet from it → close both → the page still scrolls.

---

## `TASK-M17` · THE FOOTER IS UNDER THE TAB BAR, NOT UNDER THE SYSTEM BAR 🟥

Florin reads it as the system bar. **It is the app's own bottom navigation.**

```
MobileShell.tsx:177   <nav className="fixed bottom-0 inset-x-0 z-50 ...">   ← h-16, 64px
BottomSheet.tsx:63    <div className="fixed inset-0 z-50 ...">              ← SAME z-index
```

**Equal `z-50`, and the `<nav>` comes later in the DOM than the `<main>` that renders the sheet. Later element wins.** The tab bar paints **on top of** the sheet's fixed footer — so Delete is drawn, then covered. The safe-area padding added in `TASK-M12` was correct and irrelevant: it clears the home indicator, not a 64px navigation bar sitting above it.

- [ ] **Establish a z-index scale, once, and write it down** — `src/components/mobile/z-index.ts` or a comment block in `MobileShell`. Shell chrome (header, nav) below overlays (sheets, viewers, toasts). Suggested: chrome `z-40`, overlays `z-60`.
- [ ] Sheet overlay moves **above** the nav. Nav drops to `z-40`.
- [ ] **Verify with the nav still present** (a task list inside the main app, not the standalone Tasks PWA) — `TASK-M18` removes the nav from the Tasks app, and **that must not be what accidentally fixes this.** The sheet must out-rank the nav wherever both exist.
- [ ] **Grep gate:** no two `fixed` overlays in `src/components/mobile/` share a `z-` value with `MobileShell`'s nav.

**VERIFY:** Delete is **fully visible and tappable without scrolling**, on a task with long notes, in the **main mobile app where the tab bar exists**.

---

## `TASK-M18` · THE TASKS PWA IS A TASKS APP, NOT THE WHOLE ERP IN A COSTUME 🟧

> *"It's the task manager, but I can navigate the entire app from there — not intended."*

`MobileShell` renders all five tabs unconditionally (`:42-48` — home, tasks, invoices, expenses, quotes) and a hardcoded avatar link to **`/m/settings?tab=company-info`** (`:159`) — company-wide ERP settings. **Florin installed a task manager and got a full ERP launcher.**

- [ ] **Introduce an explicit app scope**, not a route sniff:
  ```ts
  export type MobileAppScope = 'erp' | 'tasks';
  ```
  Passed to `MobileShell` by the layout that renders it. **The shell must not infer scope from `pathname`** — that is a second source of truth, and it breaks the moment a route moves.
- [ ] **Scope `'tasks'`:**
  - **No bottom tab bar at all.** Remove it; do not hide it with CSS and do not render a one-tab version. `<main>` loses its `pb-20`.
  - The header shows the **Tasks** identity, not the ERP dashboard identity.
  - **Settings goes to `/m/tasks/settings`** — see `TASK-M19`.
  - **No link from the Tasks app into ERP surfaces.** If a task has a project, the project name is **text, not a link**, in this scope.
- [ ] **Scope `'erp'`: unchanged.** The main mobile app keeps all five tabs and the existing settings link. Nothing regresses there.
- [ ] The Tasks PWA manifest `start_url` and `scope` are confined to `/m/tasks`, so the installed app cannot navigate out of itself. **Check the existing manifest before writing a new one.**
- [ ] 🛑 **STOP AND ASK** if removing the nav in `'tasks'` scope requires changing how any **`'erp'`** screen lays out. It should not. If it does, report rather than adjust ERP screens.

---

## `TASK-M19` · TASK SETTINGS, AND ONLY TASK SETTINGS 🟧

> *"Top right settings button leads to ERP settings — should contain only task manager settings."*

- [ ] **New `/m/tasks/settings`.** It contains **only** what belongs to the task manager:
  - default view (Today / All / Flagged) and default sort
  - reminder digest: on/off, delivery time, address *(`TASK-M15`, already built)*
  - default recurrence anchor *(due date / completion — `TASK-M14`)*
  - show-completed toggle, theme, language
- [ ] **Not present, deliberately:** company info, branding, VAT, users, modules, billing, anything tenant-wide. **A task manager cannot edit the company's VAT number.** If a setting is not about tasks, it does not appear.
- [ ] **No duplicate storage.** Preferences reuse whatever mechanism mobile settings already use — **read it first.** A second preferences store is defect shape #1 again.
- [ ] en/nl/fr/ro.
- [ ] 🛑 **STOP AND ASK** before adding any setting that writes outside the task domain.

---

## `TASK-M20` · ATTACHMENTS OPEN. THEY DO NOT DOWNLOAD. 🟥

> *"The behaviour when opening an attachment is to download it instead of open, and on mobile it just produces a white screen. Would be fine if on desktop would also launch the file viewer."*

**Two distinct defects, and both must be fixed — fixing either alone leaves it broken.**

### (a) The server says "download" — `src/app/api/files/[...key]/route.ts:49`
```ts
if (result.blob.contentDisposition) headers.set('Content-Disposition', result.blob.contentDisposition);
```
The route **passes through whatever Vercel Blob stored**, and Blob's default is `attachment; filename="…"`. **`attachment` means download, by definition.** In an installed PWA the browser opens a new context to service the download, the download is taken over by the OS, and the context is left blank — **that is Florin's white screen. It is not a rendering bug.**

- [ ] **Default to `inline`** for types a browser can render — `image/*`, `application/pdf`, `text/plain` — preserving the filename:
  `Content-Disposition: inline; filename="<original>"`.
- [ ] **`?download=1` forces `attachment`.** Downloading stays possible; it stops being the only option.
- [ ] Everything else (zip, docx, xlsx) stays `attachment` — those genuinely cannot render.
- [ ] **Do not drop the filename.** A downloaded file must keep its name.
- [ ] ⚠️ **Do not weaken the tenant prefix assert at `:32`.** That check is the file security model. **It is not in scope and must be byte-identical afterwards.**

### (b) There is already a viewer. Use it — do not write a second one.
`src/components/admin/file-manager/FileViewerModal.tsx` (135 lines) already handles image, PDF, keyboard navigation, prev/next and `/api/files/` URLs.

- [ ] **Promote it to shared: `src/components/files/FileViewer.tsx`.** The file-manager keeps working through the moved component — **re-export or update its import; do not fork it.**
- [ ] **Mobile tasks opens attachments in it.** Tapping a photo or a document opens the viewer **in-app**; no new tab, no navigation away, no download.
- [ ] **Mobile adaptations, inside the shared component:** full-bleed, swipe between attachments, ≥44px close, `dvh` not `vh`, `overscroll-contain`, and `useScrollLock` from `TASK-M16` — **the same lock, not a second one.**
- [ ] **Desktop uses the same viewer** for task attachments — Florin asked for this explicitly, and one viewer on both surfaces is the whole point.
- [ ] **A download action stays available** in the viewer header, using `?download=1`. The user keeps the choice; it is just no longer forced on them.
- [ ] **Unsupported type** → a clear card: name, size, type, and a Download button. **Never a blank screen.** *An empty view that means "I cannot render this" is indistinguishable from a crash.* ERROR-SURFACING DIRECTIVE.
- [ ] **Grep gate:** `grep -rln "FileViewerModal" src` → the old path has **no remaining implementation**, only the moved component and its importers.

**VERIFY:**
1. Tap a photo on the installed PWA → **it opens in the viewer.** No white screen, no download, no tab switch.
2. Tap a PDF → renders inline in the viewer.
3. Swipe between three attachments; close returns to the sheet with its scroll position intact.
4. Download from the viewer header → the file saves **with its original filename**.
5. Attach a `.zip` → the unsupported card appears with a working Download. **No blank screen.**
6. Desktop task attachment → **same viewer**.
7. `curl -I` an image key → `Content-Disposition: inline`; with `?download=1` → `attachment`.
8. A key from **another tenant** → still `403`. The prefix assert is unchanged.

---

## ORDER — not optional
**`TASK-M16` → `TASK-M17` → `TASK-M18` → `TASK-M19` → `TASK-M20`.**
`M17`'s z-index fix must be proven **while the nav still exists**; `M18` then removes the nav from the Tasks scope. Doing `M18` first would hide `M17`'s defect rather than fix it, and it would come back the moment a sheet is opened anywhere else in the mobile app.

## PROHIBITIONS
- **No second scroll lock, no second viewer, no second preferences store.** One of each.
- **No `touch-action: none`** on `body` or any scroll container.
- **No scope inferred from `pathname`.** It is passed in.
- **No changes to the `'erp'` scope's navigation or settings.**
- **No change to the tenant prefix assert** in the files route.
- **No calendar integration** — out of scope by decision, not by oversight.
- **No desktop task-module changes beyond wiring the shared viewer.** `2.10-b` is a separate item and still owns that fence.
- **Verify on the installed PWA.** `TASK-M12` passed in a browser tab and failed on the phone; that must not happen twice.

## GATES
- `npm run test:compile`
- `node --experimental-strip-types --import ./tests/register.mjs --test 'tests/*.test.ts'`
- All grep gates above.
- **Florin opens the installed Tasks PWA and confirms all five complaints are gone.** That is the gate; the greps are only evidence.
