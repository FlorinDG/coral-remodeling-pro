# CORAL — PLAN — WH-7 · Rebuild the Shift Editor

> Directive: `.agents/workflows/coder-directive-wh-7.md`  
> Author: Antigravity AI  
> Date: 2026-10-04  
> Status: 🟦 PLAN FIRST — Gate 1 (Stop for Planner Review)

---

## 1. The Pure Model: Exported Functions, Signatures, and Test Proofs

All core calculation, form state validation, recurrence expansion, payload formatting, and lock evaluation are separated into a zero-dependency, pure TypeScript module:  
`src/components/time-tracker/components/schedule/shift-editor/model.ts` (zero React, zero `fetch`, zero I/O).

### 1.1 Core Types & Interfaces

```ts
export type ShiftScheduleType = 'single' | 'recurring' | 'leave';
export type ShiftEditScope = 'occurrence' | 'following' | 'series';

export interface ShiftEditorFormInput {
  userIds: string[];
  projectId?: string | null;
  contactPageId?: string | null;
  shiftDate: string;        // 'YYYY-MM-DD'
  shiftEndDate?: string;     // 'YYYY-MM-DD' (for multi-day or leave)
  shiftStart: string;       // 'HH:mm'
  shiftEnd: string;         // 'HH:mm'
  role?: string | null;
  notes?: string | null;
  siteAddress?: string | null;
  materialsEnabled: boolean;
  scheduleType: ShiftScheduleType;
  // Recurrence configuration
  recurringWeeks?: number;   // 1..52
  selectedDays?: number[];   // 0 (Sun) .. 6 (Sat)
  // Leave configuration
  leaveReason?: string;
  includeWeekends?: boolean;
}

export interface ShiftValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface CreateShiftPayload {
  user_id: string;
  project_id?: string | null;
  contactPageId?: string | null;
  shift_date: string;
  shift_start: string;
  shift_end: string;
  role?: string | null;
  notes?: string | null;
  siteAddress?: string | null;
  materialsEnabled?: boolean;
  status: string;
  shiftName?: string;
  seriesId?: string;
}

export interface UpdateShiftPayload {
  user_id?: string;
  project_id?: string | null;
  contactPageId?: string | null;
  shift_date?: string;
  shift_start?: string;
  shift_end?: string;
  role?: string | null;
  notes?: string | null;
  siteAddress?: string | null;
  materialsEnabled?: boolean;
  seriesId?: string;
}

export interface ShiftLockState {
  locked: boolean;
  reason?: string;
  signedNumber?: string;
  signedBy?: string;
  signedAt?: string;
}
```

### 1.2 Exported Functions & Signatures

```ts
/**
 * Validates shift editor input for both create and edit flows.
 * Ensures valid dates (YYYY-MM-DD), valid times (HH:mm), non-empty workers,
 * valid date range ordering (end >= start), and recurrence/leave requirements.
 */
export function validateShiftForm(input: ShiftEditorFormInput): ShiftValidationResult;

/**
 * Expands recurring shift dates across weeks for given days of week.
 * DST-SAFE: built strictly using kernel `shiftMoment` at local noon (12:00)
 * and formatted via `localDateKey`. Never uses `toISOString()` or midnight Date arithmetic.
 */
export function expandRecurringShiftDates(
  startDate: string,
  recurringWeeks: number,
  selectedDays: number[]
): string[];

/**
 * Expands multi-day consecutive dates (e.g. for leave or multi-day single jobs).
 * Filters out weekend days when `includeWeekends` is false.
 */
export function expandRangeShiftDates(
  startDate: string,
  endDate: string,
  includeWeekends: boolean
): string[];

/**
 * Builds the exact array of payloads for `onCreateShift`.
 * - For multi-worker single-day shifts: assigns the SAME `seriesId` to all workers (WO-2 work order grain).
 * - For recurring shifts: assigns the same `seriesId` to all occurrences in the series.
 * - For leave: enforces 08:00–17:00, status `'leave'`, and sets `shiftName` to `leaveReason`.
 */
export function buildCreateShiftPayloads(
  input: ShiftEditorFormInput,
  seriesIdGenerator?: () => string
): CreateShiftPayload[];

/**
 * Builds the update payload for `onUpdateShift(shiftId, payload, scope)`.
 */
export function buildUpdateShiftPayload(
  input: ShiftEditorFormInput,
  seriesId?: string | null
): UpdateShiftPayload;

/**
 * When converting an existing single shift to recurring in EditShiftDialog:
 * generates payloads for the ADDITIONAL dates (skipping the original date, which is updated).
 */
export function buildRecurringExpansionFromExisting(
  input: ShiftEditorFormInput,
  existingShiftDate: string,
  seriesId: string
): CreateShiftPayload[];

/**
 * Pure evaluation of whether a shift is locked based on its status and audit log rows.
 * Detects client signature rows (`action === 'sign'`) and completed/submitted shifts.
 */
export function evaluateShiftLockState(
  status: string | null | undefined,
  auditLogs?: Array<{ action: string; createdAt?: string; after?: any }>
): ShiftLockState;
```

