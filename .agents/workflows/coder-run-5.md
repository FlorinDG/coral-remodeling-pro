# CORAL — AUTHORISED RUN #5 — everything open and unblocked, in order — Planner 2026-09-21

**This is the consolidated list.** Run 4 is closed. Every item below is **actionable now** — none waits on `R1`, `R5` or a Florin decision, except where marked.

**Work in order. One item, committed and reported, before the next.** `coral-execution-order.md` §🔒 applies.

**Every report ends with two numbers:**
```bash
# DI progress — 121 (allowlist length in eslint.config.mjs). The old grep said 70; it missed double quotes.
# and the DISPLACEMENT COUNT for any primitive touched (pd.md)
```

---

# PHASE A — THE GATE. **Nothing else in this run matters as much.** 🟥

**Until this exists, every rule in `pd.md` is a convention.** `BLOB-3` held for weeks because we watched it, not because anything stopped it — and `PANEL-1` shipped with five unmigrated consumers because nobody counted.

### `A1` · `PRE-1` — the import-boundary gate
- [ ] `no-restricted-imports` zones (or `dependency-cruiser`), wired into **`npm run validate` and CI**:
  - **Only `lib/storage`** imports `@vercel/blob`
  - **Nothing under `app/api/cron`** imports `prisma` *(ready ahead of `R5`)*
  - **Nothing outside `lib/data`** touches `prisma.<tenantModel>` — **write it now, switch it on with `R1-4`**
  - L0 modules import nothing from `src/components` or `src/app`
- [ ] `CLEAN-1`: remove the dead `eslint` key from `next.config.ts`. **`next build` currently does not lint at all.**
- [ ] `PRE-4`: add `* [0-9].*` to `tsconfig.json` `exclude`. *(`.gitignore` already has it; **gitignore does not stop the compiler**.)*

### `A2` · `PRE-1c` — prove it
- [ ] **Add a deliberate violation, watch CI go red, remove it.** 🛑 **An untested gate is not a gate.** Report the red output.

### `A3` · `PRE-1b` — uncover the excluded module
- [ ] Remove `src/components/time-tracker/**` from `eslint.config.mjs` `globalIgnores`.
- [ ] 🔴 **Land the findings as WARNINGS, not errors.** Expect many. **The point is visibility today; the cleanup is `LOC-2/3`.**
- [ ] **Report the count.** *(This module kept its own `i18n/`, `contexts/` and `lib/` precisely because nothing checked it.)*

---

# PHASE B — CORRECTNESS ON THE MONEY PATH 🟥

### `B1` · `KERN-1` — the document key parse
- [ ] `resolveDocumentKey` decodes after stripping `/api/files/`, per segment, as `api/files/[...key]/route.ts:26` does.
- [ ] 🔴 **One parse, one helper in `lib/storage`; the route calls it too.**
- [ ] 🛑 **Tenant-prefix assert byte-identical afterwards.**
- [ ] Tests: encoded · bare · foreign-tenant · malformed.

### `B2` · `BLOB-7` — a document cannot be replaced
- [ ] `storage.put(key, data, { overwrite?: boolean })`, **default `false`**, passed to `allowOverwrite`.
- [ ] 🔴 **Archive paths pass `false` explicitly** — `document-archive`, `peppol/inbox`, `backfill-peppol`. **Never `true`.**
- [ ] `uploadFileAction` passes `true`.
- [ ] Named errors, not the provider's string. Distinguish *"name already used"* from *"document is archived"*. en/nl/fr/ro.
- [ ] `BLOB-7c`: **check all three `uploadFileAction` callers handle `success: false`** — `PageModal:1222`, `PurchaseInvoiceEngine:169`, `AiDocumentImportModal:59`. **Report any that ignore it.**

### `B3` · `DI-1` — `notify()` takes a scope
`coder-directive-di-notif.md` — **read the PLANNER CORRECTION first.**
- [ ] `notify(params, scope)` — **required**, no default.
- [ ] 🛑 **`tenantId` leaves `NotifyParams` entirely.** Not optional — **absent.**
- [ ] 🛑 **Delete the assignee→tenant lookup.** That is tenancy resolution in L1.
- [ ] Remove `import prisma` from `lib/notifications.ts`.
- [ ] 🔴 **Proof:** move `node_modules/.prisma` aside; `tests/notifications.test.ts` must still pass.

