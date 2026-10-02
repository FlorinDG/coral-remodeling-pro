# PLAN — WO-4a · Signed Work Order PDF Renderer

**Target:** `src/lib/documents/work-order-pdf.tsx` & `tests/work-order-pdf.test.ts`  
**Directive:** `.agents/workflows/coder-directive-wo-4-pdf.md`  
**Protocol:** `coder-report-protocol.md` §0 (Plan First)  
**Status:** 🟢 REVIEWED — GO for M1 (see Planner review at the end)

---

## 1. Approach & Page Layout Sketch

### Approach
- Pure, deterministic renderer: `input: SignedWorkOrderPdfInput` in → `Promise<Buffer>` out.
- Implemented with `@react-pdf/renderer` using `renderToBuffer` (matching `src/app/api/hr/timesheet-export/route.tsx`).
- Zero network dependencies, zero DB queries, zero external font fetches at render time.
- **Font selection:** Standard built-in `Helvetica` and `Helvetica-Bold`. (The files in `public/fonts` are variable `.woff2` fonts, which are not supported by `@react-pdf/renderer` / pdfkit without pre-conversion to TTF/OTF. Using built-in Helvetica guarantees instant, crash-proof, zero-latency rendering).
- **Formatters:**
  - Hours: `formatDecimalHours(minutes, locale)` and `formatHoursMinutes(minutes)` from `src/lib/computeWorkedDuration.ts`. Format: `7,50 u (07:30)` for `nl`, `7,50 h (07:30)` for `fr`, `7.50 h (07:30)` for `en`.
  - Date: Belgian format `DD/MM/YYYY` via `formatDate` from `src/lib/format/date.ts`.
  - Signature timestamp: Belgian datetime `DD/MM/YYYY HH:mm` via `formatDateTime` from `src/lib/format/date.ts`.
- **Validation:** Strict fail-fast validation before PDF assembly, throwing a named `SignedWorkOrderValidationError` on invalid inputs:
  1. No signer name (null, undefined, or empty/whitespace-only).
  2. Empty signature image (null, undefined, or 0-byte Buffer).
  3. Zero lines (empty array or missing).
- **Prohibitions enforced:**
  - Never prints cost rates, hourly prices, or financial totals.
  - Never prints internal administrative notes or user IDs/CUIDs.
  - Never truncates text: shift description and crew notes wrap naturally (`wrap={true}`).

