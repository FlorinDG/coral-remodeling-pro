# CORAL — CODER DIRECTIVE — R3-A corrections + EXPORT-LOCK (Planner 2026-09-12)

Paste-ready. Binding. Supersedes the corresponding parts of your R3-A plan. Spec: `coral-r3-grid.md` · protocol: `pd.md`.

---

## 0 · PLANNER CORRECTION TO THE SPEC (read first)

The review text in `coral-r3-grid.md` C5 said to place the export lock in `src/app/actions/pages.ts`. **That was wrong and is corrected here.** `updatePageServerFirst` has only 2 callers. The store's sync queue — which is what the grid, the record detail and every other surface actually write through — calls **`saveGlobalPage`**:

```ts
// src/components/admin/database/store.ts:476
const result = await saveGlobalPage(page);
// imported at store.ts:6 from '@/app/actions/global-databases'
```

So the lock goes in a **single shared rule module**, invoked at each existing door. One implementation, three call sites — that is not a sideways copy; the copies would be three separate *implementations*. `R2-1` later collapses the doors and the rule moves with them.

---

## 1 · `EXPORT-LOCK-CORE` 🟥🟥 — new item, do this FIRST

**Why:** `R3-A1` proved the `accountantExportedAt` edit lock exists **only** at `src/components/admin/database/NotionGrid.tsx:1157`. Every other path — record detail, store sync, server actions, API — can currently edit a document already declared final to the accountant. This is a legally-relevant record. It is not waiting for R2.

### 1a · Create the rule, once
**New file `src/lib/records/export-lock.ts`.** One exported function, no other logic:

```ts
import type { Prisma } from '@prisma/client';

export interface ExportLockViolation { blockedFields: string[] }

/**
 * An accountant-exported record is frozen except for `accountantExportedAt`
 * itself and relation-type properties (linking is still permitted).
 * Returns null when the write is allowed.
 */
export function checkExportLock(
    existingProperties: Prisma.JsonValue | null,
    incomingProperties: Record<string, unknown>,
    relationPropertyIds: Set<string>
): ExportLockViolation | null {
    const existing = (existingProperties ?? {}) as Record<string, unknown>;
    if (existing.accountantExportedAt !== true) return null;

    const blocked = Object.keys(incomingProperties).filter((key) => {
        if (key === 'accountantExportedAt') return false;
        if (relationPropertyIds.has(key)) return false;
        return JSON.stringify(incomingProperties[key]) !== JSON.stringify(existing[key]);
    });

    return blocked.length > 0 ? { blockedFields: blocked } : null;
}
```

