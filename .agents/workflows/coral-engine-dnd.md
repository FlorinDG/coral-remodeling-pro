# CORAL — ENGINE-DND-REBUILD: engine wiring spec (Planner, 2026-07-26)

**Status:** `QuotationRow.tsx` migration is DONE and verified clean (no `hello-pangea`, no `Droppable`/`Draggable`; receives `dragHandleProps` / `isDragging` / `depth` as props at `:22-29`, handle at `:181`). `SortableQuotationRow.tsx` (49 lines) exists. **`ClientQuotationEngine.tsx` is NOT yet migrated → the quotation engine is currently in a broken half-state.** The invoice pair is untouched (invoices still work).

---

## 🚨 RULE 0 — ATOMICITY
The row + wrapper + engine for a given document type are **ONE semantic unit**. They must land in **ONE commit**. There must be no revision in history where a row is migrated and its engine is not — that revision has a broken quoting engine and can reach production.
- **Commit A:** Quotation (QuotationRow ✅ + SortableQuotationRow ✅ + ClientQuotationEngine) — ship, verify green, deploy.
- **Commit B:** Invoice (InvoiceRow + SortableInvoiceRow + ClientInvoiceEngine) — only after A is verified live.
- **Do NOT start B until A is green.** If A regresses, you revert one commit, not a tangle.
- **Pre-req:** the working tree currently mixes OCC-2 work (`accept-invoice`, `accept-quote`, `global-databases`, `pages.ts`, both cron routes, `package.json`) with DnD work. **Commit and verify the OCC batch separately FIRST**, on a clean tree.

---

## 🚨 RULE 1 — EXTRACT THE SHARED CORE *BEFORE* WIRING EITHER ENGINE
Do **not** implement the tree logic twice. The two engines have already diverged (different droppableId conventions — see §Invoice gotchas), and that divergence is exactly why bugs get fixed in one engine and not the other.

Create **`src/lib/block-tree-dnd.ts`** (or extend `sortable-tree.ts`) holding, once:
- `LEGAL_NESTING` table + `canNest(childType, parentType)`
- `getBlockProjection(...)` — type-aware, replaces the generic dnd-kit `getProjection`
- `flattenBlocks(blocks)` / `buildBlocks(flat)` — block-aware wrappers over `flattenTree`/`buildTree`
- `assertTreeInvariants(before, after)` — the count/id guard
- `countBlocks(blocks)` — recursive
Both engines import these. **No copy-paste of tree logic into engine files.**

---

## 🚨 RULE 2 — PRESERVE EXISTING NESTING SEMANTICS EXACTLY
This migration changes the **drag mechanism**, NOT the **document model**. Do not "improve" the rules while migrating — that silently changes what documents are expressible and can alter totals grouping.

**The only rule enforced today** (`ClientQuotationEngine.tsx:372-383`, mirrored `ClientInvoiceEngine.tsx:652,673`):
> Containers (`section` | `subsection` | `post`) may NOT be placed inside a non-container (i.e. inside a `line`/leaf). Everything else is currently permitted.

Formalize exactly that:
```ts
const CONTAINERS = ['section','subsection','post'] as const;
const isContainer = (t: BlockType) => CONTAINERS.includes(t as any);
// child may nest under parent iff parent is a container.
// a container child additionally requires the parent to be a container (same rule).
export const canNest = (childType, parentType) =>
  parentType === 'root' ? true : isContainer(parentType);
```
Keep the existing NL toast on rejection: `'Mappen/secties kunnen niet in een calculatieregel worden geplaatst.'`

**Also preserve:** `getBlockProjection` must clamp `depth` to the nearest **legal** depth — never `prevDepth + 1` blindly (the generic dnd-kit example). If the projected parent fails `canNest`, walk up until one passes; if none, drop at root.

> **Open decision (do NOT implement unasked):** whether to tighten further (e.g. `section` only at root, `subsection` only inside `section`, hard `maxDepth`). That is a **document-model change** and needs Florin's sign-off as a separate item — not part of this migration.

---

## 🚨 RULE 3 — INVARIANTS ON EVERY DROP (non-negotiable)
Before persisting the rebuilt tree:
1. **`countBlocks(before) === countBlocks(after)`** — recursive, includes all `children`.
2. **The id set is identical** (`before` ids === `after` ids) — catches duplication as well as loss.
3. If either fails: **abort the write**, keep the pre-drag tree, `toast.error`, and `console.error` the diff. **Never persist a tree that failed the check.**
`buildTree` silently dropping a `children` array is the realistic failure mode, and it destroys billable lines.

## 🚨 RULE 4 — UNDO
`updatePageBlocks` (`store.ts:1270-1293`) sets blocks + `dirtyBaseBlocks` + syncs but **never calls `_pushUndo`** (unlike `deletePage`). Push an undo entry capturing the pre-drag tree on every drop. Drag is about to get much easier; a mis-drop must be one Ctrl+Z away.

---

