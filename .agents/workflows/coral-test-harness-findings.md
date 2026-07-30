# CORAL — TEST HARNESS + FIRST FINDING (Planner, 2026-07-29, while Florin was away)

## 🔴 BUG FOUND AND FIXED — `buildBlocks` silently deletes line subcomponents

**Severity: silent data loss on client-facing documents.**

`src/lib/block-tree-dnd.ts` — **every drag** on a quote or invoice containing a line that carries subcomponents/variants **deleted those children**.

**Mechanism:**
- `flattenBlocks` correctly recurses **only into containers** (`section`/`subsection`/`post`), so a leaf `line`'s children are deliberately *not* flattened — they stay inline. Correct.
- `buildBlocks` then did:
  ```js
  const items = flattenedItems.map((item) => ({ ...item, children: [] }));
  ```
  resetting `children` to `[]` for **every** item. Containers get theirs pushed back by the `parentId` loop — but a leaf line's children were never in the flat list, so **nothing is pushed back and they are gone**.

**Fix applied:**
```js
const items = flattenedItems.map((item) => ({
    ...item,
    children: isContainer(item.type ?? '') ? [] : (item.children ?? []),
}));
```
Containers start empty (rebuilt from the flat list); non-containers keep their children untouched.

**Proof:** `tests/block-tree.test.ts` → *"a leaf line KEEPS its subcomponents through the round trip"*. Before the fix: `expected 4, actual 2`. After: **18/18 green.**

**Why it hadn't surfaced yet:** the quotation engine's dnd-kit migration is recent, and `assertTreeInvariants` (which *would* catch the count mismatch) either isn't wired into the drop handler or was rejecting drops that looked like other problems. **Worth checking that the invariant is actually called on every drop** — it exists and works; a guard that isn't invoked protects nothing.

⚠️ **This is exactly the class the invoice-engine migration would have inherited.** The invoice pair is still on `@hello-pangea/dnd` and hasn't been migrated — fix landed before that work starts.

---

## Secondary fix — type-only imports
`invoice-totals.ts` and `block-tree-dnd.ts` imported the `Block` **type** with a value import (`import { Block }`). Harmless in the bundler, but wrong under `isolatedModules: true` and it makes the modules unloadable outside Next. Changed both to `import type { Block }`. Zero runtime change.

---

## Harness — `tests/`, zero new dependencies
Node 22's built-in test runner + native TypeScript type-stripping. No vitest/jest, no transpiler config, nothing added to `package.json` dependencies.

```bash
node --experimental-strip-types --import ./tests/register.mjs --test tests/
```

| File | Coverage | Status |
|---|---|---|
| `invoice-totals.test.ts` | VAT 21/6/medecontractant, uniform output VAT, `unitPrice` > `verkoopPrice`, quantity multipliers through nesting, optional exclusion, VAT-inclusive back-calc, rounding, totals reconciliation | **22/22 green** |
| `block-tree.test.ts` | flatten/build round-trip, containers-only recursion, `assertTreeInvariants`, `canNest` rules | **18/18 green** (after the fix above) |
| `duration.test.ts` | >4h break rule, the 4h boundary, `noBreak`, missing/reversed/unparseable timestamps | **15/15 green** |

**55 tests, all green.**

### One config change
`tsconfig.json` — added `"tests"` to `exclude`. Node requires explicit `.ts` extensions in imports; `tsc` rejects them without `allowImportingTsExtensions`. Excluding `tests` keeps them out of the production typecheck **and** is correct anyway: tests shouldn't gate a deploy, they're a separate check before promoting.
*(Verified: without this, my test files would have failed `tsc --noEmit` and broken the build gate.)*

### Rules for these tests
1. They pin **current** behaviour. A failure means something **changed**.
2. **Never edit a test to make it pass.** Either the code regressed, or the change was intended — then update the test in the same commit so the diff shows the behaviour change.

---

## Housekeeping
Two empty files I created while probing filesystem permissions and **cannot delete** (the mount permits create but not unlink):
- `.git/_writetest`
- `src/_writetest` ← will show as untracked

Please `rm` both.

## Suggested next for the harness
- **`assertTreeInvariants` call-site audit** — confirm it runs on every drop (highest value, given the above).
- `lib/ogm.ts` — Belgian structured payment reference has a mod-97 checksum; wrong OGM = misallocated client payments.
- `lib/decimal-parser.ts` — comma/point decimal handling (Belgian input habits).
- VAT regime inference on purchase invoices (`PI-INFER-VAT-CURRENCY`).
