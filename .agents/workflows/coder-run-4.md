# CORAL — AUTHORISED RUN #4 — post-promotion, pre-`R1` — Planner 2026-09-21

**`main` is current.** Everything here is **unblocked by `R1`, `R5` and the reminder engine** — deliberately. Nothing in this run touches the tenancy gate, so none of it collides with `R1` when it starts.

**Work the items in order. One at a time, committed and reported before the next.** `coral-execution-order.md` §🔒 applies in full.

---

## PHASE A — REPORTS FIRST. **Read-only. No code.**
*Three answers that shape later work. Cheap now, expensive to guess later.*

### `A1` · `KERN-1` census — encoded document keys
`coder-directive-kernel-pass.md`
- [ ] Count `receiptUrl` values across invoices **and** expenses containing `%2F` or `%20`.
- [ ] Report per tenant, with 5 examples. **No repair. Florin decides.**

### `A2` · `PANEL-0` — why a relation resolves in the grid and not the panel
`coder-directive-relation-resolution.md`
- [ ] For a purchase invoice showing a client in the grid but not the panel: report the stored `relationDatabaseId` (bare or scoped), whether the target database is hydrated, and whether `pageIndex` holds its entries.
- [ ] **Name which of the two causes is real.** This answer feeds `R1-1b`.

### `A3` · `LOC-4` — can a client-facing PDF render an American date?
`coral-locale-dates.md`
- [ ] `InvoicePDFTemplate:157` and `QuotationPDFTemplate:98` use `localeFmt`. **Report what it resolves to when the document language is unset**, and whether it can fall through to the machine locale.
- [ ] 🔴 **If yes, say so loudly** — it means a client has received an invoice with a date in the wrong format.

---

## PHASE B — `KERN-1` · THE DOCUMENT KEY PARSE 🟥 **P0**
`coder-directive-kernel-pass.md` · *the only item here that can break a legally-significant process*

- [ ] `resolveDocumentKey` decodes after stripping `/api/files/`, per path segment, exactly as `api/files/[...key]/route.ts:26` does.
- [ ] 🔴 **One parse, not two behaviours.** Extract into a single exported helper in `lib/storage`; **the route calls it too.**
- [ ] Already-decoded keys survive unchanged; malformed sequences return `null` rather than throw.
- [ ] 🛑 **The tenant-prefix assert is byte-identical afterwards.**
- [ ] Tests: encoded key · bare key · foreign-tenant key · malformed sequence.

---

## PHASE C — CHEAP AND VISIBLE
*Four small items. None depends on another.*

### `C1` · `DOC-VOCAB-1` — reserve "werkbon" 🟧
`coral-site-documents.md`
- [ ] `projects-management/bordereau/[id]:62` and `:81` stop calling the page a Werkbon. It is a **Bordereau**.
- [ ] Through the **catalogue**, not a literal (`LOC` rules), en/nl/fr/ro.
- [ ] Check `nl.json` `viewWorkOrder: "Werkbon bekijken"` — **report which document it opens** before changing it.
- [ ] `admin/hr/timesheets/[id]` keeps the word. **It is the correct owner.**

### `C2` · `CLEAN-1` — the build is not linting 🟧
`coral-post-promotion-cleanup.md`
- [ ] Remove the dead `eslint` key from `next.config.ts` (Next 16 ignores it).
- [ ] **Add an explicit lint step to CI.** 🔴 **Note for `R1`: the import-boundary gate cannot ride on `next build`.**

### `C3` · `CLEAN-8` — filter value input too narrow 🟨
Florin, 2026-09-20: *"the value field in the filter modal is a bit small, and it is hard to use as is."*
- [ ] Widen the value input in `FilterToolbar`. **Layout only.**

### `C4` · `KERN-2` · `MODAL-HAZE` — every dialog blurs on odd sizes 🟧
`coder-directive-kernel-pass.md`
- [ ] Centre `ui/dialog.tsx` **without a fractional transform** — flex on the overlay, no `translate-x/y-[-50%]` in the resting state.
- [ ] Animation stays; it must not leave a half-pixel transform when settled.
- [ ] Check odd widths, long content, light and dark.
- [ ] 🛑 **`ui/dialog.tsx` only.** Do not touch `BottomSheet`.

---

## PHASE D — `NOTIF-1` · THE NOTIFICATION SERVICE 🟥 *the substantial one*
`coral-notifications.md` · **Step 1 only. Explicitly not blocked by `R1`, `R5` or the reminder engine.**

- [ ] **`notify({ userId, topic, title, body, entity, href })`** in L1 — the service every module will call.
- [ ] 🔴 **In-app is ALWAYS written, first, and is the record.** Use the **existing `Notification` table** (`schema.prisma:932`). 🛑 **No second table.**
- [ ] **Delivery outcome per channel** — additive fields on `Notification`: `attempted · delivered · denied · failed`, with a reason. **This is Florin's log.** *(Additive migration — **Florin runs it.**)*
- [ ] **Namespace the topics.** The existing `QUOTE_ACCEPTED · INVOICE_OVERDUE · PEPPOL_RECEIVED · DATE_REMINDER` become `quotes.accepted`, `invoices.overdue`, `peppol.received`, `tasks.reminder`. **Declared in one place and validated — no free-text `type`.**
- [ ] **Migrate the existing callers** of `lib/notifications.ts` `createNotification` to `notify()`. **One at a time.**
- [ ] 🛑 **No transports in this step.** No push, no SMS, no `web-push` dependency. **The service and the record only** — transports and the subscription registry land with `R1`.
- [ ] **Assignee only** (Florin, 2026-09-21). Not the owner, not the tenant.
- [ ] Tests: `notify()` always writes in-app · an unknown topic is rejected · outcome fields are recorded.