### 1.3 Test Specifications & Throw Proofs (`tests/shift-editor-model.test.ts`)

Every test must have an explicit proof and a stated, verified throw condition:

| # | Test | What It Proves | Throw Proof (How It Can Fail) |
|---|---|---|---|
| 1 | `validateShiftForm — worker required` | `valid: false` and `errors.userIds` populated when `userIds` is empty | Remove empty check in `validateShiftForm`; assertion `expect(res.valid).toBe(false)` throws |
| 2 | `validateShiftForm — date ordering` | `valid: false` and `errors.shiftEndDate` when `shiftEndDate < shiftDate` | Invert date comparison `end >= start`; assertion `expect(res.valid).toBe(false)` throws |
| 3 | `validateShiftForm — recurring days required` | `valid: false` when `scheduleType === 'recurring'` and `selectedDays` is empty | Omit check for `selectedDays.length === 0`; assertion `expect(res.valid).toBe(false)` throws |
| 4 | `validateShiftForm — leave reason required` | `valid: false` when `scheduleType === 'leave'` and `leaveReason` is blank | Remove check `!input.leaveReason?.trim()`; assertion `expect(res.valid).toBe(false)` throws |
| 5 | `expandRecurringShiftDates — DST transition safe` | Generates identical weekday calendar dates across the spring clock change (e.g. 2026-03-29 in `Europe/Brussels`) without day slipping or time skew | Replace `shiftMoment(..., '12:00')` + `localDateKey` with `new Date('YYYY-MM-DD')` + `.toISOString().split('T')[0]`; assertion on Sunday 2026-03-29 throws due to UTC slip |
| 6 | `expandRecurringShiftDates — week count & day filtering` | Returns exactly `recurringWeeks * selectedDays.length` sorted unique dates | Decrement loop bound `week < recurringWeeks - 1`; assertion `expect(dates).toHaveLength(expected)` throws |
| 7 | `expandRangeShiftDates — weekend exclusion` | Omits Saturdays (6) and Sundays (0) when `includeWeekends = false` | Comment out `if (!includeWeekends && (day === 0 || day === 6)) continue`; assertion throws on weekend dates |
| 8 | `buildCreateShiftPayloads — multi-worker seriesId` | Multiple workers scheduled together receive the exact same `seriesId` (WO-2 work order visit) | Generate separate random IDs inside the worker loop; assertion `expect(p[0].seriesId).toBe(p[1].seriesId)` throws |
| 9 | `buildCreateShiftPayloads — single worker single day has no seriesId` | A solo shift on one day has `seriesId: undefined` (independent work order) | Unconditionally assign `seriesId`; assertion `expect(p[0].seriesId).toBeUndefined()` throws |
| 10 | `buildCreateShiftPayloads — leave formatting` | Formats leave shift: start `'08:00'`, end `'17:00'`, status `'leave'`, `shiftName` equal to reason | Preserve custom start/end or set status `'scheduled'`; assertion `expect(p[0].status).toBe('leave')` throws |
| 11 | `buildRecurringExpansionFromExisting — skips original date` | Spawning recurring dates from an existing shift skips `existingShiftDate` to prevent duplicate record | Remove the `dateStr === existingShiftDate` continue check; assertion on `payloads.length` throws |
| 12 | `evaluateShiftLockState — signed work order detection` | Returns `locked: true`, extracts `signedNumber` and `signedBy` when audit log contains `action: 'sign'` | Return `locked: false`; assertion `expect(lock.locked).toBe(true)` throws |

