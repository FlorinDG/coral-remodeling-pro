# CORAL — CODER DIRECTIVE — `KERN-7a` · the parse ratchet — Planner 2026-09-27

Governed by `coral-id-parsing-decomposition.md` §PASS 3b.

**Pass 3b splits in two.** The conversions read `GlobalDatabase.logicalKey`, which is **empty until Florin applies the `R1-1b` migration**. The ratchet does not. 🟢 **`7a` is the ratchet and it ships now; `7b` is the conversions and waits.**

---

# 1 · THE SURFACE — measured today

| Pattern | Sites | Ambiguous? |
|---|---|---|
| `startsWith('db-…')` | **41** | no |
| `isSystemDatabase(…)` | **15** | no |
| `getBaseDbId(…)` | **9** | no |
| **files affected** | **28** | |

## 🛑 `split('-')` IS NOT IN THE RULE — and that decision is measured
Nine sites. **Only two parse a database id**, and both are in `lockedDbUtils.ts:25,40` — the file pass 3c deletes outright. The other seven are legitimate:
```
EditShiftDialog:103 · CreateShiftForm:116 · TimesheetView:86   → dates  '2026-09-27'
internal-projects:20 · quote-service:81                        → projectCode 'PRJ-001'
store.ts:1704 · due-date.ts:13                                 → payment terms
```
🔴 **Banning `split('-')` would be seven false positives out of nine.** *A rule that over-reaches gets disabled, and a disabled rule is not a rule.* `lockedDbUtils.ts` is simply allowlisted and dies in `3c`.

---

# 2 · THE RULE

- [ ] **`no-restricted-syntax`, severity `error`**, three selectors:
  - `MemberExpression` whose property is `startsWith` **and** whose first argument is a string literal beginning `db-`
  - any `CallExpression` to **`getBaseDbId`**
  - any `CallExpression` to **`isSystemDatabase`**
- [ ] **Message, on all three:**
  > *"ARCHITECTURAL RULE (KERN-7): a database id is never parsed. Read the binding — `scope.systemDatabase(role)` forward, `roleOfDatabase(tenantId, id)` reverse."*
- [ ] **Scope: `src/**`.** This is not a time-tracker problem — the sites are spread across the ERP.
- [ ] **Exempt the kernel and the accessor**, which are *allowed* to know: `src/lib/kernel/**`, `src/lib/data/system-databases.ts`, `src/lib/systemDatabases.ts`. **List them as `ignores`, with a comment saying they are the implementation, not violations.**

## The allowlist
- [ ] **Grandfather the 28 files by name**, header comment:
  > *"These parse database ids. The binding is the truth — `logicalKey` reverse, `lockedDbIds` forward. **Do not add to this list.** Its length is the `KERN-7` metric, and it only falls."*
- [ ] **Report the exact length.** 🔴 **Count it inside the `ignores` array, not with a loose `grep`** — the Planner miscounted the `SUPA-2` allowlist three times that way *(40 vs 39 vs 42)*.
- [ ] 🛑 **If widening the pattern newly matches a file the narrow version missed, ADD IT to the allowlist in the same commit.** It was already carrying the shape; the detector simply improved. **Correcting an undercount is not widening an exception.** *(This is the mistake that left the build red for two rounds on `SUPA-2`.)*

---

# 3 · PROVE IT FIRES — `PRE-1c`
- [ ] **A temporary un-grandfathered file** using each of the three patterns → build fails, three times. **Paste all three messages. Delete the file.**
- [ ] **Confirm it does NOT fire on:** `startsWith('db')` without the hyphen · `startsWith(someVariable)` · `split('-')` anywhere · a date parse · `roleOfDatabase(...)`.
- [ ] 🔴 **`eslint src --quiet` must exit 0 after the allowlist is in.** Verify the TRUE exit code:
  ```bash
  node ./node_modules/eslint/bin/eslint.js src --quiet; echo $?
  ```
  **A pipe's exit code is not eslint's** — that error was made once already this week.

---

# 4 · VERIFY
1. `eslint src --quiet` → **exit 0**, allowlist length reported.
2. Three deliberate violations fail, three messages pasted.
3. The four negative cases above do **not** fire.
4. `npm run test:compile` exit 0 · `npm run test:lint` exit 0 · suite **exit 0**, `fail 0`.
5. **`SUPA-2` allowlist and `@ts-nocheck` count unchanged** — this pass touches neither.
6. **The grandfathered prisma allowlist stays 40.** The new config adds no imports.
7. A test in `tests/` asserting the rule exists and is `error`, not `warn`. *(Cheap; it is the ratchet's own ratchet.)*

## PROHIBITIONS
- 🛑 **Convert nothing.** Not one call site. `7b` does that, after the migration is applied and `logicalKey` is populated.
- 🛑 **`split('-')` stays out of the rule.** Seven of its nine sites are legitimate.
- 🛑 **Do not touch `getLockedDbId`, `BASE_TO_KEY` or `lockedDbUtils.ts`.** Pass `3c`.
- 🛑 **No `warn`.** 1507 warnings exist; a 1508th is invisible. **Boundary rules are errors or they are decoration.**

---

## 🟢 WHY THE RATCHET COMES BEFORE THE CONVERSIONS
**74 parse sites exist because nothing stopped the 75th.** The ratchet costs one config block, blocks new growth today, and turns the remaining work into a number that only falls — **the same mechanism that made the prisma-import count a build artefact instead of the Planner's memory.**

**`7b` is then mechanical:** `getBaseDbId(id)` → `roleOfDatabase(tenantId, id)`, `isSystemDatabase(id)` → `roleOfDatabase(...) !== null`, batch by batch, allowlist falling each time.

## 🛑 FLORIN — `7b` IS BLOCKED ON YOU
`roleOfDatabase` reads `logicalKey`. **Until the `R1-1b` migration is applied and backfilled it returns null for every database**, and any conversion built on it would be silently wrong.
**Apply it, then confirm:** `SELECT COUNT(*) FROM "GlobalDatabase" WHERE "logicalKey" IS NOT NULL;` → **expect 32.**
