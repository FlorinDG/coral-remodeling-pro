# CORAL — TREE CLEANUP — scan and deletion list — Planner 2026-09-21

**Florin, 2026-09-21:** *"Scour the tree. There might be more. Scan, mark for deletion those safe to remove."*

**Scanned the whole repository. 134 files. All safe to delete. Nothing is imported, nothing is referenced.**

---

## 🔴 WHY THIS IS MORE THAN TIDINESS — THE DUPLICATES ARE IN THE BUILD

```jsonc
// tsconfig.json
include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', …]
exclude: ['node_modules', '.next', '.next.nosync', 'scripts', 'mcp-server', 'tests']
```
**`src/lib/format/date 2.ts` matches `**/*.ts` and is excluded by nothing.**

So the 40 duplicates under `src/` are **type-checked on every `npm run test:compile` and every `npm run build`.**
- They are compiled for nothing on every build.
- 🔴 **A stale duplicate that no longer type-checks would fail the build** — on a file nobody has opened in weeks.
- `src/lib/records/export-lock 2.ts` is a copy of a module we changed **four times last week**. It is a trap waiting for whoever greps for `checkExportLock` and edits the wrong result.

*(`.gitignore:57` already has `* 2.*`, so git ignores them — **but `.gitignore` does not affect the TypeScript compiler.** That is why they are invisible in `git status` and still present in the build.)*

---

## GROUP A — 🔴 TRACKED CRUFT · 3 files · **delete and commit**
*These are in git. They travel with every clone.*

| File | Evidence it is safe |
|---|---|
| `prisma/schema.prisma.orig` | **851 lines vs the real schema's 1054** — a stale snapshot, not a conflict file *(0 conflict markers)*. **Nothing reads `.orig`.** Anyone opening it to answer a schema question gets a 200-line-old answer. |
| `public/branding/coral-enterprises-logo-minimal copy.svg` | `grep -rn "logo-minimal copy"` → **zero references** in `src` or `public`. |
| `src/components/ui/CustomDatePicker.tsx.tmp` | A `.tmp` **committed to git**. Imports resolve to `CustomDatePicker.tsx` (`TaskDetailPanel:12`, `TaskBoardView:8`); **`.tmp` is not a module resolution extension**, so nothing can import it. |

## GROUP B — 🟠 DUPLICATES UNDER `src/` · 40 files · **delete**
*Untracked and gitignored, **but compiled.** This is the group that matters.*

Includes copies of modules changed in the last week — **`export-lock 2.ts`, `document-archive 2.ts`, `subtasks 2.ts`, `date 2.ts`, `due-date 2.ts`, `BottomSheet 2.tsx`, `useScrollLock 2.ts`, `z-index 2.ts`, `FileViewer 2.tsx`, `AccountantExportDialog 2.tsx`, `MobileScopeContext 2.tsx`, `page 2.tsx`** — plus 28 others across `app/`, `components/`, `hooks/`, `lib/`.

```bash
find src -name "* [0-9].*" -delete
```

## GROUP C — 🟡 DUPLICATES ELSEWHERE · 91 files · **delete**
*Untracked, gitignored, **not** compiled (`scripts`, `tests` and `.agents` are outside the tsconfig include or excluded). Pure clutter.*

| Where | Count | Note |
|---|---|---|
| `.agents/workflows/` | 57 | duplicate **specs** — the genuine hazard here is reading a stale copy of a directive |
| `tests/` | 15 | excluded from tsconfig; **check the test glob** — `tests/*.test.ts` would match `foo 2.test.ts` and run duplicates |
| repo root | 15 | `scratch-*`, `test-*`, `fix_*`, `add-series-id 2.sql`, `coral-workhub-planning 2.xlsx` |
| elsewhere | 4 | |

```bash
find . -path ./node_modules -prune -o -name "* [0-9].*" -print -delete
```

---

## ✅ CHECKED — THE TEST COUNT IS HONEST
I flagged a risk that duplicate tests were inflating the suite. **Checked, and they are not.**

There **are** 15 duplicates in `tests/` — `export-lock.test 2.ts`, `subtasks.test 2.ts`, `i18n.test 2.ts` and others — **but the glob does not match them:**
```
--test 'tests/*.test.ts'   requires a name ENDING in .test.ts
"export-lock.test 2.ts"    ends in " 2.ts"          → no match
ls tests/*.test.ts         → 13 files, 0 duplicates
```
**141 is a genuine count.** Delete them for tidiness, not because they were counted.

⚠️ **But note the fragility:** the duplicate of `register.mjs` and `alias-hooks.mjs` sit beside the real ones, and those are loaded **by explicit path**, not by glob. **Deleting the wrong one of a pair breaks the harness.** Delete by the `* [0-9].*` pattern only — **never by hand-picking.**

---

## THE ORDER
```bash
# 1. look before you leap
find . -path ./node_modules -prune -o -name "* [0-9].*" -print | wc -l   # expect 131
ls tests/ | grep " 2\."                                                  # see the note above

# 2. Group A — tracked, needs a commit
git rm "prisma/schema.prisma.orig" \
       "public/branding/coral-enterprises-logo-minimal copy.svg" \
       "src/components/ui/CustomDatePicker.tsx.tmp"

# 3. Groups B + C — untracked, no git involvement
find . -path ./node_modules -prune -o -name "* [0-9].*" -print -delete

# 4. prove nothing moved
npm run test:compile
node --experimental-strip-types --import ./tests/register.mjs --test 'tests/*.test.ts'
```

## PREVENTION
- [ ] `.gitignore:57` already holds `* 2.*`. **Widen to `* [0-9].*`** — the next collision is `foo 3.ts`.
- [ ] 🔴 **Add the same pattern to `tsconfig.json`'s `exclude`.** Gitignore stops them entering git; **only tsconfig stops them entering the build.** *(This is the actual fix — the rest is housekeeping.)*
- [ ] Worth knowing **where they come from** — an editor, a sync client, or a file-manager copy. They are dated across weeks, so it is recurring rather than a one-off.

## AFTERWARDS
**141 tests and a clean `tsc` must still hold.** If the count changes, Group C's test duplicates were being counted — **and that is a finding, not a regression.**
