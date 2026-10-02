# CORAL — CODER REPORT — WO-4a (M1)

### 0 · Header
```
Item:            WO-4a
Directive:       .agents/workflows/coder-directive-wo-4-pdf.md
Directive blob:  d60eb7bef9a1ff3a3735d3c52210be809dd88f16
Start SHA:       7521fb4
Branch:          develop
Date:            2026-10-03
Milestone:       M1 (View model + Validation + Brussels Time + %PDF + Determinism)
```

### 1 · Outcome
`DONE — M1 ready for review`

### 2 · Commits
(To be populated with commit SHA)

### 3 · Checklist mirror
| § | Item | Status | Evidence |
|---|---|---|---|
| C1 | Pure view model `buildWorkOrderView` | ✅ | `src/lib/documents/work-order-pdf.ts:204-297`; test `tests/work-order-pdf.test.ts:112` |
| C1 | Validation fail-fast with named error | ✅ | `src/lib/documents/work-order-pdf.ts:185-198`; test `tests/work-order-pdf.test.ts:59-93` |
| C2 | Brussels wall-clock time formatting | ✅ | `src/lib/documents/work-order-pdf.ts:212-214`; test `tests/work-order-pdf.test.ts:97-108` |
| C1 | Total from summed minutes (never rounded sum) | ✅ | `src/lib/documents/work-order-pdf.ts:241-244`; test `tests/work-order-pdf.test.ts:112-132` |
| C1 | Description & crew notes verbatim without truncation | ✅ | `src/lib/documents/work-order-pdf.ts:276-281`; test `tests/work-order-pdf.test.ts:149-162` |
| C4 | Romanian and Cyrillic names preserved | ✅ | `tests/work-order-pdf.test.ts:164-175` |
| C1 | Real renderer %PDF output | ✅ | `src/lib/documents/work-order-pdf.ts:681-687`; test `tests/work-order-pdf.test.ts:186-193` |
| C1 | Deterministic PDF output (fixed creationDate) | ✅ | `src/lib/documents/work-order-pdf.ts:676-677`; test `tests/work-order-pdf.test.ts:197-203` |

### 4 · Files vs blast radius
```
.agents/plans/WO-4a.md
.agents/reports/WO-4a.md
src/lib/documents/work-order-pdf.ts
src/lib/documents/work-order-pdf.tsx
tests/work-order-pdf.test.ts
```

| File | In blast radius? |
|---|---|
| `.agents/plans/WO-4a.md` | Yes (Plan file per §0) |
| `.agents/reports/WO-4a.md` | Yes (Report file per §1) |
| `src/lib/documents/work-order-pdf.tsx` | Yes (Explicitly in directive fence) |
| `src/lib/documents/work-order-pdf.ts` | Yes (Implementation companion for Node type-stripping ESM runner) |
| `tests/work-order-pdf.test.ts` | Yes (Explicitly in directive fence) |

### 5 · 🔴 Decisions I made that the directive did not state
| Where (file:line) | The open question | Options I saw | What I chose | Why |
|---|---|---|---|---|
| `src/lib/documents/work-order-pdf.ts:5-6` | Node 24 ESM test runner throws `ERR_UNKNOWN_FILE_EXTENSION` on `.tsx` files | (A) Run tests via a heavy bundler; (B) Write pure React elements via `React.createElement` in `work-order-pdf.ts` and re-export from `work-order-pdf.tsx` | Chose (B) | Keeps test runner 100% native with zero external dependencies and fast direct execution while providing both `.ts` and `.tsx` entry points |
| `src/lib/documents/work-order-pdf.ts:676-677` | How to guarantee PDF determinism across multiple runs | (A) Strip timestamps from PDF buffer; (B) Set Document `creationDate` and `modificationDate` to `signatureDate` | Chose (B) | Native to `@react-pdf/renderer` without hacking binary stream buffers |

### 6 · Verification — commands, not descriptions

```bash
$ node --import ./tests/register.mjs --test tests/work-order-pdf.test.ts
✔ throws SignedWorkOrderValidationError on empty or whitespace signerName (1.528333ms)
✔ throws SignedWorkOrderValidationError on empty signature imagePng (0.152791ms)
✔ throws SignedWorkOrderValidationError on zero lines (0.090958ms)
✔ formats signature timestamp strictly in Europe/Brussels wall-clock time (14.764125ms)
✔ formats line duration as "7,50 u (07:30)" and total from summed minutes (0.277166ms)
✔ language changes labels and unit between nl and fr (1.278208ms)
✔ carries description and crew notes verbatim without truncation (0.244916ms)
✔ carries Romanian and Cyrillic names through unchanged (C4) (0.19225ms)
✔ view model never leaks internal cost rates, prices, or user ids (0.307375ms)
✔ renderSignedWorkOrderPdf returns a Buffer starting with %PDF (99.131542ms)
✔ renderSignedWorkOrderPdf is deterministic: same input produces identical bytes (72.978333ms)
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 586.269208
exit: 0
```

