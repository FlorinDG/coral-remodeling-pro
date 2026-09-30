# CORAL — DRAFT — WHAT PRO IS — Planner 2026-09-30 · **for Florin, not decided**

> **Florin:** *"pro tier — stays undefined, write a draft if you want. but didn't find the time to define it."*
> This is a draft to react to. Nothing here is built or promised. The mechanism is already decided (`coral-submodule-entitlement.md`: module → submodule → quota; **the tier is a template, not a gate**) — this only proposes the **template** for PRO.

---

## 0 · THE QUESTION PRO HAS TO ANSWER
**€29/month, 1 user, €19 per extra user, €4.99 per workforce seat.** FREE is "invoice and get paid". ENTERPRISE is "run a company with teams, clients and a public face". **PRO is the small contractor in between — and today three sources disagree about what that contractor gets.**

## 1 · 🔴 THE CONTRADICTION THAT DECIDES THE SHAPE — measured
| Source | HR / WorkHub on PRO |
|---|---|
| `pd.md` Tier Feature Tree (locked 2026-05-13) | **HR ❌** — Enterprise only |
| `feature_matrix.md` (approved 2026-04-21) | **WorkHub ✓ · Employees 2 max · Workforce scheduler ✗** |
| `lib/stripe.ts` (live pricing) | **Workforce seat €4.99 on PRO** |

- If PRO has **no HR**, the €4.99 workforce seat is a price for something PRO cannot use.
- If PRO has **WorkHub but no scheduler** (the matrix), a PRO crew can only ever *clock in without a shift* — every hour arrives unattributed and pending (`pd.md` 4x), the planning half of the product is missing, and **the shift brief, shift submit and the werkbon (all shift-based) are unreachable on PRO.**
- **Either way PRO is incoherent today.** The draft below resolves it one of three ways.

---

## 2 · THREE SHAPES FOR PRO

| | **A · Office PRO** | **B · Small-contractor PRO** *(Planner's recommendation)* | **C · Matrix as written** |
|---|---|---|---|
| **One line** | Everything a desk needs; crews are Enterprise | A 1–10 person contractor runs the whole job on PRO | April's matrix, unchanged |
| **HR / WorkHub** | ✗ (matches `pd.md`) | ✓ WorkHub + **scheduler** + leave + timesheets; **quota: ≤ 10 workforce seats** | WorkHub ✓, scheduler ✗ |
| **Workforce seat €4.99** | **Removed from PRO** | Kept — it is the growth lever | Kept, but seats get a crippled app |
| **Werkbon (signed work order)** | ✗ | ✓ (it is what the client pays against) | ✗ (needs shifts) |
| **Where Enterprise still wins** | HR entirely | teams > 10 · multiple pipelines · unlimited portals · white-label · multi-currency · calendar sync · inbox · Store · Batiprix add-on · advanced formulas | same as B, plus the scheduler |
| **Risk** | Contractors with even one crew member can't use PRO → pushed to €99 or away | Enterprise must stay clearly ahead on *team size and presence*, not on basic workforce | Sells a feature (crew seats) that doesn't work properly |
| **Code consequence** | Delete PRO workforce pricing; HR gate unchanged | Scheduler + werkbon reach PRO; a seat quota (the quota axis already exists for Peppol/OCR) | None — which is the problem |

**Why B:** CoralOS's edge for Belgian contractors is the loop *plan → crew clocks → evidence → signed werkbon → invoice.* Cutting the loop at PRO sells the ERP without the part competitors don't have. The quota axis — not the gate — is what separates PRO from Enterprise on workforce: **same doors, fewer seats.**

---

## 3 · THE FULL PRO TEMPLATE UNDER B — module → submodules (→ quota)

| Module | PRO gets | Quota on PRO | Enterprise adds |
|---|---|---|---|
| **INVOICING** | invoices · purchases · expenses · credit notes (sale + purchase) · Peppol · OCR | Peppol 20 sent / 30 received · OCR 300 | unlimited · multi-currency · no "Powered by" |
| **CRM** | clients · quotes · pipeline | **1 pipeline** | unlimited pipelines · forecasting · pipeline → invoice automation |
| **LIBRARY** | articles · bestek (tenant's own, empty at start) | — | populated catalogue · **Batiprix add-on (+€100, Enterprise only — decided 2026-09-30)** |
| **PROJECTS** | projects · client portals | 20 projects · 10 portals | unlimited · planning timeline |
| **HR** | WorkHub · scheduler · leave · timesheets · werkbon | **≤ 10 workforce seats** · 2 office employees | unlimited seats · teams/leads · advanced reporting |
| **TASKS** | standalone tasks | — | relations · rollups |
| **UTILITIES** | calendar (personal + team ≤ 3) · files (5 GB) · custom databases | 5 databases | calendar sync · inbox · unlimited · advanced formulas |
| **STORE** | ✗ *(decided: Enterprise only)* | — | pages · services · portfolio · custom domain |
| **Branding** | tenant logo on PDFs | — | white-label |

## 4 · WHAT FLORIN DECIDES — the rest is data
1. **A, B or C** — the shape.
2. Under B: **the seat quota** (10 is a placeholder — the number where a contractor should move to Enterprise).
3. Whether the **April PRO numbers** (20 projects, 10 portals, 5 databases, 5 GB, 3-user team calendar) still hold.

*Sources: `pd.md` Tier Feature Tree · `feature_matrix.md` (2026-04-21) · `lib/stripe.ts` pricing as read 2026-09-26 · `coral-submodule-entitlement.md` · the feature-matrix artifact (26 Sep). Batiprix recorded per Florin 2026-09-30.*
