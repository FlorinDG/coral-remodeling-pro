# GROUND-ZERO TRIAGE — Florin app-comb feedback 2026-06-27

**Purpose:** the cleanup list to reach a clean baseline ("ground zero"), then tag a version and move on.
**Workflow (locked):** all fixes authored on `develop` → promote to `staging` → test on the staging webapp install → promote to `main` → tag. One-way only. Coder lives on `develop`.
**Severity legend:** 🟥 data-integrity / crash (fix on sight, per the GENERAL rule) · 🟧 broken feature · 🟨 polish/UX · 🟦 larger build-out · ⟳ = RECURRENCE of an item previously marked "committed" (verification gap — must be confirmed on the staging install, not trusted from a commit).

---

## ⚙️ CODER GUARDS — READ EVERY PASS, NON-NEGOTIABLE (mirrored from board-v2.md so they bind here too)
- **⛔⛔ BRANCH — work ONLY on `develop`.** First action every run: `git rev-parse --abbrev-ref HEAD` must == `develop`; if not, STOP (misconfiguration for Florin). NEVER checkout/commit/push/merge/rebase `main` or `staging`. NEVER merge `main`/`staging` INTO `develop` (no back-merges). Flow is one-way UP `develop → staging → main`, promoted by Florin only. If `develop` looks behind `main`, STOP and leave it for Florin.
- **PERSIST PLANNER FILES FIRST (AUTOMATED — lost-update + untracked-file guard).** Before reading the queue or touching code, run exactly: `git add -A .agents/workflows/ && git diff --cached --quiet || git commit -m "docs(planner): persist board"`. This stages every planner file (this doc, `board-v2.md`, `pd.md`) whether tracked or UNTRACKED (`??`) and commits only if something is staged. You are SAVING the Planner's edits verbatim, NOT authoring them. This is the ONLY commit you make to these files.
- **NEVER EDIT/AUTHOR the Planner files** (`board-v2.md`, `ground-zero-triage.md`) — Planner-only (pd Rule 6). No rewording, no status changes, no marking ✅ (only Florin closes items). Report your work ONLY via `<ID>: <imperative>` commit names.
- **ONE ITEM = ONE COMMIT**, named exactly `<ID>: <imperative>`. Never bundle. After committing, LOOP to the next item; stop only when the actionable queue is dry or your budget is spent.
- **tsc + lint must be GREEN before committing.** If your change breaks them and you can't fix in-window → `git checkout .` and skip. NEVER commit broken code. Same item fails twice → skip it permanently this session.
- **AMBIGUOUS / needs a decision / files mid-change → SKIP, move on.** Never guess scope. Never expand scope.
- **MEASURE BEFORE YOU CODE (pd Rule 2).** Reproduce/confirm the root at runtime; don't code from inference. Smallest change that fixes it (Rule 3). Protect what's already built — do not regress working behaviour.
- **GENERAL GATE per module (below):** tenant gating + data integrity FIRST, before that module's feature/polish.
- **NOTHING closes from a commit.** An item is DONE only when Florin confirms it on the **staging install**. The ⟳ items prove why: they were "committed" yet broken. Your commit is a proposal, not a closure.

---

## 🔴⚡ DO THIS FIRST — WORKHUB-PROJECT-LINK (Planner re-pin 2026-06-28)

**WORKHUB-PROJECT-LINK was skipped** in the last coder session — WORKHUB-PROJ-SELECT/MODAL-HEIGHT/MODAL-TASKS were all committed, but WORKHUB-PROJECT-LINK (listed BEFORE them, marked priority 0) has zero commits. No files are mid-change; collision is gone. **Start your next work item here.**

Full spec is in FULL SPECS → HR WORKFORCE SCHEDULER → **WORKHUB-PROJECT-LINK** below. Summary: forward direction (shift→project) is already wired; the gap is the reverse direction. Add a read-only "Scheduled Labour" card to `PageModal.tsx` fetching `prisma.scheduledShift.findMany({ where: { projectId: page.id, tenantId } })`, tenant-scoped. Commit: `WORKHUB-PROJECT-LINK: wire scheduler shifts to projects both directions`.