---

## 2. Work Order Lock: Detection & Visual Appearance

### 2.1 How the Editor Learns a Shift is Signed (Read Path)
- **Primary Source (Server SSOT):**  
  On dialog open, `EditShiftDialog` executes:  
  `hrList('audit-logs', { entityType: 'shift', entityId: shift.id })`  
  This calls existing route `GET /api/hr/audit-logs?entityType=shift&entityId=${shift.id}` (which queries `prisma.auditLog` with `tenantId` and `entityType: 'shift'`).
- **Signature Detection:**  
  The helper `evaluateShiftLockState(shift.status, auditLogs)` checks for a log with `action === 'sign'`.  
  When present, the payload in `log.after` yields:
  - `number`: Work order number (e.g. `WB-2026-0004`)
  - `signerName`: Name of client signatory (e.g. `Familie Janssens`)
  - `createdAt`: Date/time of signing
- **Fallback / Concurrency Guard:**  
  If a write is attempted concurrently and the server responds with HTTP 409 or error message containing `work_order_signed`, the editor catches `HrApiError`, triggers toast error, and instantly flips into the locked state.
- **Strict Compliance:**  
  Zero new API routes. Zero changes to `src/app/api/hr/[entity]/route.ts`. Read-only consumption of existing endpoints.

### 2.2 Visual Appearance of the Locked State
When `lock.locked` is `true`:
1. **Prominent Lock Banner (Amber / Gold styling):**
   - Icon: `<Lock className="h-5 w-5 text-amber-600" />`
   - Title: **"Werkbon ondertekend door klant · Wijzigingen vergrendeld"**
   - Subtext:  
     `Ondertekend door ${signerName || 'klant'} op ${signedAtFormatted} (Werkbon ${signedNumber || 'WB'}). Deze dienst kan niet meer worden gewijzigd of verwijderd.`
2. **Form Controls State:**
   - Worker, Project, Date, Start Time, End Time, Role, Status, Description (`notes`), Site Address, Materials checkbox: **all set to `disabled`**.
   - "Make Recurring" section: **hidden**.
   - Scope picker: **disabled / hidden**.
3. **Tab Accessibility:**
   - **Details Tab:** Read-only inspection of all values.
   - **Tasks Tab:** Assigned tasks can be viewed, but "Add Task", "Quick create task", and "Remove Task" buttons are disabled/hidden.
   - **Attachments Tab:** Upload button and delete buttons disabled. Files remain clickable to download/view (including the signed PDF and signature image `Handtekening — ...png`).
4. **Footer Actions:**
   - **Delete button:** Completely hidden.
   - **Save Changes button:** Replaced with a single **"Sluiten"** (Close) button.

---

## 3. Feature Inventory & Mapping (Old → New)

Every single feature measured in `CreateShiftForm.tsx` (2,035 lines), `EditShiftDialog.tsx` (935 lines), and `useScheduleAttachments.ts` (142 lines) is inventoried and mapped to its exact place in the new architecture. Nothing is dropped.