## ENGINE WIRING — `ClientQuotationEngine.tsx` (Commit A)
Current: `:9` imports `DragDropContext, Droppable, DropResult`; `:332` `handleDragEnd(result: DropResult)`; `:999-1025` `<DragDropContext><Droppable droppableId="root">` rendering bare `QuotationRow` at `:1008`.

1. **Imports** — drop `@hello-pangea/dnd`; add `DndContext`, `DragOverlay`, `closestCenter`, `SortableContext`, `verticalListSortingStrategy`, `useAppDndSensors` (`lib/dnd-sensors.ts`), and the shared core.
2. **Flatten for render** — `const flat = useMemo(() => flattenBlocks(blocks), [blocks])`. Render `flat.map(item => <SortableQuotationRow key={item.id} … depth={item.depth} />)` inside a single `<SortableContext items={flat.map(i => i.id)} strategy={verticalListSortingStrategy}>`. The three former nested droppables are gone — nesting is expressed purely by `depth`.
3. **Collision detection** — commit to `closestCenter` for a vertical list. The original complaint was a **large gap between cursor and drop target**; that is usually a scroll-container/transform offset, so verify explicitly with the container scrolled mid-way (see test T5). Do not leave this "closestCorners or pointerWithin — TBD".
4. **`onDragStart`** — `setIsDraggingGlobal(true)`, record `activeId` + a deep clone of the pre-drag tree (for undo + invariant compare).
5. **`onDragMove`** — compute projected depth from `delta.x / INDENT_WIDTH` (24px), clamped via `getBlockProjection`. **Require a deliberate horizontal threshold** (well above the 5px pointer activation — suggest ≥ 1 full indent unit) before re-parenting, and render a visible indent/parent guide. Silent re-parenting moves a cost line into a different section subtotal on a client-facing document.
6. **`onDragEnd`** — resolve final `{depth, parentId}` via `getBlockProjection`; `buildBlocks(...)`; run `assertTreeInvariants`; on pass → `_pushUndo` + `updatePageBlocks`; on fail → abort + toast. Always `setIsDraggingGlobal(false)`.
7. **`DragOverlay`** — render a `QuotationRow` clone so the dragged row tracks the cursor (this is also what kills the perceived "gap").
8. **Delete `handleDragEnd`'s old body** (`:332-~420`: `extractNode`/`findNode`/`insertNode`) — superseded. Keep the hierarchy-protection toast text, now sourced from `canNest`.
9. **Grip menu** — the handle opens a menu on click (no drag). `PointerSensor distance:5` already discriminates. Menu: *Add line under · Add line on top · Add spacer · Add subsection · Duplicate · Delete*.
10. **Fold in ENGINE-ADD-BLOCK-AFFORDANCES** — a `+` on a line beneath the drag handle, and on the section/subsection bar next to the handle. Same files; don't reopen them later.

---

---

## 🟥🟥 DND-FIX-1 — DOUBLE-RENDER + OVER-FLATTENING + CURSOR OFFSET (Florin live, 2026-07-26)
**Symptoms:** every nested line appears **twice** — once inside its parent, once as a half-indented top-level row; subcomponents also escape their parent line; and there's a visible **gap between the cursor and the drag handle**.
**Data is NOT corrupted** — `flattenBlocks` derives from the real tree; this is purely a rendering/measurement defect. No stored quote was damaged.

### A. Rows must render ONLY themselves (the duplication)
`QuotationRow.tsx` still renders its own children at **`:430`, `:603`, `:828`** (`(block.children || []).map(...)`). The engine now also renders the flattened list at `ClientQuotationEngine.tsx:1013`, which already contains those children as their own rows → **every nested block renders twice**, the second at `marginLeft: depth*24px` (the "half-indented duplicate").
**FIX:** in a flat sortable-tree, a row renders itself and nothing else. For each of the three sites, determine whether it sat **inside one of the removed `<Droppable>` wrappers**:
- **Was inside a removed Droppable** ⇒ those children are now flattened into the engine's list ⇒ **delete that child-render block from the row.**
- **Was NOT inside a Droppable** (inline, non-draggable subcomponent UI) ⇒ **keep it**, and exclude that level from flattening (see B).
**MUST KEEP (do not touch):** `:110/115/117` `calculateBlockTotal` recursion — totals legitimately need `children`. Review `:147/152/157-169` child-mutation handlers; if a level is now flattened, its mutations must route through the engine's block update path instead of the parent row.
**Also revisit:** `:481` `childrenTotal`, and the empty-drop-zone affordance at `:590-598` — that zone existed to accept drops into an empty container; in the flat model an empty container needs an equivalent (a depth-aware placeholder row) or it becomes impossible to drop into.

### B. `flattenBlocks` must only descend into CONTAINERS
Currently it flattens all levels, so **leaf-line subcomponents get promoted to top-level sortable rows** — they were previously inline UI and are not independently draggable. `flattenBlocks` must recurse **only** into `section | subsection | post`; a leaf `line`'s `children` stay inline and are rendered by the row. Fix in `lib/block-tree-dnd.ts` so both engines inherit it.