---

## ▣ GENERAL GATE — applies to EVERY module before its other fixes (Florin standing rule)
1. **Tenant gating** — confirm the module's data/actions are scoped to the tenant.
2. **Data PROTECTION / INTEGRITY** — no cross-record overwrite, no data loss, no silent revert.
*Only after those two pass do we touch that module's feature/polish items.*

---

## 🟥 P0 — DATA-INTEGRITY / CRASHES (fix first, any module — these violate the GENERAL gate)
- 🟥⟳ **Contacts (and Suppliers): wrong-row corruption.** Create a contact, type a name, then edit ANY other field → the record JUMPS sort position AND the first record in that position gets its cell OVERWRITTEN. Same in Suppliers. The single worst bug here.
  - **TENANT GATING: ✅ PASS (Planner-verified 2026-06-27).** `createPageServerFirst` (pages.ts L42-83) + `updatePageServerFirst` (L172-179) both verify `existing.database.tenantId === session.tenantId` before any write; store `updatePageProperty` (store.ts L880) merges by `p.id===pageId`; grid `onChange` (NotionGrid L980-989) diffs by id. The whole data path is id-based + tenant-scoped — NOT the source of the overwrite.
  - **FUNCTIONALITY ROOT (Planner-measured, high confidence; reproduce to confirm):** a RENDER-ORDERING bug, not a data bug. New rows are pinned to the top of `sortedPages` (NotionGrid L497 `[...newPages, ...sortedRegular]`, "new" = createdAt <120s). Editing a field updates the store → re-render → `sortedPages` recomputes → the row REORDERS mid-edit. DataSheetGrid tracks its active cell by POSITION (row index), so when rows reorder underneath the active cell, DSG emits the in-progress value attributed to the record NOW at that position → the id-based onChange writes it to the WRONG record ("first record in that position overwritten"). GRID-12's id-mapping can't catch it because DSG mis-attributes the value before onChange sees it.
  - **FIX:** keep row order STABLE during an active edit — snapshot the `sortedPages` order when a cell edit begins and don't re-sort until blur/commit; OR don't reorder a newly-created/edited row until the user leaves it (defer the pin/sort move). **VERIFY:** create a contact, type name, edit another field → that record updates, NO other row changes, no jump-then-overwrite; repeat in Suppliers. **Commit (on develop):** `GRID-EDIT-ORDER-STABLE: freeze row order during active edit to stop wrong-row overwrite`.
- 🟥⟳ **Tasks: file upload still appears to target Google Drive → crashes the app.** Drive-out regression; must route to Blob (`uploadFileAction`), never `/api/drive`.
- 🟥 **Financials — Purchase-invoice details modal: VAT field mapping.** Under "supplier" the VAT shows; the VAT field itself is empty. Click Edit → fields correct. On Save → reverts to the wrong mapping. (Read vs persist field mismatch.)

## 🟧 P0 — HR WORKFORCE SCHEDULER (Florin: "redo the whole work", priority 0, absolute next)
- 🟧 **WorkHub ↔ Project connection — CRITICAL, priority 0.** The scheduler must be genuinely wired to projects.
- 🟧⟳ **Project select does not work** in the shift modal (CreateShiftForm) — can't choose a project.
- 🟧 **Modal height inconsistent across tabs** (Details/Tasks/Files) — keep consistent.
- 🟧 **Re-add on-the-fly task creation** inside the shift modal.
- 🟧 **Upload:** from local storage AND include a "project files / Blob" picker option.
- 🟧 **Employee → scheduler presence gated by a "Schedule" checkbox**, NOT by active status. (Directory has a Schedule toggle that controls matrix presence.)