| Area | Old File & Lines | Implementation Details Today | New Location in `shift-editor/` | Notes / Elimination of Debt |
|---|---|---|---|---|
| **Recurrence / Series** | `CreateShiftForm.tsx:175-177, 456-501, 770-795, 946-1025` | Single vs Recurring toggle, weekdays (Sun-Sat), N weeks (1-52). | `model.ts:expandRecurringShiftDates` & `shift-editor/CreateShiftForm.tsx` | Kernel-backed (`shiftMoment`, `localDateKey`), replaces local Date arithmetic. |
| **Series Scope** | `EditShiftDialog.tsx:360-371, 605-614` | ScopePicker with `occurrence`, `following`, `series`. | `shift-editor/EditShiftDialog.tsx` | Passes `scope` to `onUpdateShift` and `onDeleteShift`. |
| **Convert to Recurring** | `EditShiftDialog.tsx:320-358, 565-603` | Single shift converted to recurring series via `onCreateShift` loop. | `model.ts:buildRecurringExpansionFromExisting` & `shift-editor/EditShiftDialog.tsx` | Replaces `.toISOString().split('T')[0]` with kernel `localDateKey`. |
| **Leave Shifts** | `CreateShiftForm.tsx:503-552, 796-803, 840-880` | Leave schedule type, multi-day consecutive dates, weekend exclusion, 08:00-17:00, reason. | `model.ts:expandRangeShiftDates` & `shift-editor/CreateShiftForm.tsx` | Standardized leave payload construction. |
| **Templates (List/Apply)** | `CreateShiftForm.tsx:152, 222-233, 337-346, 805-825` | Fetch `shift-templates`, apply start, end, project, role, notes. | `shift-editor/CreateShiftForm.tsx` | Uses `hrList('shift-templates')`. |
| **Templates (Save/Delete)** | `CreateShiftForm.tsx:180-183, 441-452, 609-617, 1168-1195` | Save current form as template, delete template via `hrDelete`. | `shift-editor/CreateShiftForm.tsx` | Clean error handling with `toast`. |
| **Tasks Tab (Edit)** | `EditShiftDialog.tsx:250-307, 635-775` | List assigned shift tasks, toggle worker completion, assign from project tasks, quick create task. | `shift-editor/components/ShiftTasksTab.tsx` | Uses existing `useShiftTasks` & `useTasks`. |
| **Tasks Link (Create)** | `CreateShiftForm.tsx:55-77, 192-205, 348-385, 498, 560-562, 1200-1280` | Select tasks to link upon shift creation. | `shift-editor/CreateShiftForm.tsx` | Cleaner selector, assigns tasks post-creation. |
| **Attachments (Edit)** | `EditShiftDialog.tsx:148-180, 230-248, 780-870` & `useScheduleAttachments.ts:1-142` | Upload shift files, add from project, view, delete. | `shift-editor/components/ShiftAttachmentsTab.tsx` | **Eliminates `useScheduleAttachments.ts`**. Uses `uploadFileAction` + `addShiftFile` from `src/lib/data/shift-files.ts`. |
| **Attachments (Create)** | `CreateShiftForm.tsx:65-72, 206-220, 387-425, 497, 558, 1285-1360` | Queue attachments to upload after shifts are created. | `shift-editor/CreateShiftForm.tsx` | Uses `uploadFileAction` + `addShiftFile`. |
| **Fields: Workers** | `CreateShiftForm.tsx:156-174, 827-838` & `EditShiftDialog.tsx:123, 435-444` | Multi-select for create form; single select for edit dialog. | `shift-editor/CreateShiftForm.tsx` & `shift-editor/EditShiftDialog.tsx` | `WorkerOption` from `types/timesheet.ts`. |
| **Fields: Project & Client** | `CreateShiftForm.tsx:160-165, 839-850` & `EditShiftDialog.tsx:124, 447-458` | Project selection; order giver picker (`erp-clients`). | `shift-editor/CreateShiftForm.tsx` & `shift-editor/EditShiftDialog.tsx` | Uses `SearchableSelect`. |
| **Fields: Times & Role** | `CreateShiftForm.tsx:166-170, 885-940` & `EditShiftDialog.tsx:126-128, 488-525` | `shiftStart`, `shiftEnd`, `role` (`ROLE_OPTIONS`). | `shift-editor/CreateShiftForm.tsx` & `shift-editor/EditShiftDialog.tsx` | Form validation via `model.ts`. |
| **Fields: Work Order Description** | `CreateShiftForm.tsx:172, 1080-1095` & `EditShiftDialog.tsx:129, 540-550` | `notes` field labelled "Description — printed on the client's signed work order". | `shift-editor/CreateShiftForm.tsx` & `shift-editor/EditShiftDialog.tsx` | Preserved verbatim. |
| **Fields: Site Address & Materials** | `CreateShiftForm.tsx:173-174, 1100-1120` & `EditShiftDialog.tsx:130-131, 551-562` | `siteAddress` (execution address) and `materialsEnabled` toggle. | `shift-editor/CreateShiftForm.tsx` & `shift-editor/EditShiftDialog.tsx` | Preserved verbatim. |
| **Work Order seriesId (WO-2)** | `CreateShiftForm.tsx:461, 520` | Multiple workers created together share one `seriesId` per day/visit. | `model.ts:buildCreateShiftPayloads` | Deterministic unit-tested logic. |
| **Inline Create Project** | `CreateShiftForm.tsx:628-725` | Modal inside form to create a project with name, address, color. | `shift-editor/components/InlineCreateProjectModal.tsx` | Clean modal helper. |
| **Dual Dialog Modes** | `CreateShiftForm.tsx:732-1390` vs `1396-2035` | Uncontrolled (+ Schedule button) vs Controlled (`open`, `prefilledUserId`, `prefilledDate`). | `shift-editor/CreateShiftForm.tsx` | Single unified component; avoids 650 lines of duplicate JSX. |

