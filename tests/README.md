# Characterization test harness

**Zero new dependencies.** Uses Node 22's built-in test runner and TypeScript type-stripping.

## Run

```bash
node --experimental-strip-types --import ./tests/register.mjs --test tests/
```

Or a single file:

```bash
node --experimental-strip-types --import ./tests/register.mjs --test tests/invoice-totals.test.ts
```

## What's here

| File | Pins |
|---|---|
| `invoice-totals.test.ts` | **The money path.** VAT regimes (21 / 6 / medecontractant), uniform output VAT, `unitPrice` overriding `verkoopPrice`, quantity multipliers through nesting, optional lines excluded, VAT-inclusive back-calculation, rounding, totals reconciliation. |
| `block-tree.test.ts` | **The DnD invariant.** flatten/build round-trip is lossless, containers-only recursion, `assertTreeInvariants` catches loss and id changes, nesting rules (`canNest`). |
| `duration.test.ts` | **The break rule.** >4h ⇒ deduct 30 min, `noBreak` suppression, the 4h boundary, missing/reversed/unparseable timestamps returning 0 rather than NaN or negatives. |
| `alias-hooks.mjs` / `register.mjs` | Resolve `@/*` → `src/*` so tests can import app modules. |

## Rules of use

1. **These pin CURRENT behaviour, not desired behaviour.** A failure means something *changed*.
2. **Never edit a test to make it pass.** Either the code regressed (fix the code), or the change was intentional — then update the test **in the same commit**, deliberately, so the diff shows the behaviour change.
3. `tests/` is excluded from `tsconfig.json`, so these files do **not** gate the production build. They're a separate, fast check you run before promoting.

## Note on `--experimental-strip-types`

Node runs the `.ts` sources directly — no build step, no transpiler config. The flag is experimental but the feature is stable in Node 22 for "erasable syntax only" (no enums/namespaces/decorators), which this codebase satisfies in the modules under test.

Type-only imports **must** be written `import type { X } from '...'`. A plain `import { X }` of a type fails at runtime because the module has no such runtime export. Two source files needed this correction (`invoice-totals.ts`, `block-tree-dnd.ts`) — it is also what `isolatedModules: true` in `tsconfig.json` expects.