## 🟧 P1 — PORTALS (Florin: second after HR; "customers NEED a place to check their project anytime, anywhere")
- 🟧⟳ Confirm portal media + document upload actually work on staging (PORTAL-MEDIA-UPLOAD was committed — verify real upload, no 404).
- 🟧⟳ Confirm multi-project portal works (PORTAL-MULTI-PROJECT committed — verify a client sees all their projects).
- 🟧 General portal robustness pass for customer-facing reliability.

---

## ⟳ CROSS-CUTTING RECURRENCES — affect ALL detail modals / selects (one fix each, app-wide)
- 🟧⟳ **Details-modal blur STILL not fixed** (MODAL-HAZE — was "resolved via portal"; not resolved on screen). Re-measure at runtime.
- 🟧⟳ **Flyouts/selects won't close** unless the three-dot is clicked (SELECT-LINGER — capture-phase close didn't fully take, or these selects don't use SearchableSelect). Seen in: Library leverancier modal, the Connect-New flyout, task status/date.
- 🟧⟳ **"New Workspace" ghost DBs reappear** when creating a connection via Connect-New (WORKSPACE-DB-GHOST — creation still not prevented on this path).
- 🟧 **Connect-New flyout only opens on the SECOND click** (the recurring "lingering/portal" event bug).
- 🟧 **Details modal: "Connect New" button conflicts with the close-modal button** (it was removed from the Connected-Records card → now collides with close). MODAL-LAYOUT regression.
- 🟧 **Details modal: remove the "Start your project journal" section** — superseded by the new journal card.
- 🟧⟳ **Journal card in detail: latest version incomplete** — finish the new journal-card build.
- 🟧⟳ **Notifications: "View" → 404** (the notif deep-link target route is wrong).
- 🟧 **Localisation incomplete** — app-wide i18n sweep (continues LOCALE-AUDIT).
- 🟥 **Formula engine: 20–25 character offset between click point and actual insertion point** → editing very difficult; engine feels unreliable overall. (Measure the click→caret mapping.)

---

## Per-module backlog (after the module's GENERAL gate passes)

### Quotations
- 🟧 Details modal "Edit quotation" button → goes to the STATUS pipeline kanban, NOT the edit engine. (Wrong nav target.)
- 🟨 Financial-analysis card: remove the black tooltip (useless).
- 🟦 Adapt the analysis to a QUOTE: quoted amount, workforce costs, overhead, margin/profit, quote-pertinent indicators (not the project-budget version).
- 🟨⟳ Engine: alignment of calculation elements & values is off (ENGINE-ROW-BREAK family — re-check).
- 🟨 "Meer acties" button — not localized.
- 🟨⟳ "Meer acties" button — blurred; Kanban three-dot flyout — blurred (blur family).

### Projects
- 🟧⟳ Tasks: a max-height CLIPS the flyouts → can't set status or date on a new task (cutting-mask / SELECT-PORTAL recurrence).
- 🟧⟳ Tasks: date picker opens the SYSTEM calendar, not the custom date picker (DATE-LOC).
- 🟧⟳ Tasks backlink button → full UI redraw TWICE + the sidebar resets→corrects→resets→settles (redraw + sidebar-migrate flicker).
- 🟦 Projects module incompletely developed — ongoing.

### Library
- 🟧⟳ Details modal (leverancier): flyout can't be closed unless the three-dot is clicked (SELECT-LINGER).
- 🟨 "Dekking pak" and "Stuks/Pak" — need clearer explanation/labels.
- 🟧⟳ Detail modal: formulas are EMPTY, not calculated (formula engine).

### Tasks (Florin: "overall not developed enough" — 🟦 larger build-out)
- 🟧 Does not scroll; Kanban does not scroll vertically.
- 🟧 Sections don't work — only the "No section" accordion; no way to create another section or change view.
- 🟧 Perspectives useless / insufficiently developed / not working.
- 🟧 Sidebar names show the raw VARIABLE names (i18n keys leaking).
- 🟦 Dependencies insufficiently developed.
- 🟦 GTD insufficiently developed.
- (file-upload Drive crash → see P0 data/crash above)