### C. Cursor/handle offset — indentation is on the wrong node
`SortableQuotationRow.tsx` applies `marginLeft: ${depth*24}px` **on the same element that carries `setNodeRef` and `CSS.Transform`**. dnd-kit measures that node's rect; margin combined with transform on the sortable node skews the pointer↔element offset.
**FIX:** keep the sortable node's box clean — move indentation to an **inner wrapper** (`paddingLeft`, or a nested `<div style={{marginLeft}}>` inside the ref'd node). Then re-run test **T5** (drop indicator exactly under the cursor with the container scrolled mid-way, at two zoom levels).

### D. Add the invariant + undo now, not later
Rules 3 and 4 above (block-count/id invariants on every drop, `_pushUndo` in `updatePageBlocks`) are **not yet implemented**. A double-render bug is harmless; a `buildBlocks` bug is not. Land these **before** any dragging is done on a real document.

**Verify DND-FIX-1:** open a nested quote → each line appears exactly ONCE, at correct indentation; subcomponents stay inside their line; document total matches pre-migration; drag handle sits under the cursor; T1 (10 same-parent reorders, total unchanged) passes.

---

## ⚠️ INVOICE-SPECIFIC GOTCHAS (Commit B) — the two engines are NOT symmetric
**Do not copy-paste the quotation solution.** Verified differences:

1. **Prefixed droppable IDs.** `InvoiceRow.tsx` uses `block.id` (`:355`), **`sub-${block.id}`** (`:522`), and **`modal-${block.id}`** (`:758`) — the quotation side used bare `block.id` for all three. `ClientInvoiceEngine.handleDragEnd` (`:497`) therefore contains **prefix-parsing logic** the quotation handler does not have. Read it fully before deleting; confirm the prefixes carried no semantic meaning beyond droppable disambiguation. In the flat dnd-kit model droppableIds disappear entirely (parent comes from projection) — so grep for any other consumer of `sub-`/`modal-` prefixes before removing them.
2. **🔴 `modal-${block.id}` is a droppable INSIDE A MODAL.** This is the highest-risk item in the whole migration. If that modal renders through a **React portal outside the `<DndContext>`**, dnd-kit sortables inside it **will not work** (hello-pangea was more forgiving here). Options: (a) move `DndContext` high enough to enclose the portal, (b) give the modal its **own** `DndContext` + `SortableContext` for its local list, or (c) confirm the modal renders inline. **Decide this before wiring, and test dragging inside that modal explicitly.**
3. **Credit notes share this engine.** `ClientInvoiceEngine` serves `/admin/financials/income/invoices/[id]` **and** `/admin/financials/income/credit-notes/[id]` **and** `/m/invoices/[id]`. Test drag on a credit note, not just an invoice.
4. **Size.** 1964 lines — the largest of the four. Same targeted-edit discipline: locate the specific sites, don't rewrite the file.
5. `InvoiceRow` mirrors QuotationRow's structure (`:122` handle, `:230` `<Draggable>`, three droppables) — the six-site pattern holds; apply it identically, then wire.

---

## TEST PROTOCOL (run for EACH engine before commit)
- **T1 — Totals invariant (the master test):** open a real complex quote (nested sections + subsections + posts + an addendum). Record the document total. Perform 10 reorders **within the same parent**. **The total must be identical every time.** Any change means something silently re-parented or was lost.
- **T2 — Block count:** count lines before/after a drag session; must match. Verify the abort path by temporarily forcing an invariant failure.
- **T3 — Legal nesting:** attempt to drag a `section` into a `line` → rejected with the NL toast, tree unchanged. Attempt legal moves (line between sections, subsection into section) → succeed.
- **T4 — Cross-section move:** move a costed line from section A to section B → A's subtotal decreases by exactly that line, B's increases by exactly that line, document total unchanged.
- **T5 — Cursor/drop alignment:** with the container **scrolled to the middle**, the drop indicator sits exactly under the cursor. This is the original reported bug — verify it explicitly, at two zoom levels.
- **T6 — Grip menu:** click the handle (no movement) → menu opens, no drag starts. Drag > 5px → drags, no menu.
- **T7 — Undo:** perform a bad drop → Ctrl+Z restores the previous tree exactly.
- **T8 — Persistence:** reload after a reorder → order persists; no OCC conflict toast; `dirtyBaseBlocks` behaves.
- **T9 — Mobile sensor:** touch-scroll the list without initiating a drag; long-press (200ms) does initiate. (Mobile UI overhaul is separate, but don't regress the sensor.)
- **T10 — Invoice only:** repeat T1/T3 on a **credit note**, and drag inside the `modal-` list.

## ROLLBACK / SAFETY
- **Neon snapshot before promotion** (`pd.md` PRE-PROMOTION BACKUP CHECKPOINT) — this rewrites the `blocks` JSON of live revenue documents.
- Test on a **copy** of a real complex quote first, never directly on a live client document.
- One revertable commit per engine; if T1 fails at any point, stop and revert rather than patching forward.