### `B4` · `NOTIF-3` — the legacy default
- [ ] `deliveryStatus` column default becomes **`'Dispatched'`** (Florin, 2026-09-21), not `'delivered'`. `notify()` writes `'delivered'` explicitly for in-app.
- [ ] ⚠️ **Migration not yet run** — fold this in before Florin runs it, or it is a second migration.

---

# PHASE C — DISPLACEMENT. **Finish what the primitives started.** 🟧

*`pd.md` DISPLACEMENT RULE. Each item ends with a count.*

### `C1` · `PANEL-5` — five unmigrated relation consumers
- [ ] `KanbanView` · `useGridColumns` · `SpreadsheetImportModal` · `PropertyMentionBlock` · `PageModal` adopt `lib/relations/resolve`.
- [ ] **Report the remaining count.** `PANEL-1` claimed three consumers; there were eight.

### `C2` · `SCROLL-2` — two files roll their own scroll lock
- [ ] `ProjectGallery.tsx` and `admin/Modal.tsx` adopt `useScrollLock`.
- [ ] **Grep gate:** `body.style.overflow` only inside `useScrollLock`.

### `C3` · `KERN-3b` — the docstring that lies
- [ ] `lib/database-identity.ts` stops claiming to be server-side. **Say what is true**, and that `CUSTOM-6` must call a server action.
- [ ] Same note on `store.createDatabase`.
- [ ] 🛑 **No behaviour change.** Florin has chosen to leave the capability; only the claim is wrong.

### `C4` · `JOURNAL-PROV-1/2` + `AUDIT-UNRESOLVED`
- [ ] Journal: creation path **deleted** *(already gone — confirm)*, honest *"not available for this workspace yet"* state.
- [ ] `journal:99` and `:106` resolve `GENERAL_DB_ID` through `resolveDbId`, like `:103-105` beside them.
- [ ] 🔴 **Then sweep:** find every other place where a bare `db-*` read sits beside a resolved sibling. **Report the list. Do not fix beyond the journal.**

---

# PHASE D — VISIBLE, CHEAP 🟨

- [ ] `D1` · `DOC-VOCAB-1` — `bordereau/[id]:62,:81` stop saying **Werkbon**. Through the catalogue, en/nl/fr/ro. `admin/hr/timesheets/[id]` keeps the word. **Check what `nl.json` `viewWorkOrder` opens before touching it.**
- [ ] `D2` · `CLEAN-8` — widen the filter value input.
- [ ] `D3` · `SP-5` — remove the toolbar period picker; the dialog owns the period.
- [ ] `D4` · `KERN-2` — `ui/dialog.tsx` centres without a fractional transform. **That file only. Not `BottomSheet`.**
- [ ] `D5` · `DYNDB-DEAD-BTN` — ✅ **DECIDED (Florin, 2026-09-21): REMOVE the + Add Database button.**
  > *"Leave dead. Remove add database. Option to add database must be in settings, with configuration of custom database, and module that will house it. We develop this later."*
  - [ ] **Delete the button and its `onClick`** from `dynamic-db/page.tsx:26`. **Not hidden, not disabled — removed.**
  - [ ] `dynamic-db` keeps rendering existing databases. 🛑 **Do not build the settings flow now** — that is `CUSTOM-6`, respecced below.
  - [ ] With this gone, **`store.createDatabase` has zero callers.** 🔴 **Report that**, but **do not delete it** — `KERN-3b` covers its labelling and `CUSTOM-6` will replace it properly.

---

# 🛑 NOT IN THIS RUN

| | Why |
|---|---|
| `LOC-2` / `LOC-3` date + week-start migration | Large. Own run, after the gate makes the scope visible. |
| `LOC-4` PDF locale | ✅ **Already answered** in Run 4 Phase A — cannot fall through to a machine locale. **Close it.** |
| `KERN-3c`, `CUSTOM-6b` | Ride `CUSTOM-2` provisioning. |
| `PANEL-6` *(DatabaseClone seeds resolved ids)* | Rides `R1-1b`'s `logicalKey`. |
| `R5-0`, `IMP-0`, `TSC-*` | Need `R1-2`'s fail-closed resolver. |
| `CLEAN-9`, `DATA-DRIVE-1` | **Florin's data repairs**, not code. |

## GATES — every item
```bash
npm run test:compile
node --experimental-strip-types --import ./tests/register.mjs --test 'tests/*.test.ts'
```
**Report: id · commit · what changed · what was verified · displacement count · prisma-import count · anything noticed and NOT fixed.**