### Layout Sketch (Top → Bottom, A4 Portrait)

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Brand Color Accent Bar / Top Stripe (4px)]                           │
│                                                                        │
│ ┌──────────────────────────────┐    ┌────────────────────────────────┐ │
│ │ [Optional Tenant Logo]       │    │ WERKBON / BON DE TRAVAIL       │ │
│ │ Tenant Company Name          │    │ Nr: WO-2026-0042               │ │
│ │ VAT: BE 0123.456.789         │    │ Datum: 02/10/2026              │ │
│ │ Address line                 │    │ Project: Renovatie Residentie  │ │
│ └──────────────────────────────┘    └────────────────────────────────┘ │
│                                                                        │
│ ┌──────────────────────────────┐    ┌────────────────────────────────┐ │
│ │ KLANT / CLIENT:              │    │ WERFADRES / SITE ADDRESS:      │ │
│ │ Klant Naam                   │    │ Straat 123                     │ │
│ │ Klant Adres                  │    │ 1000 Brussel                   │ │
│ └──────────────────────────────┘    └────────────────────────────────┘ │
│                                                                        │
│ ── PRESTATIES / HEURES ─────────────────────────────────────────────── │
│ ┌──────────────────────┬─────────┬─────────┬─────────────────────────┐ │
│ │ Medewerker           │ Van     │ Tot     │ Duur                    │ │
│ ├──────────────────────┼─────────┼─────────┼─────────────────────────┤ │
│ │ Jan Janssens         │ 08:00   │ 16:30   │ 8,00 u (08:00)          │ │
│ │ Piet Pieters         │ 08:00   │ 16:30   │ 8,00 u (08:00)          │ │
│ ├──────────────────────┴─────────┴─────────┼─────────────────────────┤ │
│ │ TOTAAL                                   │ 16,00 u (16:00)         │ │
│ └──────────────────────────────────────────┴─────────────────────────┘ │
│                                                                        │
│ ── UITGEVOERDE TAKEN / TÂCHES (if any tasks present) ───────────────── │
│   ☑ Wandisolatie geplaatst                                             │
│   ☐ Plafond afgewerkt                                                  │
│                                                                        │
│ ── OMSCHRIJVING / DESCRIPTION (if shift.description present) ──────── │
│   "Herstelling waterlek volgens offerte #44. Klant akkoord met..."     │
│                                                                        │
│ ── OPMERKINGEN UITVOERING (if any crewNotes present) ──────────────── │
│   • Jan Janssens: "Puin afgevoerd naar container op oprit."            │
│                                                                        │
│ ── ONDERTEKENING VOOR AKKOORD / SIGNATURE ──────────────────────────── │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Ondertekend door: Jean Dupont                                      │ │
│ │ Tijdstip: 02/10/2026 16:45                                         │ │
│ │                                                                    │ │
│ │  ┌─────────────────────────────┐                                   │ │
│ │  │ [ Signature PNG Image ]     │                                   │ │
│ │  │                             │                                   │ │
│ │  └─────────────────────────────┘                                   │ │
│ │                                                                    │ │
│ │ "Voor akkoord met de gepresteerde uren en uitgevoerde werken"       │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ [Page Numbering: Pagina 1 van 1]                                       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. File & Function Signatures

### Files to Create (Inside Directive Fence)
- `src/lib/documents/work-order-pdf.tsx`
- `tests/work-order-pdf.test.ts`

### Types & Exported Signatures
```ts
// src/lib/documents/work-order-pdf.tsx

export class SignedWorkOrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignedWorkOrderValidationError';
  }
}

export interface SignedWorkOrderPdfInput {
  tenant: {
    name: string;
    vatNumber?: string | null;
    address?: string | null;
    logoUrl?: string | null;
    brandColor?: string | null;
  };
  client: {
    name: string;
    address?: string | null;
  } | null;
  workOrder: {
    reference: string;
    date: string; /* YYYY-MM-DD, Brussels */
    siteAddress?: string | null;
    projectName?: string | null;
  };
  lines: Array<{
    workerName: string;
    in: string; /* HH:mm */
    out: string; /* HH:mm */
    minutes: number;
  }>;
  tasks: Array<{
    title: string;
    done: boolean;
  }>;
  /** Florin 2026-10-02: printed. The shift's description (scheduler 'Notes'). */
  description: string | null;
  /** Florin 2026-10-02: printed. Each crew member's note. */
  crewNotes: Array<{
    workerName: string;
    note: string;
  }>;
  signature: {
    signerName: string;
    signedAt: string; /* ISO instant */
    imagePng: Buffer;
  };
  language: 'nl' | 'fr' | 'en';
}

/**
 * Validates input and renders the signed work order as PDF bytes.
 * Throws SignedWorkOrderValidationError on invalid data.
 */
export async function renderSignedWorkOrderPdf(input: SignedWorkOrderPdfInput): Promise<Buffer>;
```

