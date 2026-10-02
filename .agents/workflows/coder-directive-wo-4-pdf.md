# CODER DIRECTIVE — WO-4a · the signed work order PDF renderer — PLAN REQUEST

**Planner 2026-10-02. Gate 1 only: write the PLAN (`.agents/plans/WO-4a.md`) per `coder-report-protocol.md` §0, push, STOP.**
Context: `coral-work-order-tabs.md` (WO-3 = signing, live) · `coral-walkdown-werkbon-record.md` §11a (the PDF is
generated AT SIGNING, stored once, mailed later from the stored bytes) · §10d (what may print on a client document).

## Who does what
- **You (WO-4a):** a pure renderer — data in, PDF bytes out. Nothing else.
- **Planner (WO-4b):** choosing the data (the frozen evidence), calling the renderer at signing, storing the bytes,
  the send + retry cron, the "unsent" view. You do not touch those.

## The contract (fixed — propose changes in the plan, don't change it silently)
```ts
// src/lib/documents/work-order-pdf.tsx
export interface SignedWorkOrderPdfInput {
  tenant:   { name: string; vatNumber?: string | null; address?: string | null; logoUrl?: string | null; brandColor?: string | null };
  client:   { name: string; address?: string | null } | null;
  workOrder:{ reference: string; date: string /* YYYY-MM-DD, Brussels */; siteAddress?: string | null; projectName?: string | null };
  lines:    Array<{ workerName: string; in: string /* HH:mm */; out: string /* HH:mm */; minutes: number }>;
  tasks:    Array<{ title: string; done: boolean }>;
  signature:{ signerName: string; signedAt: string /* ISO instant */; imagePng: Buffer };
  language: 'nl' | 'fr' | 'en';
}
export async function renderSignedWorkOrderPdf(input: SignedWorkOrderPdfInput): Promise<Buffer>;
```
- Hours print as `7,50 u (07:30)` — use `formatDecimalHours` / `formatHoursMinutes` from `src/lib/computeWorkedDuration.ts`; a TOTAAL from summed minutes.
- Dates/times Belgian (`src/lib/format/date.ts`); labels in the three languages (a small map in the file is fine).
- Library: `@react-pdf/renderer` (already used — see `src/app/api/hr/timesheet-export/route.tsx`, `src/components/admin/invoices/InvoicePDFTemplate.tsx` for style). Fonts: the self-hosted files in `public/fonts` if the library can load them, otherwise its built-in Helvetica — say which in the plan.
- **Throws** (named error) on: no signer name, empty signature image, zero lines.
- 🛑 **Prints nothing else** — no notes of any kind (§10d; which note is client-facing is an open product decision), no internal ids, no cost rates.

## Tests (`tests/work-order-pdf.test.ts`)
Must call the REAL renderer. At minimum: returns a Buffer starting with `%PDF`; each of the three throws; output for
`nl` and `fr` differs. Each test needs its THROW PROOF (§3a) in the report.

## 🛑 FENCE
Create only `src/lib/documents/work-order-pdf.tsx` and `tests/work-order-pdf.test.ts` (+ the plan / report).
Everything else read-only. No new dependency (`package.json` untouched).

## Your plan must contain
1. Approach + page layout sketch (sections top → bottom). 2. Function list with signatures. 3. Each test and how it fails.
4. Milestones (suggested: M1 skeleton + throws + `%PDF` test · M2 full layout nl · M3 fr/en + fonts). 5. Open questions.
