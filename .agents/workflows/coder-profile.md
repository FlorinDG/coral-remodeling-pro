# CORAL — WRITING FOR THE CODER — Gemini 3.8 Flash @ medium effort (Planner 2026-09-12)

Not a style guide. This is **how the specs in `.agents/workflows/` must be written so this particular model succeeds**, derived from its published characteristics and from what it actually did on the BLOB/MAIL batch.

---

## THE MODEL — verified facts (not assumptions)

Released **2 September 2026**, built on Gemini 3.7 Flash. Distributed via **Google Antigravity** (our cron coder).

| Property | Value | What it means for a spec |
|---|---|---|
| Input context | **1M tokens** | A long spec is not the constraint. Under-specification is. |
| **Output cap** | **64K tokens** | **One commit per item.** A refactor that must emit more than ~64K of code in one response will be truncated or degraded. |
| Effort levels | customizable; **we run medium** | It will not spend tokens exploring alternatives. **Pre-decide; never ask it to choose.** |
| Knowledge cutoff | **March 2026** (some domains Jan 2025) | It does not reliably know our installed library APIs. See "the hallucinated API" below. |
| Terminal-bench 2.1 (agentic terminal coding) | **89.4%** — beats Opus 5 | It is *very* good at executing precise, verifiable command-driven work. **Lean on this.** |
| DeepSWE v1.1 (long-horizon SWE) | **73.7%** — near Opus 5's 74.0% | Strong at multi-step code work when the target is defined. |
| Terminal-bench 4.0 (general agent) | **19.1%** vs Opus 5 **51.8%** | **The weak spot.** Open-ended agentic judgement is roughly a third of frontier. Do not leave decisions open. |
| GDPVal-AA v2 (knowledge work) | Elo **1545** vs Opus 5 **1824** | Same conclusion: weaker at open-ended judgement than at code. |
| Known limitation | *"occasional slowness or timeout issues"* | Long single steps can die. Small commits are also a reliability measure. |

**The one-line profile: excellent executor, weak decider.** Give it a decided, verifiable target and it performs at frontier level. Leave judgement open and it fills the gap with something plausible.

---

## EVIDENCE FROM OUR OWN BATCH (2026-09-10 → 12)

**What it did well** — given `coral-blob-read-and-error-surfacing.md`, it landed seven commits and **honoured all five corrections**, including the subtle ones: the `$transaction`, the stamp-after-`generateAsync()` ordering, the "no document ≠ failure" distinction, and a defensive empty-file check nobody asked for. That is a strong result.

**Failure 1 — it invented an API that does not exist.** Its plan called `getStorageProvider().read(key)`. The module exports a singleton: `export const storage = new BlobStorageProvider()`. A plausible-looking name, recalled rather than read. **This is the March-2026 cutoff and hallucination limitation in its purest form** — and it would not have compiled.

**Failure 2 — it got an order of operations wrong.** Its plan stamped `accountantExportedAt` *before* building the ZIP, re-creating the exact bug the item existed to fix, in a smaller window. The spec said "read-all → verify-all → build ZIP → stamp"; the plan reordered it. **Ordering that matters must be numbered and stated as a rule, not implied by prose.**

**Failure 3 — it did not discover the two data edge cases.** That `receiptUrl` holds both keys and legacy full URLs, and that a record with *no* document is not a failure, were both found by the Planner reading the code — not by the coder writing the plan. **It reasons about code well and about *our data* poorly.** It has never seen the production rows.

All three are the same shape: **it does not know what it has not been told, and it does not stop to find out.**

---

## THE RULES

### 1 · Never name an API without pasting its signature 🟥
Any function, export, import or option the coder must call appears in the spec **with its real signature and import path, copied from the file**. If it is not pasted, assume it will be invented.
```ts
import { storage } from '@/lib/storage';        // singleton — NOT getStorageProvider()
await storage.read(key);                        // (key: string) => Promise<Buffer>
```