---

## 4. Milestones & Click-Through Verification

### M1 · The Pure Model & Unit Tests
- **Artifacts:**  
  - Create `src/components/time-tracker/components/schedule/shift-editor/model.ts`
  - Create `tests/shift-editor-model.test.ts`
- **Scope:** Zero React components, zero UI, zero API calls. Pure logic for validation, date expansions, payload building, and lock state evaluation.
- **Verification:**  
  Run `npx vitest run tests/shift-editor-model.test.ts`.  
  Confirm 12/12 tests green with explicit throw proofs documented.

### M2 · The Edit Dialog (`shift-editor/EditShiftDialog.tsx`)
- **Artifacts:**  
  - Create `src/components/time-tracker/components/schedule/shift-editor/EditShiftDialog.tsx`
  - Create `src/components/time-tracker/components/schedule/shift-editor/components/ShiftTasksTab.tsx`
  - Create `src/components/time-tracker/components/schedule/shift-editor/components/ShiftAttachmentsTab.tsx`
  - Create `src/components/time-tracker/components/schedule/shift-editor/components/ShiftLockBanner.tsx`
- **Scope:** Replaces `EditShiftDialog.tsx` functionality on the new model. Implements signed work order lock banner, read-only mode for locked shifts, scope picker, tasks tab, and attachments tab using `addShiftFile` (eliminating `useScheduleAttachments`).
- **Florin Click-Through Verification:**
  1. Open existing open shift in Schedule -> edit time, role, notes -> save changes -> updates successfully.
  2. Open an existing signed shift (work order signed) -> verify prominent gold lock banner is displayed with work order number and signer; all inputs are disabled, delete button is hidden, save button is replaced by "Sluiten".
  3. Open a series shift -> verify scope picker appears with "This occurrence only", "This and following", "All in series".
  4. View Tasks and Attachments tabs on both open and signed shifts.

