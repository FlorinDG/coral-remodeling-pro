# CORAL — 🟥🟥 OVERLAY EVENT SHIELD — DSG's document listeners fire under every modal — Planner 2026-09-12

**Origin:** the coder, investigating `R3-A2`, confirmed the Planner's C3 hypothesis: DSG holds `activeCell` while `PageModal` is open, and its `document`-level `paste` listener intercepts the paste and writes the clipboard into the grid's title cell. It correctly respected the `R3-C` freeze and reported instead of patching DSG.

**The Planner then measured the actual exposure. It is not one listener — it is eight.**

---

## THE MEASUREMENT

`node_modules/react-datasheet-grid/dist/hooks/useDocumentEventListener.js`:
```js
const useDocumentEventListener = (type, listener) => {
    useEffect(() => {
        document.addEventListener(type, listener);      // ← BUBBLE phase, no capture flag
        return () => document.removeEventListener(type, listener);
    }, [listener, type]);
};
```
Registered by `components/DataSheetGrid.js`:

| Event | Line | What it does while an overlay is open |
|---|---|---|
| **`cut`** | 495 | **Clears the grid's active cell — silent data loss** |
| **`paste`** | 631 | Writes the clipboard into the active cell (**the confirmed bug**) |
| `copy` | 488 | Copies the grid cell instead of the user's selected text |
| `keydown` | — | Arrow/Enter/Escape drive the grid behind the modal |
| `contextmenu` | — | Right-click may raise the grid's menu |
| `mousedown` ×2, `mousemove`, `mouseup` | — | Selection/drag state advances behind the overlay |

**`cut` is the reason this is P0 rather than a nuisance.** Select text in a modal field, press ⌘X expecting to move it, and DSG clears the underlying grid cell instead — a **destructive** write to a different record's field, with no error. Nobody has reported it because cut is rarer than paste, not because it does not happen.

**The class:** *any* overlay rendered over a mounted grid inherits all eight — `PageModal`, dialogs, the engines, the send modals. `PageModal` already patches exactly one of them, ad hoc:
```js
e.nativeEvent.stopPropagation(); // Stop native keydown bubbling to window/document (DSG listeners)
```
One symptom patched in one overlay. That is the sideways-copy shape: the next overlay will need the same patch and will not have it.

---

## THE FIX — one shield, used by every overlay

### OVL-1 · `useOverlayEventShield()` 🟥 — new hook, `src/hooks/useOverlayEventShield.ts`
One implementation. Takes the overlay's root ref, and while mounted prevents any of the eight events from reaching `document`.

**Two mechanisms, both required — this is the part to get right:**

1. **Bubble-phase `stopPropagation` on the overlay root.** The event still reaches its real target (the focused input pastes normally), then stops at the overlay boundary and never reaches `document`, so DSG's listener never runs.
   ```ts
   root.addEventListener(type, (e) => e.stopPropagation());   // bubble, on the overlay element
   ```
2. **Capture-phase guard on `document` for events that originate *outside* the overlay** (focus momentarily on `body` — the case the coder observed). Registered in **capture**, so it runs before DSG's bubble listener:
   ```ts
   document.addEventListener(type, (e) => {
       if (root.contains(e.target as Node)) return;   // handled by (1); do NOT stop it here
       e.stopPropagation();                            // stray event — DSG must not act on it
   }, true);
   ```

**Prohibitions — each of these breaks something:**
- **Never `preventDefault()`.** The browser's native paste/copy/cut into the focused input must still work; we are removing DSG from the chain, not the clipboard.
- **Never `stopPropagation()` in the document capture listener for a target *inside* the overlay.** Capture runs before the event descends to its target — stopping there would prevent the input from ever receiving the paste. This is the one subtle way to get this wrong, and it would look like "paste does nothing".
- Register and remove strictly on mount/unmount; no listener may outlive its overlay.

Cover all eight: `paste` · `copy` · `cut` · `keydown` · `contextmenu` · `mousedown` · `mousemove` · `mouseup`.

### OVL-2 · Adopt it in `PageModal` 🟥
`src/components/admin/database/components/PageModal.tsx`: call the hook with `modalRef`, and **delete the ad hoc `stopPropagation` in `handleKeyDown`** — the hook subsumes it. One rule, one place.

### OVL-3 · Sweep the other overlays 🟧
Every component that renders over a mounted grid adopts the same hook: record/detail dialogs, the quote and invoice send modals, `TicketCaptureModal`, the schema editor, the shift editor. **Enumerate them in this spec as they are adopted** — an overlay without the shield is an unfixed instance of this bug, not a missing nicety.

### OVL-4 · Delete it with DSG 🟨
This shield exists because a third-party component listens globally. **It is temporary.** `GRID-REPLACE-5` removes `react-datasheet-grid`; the shield is removed in the same commit, and this spec is closed. Note it in the `GRID-REPLACE` checklist so it is not left behind as permanent scaffolding around a problem that no longer exists.

---

---

## ⚠️ POST-MERGE REVIEW — OVL-1…4 (Planner 2026-09-12, after `f7af3ef`…`cece86a`)

**The hook itself is correct.** Both mechanisms present, `preventDefault` never called, and the capture guard correctly skips targets inside the overlay — the subtle failure I flagged was avoided. `EXPORT-LOCK-CORE` is in with 7 tests; the suite is **77 tests, 76 pass**, the one failure being the pre-existing `i18n` red. Good work.