---

---

## PHASE E — `KERN-3` · `mintDatabaseId` 🟥 **AUTHORISED by Florin, 2026-09-21**
`coder-directive-kernel-pass.md` · `pd.md` IDENTITY DIRECTIVE

**Do this LAST in the run** — it changes how databases come into existence, and nothing above should be debugged through it.

- [ ] **`mintDatabaseId()`** — server-side, **the only source of a new database identifier.** `pd.md`: *identity is minted at the lowest layer that owns it and is immutable to everything above.*
- [ ] 🔴 **Delete the `specificId` parameter** from `createDatabase` — `store.ts:175` (signature), `:859` (impl), `:865` (`id: specificId || uuidv4()`).
- [ ] **A caller learns an identity; it never chooses one.** Creation returns the id.
- [ ] 🟢 **`DatabaseClone:983` then cannot auto-create a database in the browser** — it passes `resolvedId` as `specificId`, and with the parameter gone the call is unwritable. **`CUSTOM-4` falls out as a consequence, not as a task.** Do not replace it with a different client-side path.
- [ ] `uuidv4()` for **pages and views** is unaffected. **This is about database identity only.**
### 📋 THE THREE CALL SITES — already traced. **Do not re-investigate.**
`coral-journal-decomposition.md` has the full analysis.

| Call site | What happens | Action |
|---|---|---|
| `dynamic-db/page.tsx:26` | Passes **no** `specificId`. Already dead — `store.ts:816` rejects the name `'New Database'`. | **Unaffected.** 🛑 **Do NOT "fix" it by passing an id.** It is fixed properly in `CUSTOM-6`. |
| `DatabaseClone.tsx:983` | `createDatabase(parsedName, undefined, resolvedId, customProps)` — **the browser auto-creating a system database.** | **Dies with the parameter. This is the objective.** Do not replace it. |
| `journal/page.tsx:343` | `createDatabase('General Journal', …, GENERAL_DB_ID, […])` inside `if (!db)`. | **Delete the creation path.** See below. |

### 🟢 THE JOURNAL BREAKS NOTHING — verified, not assumed
```js
if (!db) { db = createDatabase(…, GENERAL_DB_ID, …); }   // :342-343
```
**Creation only fires when the database is MISSING.**
- **Florin's tenant:** `db-journal-general` exists with **11 pages** → the branch never runs.
- **Any other tenant:** it fires, then `saveGlobalDatabase:351` rejects it as another tenant's id → *"Failed to save database configuration"*. **Already broken today.**

> **So deleting this path removes something that works for exactly one tenant by accident of history and fails for everyone else.**

- [ ] **Delete the `if (!db)` creation block.** 🛑 **No `provisionJournalDb()` helper — that is `specificId` under another name.**
- [ ] **Replace it with an honest state:** *"The journal is not available for this workspace yet."* **Not a silent failure, not a toast about saving configuration.** ERROR-SURFACING DIRECTIVE — and strictly better than today.
- [ ] **Free fix, same file, same mistake:** `:99` and `:106` use `GENERAL_DB_ID` **unresolved**, while `:103-105` resolve `db-1`, `db-clients` and `db-crm` through `resolveDbId`. **Resolve it too.** One line each.
- [ ] **Not in scope:** server-side journal provisioning (`CUSTOM-2`/`R1`) and adding `db-journal-general` to `SYSTEM_DB_PREFIXES` (`R1-1a`). **The journal stays unavailable to new tenants — which is its current state, stated honestly rather than failing quietly.**

- [ ] 🛑 **STOP AND REPORT if any OTHER seeding path breaks** — `mockData`, `provisionTenantDbs`, or anything not listed above. **Do not reinstate `specificId` under another name.** A seeding path that needs to choose an id is telling us something, and Florin decides what.
- [ ] **Grep gate:** `grep -rn "specificId" src` → **zero.**

**Why now rather than with `R1`:** it is safe ahead of the tenancy work and **makes `R1-1b` cheaper** — `logicalKey` lands on databases whose identity already has one author.

---

## 🛑 NOT IN THIS RUN
| | Why |
|---|---|
| Push / SMS transports · subscription registry | Seraph work — lands with `R1`. |
| `R5-0`, `IMP-0` | Need `R1-2`'s fail-closed resolver. **Built now they would wrap a fail-open default.** |
| `LOC-2/3` date + week-start migration | Larger; after this run. |
| `BORD-*`, `WERK-1`, `PANEL-1…4` | Queued behind `R1` or behind a Florin decision. |

## GATES — every item
```bash
npm run test:compile
node --experimental-strip-types --import ./tests/register.mjs --test 'tests/*.test.ts'
```
**Report per item: id · commit hash · what changed · what was verified · anything noticed but NOT fixed.**
