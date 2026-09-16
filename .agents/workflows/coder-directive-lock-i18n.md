# CORAL — CODER DIRECTIVE — `LOCK-5` · no hardcoded UI text, no second label catalogue — Planner 2026-09-16

**Florin, 2026-09-16:** *"No hardcoding UI — we have fought long and hard over this. NO HARDCODING UI."*

**Follow-up to `LOCK-1…4`, which are otherwise accepted and verified (125/125).** `R1` and `R3` are correct: `depth` and `isParentCollapsed` are confirmed **render-derived** (they exist only on `FlattenedBlock` via `flattenBlocks`, never on `Block`), and `parentId` — which carries the real structure — is correctly **not** stripped.

**This item is about `formatExportLockMessage` in `src/lib/records/export-lock.ts`.**

---

## THE VIOLATION — two of them, and the second is the structural one

### V1 · Four locales of UI copy hardcoded in a `.ts` file
```ts
if (lang === 'nl') { return `${prefix} is al naar de boekhouder verzonden. De factuurregels ...`; }
if (lang === 'fr') { ... }
if (lang === 'ro') { ... }
// default 'en'
```
Twelve user-facing sentences live in application logic, with a hand-rolled locale switch and a hand-rolled fallback chain.

**Why this is not a style preference:**
- **`tests/i18n.test.ts` cannot see them.** They are not `t()` calls, so the parity suite we just brought to **846 keys × 4 locales, 125/125** does not cover them. **We closed the gate on Monday and walked around it on Tuesday.**
- Translations now live in two places — `src/messages/*.json` and this file. **The next person fixing a Dutch phrase will not find it.**
- It re-implements locale selection and fallback that `next-intl` already provides.

### V2 · 🔴 `DEFAULT_PROPERTY_LABELS` is a THIRD representation of a name we already store
```ts
const DEFAULT_PROPERTY_LABELS = { nl: { vatRegime: 'btw-regime', totalExVat: 'totaal excl. btw', ... }, en: {...}, fr: {...}, ro: {...} };
```
**Every property already carries its display name in the database schema** — `database.properties[].name`, which is exactly what `ColumnHeader` renders. This map is a **hand-maintained copy of data the system already holds**, for ten of the twenty-odd properties, in four languages.

**This is defect shape #1 again:** two representations of one concept. Add a property, or rename one in the schema, and the lock message silently shows the old name or the raw id. **Nothing will fail; it will just be wrong.**

---

## `LOCK-5` · THE FIX

- [ ] **Delete the hardcoded sentences.** Move all message variants into `src/messages/{en,nl,fr,ro}.json` under one namespace — e.g. `Admin.exportLock.*` — with the three shapes already identified (blocks only · properties only · both) as separate keys taking ICU placeholders for `{document}` and `{fields}`.
- [ ] **Delete `DEFAULT_PROPERTY_LABELS` entirely.** The caller passes real labels **resolved from `database.properties[].name`** — the same source the grid header uses. The server already reads `parentDb.properties` to build `relationPropertyIds`; **the names are in that same object.**
- [ ] **Fall back to the property id only if the schema has no name**, and treat that as a schema defect worth reporting — not as a normal path.
- [ ] **`export-lock.ts` returns DATA, not prose.** It is a pure rule module (`checkExportLock` is unit-tested precisely because it is pure). It should return `{ blockedFields, blockedBlocks: boolean }` and let the **UI layer** render the sentence through `t()`. **A rule engine that formats Dutch is doing two jobs.**
- [ ] The document name is already passed in (`docTitle`) — keep that, it was the right part of `R4`.
- [ ] **Do not hardcode "Factuur" / "Invoice" either.** The lock also covers `db-expenses` and `db-tickets`; a purchase invoice announced as *"Invoice 2026-55"* is wrong. **The document type comes from the database, not from a string in the message.** If the record type is not readily available, use a neutral phrasing that reads correctly for any document — do **not** guess.

## VERIFY
1. `grep -n "boekhouder\|accountant has already\|comptable\|contabilului" src/lib/` → **no matches.** All four sentences live in `src/messages/`.
2. `grep -n "DEFAULT_PROPERTY_LABELS" src` → **no matches.**
3. Rename a property in the database schema → the lock message shows the **new** name, with no code change.
4. Trigger the lock on a **purchase invoice** (`db-expenses`) → the message does **not** call it an "Invoice"/"Factuur" if that is not what it is.
5. `node --experimental-strip-types --import ./tests/register.mjs --test 'tests/*.test.ts'` → green, **and `i18n.test.ts` now covers the new keys** (846 → 846 + N, equal across all four locales).
6. `tests/export-lock.test.ts` still passes — **assert on `blockedFields`, not on rendered sentences.** If a test broke because the module stopped returning prose, that is the fix working.

## PROHIBITIONS
- **No user-facing string in any `.ts`/`.tsx` outside `src/messages/`.**
- **No second catalogue of property display names.** One source: the schema.
- **No hand-rolled locale switch or fallback chain.** `next-intl` owns that.
- **No document-type word baked into a message.**

---

**Note for the future, and the reason Florin is emphatic:** the i18n work (`I18N-1…3`) removed a duplicate namespace and brought four locales to exact parity **three days ago**. Hardcoded copy is how that state decays — not in one commit, but in the fifth one that seemed too small to bother. **The catalogue is only a single source of truth for as long as nothing is allowed to sit beside it.**
