# CORAL — DESIGN — SUBMODULE ENTITLEMENT — Florin 2026-09-26

> **Florin:** *"there is one more level to introduce in the gating then — submodule. Free can get CRM → clients. quotes and pipeline gated. … A module is granted with a minimum of one submodule, to avoid empty links in the sidebar. And we map which submodule each tier gets."*
>
> *"it is why i named other gates in the map. one of them is this one."*

**This was specified at the start.** The original mindmap read *"kernel → core → TENANT GATE → module → **other gates** → **submodule** → leaves."* Both the gate and the level were named then. **The Planner filed entitlement as a detail of tenancy for two days.** It is a gate of its own, at its own level, and submodule is the level below it.

---

# 1 · THE DEFINITION THAT BOUNDS EVERYTHING

> ## A SUBMODULE IS A SIDEBAR ENTRY.

**If it does not appear in the navigation, it is not a submodule.** This is not a stylistic choice — it is what makes Florin's invariant checkable and stops the vocabulary exploding into a permission system.

- **Permissions** answer *may this user do this action*. Not this.
- **Submodules** answer *does this tenant see this door*. This.

---

# 2 · THE INVARIANT — and why it decides the data model

> **"A module is granted with a minimum of one submodule, to avoid empty links in the sidebar."**

🔴 **`activeModules: String[]` cannot express this.** A flat list of module names has no place to put the submodules, so the invariant would have to be *validated* — and anything validated can be violated between validations.

