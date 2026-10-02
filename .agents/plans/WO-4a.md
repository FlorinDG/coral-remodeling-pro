# PLAN — WO-4a · Signed Work Order PDF Renderer

**Target:** `src/lib/documents/work-order-pdf.tsx` & `tests/work-order-pdf.test.ts`  
**Directive:** `.agents/workflows/coder-directive-wo-4-pdf.md`  
**Protocol:** `coder-report-protocol.md` §0 (Plan First)  
**Status:** 🟦 AWAITING PLANNER REVIEW

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