### Calendar
- 🟦 Seriously underdeveloped — needs a real build-out (scope TBD with Florin).

### Dashboard / Sales
- ✅ Stay as-is until future development (Florin).

---

## 🟦 Larger requests (scoped separately, post-ground-zero unless Florin pulls forward)
- **Superadmin module with freeform Notion-type databases** (Florin re-requested).
- Tasks full development (sections/perspectives/dependencies/GTD/scroll).
- Calendar development.
- Quotation analysis redesign.

---

## ═══ FULL SPECS (Planner 2026-06-27, "create all the work") ═══
Format: **ID** — ROOT (measured / ⟲reproduce-first) → FIX → VERIFY → `commit`. All on `develop`. Measure-confirm before coding (Rule 2).

### DATA-INTEGRITY (P0)
- **GRID-EDIT-ORDER-STABLE** — see the Contacts/Suppliers entry above (full spec there). Freeze grid row order during an active edit. `GRID-EDIT-ORDER-STABLE: freeze row order during active edit`.
- **TASKS-UPLOAD-BLOB** 🟥 — ROOT: `TaskDetailPanel.tsx` `handleUpload` (L433) reads each file with `reader.readAsDataURL` and stores the **base64 data-URL** into `prop-task-attachments` (inside the record's JSON properties). Large files → enormous base64 in the page record → bloats/crashes the app (the "google drive" impression is a red herring; the real fault is base64-in-properties). FIX: upload via `uploadFileAction(formData, 'task', taskId)` → store the returned **Blob key** (not data-URL) in `prop-task-attachments`; render via `/api/files/{key}`; keep `multiple`; show per-file uploading state. VERIFY: attach a large image + a PDF to a task → no crash, files stored as Blob keys, viewable, persist on reload. `TASKS-UPLOAD-BLOB: task attachments upload to Blob, not base64-in-record`.
- **PI-VAT-SOURCE** 🟥 — ROOT: `PurchaseInvoiceEngine.tsx` read view (L564-573) shows `resolvedSupplier.properties.title` / `.vatNumber` when a supplier is linked, but edit/save uses `editData.supplierName`/`supplierVat` → `page.properties.*`. The two paths read different sources, so a save doesn't "stick" and the supplier field shows a VAT / the VAT field shows empty (the linked supplier record's fields are mismatched/empty). FIX: read and edit/save must use ONE consistent source — display the SAVED `page.properties.supplierName`/`supplierVat` (so saves stick), using the resolved-supplier record only as a fallback when the page field is empty, and map supplier name←`title`, vat←`vatNumber` correctly. Also reproduce WHY `resolvedSupplier.title` reads as a VAT (supplier DB title field?). VERIFY: open a purchase invoice → supplier shows name, VAT shows VAT number; edit + save → values persist and display correctly after save (no revert). `PI-VAT-SOURCE: purchase-invoice supplier/vat read+save use one consistent source`.