### M3 · The Create Form (`shift-editor/CreateShiftForm.tsx`)
- **Artifacts:**  
  - Create `src/components/time-tracker/components/schedule/shift-editor/CreateShiftForm.tsx`
  - Create `src/components/time-tracker/components/schedule/shift-editor/components/InlineCreateProjectModal.tsx`
- **Scope:** Replaces `CreateShiftForm.tsx` functionality on the new model. Eliminates the 650-line JSX duplication between controlled and uncontrolled dialogs. Supports single, recurring, and leave shifts. Multi-worker single-workorder series assignment. Template loading and saving. Inline project creation.
- **Florin Click-Through Verification:**
  1. Click "+ Schedule Shift" in top navigation bar -> opens create dialog.
  2. Click "+" button on a specific employee/date cell in the Matrix view -> dialog opens pre-filled with that worker and date.
  3. Select multiple employees for a single day -> save -> confirm created shifts share a single `seriesId` (one work order).
  4. Create recurring shift for Mon/Wed over 3 weeks -> verify all shifts populate on the correct weekdays.
  5. Create a Leave entry -> confirm shift created with 08:00–17:00 and status `'leave'`.
  6. Use "Save as template", select the template, and delete the template.

### M4 · Switch, Deprecation & Cleanup
- **Actions:**
  1. In `src/components/time-tracker/components/admin/ScheduleManagement.tsx`: update imports of `CreateShiftForm` and `EditShiftDialog` to `@/components/time-tracker/components/schedule/shift-editor`.
  2. Verify with `git grep` that no other file imports the old `CreateShiftForm`, `EditShiftDialog`, or `useScheduleAttachments`.
  3. Delete `src/components/time-tracker/components/schedule/CreateShiftForm.tsx`.
  4. Delete `src/components/time-tracker/components/schedule/EditShiftDialog.tsx`.
  5. Delete `src/components/time-tracker/hooks/useScheduleAttachments.ts`.
  6. In `eslint.config.mjs`: remove lines 264–266 (`CreateShiftForm.tsx`, `EditShiftDialog.tsx`, `useScheduleAttachments.ts`) from the SUPA-2 grandfathered allowlist.
  7. Run `npm run test:compile`, `npm run test:lint`, and test suite to ensure 0 lint errors, 0 type errors, and full green test pass.
- **Florin Click-Through Verification:**
  - Full end-to-end regression check in Schedule (both Table view and Matrix view): scheduling, editing, converting to recurring, dragging, deleting.

---

## 5. Open Questions & Alignment

1. **`seriesId` generation algorithm:**  
   In today's `CreateShiftForm.tsx`, `seriesId` is generated as `Math.random().toString(36).substring(2, 9)`.  
   *Proposal:* Use standard `crypto.randomUUID()` in the browser / model (or clean random generator `Math.random().toString(36).slice(2, 10)`).
2. **Converting single shift to recurring in Edit Dialog:**  
   When an existing shift without a `seriesId` is converted to recurring via "Make Recurring", should the editor assign a new `seriesId` to both the updated existing shift and the newly created occurrences?  
   *Proposal:* Yes, generate one `seriesId`, apply it in the `onUpdateShift` payload for the existing shift, and use the same `seriesId` for all newly spawned occurrences.
3. **Locked shift PDF preview:**  
   Should the locked state banner include a direct "Werkbon bekijken" (View Work Order) button if a signed PDF or signature attachment exists on the shift?  
   *Proposal:* Yes, if a work order attachment exists, render a clean link button in the banner to view it directly.

---

## PLANNER REVIEW — 2026-10-05 · ✅ APPROVED WITH CORRECTIONS · GO for M1 only (stop after M1 for review)

Good plan: the inventory is thorough (file:line), the model is the right cut, the lock is read-only, the old
files die at M4. These corrections are binding; where the plan says otherwise, this section wins.

