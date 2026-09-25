# CORAL — CODER DIRECTIVE — `TSC-9` · `tests/tenant-isolation.test.ts`, written RED — Planner 2026-09-24

**`TSC-0` §4 made this a closure condition: the test is written first, red, and `R1-4` makes it green.** This directive defines what it asserts and, because of the harness, **changes the shape of `R1-4`.**

---

# 0 · THE HARNESS DECIDES THE DESIGN — read before anything else

`tests/README.md`: **zero dependencies**, Node 22's built-in runner, `--experimental-strip-types`, hand-written stubs, `tests/` excluded from `tsconfig`. **176 tests run in 1.6 seconds because nothing touches a database.**

🛑 **`tenant-isolation.test.ts` therefore CANNOT be an integration test.** No test database, no containers, no seeded tenants, no new dependency. Anyone proposing one has misread the repo.

## 🟢 AND THAT IS A GIFT, NOT A LIMITATION
A database test would answer *"did this query leak?"* — one query at a time, forever, and only for queries someone thought to write. **The harness forces a better question:** *"is the scoping rule correct for every model in the schema?"*

**So `R1-4` splits in two, and `TSC-9` lands the first half now:**

```
lib/data/scope-rules.ts     ← PURE. No prisma import. The classification + the where-builder.
lib/data/scope.ts           ← R1-4. $extends calls scope-rules. Execution only.
```

**The decision is separated from the execution.** The decision is exhaustively testable today; the execution is thin enough to review by eye. **`$extends` stops being where correctness lives and becomes plumbing.**

🔴 **This is a change to `TSC-0 D1/D2` and it is binding:** the classification table is a **module of its own**, not a `const` inside the extension.

---

# 1 · WHAT `TSC-9` SHIPS

## `1a` · `src/lib/data/scope-rules.ts` — the table lands NOW, the behaviour does not
**The classification is data we already have** (`coral-tsc-design.md` §1, re-measured 2026-09-24: **55 models · 33 Class A · 20 Class B · 2 Class D · Class C now empty**, `ShiftTask`/`ShiftAttachment` having been declared by `TSC-4`).

```ts
export type ScopeRule =
  | { kind: 'direct' }                      // has tenantId
  | { kind: 'via'; through: string }         // relation field name on THIS model
  | { kind: 'platform' };                    // Tenant, VerificationToken — scoped client refuses

export const SCOPE: Readonly<Record<string, ScopeRule>> = { … };   // all 55, exhaustive

export class UnclassifiedModelError extends Error {}
export class PlatformModelError extends Error {}

/** Pure. Returns the where-clause a scoped query must carry. Throws for unknown/platform models. */
export function scopeWhere(model: string, tenantId: string, userWhere?: object): object;
```

- [ ] **`SCOPE` is complete and correct on day one.** It is a table, not behaviour — landing it costs nothing and unblocks the test.
- [ ] **`scopeWhere` may throw `new Error('NOT_IMPLEMENTED')`** for now. 🔴 **That is the RED.** `R1-4` implements it and the suite turns green without the test file changing.
- [ ] 🛑 **No prisma import in this file.** The `R1-5` gate is already `error`; this file is not on the allowlist and must never join it.
- [ ] **`through` is the RELATION FIELD NAME**, not the model name — `GlobalPage → 'database'`, `ShiftTask → 'shift'`, `InvoiceItem → 'invoice'`. **Verify each against `schema.prisma`; a wrong name is a silent no-op filter.**

## `1b` · `tests/tenant-isolation.test.ts`

---

# 2 · THE ASSERTIONS

## 🔴 A · EXHAUSTIVENESS — the test that keeps working after we stop looking
```ts
// read prisma/schema.prisma, extract /^model (\w+)/gm, assert every one is in SCOPE
```
- [ ] **Every model in the schema has a rule. A model absent from `SCOPE` fails the suite.**
- [ ] **Assert the census: 55 models · 33 direct · 20 via · 2 platform.** A changed count fails loudly and is updated deliberately, in the same commit *(the harness's rule 2)*.
- [ ] 🟢 **This is `D2` enforced at the schema level.** Add a Prisma model, the suite goes red until someone decides its tenancy — **at design time, which is the only time it is cheap.**
- [ ] **Assert every `via` rule's `through` names a real relation field on that model** *(parse the schema block; a typo'd relation name is the failure mode that would silently return everything)*.