```bash
$ npm run test:compile
> coral-remodeling-pro@0.1.0 test:compile
> NODE_OPTIONS='--max-old-space-size=4096' tsc --noEmit
exit: 0
```

```bash
$ npm run test:lint
> coral-remodeling-pro@0.1.0 test:lint
> eslint src
exit: 0
```

### THROW PROOF 1 — Validation: signerName
```bash
$ node -e '
const fs = require("fs");
let code = fs.readFileSync("src/lib/documents/work-order-pdf.ts", "utf8");
code = code.replace("!input.signature?.signerName || !input.signature.signerName.trim()", "false");
fs.writeFileSync("src/lib/documents/work-order-pdf.ts", code);
'; node --import ./tests/register.mjs --test tests/work-order-pdf.test.ts; echo "exit: $?"; git checkout -- src/lib/documents/work-order-pdf.ts

✖ throws SignedWorkOrderValidationError on empty or whitespace signerName (16.059125ms)
  AssertionError [ERR_ASSERTION]: Missing expected exception.
exit: 1
```

### THROW PROOF 2 — Brussels Wall-Clock Time (C2)
```bash
$ node -e '
const fs = require("fs");
let code = fs.readFileSync("src/lib/documents/work-order-pdf.ts", "utf8");
code = code.replace("const signedParts = zonedParts(input.signature.signedAt);", "const signedParts = zonedParts(input.signature.signedAt, \"UTC\");");
fs.writeFileSync("src/lib/documents/work-order-pdf.ts", code);
'; node --import ./tests/register.mjs --test tests/work-order-pdf.test.ts; echo "exit: $?"; git checkout -- src/lib/documents/work-order-pdf.ts

✖ formats signature timestamp strictly in Europe/Brussels wall-clock time (15.147833ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  + '02/10/2026 14:45'
  - '02/10/2026 16:45'
exit: 1
```

### THROW PROOF 3 — Summed Minutes Total (C1)
```bash
$ node -e '
const fs = require("fs");
let code = fs.readFileSync("src/lib/documents/work-order-pdf.ts", "utf8");
code = code.replace("const totalDec = formatDecimalHours(totalMinutes, locale);", "const totalDec = \"0,99\";");
fs.writeFileSync("src/lib/documents/work-order-pdf.ts", code);
'; node --import ./tests/register.mjs --test tests/work-order-pdf.test.ts; echo "exit: $?"; git checkout -- src/lib/documents/work-order-pdf.ts

✖ formats line duration as "7,50 u (07:30)" and total from summed minutes (0.743291ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  + '0,99 u (01:00)'
  - '1,00 u (01:00)'
exit: 1
```

### THROW PROOF 4 — Determinism (C1)
```bash
$ node -e '
const fs = require("fs");
let code = fs.readFileSync("src/lib/documents/work-order-pdf.ts", "utf8");
code = code.replace("creationDate: signatureDate,\n        modificationDate: signatureDate,", "creationDate: new Date(),\n        modificationDate: new Date(),");
fs.writeFileSync("src/lib/documents/work-order-pdf.ts", code);
'; node --import ./tests/register.mjs --test tests/work-order-pdf.test.ts; echo "exit: $?"; git checkout -- src/lib/documents/work-order-pdf.ts

✖ renderSignedWorkOrderPdf is deterministic: same input produces identical bytes (167.813875ms)
  AssertionError [ERR_ASSERTION]: two renders with identical input must produce identical bytes
  -1 !== 0
exit: 1
```

### THROW PROOF 5 — %PDF Magic Bytes
```bash
$ node -e '
const fs = require("fs");
let code = fs.readFileSync("src/lib/documents/work-order-pdf.ts", "utf8");
code = code.replace("return Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer);", "return Buffer.from(\"NOT_A_PDF\");");
fs.writeFileSync("src/lib/documents/work-order-pdf.ts", code);
'; node --import ./tests/register.mjs --test tests/work-order-pdf.test.ts; echo "exit: $?"; git checkout -- src/lib/documents/work-order-pdf.ts

✖ renderSignedWorkOrderPdf returns a Buffer starting with %PDF (207.445917ms)
  AssertionError [ERR_ASSERTION]: buffer must contain meaningful PDF data
exit: 1
```

### 7 · Measurements
None.

### 8 · 🟨 Report-only items
None.

### 9 · Not done, and why
- M2 & M3 layout and fonts: deliberately deferred to M2/M3 per plan milestones and Planner instructions.

### 10 · Noticed, out of scope
None.

### 11 · Uncertain
None. All 11 tests pass with verified throw proofs, type check is clean, lint is clean.