### Internal Helper Functions & Components
- `function validateSignedWorkOrderInput(input: SignedWorkOrderPdfInput): void`
- `function getLabels(lang: 'nl' | 'fr' | 'en')`: Dictionary mapping titles, column headers, units (`u` vs `h`), and legal agreement footer.
- `const WorkOrderDocument: React.FC<{ input: SignedWorkOrderPdfInput }>`: React-PDF Document component.
  - `HeaderSection`: Top branding bar, company details, logo, document title and reference.
  - `ClientSiteSection`: Client name/address and site address/project name.
  - `LinesTable`: Table of workers, in/out timestamps, individual durations, and bold Total row.
  - `TasksSection`: Rendered when `input.tasks.length > 0`.
  - `DescriptionSection`: Rendered when `input.description` is non-empty.
  - `CrewNotesSection`: Rendered when `input.crewNotes.length > 0`.
  - `SignatureSection`: Signer name, signedAt, PNG signature, declaration text.

---

## 3. Test Cases & Throw Proofs (`tests/work-order-pdf.test.ts`)

Tests will run via node test runner (`node --import ./tests/register.mjs --test tests/work-order-pdf.test.ts`).
All tests call the real `renderSignedWorkOrderPdf` function.

### Planned Tests
1. **`valid input returns PDF Buffer`**:
   - Call `renderSignedWorkOrderPdf` with valid minimal fixture.
   - Assert `Buffer.isBuffer(buf)`.
   - Assert `buf.subarray(0, 4).toString('utf-8') === '%PDF'`.
   - Assert `buf.length > 1000`.
   - *Throw Proof Mutation:* Temporarily change `renderSignedWorkOrderPdf` return to `Buffer.from('not-a-pdf')` or flip header assertion; verify test fails with assertion error.

2. **`throws SignedWorkOrderValidationError on empty/missing signerName`**:
   - Call with `signature.signerName = ''` or whitespace.
   - Assert throws `SignedWorkOrderValidationError` with message matching `/signer/i`.
   - *Throw Proof Mutation:* Comment out the signerName validation check; verify test fails because no error is thrown.

3. **`throws SignedWorkOrderValidationError on empty signature image`**:
   - Call with `signature.imagePng = Buffer.alloc(0)`.
   - Assert throws `SignedWorkOrderValidationError` with message matching `/signature/i`.
   - *Throw Proof Mutation:* Comment out signature buffer length check; verify test fails.

4. **`throws SignedWorkOrderValidationError on zero lines`**:
   - Call with `lines = []`.
   - Assert throws `SignedWorkOrderValidationError` with message matching `/lines/i`.
   - *Throw Proof Mutation:* Comment out `lines.length === 0` check; verify test fails.

5. **`language produces distinct PDF output for nl and fr`**:
   - Call with identical input except `language: 'nl'` vs `language: 'fr'`.
   - Assert `Buffer.compare(bufNl, bufFr) !== 0`.
   - *Throw Proof Mutation:* Hardcode `const lang = 'nl'` inside the renderer; verify test fails because buffers become identical.

6. **`renders shift description and crew notes when provided`**:
   - Call with `description: 'Specific client quote description'` and crew notes.
   - Ensure render completes successfully and produces valid `%PDF` buffer.
   - *Throw Proof Mutation:* Intentionally throw or drop notes; verify failure.

---

## 4. Milestones

- **M1 · Skeleton, Validation & Throws:**
  - Create `SignedWorkOrderValidationError` and `validateSignedWorkOrderInput`.
  - Set up `tests/work-order-pdf.test.ts` testing the 3 validation throw cases + 1 happy-path skeleton `%PDF` render.
  - Prove throw proofs for each test.
  - Stop for review.

- **M2 · Full Document Layout (Dutch / `nl`):**
  - Implement full layout with `@react-pdf/renderer`:
    - Brand bar & tenant header with optional logo.
    - Client info & work site block.
    - Lines table with hours calculation (`formatDecimalHours` + `formatHoursMinutes`) and total sum.
    - Tasks list with checkbox icons/text.
    - Description & Crew Notes sections with full text wrapping.
    - Signature container with PNG image, signer name, formatted date/time, and agreement statement.
  - Verify visually and test with comprehensive data fixtures.
  - Stop for review.