### HR WORKFORCE SCHEDULER (P0 — Florin: redo)
- **WORKHUB-PROJECT-LINK** 🟧 (priority 0) — ⟲ the scheduler↔project connection must be real: project view shows its scheduled labor. **Planner-measured 2026-06-28:** Forward direction (shift→project) IS wired: `CreateShiftForm.tsx` state `projectId` sends to `createShift({ projectId, ... })` → persisted in `ScheduledShift.projectId String?` (schema L769). The `erp-projects` endpoint (`src/app/api/hr/[entity]/route.ts` L137-170) correctly merges `GlobalPage` (from dynamic projects DB, resolved via `locked['projects']`) + `InternalProject` records and returns `{ id, name }` for the picker. **MISSING (the actual gap):** the REVERSE direction — no project detail surface shows scheduled shifts. FIX: add a "Scheduled Labour" card to the project detail modal (`PageModal.tsx`) that fetches `prisma.scheduledShift.findMany({ where: { projectId: page.id, tenantId: ctx.tenantId }, orderBy: { shiftDate: 'asc' } })` via a new server action or API route, and renders employee name + date + start/end + role for each shift. Tenant-scope the query. Keep it read-only (this card just shows the data; edit stays in WorkHub). VERIFY: create a shift linked to a project → open that project's detail modal → the shift appears in the Scheduled Labour card; shifts for other projects/tenants don't appear. `WORKHUB-PROJECT-LINK: wire scheduler shifts to projects both directions`.
- **WORKHUB-PROJ-SELECT** 🟧 — ROOT: project select in `CreateShiftForm` doesn't work — it's a SearchableSelect inside a Radix dialog (SELECT-MODAL-DISMISS / SELECT-LINGER class) and/or not bound. After WORKHUB-1 dedup it should use the converged select. FIX: ensure the project picker opens, filters, selects, and the value binds to the shift; reuse the app select primitive; capture-phase close. VERIFY: create a shift → pick a project → it sticks. `WORKHUB-PROJ-SELECT: working project picker in shift modal`.
- **WORKHUB-MODAL-HEIGHT** 🟧 — keep the shift modal height consistent across Details/Tasks/Files tabs (no jump/reflow). `WORKHUB-MODAL-HEIGHT: consistent shift-modal height across tabs`.
- **WORKHUB-MODAL-TASKS** 🟧 — re-add on-the-fly task creation inside the shift modal (create task → link to shift/project). `WORKHUB-MODAL-TASKS: create tasks on the fly in shift modal`.
- **WORKHUB-MODAL-UPLOAD** 🟧 — shift Files: upload from local (Blob via uploadFileAction) AND a "project files" picker option. `WORKHUB-MODAL-UPLOAD: local + project-file attachment in shift modal`.
- **WORKHUB-SCHEDULE-FLAG** 🟧 — employee presence in the scheduler gated by a per-employee **"Schedule" checkbox** (a `schedule` boolean on Employee), NOT by `status==='ACTIVE'`. Add the field + the directory toggle; matrix lists employees where `schedule===true`. VERIFY: toggle Schedule on/off → employee appears/disappears in the matrix independent of active status. `WORKHUB-SCHEDULE-FLAG: scheduler presence via Schedule checkbox not active status`.

### PORTALS (P1)
- **PORTAL-VERIFY** ⟲ — confirm PORTAL-MEDIA-UPLOAD + PORTAL-MULTI-PROJECT actually work on the staging install (both "committed"); fix gaps found. Then a robustness pass for customer-facing reliability (auth, error states, empty states). `PORTAL-ROBUSTNESS: customer-portal reliability pass`.