### 2 · Pin the installed version, and require it to read the types 🟥
Its knowledge predates our stack. Current: **Next 16.1.6 · React 19.2.3 · Prisma 6.19.2 · zustand 5.0.11 · next-intl 4.8.2 · @tanstack/react-query 5.90.21 · react-datasheet-grid 4.11.6**.
**This matters most for `GRID-REPLACE`** — TanStack Table is not yet installed, and the coder's recall of its API will be older than whatever we install. The spec must instruct: *read the installed package's own types before writing against them; do not write from memory.*

### 3 · Decide everything. Offer nothing. 🟥
At medium effort it will not weigh options — it will pick one and proceed. Where a real choice exists, **Florin decides and the spec records the rejected option explicitly** ("the partial-export option is rejected — do not implement it, do not offer it as a fallback, do not add a setting for it"). That phrasing worked; the coder did not drift back to it.

### 4 · State our data's edge cases. It cannot see production. 🟥
Every spec touching stored data lists **the shapes that actually exist** — legacy formats, empty values, absent fields — and says which are failures and which are normal. It will not discover them. C1/C2 above would each have caused an outage.

### 5 · Number the order when order is the fix 🟧
"Read-all → verify-all → build → stamp" as a **numbered list with a sentence saying the sequence is the fix**, never as narrative. Prose ordering gets re-derived.

### 6 · One item, one commit, and keep it under the cap 🟧
64K output. Any item whose diff could exceed that is **split in the spec**, not left to the coder to chunk. Commit tag = the item id (`BLOB-1: …`) so verification maps to spec 1:1.

### 7 · Make every acceptance criterion a command 🟥 — *this is where it is strongest*
89.4% on agentic terminal coding. Exploit it: acceptance criteria are **runnable**, not descriptive.
```bash
grep -rn "from '@vercel/blob'" src   # must return exactly 2 files
npx tsc --noEmit                      # 0 errors
node --experimental-strip-types --import ./tests/register.mjs --test 'tests/*.test.ts'
```
*(Note: `--test tests/` now throws `ERR_UNSUPPORTED_DIR_IMPORT` — the glob form is required.)*

### 8 · Say what must NOT happen 🟧
Negative constraints are followed well when explicit. "Do not reimplement the whole-row diff in any form." "Do not port these rules into V2 — move them down to the core." Without the prohibition, the natural move is to port.

### 9 · Require the plan before the code, and review it 🟥
Its plans surface its misconceptions cheaply — all three failures above appeared in the plan, before any code. **This review step is not optional and it is the highest-leverage thing the Planner does.** Corrections go back as numbered items (C1…Cn) written **into the spec**, not only into chat, so the binding text and the instruction never diverge.

### 10 · Trust the execution, verify the judgement 🟧
Do not re-read code it wrote to check syntax or mechanics — it is good at those, and that is not where it fails. **Verify instead: did it invent an API? did it preserve a required order? did it handle the data shapes?** That is where the defects are, and checking those is cheap.

---

## FOR THE ROOTS AHEAD
R1 and R2 are the most judgement-heavy work we have given it. Mitigations, per the above:
- **R1-1 (inventory)** is deliberately read-only and produces a table — it is exactly the kind of enumerable, verifiable task the model is strong at, and it hands the *judgement* (which model needs what) back to the Planner.
- **R1-2** touches the schema. `pd.md` DATA-SAFETY already forbids `db push` / `--accept-data-loss`; restate it **inside** the item, because a rule in another file is a rule it may not weigh.
- **R2** must be split finely. "One write function replacing five doors across 17 files" is far beyond 64K in one step — the spec already stages it; keep each stage independently committable.

## Sources
- [Gemini 3.8 Flash — Model Card, Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-8-flash/)
- [Introducing Gemini 3.8 Flash and 3.8 Flash Cyber — Google Blog](https://blog.google/innovation-and-ai/models-and-research/gemini-models/3-8-flash-and-3-8-flash-cyber/)
- [Gemini 3.8 Flash rolling out three weeks after last release — 9to5Google](https://9to5google.com/2026/09/02/gemini-3-8-flash-launch/)