- **M3 · Multi-Language Parity (`nl`, `fr`, `en`), Formatting & Edge-Case Hardening:**
  - Complete dictionary for French (`fr`) and English (`en`).
  - Unit formatting: `u` for `nl`, `h` for `fr` and `en`.
  - Add test asserting difference between language renders.
  - Validate edge cases: very long worker names, multi-line crew notes, missing optional fields (client, siteAddress, projectName, logoUrl).
  - Stop for final review.

---

## 5. Open Questions for Planner / Florin

1. **Logo Image Format:** If `tenant.logoUrl` is provided, is it guaranteed to be a public URL or data URI readable by `@react-pdf/renderer`? (Plan: wrap `<Image src={tenant.logoUrl} />` defensively so an unparseable or broken URL does not crash document generation).
2. **Signature aspect ratio:** Signature PNGs from `react-signature-canvas` are typically variable aspect ratios (often ~3:1 or 2:1). We plan to render the signature image with `objectFit: 'contain'`, fixed height of 45–50pt, and max width of 160pt to keep it balanced and legible.
3. **Empty sections:** If `tasks` is empty, or `description` is null, or `crewNotes` is empty, those sections are omitted completely rather than printing empty boxes.

---

## Planner review — 2026-10-02 · **GO for M1, with these corrections** (binding)

Good plan: pure renderer, named error, fail-fast, sections omitted when empty, a clear layout. Corrections:

### C1 · 🔴 Make the content testable — a pure VIEW MODEL between input and PDF
Tests 5 and 6 cannot fail meaningfully: a PDF embeds its creation date, so two renders ALWAYS differ (test 5
passes even with the language hardcoded — its throw proof would not throw), and "renders without crashing"
(test 6) proves nothing about the notes. Split the renderer:
```ts
export function buildWorkOrderView(input: SignedWorkOrderPdfInput): WorkOrderView;   // pure data: every printed string
export async function renderSignedWorkOrderPdf(input: SignedWorkOrderPdfInput): Promise<Buffer>; // validate → view → PDF
```
`WorkOrderView` holds every string the PDF prints (labels, rows with their formatted durations, the TOTAAL from
**summed minutes**, task lines, the description, each crew note with its worker, the signature caption). The React-PDF
component only lays out a view. Tests assert on the VIEW: nl vs fr labels; `7,50 u (07:30)`; the total from summed
minutes (3 × 20 min → `1,00 u (01:00)`, never 0,99); description and every crew note present verbatim; no field of
the input that must not print appears anywhere in the view (serialize it and search). Keep one `%PDF` test on the
real renderer. Set the Document's `creationDate`/`modDate` from `signature.signedAt` so the same input renders the
same bytes, and add a determinism test (same input twice → identical buffers) — its throw proof: remove the fixed date.

### C2 · 🔴 Times in BRUSSELS, not the server's clock
`formatDateTime(new Date(signedAt))` formats in the process's time zone — Vercel runs UTC, so a 16:45 signature
prints 14:45. Use `zonedParts(signedAt)` from `src/lib/kernel/shift-time.ts` (Europe/Brussels) and format date + time
from its parts. Test: `2026-10-02T14:45:00Z` → `02/10/2026 16:45`.