### CROSS-CUTTING (one fix each, app-wide)
- **MODAL-HAZE-4** 🟧⟲ — blur STILL present though PageModal portals to body (L630). REPRODUCE at runtime: DevTools-inspect the panel's ancestors for `transform`/`filter`/`backdrop-filter`/`will-change`/`perspective`, AND the panel's own computed `transform` (fractional?) + `-webkit-font-smoothing`. Fix the actual compositing source found. Do NOT re-guess. `MODAL-HAZE-4: eliminate runtime-confirmed compositing blur source`.
- **SELECT-CLOSE-ALL** 🟧⟲ — flyouts still need a second/three-dot click to close (Library leverancier, Connect-New, task status/date) though SELECT-LINGER added capture-phase close to SearchableSelect. These selects likely AREN'T SearchableSelect. Identify each offending select component; apply the same capture-phase outside-close + Esc (or converge them onto SearchableSelect). VERIFY: each closes on a single outside click. `SELECT-CLOSE-ALL: capture-phase close on all flyout/select variants`.
- **WORKSPACE-GHOST-2** 🟧⟲ — "New Workspace" DBs reappear when creating a connection via Connect-New. WORKSPACE-DB-GHOST guarded one path; the Connect-New path still mints a default-named GlobalDatabase. Find the createDatabase call in the connect-new flow; guard against default/empty names. VERIFY: create a connection via Connect-New repeatedly → no ghost DBs. `WORKSPACE-GHOST-2: stop connect-new minting default databases`.
- **CONNECT-NEW-FLYOUT** 🟧 — the Connect-New flyout (in detail modal Connected-Records) only opens on the SECOND click, and its button collides with the modal close button (it was removed from the Connected-Records card). FIX: fix the open-on-first-click (event/portal timing, same family as SELECT-LINGER) and reposition so Connect-New doesn't overlap the modal close control. VERIFY: one click opens it; no overlap with close. `CONNECT-NEW-FLYOUT: first-click open + no close-button collision`.
- **MODAL-REMOVE-JOURNAL-STUB** 🟨 — detail modal: remove the legacy "Start your project journal" section (superseded by the new journal card). `MODAL-REMOVE-JOURNAL-STUB: drop legacy journal stub from detail modal`.
- **JOURNAL-CARD-FINISH** 🟧⟲ — finish the new journal-card build (latest version incomplete); confirm it uses linked entries (JOURNAL-SOURCE-FIX) + flows full height (JOURNAL-UNBOX) + per-line editor (JOURNAL-ENTRY-TYPE). `JOURNAL-CARD-FINISH: complete the new journal card`.
- **NOTIF-VIEW-404** 🟧⟲ — clicking "View" in a notification → 404. Measure the notif `href` builder; route to the correct record/module deep-link (reuse `/admin/database/{dbId}/{pageId}` like LinkedRecords). VERIFY: View opens the right record, no 404. `NOTIF-VIEW-404: fix notification view deep-link`.
- **FORMULA-CARET-OFFSET** 🟥⟲ — formula engine: 20-25 char offset between click point and caret insertion → editing very hard. REPRODUCE + measure the input's coordinate mapping (likely a transform/scroll/font-metric mismatch in the formula editor). Fix the click→caret mapping. VERIFY: click anywhere in a formula → caret lands exactly there. `FORMULA-CARET-OFFSET: fix click-to-caret mapping in formula editor`.
- **LOCALE-AUDIT-5** 🟨 — continue i18n sweep for remaining hardcoded strings + leaked keys (incl. "Meer acties", task sidebar variable names — see below). `LOCALE-AUDIT-5: i18n sweep remaining strings`.

### QUOTATIONS
- **QUOTE-EDIT-NAV** 🟧⟲ — the quotation details-modal "Edit quotation" button routes to the STATUS pipeline kanban (`/admin/quotations`) instead of the engine (`/admin/quotations/[id]`). Find the button; point it at the `[id]` engine route. VERIFY: Edit → opens the quote engine. `QUOTE-EDIT-NAV: edit button opens quote engine not pipeline`.
- **QUOTE-ANALYSIS-TOOLTIP** 🟨 — remove the black tooltip on the financial-analysis card (useless). `QUOTE-ANALYSIS-TOOLTIP: remove black tooltip`.
- **QUOTE-ANALYSIS-ADAPT** 🟦 — adapt the analysis card to a QUOTE: quoted amount, workforce cost, material/overhead, margin & profit, quote-pertinent indicators (replace the project-budget version when databaseId is db-quotations). `QUOTE-ANALYSIS-ADAPT: quote-specific financial analysis`.
- **QUOTE-MEER-ACTIES** 🟨 — "Meer acties" button: localize (i18n) + fix blur (same compositing family as MODAL-HAZE; also the kanban three-dot flyout blur). `QUOTE-MEER-ACTIES: localize + de-blur meer-acties and kanban flyout`.
- **ENGINE-ALIGN** 🟨⟲ — quote engine calc element/value alignment off (right-align numbers, consistent columns; ties ENGINE-ROW-BREAK). Measure + align. `ENGINE-ALIGN: align quote engine calc columns/values`.