## B · THE WHERE-BUILDER
- [ ] **Class A** → `{ tenantId }` merged in.
- [ ] **Class B** → `{ [through]: { tenantId } }`. Specifically pin `GlobalPage → { database: { tenantId } }` — **it has no `tenantId` of its own and never will.**
- [ ] **Class D** → `scopeWhere` **throws `PlatformModelError`.** Not "returns {}", not "passes through". *(`D4`: platform access is a second named client, never a flag.)*
- [ ] **Unknown model** → throws `UnclassifiedModelError`. **Fail closed.**
- [ ] 🔴 **The user's `where` is ANDed, never allowed to replace the scope.** Pin the attack directly:
  ```ts
  scopeWhere('Invoice', 'tenant-A', { tenantId: 'tenant-B' })
  // → the result must still constrain to tenant-A. A caller cannot widen its own scope.
  ```
  **Assert the same for a nested `OR` that names another tenant**, and for Class B via the parent.

## C · REGRESSION PINS — this week's seven holes, named
**Each is a one-line assertion that the rule table would have prevented it.** The file becomes the record of why the gate exists.
- [ ] `ShiftTask` / `ShiftAttachment` → `{ shift: { tenantId } }` *(`TSC-4a`, `TSC-4b` — the read and the write)*
- [ ] `HrTeamMember` → `{ team: { tenantId } }` *(the one that was always right — pin it so it stays)*
- [ ] `ScheduledShift` → `{ tenantId }` direct *(`HRA-2`/`HRA-3`: the automations reached it with no scope at all)*
- [ ] `ClockEntry` → `{ tenantId }` direct *(`HRA-1`)*
- [ ] `GlobalPage` → via `database` *(the `R1` core case)*
- [ ] **A comment above each naming the defect and its directive.**

## D · CONSTRUCTION — no path yields an unscoped client
These are type/shape assertions; `scope.ts` need not exist yet — **assert the contract, `R1-4` satisfies it.**
- [ ] `systemScope(tenantId, reason)` with an empty or missing `reason` → **throws.** *(`D5`: a system write with no stated reason is refused.)*
- [ ] `scopeFromSession()` with no tenant → **throws**, never returns `null`, never returns an unscoped client. *(`R1-2`: absence is a question, not an answer.)*
- [ ] 🟨 If `scope.ts` does not exist yet, these live in a `describe(..., { skip: 'R1-4' })` block **with the assertions written out**. 🛑 **Skipped, not omitted** — the contract is recorded now, when it is being decided, not later when it is being argued about.

---

# 3 · WHAT THIS TEST DOES NOT DO — state it in the file header
🔴 **It does not prove no query leaks.** It proves **the rule is right and total**. Three things stay outside it, and each has its own mechanism:

| Risk | Covered by |
|---|---|
| Code bypasses the client entirely | `R1-5` ESLint ratchet — **121 allowlisted, falling** |
| `$queryRaw` evades `$extends` | `TSC-7` — three named functions in `lib/data/raw/`, `$queryRaw` removed from the client type |
| An automation reaches another model unscoped | **`HRA` was exactly this.** `R1-4` is the structural answer |

- [ ] **Put that table in the test file's header comment.** 🛑 **A green `tenant-isolation.test.ts` must never be quoted as "tenancy is proven."** It is one of four mechanisms, and `TSC-0 D1` already said no single mechanism is sufficient.

---

# 4 · VERIFY
1. `node --experimental-strip-types --import ./tests/register.mjs --test tests/tenant-isolation.test.ts` → **runs, and FAILS on the `scopeWhere` assertions.** 🔴 **A green suite at this stage means the test asserts nothing — reject it.**
2. **The exhaustiveness block (§2A) PASSES today** — the table is complete even though the builder is not. **Report which assertions are red and which are green; they should split exactly along that line.**
3. Delete one entry from `SCOPE` → **§2A fails.** Restore it. **Paste the failure message.**
4. Add a throwaway `model Zzz { id String @id }` to the schema → **§2A fails.** Remove it. **Paste the failure.** *(This is the ratchet; prove it fires, per `PRE-1c`.)*
5. Full suite: **176 + the new file**, no regressions.
6. `eslint src --quiet` → **0 errors.** *(`scope-rules.ts` must not import prisma.)*
7. **Report the model census the test asserts: 55 / 33 / 20 / 2.**

## PROHIBITIONS
- 🛑 **No new dependency.** Not jest, not vitest, not testcontainers, not a mock library. The harness is `node:test` + `node:assert/strict` and hand-written stubs.
- 🛑 **No test database, no `DATABASE_URL` read, no network.**
- 🛑 **Never edit an assertion to make it pass** *(harness rule 2)*. If `R1-4` cannot satisfy one, **stop and report** — that is a design finding.
- 🛑 **`scope-rules.ts` imports nothing from `@/lib/prisma`.**

---

## 🟢 WHY THIS IS THE RIGHT TEST TO HAVE WRITTEN FIRST
**Seven tenancy holes were found this week by reading code.** Reading does not scale and does not survive us.

The exhaustiveness assertion is the part that outlives this work: **it does not check the holes we found — it fails on the next model somebody adds without deciding its tenancy.** That is the same move as the `PRE-1d` ratchet, one layer down: *the metric is maintained by the build, not by memory.*