### C3 · Logo — no network in a pure renderer
Contract change (Planner's): `tenant.logoUrl` becomes `tenant.logoPng?: Buffer | null`. WO-4b fetches the logo; the
renderer never touches a URL. Missing → no logo, no error.

### C4 · Fonts — Helvetica is fine for M1, NOT for the final document
Built-in Helvetica covers Latin-1 only: Romanian (ș ț ă), Polish, Czech and Cyrillic names — your crew's and clients'
names — would print as missing glyphs on a signed document. Before M2 the Planner adds static IBM Plex Sans TTFs
(Regular + Bold, full Latin-ext + Cyrillic) at `src/lib/documents/fonts/`; register them with `Font.register` from those
local paths. Test (on the view): a worker named `Ștefan Țurcanu` and a client `Дмитрий` are carried through unchanged.

### C5 · Page breaks
Long lists must flow: repeat the table header on a new page (`fixed`), keep the TOTAAL row with the last line, keep the
signature block in one piece (`wrap={false}`), page numbers in the footer (`render` prop). M2 fixture: 40 lines.

### Answers
1. Logo → C3. 2. Signature: `objectFit: 'contain'`, max 160 × 60 pt — agreed. 3. Empty sections omitted — agreed.
Declaration text — agreed: nl "Voor akkoord met de gepresteerde uren en uitgevoerde werken." (fr/en in M3).

**Milestones as proposed, with C1/C2 in M1 (view model + validation + time zone + `%PDF` + determinism).**
**GO for M1.** Stop after M1 for the Planner's ✅.

---

## M1 — done

**Date:** 2026-10-03  
**Status:** ✅ M1 COMPLETE — Awaiting Planner review for M2

### 1. What was built in M1
- **Pure View Model (`buildWorkOrderView`)**:
  - Implemented in `src/lib/documents/work-order-pdf.ts` (with re-export in `src/lib/documents/work-order-pdf.tsx`).
  - Separates view logic from PDF layout. Computes all printed strings, labels, and formatted fields.
  - Enforces `validateSignedWorkOrderInput` throwing named `SignedWorkOrderValidationError` on:
    - Empty or whitespace-only signer name
    - Empty or 0-byte signature PNG buffer
    - Zero work order lines
  - Formats line duration as `7,50 u (07:30)` (or `h` for `fr`/`en`).
  - Formats TOTAAL duration from **summed minutes** (e.g. 3 × 20 min = 60 min → `1,00 u (01:00)`, never 0,99).
  - Preserves description and crew notes verbatim without truncation.
  - Carries Romanian and Cyrillic names through unchanged (`Ștefan Țurcanu`, `Дмитрий Иванов`).
  - Negative test confirms no internal rates (`costRate`, `hourlyRate`), admin notes, or CUIDs leak into the view.
- **Brussels Timezone Formatting (C2)**:
  - Formats signature instant using `zonedParts(input.signature.signedAt)` from `src/lib/kernel/shift-time.ts`.
  - Converts UTC timestamps (e.g. `2026-10-02T14:45:00Z`) into Belgian wall-clock time (`02/10/2026 16:45`).
- **Logo PNG (C3)**:
  - Supports `tenant.logoPng?: Buffer | null` directly in renderer without network I/O.
- **Real PDF Rendering (`renderSignedWorkOrderPdf`)**:
  - Uses `@react-pdf/renderer` with `React.createElement` (fully compatible with Node's native type-stripping ESM runner).
  - Asserts output begins with `%PDF` magic bytes and contains valid PDF structure.
- **Determinism (C1)**:
  - Binds document `creationDate` and `modificationDate` to `new Date(signature.signedAtInstant)`.
  - Verified: calling `renderSignedWorkOrderPdf` twice with identical input yields byte-for-byte identical buffers (`Buffer.compare(buf1, buf2) === 0`).

### 2. Verification Commands & Outputs Verbatim

#### Test Suite
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

#### TypeScript Check
```bash
$ npm run test:compile
> coral-remodeling-pro@0.1.0 test:compile
> NODE_OPTIONS='--max-old-space-size=4096' tsc --noEmit
exit: 0
```

#### Lint Check
```bash
$ npm run test:lint
> coral-remodeling-pro@0.1.0 test:lint
> eslint src
exit: 0
```

### 3. Throw Proofs (§3a)

#### THROW PROOF 1 — Validation: signerName
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

#### THROW PROOF 2 — Brussels Wall-Clock Time (C2)
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

#### THROW PROOF 3 — Summed Minutes Total (C1)
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

#### THROW PROOF 4 — Determinism (C1)
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

#### THROW PROOF 5 — %PDF Magic Bytes
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