### PROJECTS / TASKS
- **TASKS-FLYOUT-CLIP** 🟧⟲ — a max-height clips flyouts in Tasks → can't set status/date on a new task (cutting-mask / portal class). Portal the status/date flyouts to body (SELECT-PORTAL pattern); remove the clipping max-height. VERIFY: set status + date on a new task. `TASKS-FLYOUT-CLIP: portal task status/date flyouts out of clip`.
- **TASKS-DATEPICKER** 🟧 — task date opens the SYSTEM calendar, not the custom date picker (DATE-LOC). Wire the custom localized picker. `TASKS-DATEPICKER: use custom localized date picker in tasks`.
- **TASKS-BACKLINK-REDRAW** 🟧⟲ — task backlink → full UI redraw twice + sidebar reset flicker. Measure: the backlink nav forces a full remount + the sidebar store re-hydrates (ties SIDEBAR-MIGRATE). Make the backlink a scoped navigation (no full app remount); stabilize sidebar hydration so it doesn't flicker. `TASKS-BACKLINK-REDRAW: scoped backlink nav, no full redraw/sidebar flicker`.
- **TASKS-SCROLL** 🟧 — Tasks view doesn't scroll; Kanban doesn't scroll vertically. Fix the scroll containers (overflow + height; tie SCROLL-TRAP). `TASKS-SCROLL: vertical scroll for tasks list + kanban`.
- **TASKS-SECTIONS** 🟧⟲ — sections don't work (only "No section"); no way to create another or change grouping/view. Build section CRUD + grouping. `TASKS-SECTIONS: create + group by sections`.
- **TASKS-PERSPECTIVES** 🟦⟲ — perspectives broken/insufficient. Scope + build proper saved views/perspectives. `TASKS-PERSPECTIVES: working saved perspectives`.
- **TASKS-I18N-NAMES** 🟨 — task sidebar shows raw VARIABLE names (i18n keys leaking). Map to translated labels. `TASKS-I18N-NAMES: translate task sidebar labels`.
- **TASKS-DEPENDENCIES** 🟦 — dependencies underdeveloped (ties GRID-11-2). Build blockedBy/blocks + indicators. `TASKS-DEPENDENCIES: task dependencies + blocked indicator`.
- **TASKS-GTD** 🟦 — GTD workflow underdeveloped; scope with Florin. `TASKS-GTD: GTD workflow build-out`.

### LIBRARY
- **LIB-FLYOUT-CLOSE** 🟧 — leverancier flyout can't close unless three-dot clicked → covered by SELECT-CLOSE-ALL. (no separate commit if that fixes it; else `LIB-FLYOUT-CLOSE`).
- **LIB-LABELS** 🟨 — "Dekking pak" + "Stuks/Pak" need clearer labels/help text (Florin to supply exact wording). `LIB-LABELS: clarify Dekking/Stuks-Pak labels`.
- **LIB-FORMULAS-EMPTY** 🟧⟲ — library detail-modal formulas show empty, not calculated. Measure: formula columns not evaluated in the detail modal context (vs grid). Wire formula evaluation in the detail view. `LIB-FORMULAS-EMPTY: evaluate formulas in library detail modal`.

### CALENDAR
- **CALENDAR-BUILDOUT** 🟦⟲ — seriously underdeveloped; scope a real build with Florin (views, event CRUD, provider-agnostic per CAL-4). Parked until scoped. `CALENDAR-*`.

### LARGER (post-ground-zero unless pulled forward)
- **SUPERADMIN-DB** 🟦 — Superadmin module with freeform Notion-type databases (Florin re-requested). Scope: a superadmin-only workspace using the existing GlobalDatabase/NotionGrid engine, ungated schema. `SUPERADMIN-DB-*` (phased).


- Every ⟳ item is a "committed-but-not-working" — do NOT mark done from a commit; only Florin's confirmation on the **staging install** closes it.
- P0 data-integrity items (Contacts wrong-row, Tasks Drive-crash, PI VAT save-revert) override module ordering — they're the GENERAL gate failing.
- Full per-item diagnosis + file/line spec is written just-in-time as each rises to the top of the work queue (measure-first, pd Rule 2) — not all upfront.