**But the shield is too broad, and it has already broken things. Four corrections.**

### C6 🟥 The capture guard swallows events *outside* the overlay before they reach their target
`e.stopPropagation()` in **capture phase on `document`** halts the event at the first node of the propagation path — it never descends to the element the user actually clicked. So while any shielded overlay is mounted, **every `mousedown` / `mouseup` / `keydown` outside it is destroyed**, not merely hidden from DSG.

For a true modal with a backdrop this is mostly invisible. For **`ProjectDetailView`** and **`InlineDialog`** it is a behaviour change — and `ProjectDetailView` registers its own bubble-phase click-away at `:85`, which its own shield now prevents from ever firing.

**Required narrowing:** the document capture guard handles **clipboard events only — `paste`, `copy`, `cut`.** Those are the ones that misroute when focus is astray, which is the case the coder actually observed. Mouse and keyboard strays do not damage anything in DSG and must be left alone.

### C7 🟥 The root bubble-stop kills the overlay's *own* bubble-phase document listeners
The shield stops shielded events at the overlay root, so any `document` listener registered in **bubble** phase stops receiving events that originate inside the overlay. The coder found two (`FormulaEditorModal`, `InlineDialog` Escape) and moved them to capture. **It is not two.** Confirmed bubble-phase document listeners now dead while a shielded overlay is open:

| File | Line | What breaks |
|---|---|---|
| **`PageModal.tsx`** | **662** | `mouseup` — **the very file that adopted the shield first breaks its own handler** |
| `UniversalSearch.tsx` | 117, 141 | the global search shortcut and its click-away |
| `NotionGrid.tsx` | 211 | undo (`handleUndo`) |
| `TaskContextMenu.tsx` | 64 · `FilterToolbar.tsx` | 130 · `SortToolbar.tsx` 78 · `PropMentionFlyout.tsx` 112 | keyboard handling |
| `DatabaseClone.tsx` 241, 252 · `NotificationBell.tsx` 29 · `settings/databases/[id]/page.tsx` 53 | | click-away |

**Required:**
1. Fix `PageModal.tsx:662` — register in capture, or scope the listener to the modal element.
2. **State the rule in this spec and in `pd.md`:** *an overlay that adopts the shield must register its own `document` listeners in **capture** phase.* Most of the app already does (`SearchableSelect`, `CustomDatePicker`, `SelectDropdown`, `SmartVATLookup`, `PageModal:118/269` all pass `true`) — which is why this mostly works. Make it explicit rather than accidental.
3. Audit the listeners belonging to the **ten adopted overlays** for bubble-phase registrations. Out-of-overlay components (`UniversalSearch`, `NotificationBell`, `NotionGrid`) are C6's problem and are fixed by narrowing the capture guard.

### C8 🟧 `mousemove` does not need shielding — remove it
DSG's `mousemove` matters only during an active drag-selection, which **cannot begin** because `mousedown` is already stopped at the overlay root. Shielding it buys nothing and costs a `root.contains()` on **every mouse movement, per mounted overlay**. Drop `mousemove` from `SHIELDED_EVENTS`.

### C9 🟧 Verify `ProjectDetailView` is actually an overlay
It is in the adopted list but is a detail **view**, not a dialog. If it is mounted persistently rather than as a transient overlay, the shield is permanently active and C6's swallowing applies to the whole app for as long as it is on screen. **Confirm, and remove it from the list if it is not a true overlay.**

### Accepted, no change
The `enabled` flag for modals that mount before an early return · the null-ref guard · teardown symmetry on unmount · moving the two Escape handlers to capture · the `OVL-4` teardown note in the `GRID-REPLACE` checklist.

---

## VERIFY
1. Open a record in `PageModal` over a grid, click a non-title text field, **paste** → the text lands in that field, and the grid's title cell is **unchanged**.
2. Same with focus deliberately blurred first (click the modal's background, then paste) → nothing is written to the grid.
3. Select text in a modal field and **cut** → the text is cut from that field, and **no grid cell is cleared**. Check the underlying record afterwards.
4. **Copy** in a modal field → the clipboard holds the selected text, not a grid cell.
5. Arrow keys and Enter inside the modal do not move the grid's cursor behind it; Escape still closes the modal.
6. Right-click inside the modal does not raise the grid's context menu.
7. Close the modal → grid paste/copy/cut behave **exactly as before** (the shield must leave no residue).
9. **(C6)** With a shielded overlay open, a click on a control *outside* it still reaches that control — the capture guard no longer swallows mouse/keyboard events.
10. **(C7)** `PageModal`'s own `mouseup` handler (`:662`) still fires; the global search shortcut, undo, and the notification bell click-away all still work while an overlay is open.
11. **(C8)** `mousemove` is absent from `SHIELDED_EVENTS`.
8. `npm run test:compile` → 0 errors. `node --experimental-strip-types --import ./tests/register.mjs --test 'tests/*.test.ts'` → no new failures (`i18n.test.ts` is already red — `I18N-MISSING-KEYS`).

## NOTES
- **No edits inside `NotionGrid.tsx`, `hooks/useGridColumns.tsx`, `columns/*` or `node_modules`.** The `R3-C` freeze holds; this fix lives entirely in the overlay layer.
- Credit where due: the coder found the mechanism and stopped at the freeze boundary rather than patching through it. That is the behaviour the protocol is trying to produce.