### ✅ ONE FIELD. The bad state becomes UNREPRESENTABLE.
```ts
// Tenant.entitlements : Json
{
  "INVOICING": ["invoices", "purchases", "suppliers", "payments"],
  "CRM":       ["clients"]                    // FREE: quotes + pipeline withheld
}
```
- **A module is granted iff it has a key with ≥ 1 submodule.** There is no way to write a granted module with zero submodules — **the empty sidebar link cannot be described.**
- 🛑 **NOT two fields.** `activeModules` + `activeSubmodules` is two representations of one fact, which is the defect this codebase keeps producing *(five id lists, four module gates, three project models)*. **We are not adding a sixth.**
- **`activeModules` survives as a DERIVED read** — `Object.keys(entitlements)` — so the ~8 existing readers keep working during migration. *(Same move as pass 3a's derived lists.)*

---

# 3 · TIER IS A TEMPLATE, NOT A GATE

> **Florin:** *"we map which submodule each tier gets."*

```ts
// kernel — what a tier is GIVEN
export const TIER_DEFAULTS: Record<PlanType, Entitlements> = {
  FREE:       { INVOICING: ['invoices','purchases'], CRM: ['clients'] },
  PRO:        { … },
  ENTERPRISE: { … },
};
```
- [ ] 🔴 **`planType` decides what a tenant is GIVEN. `entitlements` decides what it MAY USE.** Applied at provisioning and at upgrade — **never consulted at a gate.**
- [ ] 🛑 **No gate anywhere reads `planType`.** *(`pd.md` 5a — a component must not decide its own privilege, and plan-sniffing is deciding it. Same error as `isImpersonating`.)*
- [ ] **A tenant's entitlements may exceed their tier's default.** Florin grants a prospect an extra submodule; nothing recomputes it from the plan behind his back. *(Automation is good, the user remains the authority.)*
- [ ] **Upgrading adds; it never silently removes.** A downgrade that would remove submodules is **shown and confirmed**, never applied blind.

---

# 4 · THE KERNEL TABLE — one level deeper than `ENT-2`

```ts
export interface SubmoduleSpec {
    submodule:   Submodule;
    displayName: string;
    routes:      string[];               // segments this door opens
    dbRoles:     SystemDatabaseRole[];   // databases it may write
}
export interface ModuleSpec {
    module:      Module;
    displayName: string;
    submodules:  Readonly<Record<Submodule, SubmoduleSpec>>;   // 🔴 at least one
}
```
🔴 **Routes and database roles attach to SUBMODULES, not modules.** That is the entire mechanism — the gate gets finer because the map does.

### Exhaustiveness — the `TSC-9` ratchet, third application
- [ ] **Every gated route appears in exactly one submodule.** Twice → build fails.
- [ ] **Every one of the 16 database roles appears in exactly one submodule, or in an explicit `UNGATED` set.** 🔴 **Absence must not mean ungated** — that is how `ENT-6` happened: 8 roles open because nobody decided.
- [ ] **Every module has ≥ 1 submodule** — asserted in the test, not merely intended.

## The worked example — CRM, from Florin's own words
```ts
CRM: { submodules: {
    clients:   { routes: ['contacts'],   dbRoles: ['clients'] },
    quotes:    { routes: ['quotations'], dbRoles: ['quotations'] },
    pipeline:  { routes: ['crm'],        dbRoles: ['crm','bobex'] },
}}
```
**FREE gets `CRM: ['clients']`.** Contacts reachable and writable; quotes and pipeline invisible.

## 🟢 THIS RESOLVES `ENT-7`
`ENT-7`: a FREE tenant cannot create a client because `clients` is gated on CRM and FREE grants only INVOICING — **so they can reach the invoice screen and cannot create the customer to invoice.** *The acquisition model broken at the first step.*
**Under submodules the question dissolves.** `clients` does not have to move to INVOICING, and CRM does not have to be granted whole. **FREE gets the one door it needs.** That is exactly what the level was for.

---

# 5 · SERAPH · the guestlist gains a column
```ts
scope.may(module: Module, submodule?: Submodule): boolean
```
- [ ] **One reader, reading the database.** 🛑 The JWT stays a rendering hint and never a gate *(`ENT-3` — the stale-token revocation leak)*.
- [ ] **`may(M)` with no submodule = "any submodule of M"** — which, by the invariant, means the module is granted at all.
- [ ] **Unknown module or submodule → throws.** A typo must not read as ungated.

# 6 · CORE · `requireModule` gains the level, and the bypass lands here
- [ ] `requireAccess(module, submodule?)` — **middleware, server actions and record creation all call this one primitive.**
- [ ] 🔴 **The superadmin bypass lives HERE, once** *(`ENT-9`, `pd.md` 5a)*. Today it is re-implemented in `middleware.ts`, `moduleGuard.ts` and `pages.ts`.

# 7 · MODULES · the sidebar renders from the grant
- [ ] **A module link renders iff ≥ 1 of its submodules is granted.** A submodule link renders iff granted.
- [ ] 🟢 **The empty link Florin named is now impossible by construction, not by a check.**
- [ ] 🛑 **No component reads `entitlements` and decides.** It asks and renders. *(No loose setters — Florin.)*

---

# 8 · MIGRATION
- [ ] **Add `Tenant.entitlements Json?`** — additive, nullable *(`pd.md`)*. `activeModules` untouched.
- [ ] **Backfill from `activeModules` × `TIER_DEFAULTS`**: each currently-granted module gets its tier's submodules, defaulting to **all** submodules for existing tenants. 🛑 **Nobody loses access in the migration.**
- [ ] **`activeModules` becomes derived** from `entitlements`; the ~8 readers are converted, then the column drops. **Never two live sources.**
- [ ] 🔴 **Verify against both tenants before and after:** `BV CORAL` ENTERPRISE / 9 modules, `Murgu` FREE / INVOICING. **BV CORAL's reachable surface must be byte-identical after backfill.**

---

# FLORIN'S DECISIONS — the business taxonomy, not the mechanism
- [ ] **The submodule list per module.** CRM is settled *(clients · quotes · pipeline)*. The others need naming — the candidate routes are the 13 in `middleware.ts:309`.
- [ ] **`TIER_DEFAULTS` for FREE / PRO / ENTERPRISE.** 🔴 **FREE must at minimum reach: invoices, purchases, clients** — otherwise the prospect cannot invoice, which is `ENT-7`.
- [ ] **`WEBSITES` / `EMAIL`** — grantable, or drop the gates? *(`ENT-8`: BV CORAL holds both; the settings UI cannot grant either.)*
- [ ] **The 8 currently ungated database roles** — which submodule owns each? *(`ENT-6`.)*