**Rules:** compare **changed** keys only — an unchanged field present in the payload is not an edit. Relation properties stay editable (matches the grid's existing `prop.type !== 'relation'` exemption). **Do not** invent additional exemptions.

### 1b · Call it at all three server doors
**`src/app/actions/global-databases.ts` → `saveGlobalPage`** (the primary path). Insert **after** the tenant check at `:411-415` and **before** the OCC block at `:417`. You must widen the parent-DB select to obtain property types — it currently selects `tenantId` only (`:406-409`):
```ts
const parentDb = await prisma.globalDatabase.findUnique({
    where: { id: page.databaseId },
    select: { tenantId: true, properties: true }   // properties ADDED
});
```
Derive `relationPropertyIds` from `parentDb.properties` (`type === 'relation'`).

**`src/app/actions/global-databases.ts` → `saveGlobalPagesBatch`** — same rule. A batch containing one locked record **fails that record**; it does not fail the batch, and it does not silently skip it (report it in the result).

**`src/app/actions/pages.ts` → `updatePageServerFirst`** — insert after the tenant check at `:180`, before `prisma.globalPage.update` at `:182`. Widen the existing include (`:174-177`) to fetch `database.properties` alongside `tenantId`.

### 1c · Fail loudly — ERROR-SURFACING DIRECTIVE
Return, **naming the fields**:
```ts
return { success: false, error: `[ExportLocked] Dit document is al naar de boekhouder verzonden. Geblokkeerde velden: ${violation.blockedFields.join(', ')}` };
```
**Never** `return;` silently. The grid's current silent `return` at `NotionGrid.tsx:1157` is not the model to copy — **leave that line untouched** (DSG is frozen, `R3-C`), it simply becomes redundant with the server rule.

### 1d · Test it
`tests/export-lock.test.ts`, Node built-in runner, pure function, no DB:
locked + ordinary field changed → violation naming the field · locked + only `accountantExportedAt` changed → allowed · locked + relation changed → allowed · locked + field present but **unchanged** → allowed · **not** locked → always allowed · `existingProperties` null/undefined → allowed.

**Commit:** `EXPORT-LOCK-CORE: block edits to accountant-exported records at the server doors`

---

## 2 · `R3-A3` — CORRECTED (C2) 🟥

Your `string | null` return is right. **The call sites are not.** `getDatabaseRoute` is used inside **template literals**, and **TypeScript does not error on `null` in a template literal** — `${null}` stringifies to `"null"`, producing `/nl null`. `tsc --noEmit` stays green and the failure is silent: the exact opposite of this item's purpose.

**Every call site gets an explicit null check before use. All seven:**
```
src/components/admin/database/components/LinkedRecords.tsx:103, 478, 491, 533, 545
src/components/admin/tasks/TaskModuleShell.tsx:406
```
Pattern:
```ts
const route = getDatabaseRoute(lp.db.id, lp.page.id);
if (!route) { toast.error(`Kan record niet openen: onbekende database (${lp.db.id})`); return; }
router.push(`/${locale}${route}`);
```
**Before and after, run `grep -rn "getDatabaseRoute" src` and confirm every call is guarded.** The unidentified third file "`page.tsx`" in your plan: **name the exact path and line, or drop it from this item.**

---

## 3 · `R3-A2` — DO NOT CLOSE ON THE MOUNT FIX (C3) 🟧

The effect at `src/components/admin/database/components/PageModal.tsx:610-624` has **`[]` deps — it runs once, at mount.** That explains focus stolen when the record *opens*. Florin's report is *"paste always lands in the NAME/title property, **no matter where you click**"* — which indicates it also happens **mid-session**.

The same file already stops keydown reaching DSG's document-level listeners:
```ts
e.nativeEvent.stopPropagation(); // Stop native keydown bubbling to window/document (DSG listeners)
```
**There is no equivalent guard for `paste`.** Hypothesis to test: a document-level paste handler in DSG is still live while the modal is open, so paste lands in the **grid's active cell** — typically the title cell. That would match the symptom precisely, and your mount-focus fix would not touch it.

**Required, in this order:**
1. Ship the mount-focus fix as specified.
2. **Reproduce mid-session:** open an existing record → click a non-title field → wait past mount → paste.
3. If it still lands in the title, **report the finding and stop.** Do not fix it inside DSG (`R3-C` freeze) — the guard belongs on the modal, and the Planner will spec it.

---

## 4 · `R3-A4` — FLAG EVERY VIEW, NOT ONLY THE SEEDED ONES (C4) 🟧

`defaultPropsSeeded` is the right idea, but **no existing view has it**, so for all of them the guard falls back to `!propertiesState || length === 0` — the same "absence of state = never configured" inference that *is* the bug.

- Write `defaultPropsSeeded: true` **on both paths**: when the effect seeds, **and** when it decides not to. After one pass every view is flagged and the inference is never consulted again.
- The seeding path calls `syncDb` — a **server write on mount**. It must be skipped entirely when nothing changed: no gratuitous `updatedAt` bump (`OCC-5-CRON-NO-OP-WRITES`).
- Confirm the neighbouring every-mount `[Schema Enforcement]` effect at `DatabaseClone.tsx:729-734` is likewise a no-op when the property type already matches.

---

## 5 · VERIFICATION — the commands are these, exactly (C1) 🟥

**`jest` is not installed in this repo** (no dependency, no `node_modules/.bin/jest`); `npx jest` would fetch it from the registry. Use:

```bash
npm run test:compile     # this repo's script for `tsc --noEmit` — must be 0 errors
node --experimental-strip-types --import ./tests/register.mjs --test 'tests/*.test.ts'
grep -rn "getDatabaseRoute" src        # every call site guarded
```
The directory form `--test tests/` throws `ERR_UNSUPPORTED_DIR_IMPORT`; the quoted glob is required.

**Baseline:** the suite is **70 tests across 5 files** (not 65/4). `tests/i18n.test.ts` is **already failing** on ~16 missing message keys (`I18N-MISSING-KEYS`) — pre-existing, **not caused by this work**. **Do not** "fix" it by deleting keys, skipping the test, or editing the test. Leave it red and report it.

---

## 6 · ORDER AND COMMITS

```
1. EXPORT-LOCK-CORE: block edits to accountant-exported records at the server doors
2. R3-A2: fix focus stealing on record detail modal      (+ report the mid-session result)
3. R3-A3: route all system databases and eliminate dynamic-db deadend
4. R3-A4: preserve view column visibility state on mount
```
One commit per item. `npm run test:compile` green before each. **`R3-A1` produced a finding, not a commit** — it is closed.

## 7 · PROHIBITIONS
- **No edits to `NotionGrid.tsx`, `hooks/useGridColumns.tsx` or `columns/*`** — `R3-C` freeze. Not even the redundant lock at `:1157`.
- **No new blocking rule implemented more than once.** One module, called at the doors.
- **No silent `return`** on a rejected user edit.
- **No schema migration, no `prisma db push`, no `migrate` command.** Nothing in this batch needs one; `defaultPropsSeeded` is a field inside existing view JSON.
- **Do not invent APIs.** Anything not pasted above, read from the file before calling it.
