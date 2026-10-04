# CODER DIRECTIVE — WO-4a-M4 · the work order PDF without global patches — PLAN REQUEST

**Planner 2026-10-04. Gate 1 only: append the M4 PLAN to `.agents/plans/WO-4a.md` per `coder-report-protocol.md` §0,
push, STOP.** One milestone is expected; keep the plan short. Roadmap: `WO-4a-M4` (P1). Blocks: WO-4b (the Planner
wires the renderer into signing — not before this lands).

## Why
M1–M3 made the PDF byte-identical on every run by changing two things **for the whole server process**:
1. `renderSignedWorkOrderPdf` replaces the global `Math.random` with a seeded generator while it renders
   (`src/lib/documents/work-order-pdf.ts`, ~line 770). A render is async: while it waits, **every other request on
   the same server instance** (Vercel runs many at once) gets the predictable numbers — ids, tokens, anything.
2. At import, the module replaces `PDFReference.prototype.initDeflate` inside the PDF library (~line 26). That
   prototype is shared: once this file is imported, the invoice, quote and timesheet PDFs all run through the patch.

Today nothing imports the renderer, so it is harmless. WO-4b imports it. Both go **before** that.

Byte-identical output is not needed: the PDF is generated once, at signing, and the stored bytes are the record
(`coral-walkdown-werkbon-record.md` §11a). What must be stable is the **content**, and that is already pure:
`buildWorkOrderView` (view model) is deterministic and tested.

## What to do
1. Delete the `initDeflate` patch (and the `PDFDocument` / `stream` / `zlib` imports it needed, if nothing else uses them).
2. Delete the `Math.random` seeding **and** the render mutex (`renderLock`) — the mutex only existed to protect the seed.
   `renderSignedWorkOrderPdf` becomes: validate → `buildWorkOrderView` → `renderToBuffer` → Buffer.
3. Tests — `tests/work-order-pdf.test.ts`:
   - **Replace** `is deterministic: same input produces identical bytes` with
     **`leaves the process untouched`**: capture `Math.random` and the PDF library's `initDeflate` before rendering;
     render twice concurrently; assert both are the **same references** afterwards, and that `Math.random()` called
     **during** a render (start the render, call it before awaiting) is not the seeded sequence — simplest: two calls
     return different values and neither equals the old seed's first output.
   - **Replace** `produces distinct PDF bytes across nl, fr, and en` — without determinism, bytes always differ, so the
     test would pass on a broken build. Assert the **view model** differs per language instead (labels + unit), and
     that each language's PDF renders (`%PDF`).
   - Content determinism stays covered by the existing view-model tests; keep them unchanged.
   - Every other test must stay green **unchanged**. If one depended on identical bytes, say which and why in the plan.

## 🔴 Throw proofs (§3a) — required in the report
- Put the `Math.random` seeding back → `leaves the process untouched` fails.
- Put the `initDeflate` patch back → the same test fails (on the prototype check).
- Make the view model ignore `language` → the replaced language test fails.

## 🛑 FENCE
May change: `src/lib/documents/work-order-pdf.ts`, `src/lib/documents/work-order-pdf.tsx` (only if a re-export moves),
`tests/work-order-pdf.test.ts`, the plan and the report. Everything else read-only. No new dependency.
The view model, labels, layout and fonts do not change — this is a removal, not a redesign.

## Your plan must contain
1. The exact lines you remove (file:line). 2. How `leaves the process untouched` reaches the library's prototype
without patching it. 3. The tests you replace, keep, and add. 4. Open questions.