**C1 · Test runner.** This repo runs `node --import ./tests/register.mjs --test 'tests/*.test.ts'` with
`node:test` + `node:assert/strict`. No vitest, no `expect`. (See `tests/shift-time.test.ts` for the style.)

**C2 · Payloads are camelCase `Partial<ScheduledShift>` — never snake_case.** The hook
(`useScheduledShifts.createShift/updateShift`) takes `Partial<ScheduledShift>`; its snake_case normalising is the
DECLARED BRIDGE (TD-5) that dies when the last legacy writer dies — which is this rebuild. Your `CreateShiftPayload`
/ `UpdateShiftPayload` (user_id, shift_date, …) would be a NEW writer of the bridge. Derive the payload types from
`ScheduledShift` (`Pick<…>` / `Partial<…>`): `userId, shiftDate, shiftStart, shiftEnd, shiftName, projectId,
contactPageId, role, notes, siteAddress, materialsEnabled, status, seriesId`. A test asserts no payload key
contains `_` (throw proof: emit `user_id`).

**C3 · Calendar days through the kernel — no Date at all.** The Planner added (kernel, tested, throw proof under
`TZ=Europe/Brussels`): `addDaysYmd(ymd, n)`, `weekdayOfYmd(ymd)` (0 = Sunday), `daysBetweenYmd(a, b)` in
`src/lib/kernel/shift-time.ts`. `expandRecurringShiftDates` / `expandRangeShiftDates` use ONLY these — not
`shiftMoment` at noon, not `new Date`. Your throw proof #5 as written cannot fail (`new Date('YYYY-MM-DD')` +
`toISOString` round-trips in UTC): run the DST test with `TZ=Europe/Brussels` and mutate to local-Date `+ n days`
→ show it fail. State the exact command.

**C4 · The lock is the SIGNATURE, nothing else.** `evaluateShiftLockState(auditLogs)` — `locked` only when a row
with `action === 'sign'` exists for THIS shift (signing writes one per member shift — `lib/data/work-order.ts`).
Drop "completed/submitted shifts": that is a rule the server does not have; the editor never invents one. Read path
as proposed (`hrList('audit-logs', { entityType: 'shift', entityId })`), plus the 409 `work_order_signed` fallback.
The lock also covers the Tasks and Attachments tabs (the server refuses shift-tasks / shift-attachments writes on a
signed shift).

**C5 · Keep today's behaviour exactly — characterise before you replace.** For `expandRecurringShiftDates`,
`expandRangeShiftDates`, `buildCreateShiftPayloads` (incl. when a solo shift gets a `seriesId`, the leave hours
08:00–17:00, the leave `shiftName`): add fixtures whose expected output is what TODAY's `CreateShiftForm` produces
(cite the lines), apart from the DST slip, which is the bug being fixed. Anything you change on purpose: list it in
the report as a behaviour change — no silent ones.

**C6 · Answers.** Q1: `crypto.randomUUID()`. Q2: yes — one new `seriesId` on the existing shift (via
`onUpdateShift`) and on every new occurrence. Q3: yes — the banner links the PDF when this shift's attachments hold
one; recognise it with `isWerkbonFile(name)` (`src/lib/records/werkbon-number.ts`, added by the Planner) — never by
guessing from the name yourself.

**Fence unchanged** (directive §FENCE). M1 = `shift-editor/model.ts` + `tests/shift-editor-model.test.ts` + the
report `.agents/reports/WH-7-M1.md`. Push, STOP.

**C7 (Planner 2026-10-05, after Florin's werkbon review)** — the signed work order is its OWN block, not an
attachment: render `<WerkbonCard shiftId=… />` (`src/components/time-tracker/components/werkbon/WerkbonCard.tsx`,
read-only, already used by today's dialog) at the top of the details AND attachments tabs, and list attachments
through `isWerkbonArtifact(att, isWerkbonFile)` (`src/lib/records/werkbon-status.ts`) so the PDF and any legacy
signature image never appear among them. Do not show the signature image anywhere (privacy).
