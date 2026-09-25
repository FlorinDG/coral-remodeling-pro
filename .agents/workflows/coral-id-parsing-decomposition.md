# CORAL — DECOMPOSITION — THE ID-PARSING PATTERN — Planner 2026-09-25

Governed by `coral-kernel-system-databases.md`. **Pass 1 and 2 are landed and verified.** This is the spec base for everything that remains.

---

# 🔴 PLANNER CORRECTION FIRST — pass 1's headline claim was not verified

Pass 1's directive said *"exactly one array may list the roles"*, and I reported it satisfied. **I grepped for the three names in my own directive** — `LOCKED_DB_BASES`, `DB_NAMES`, `BASE_TO_KEY` — **and never searched for the concept.** There are five.

| # | List | Entries | Answers | File |
|---|---|---|---|---|
| 1 | `SYSTEM_DATABASE_ROLES` | **16** | what are they | `lib/kernel/system-databases.ts` ✅ |
| 2 | `BASE_TO_KEY` | **16** | what were they called | `lib/lockedDbUtils.ts` |
| 3 | `SYSTEM_DB_PREFIXES` | **14** | is this one of ours | `lib/systemDatabases.ts` 🔴 missed |
| 4 | `SERVER_PROVISIONED_BASES` | **8** | who creates it | `lib/systemDatabases.ts` 🔴 missed |
| 5 | `DB_ID_MODULE_MAP` | **6** | **which module gates it** | `app/actions/pages.ts` 🔴 missed |

**Five lists. Five lengths. 16 · 16 · 14 · 8 · 6.**

## 🟢 AND THAT REFRAMES THE FIX
**Five lists is not five bugs. It is one missing table.** Each answers a *different question about the same sixteen things*: what they are, what they used to be called, who provisions them, what gates them.

> **That is a table with columns, not five arrays.**

## 🔴 The 14-vs-16 gap is live today
`SYSTEM_DB_PREFIXES` omits **`journal-general`** and **`hr`**. So `isSystemDatabase('db-hr')` → **false**, and:
- `createPageServerFirst` **does not resolve them through the book** — a page created in HR or the journal writes whatever id it was handed
- `requiredModuleForDb` does not gate them
**Two of the sixteen are not system databases as far as the code is concerned.**

---

# THE CENSUS — 74 parse sites across 28 files

| Pattern | Sites |
|---|---|
| `startsWith('db-…')` | **41** |
| `isSystemDatabase` | **15** |
| `getBaseDbId` | **9** |
| `split('-')` | **9** |

### Concentration — this is what makes it tractable
```
10  admin/database/[databaseId]/[pageId]/page.tsx     4  DatabaseClone.tsx
 6  components/database/PageModal.tsx                 3  RecordDetailPage · NotionGrid · api/scan
 6  app/actions/pages.ts                              2  ×7 files
 5  lib/databaseRoute.ts · api/admin/schema-cleanup    1  ×13 files
 4  hooks/useGridColumns.tsx
```
**Six files carry 36 of 74.** The long tail is 13 files with one each.

## 🛑 TWO OF THESE ARE NOT COSMETIC
- **`requiredModuleForDb` (`pages.ts:26`) decides MODULE ENTITLEMENT by prefix-matching an id.** Entitlement is a permission decision made by string comparison. *(AUTHORITY DIRECTIVE: authority is asked for, never asserted — and never inferred from a substring.)*
- **`createPageServerFirst` calls `getLockedDbId` on the WRITE path** (`pages.ts:75`). The resolver is not read-only convenience; **it decides where rows land.**

---

# PASS 3a · ONE TABLE, FIVE DERIVATIONS

```ts
// src/lib/kernel/system-databases.ts
export interface SystemDatabaseSpec {
    role:        SystemDatabaseRole;
    legacyBase:  string;        // 'db-1', 'db-clients' — ONLY for reading old data
    displayName: string;
    module:      string | null; // entitlement gate, or null
}
export const SYSTEM_DATABASES: Readonly<Record<SystemDatabaseRole, SystemDatabaseSpec>>;
```
- [ ] **All five lists derive from this.** `BASE_TO_KEY`, `SYSTEM_DB_PREFIXES`, `SERVER_PROVISIONED_BASES` and `DB_ID_MODULE_MAP` become **computed exports**, not maintained arrays.
- [ ] 🔴 **`SYSTEM_DB_PREFIXES` gains `journal-general` and `hr`** — 14 → 16. *That is a live fix, not a tidy-up.*
- [ ] 🔴 **`SERVER_PROVISIONED_BASES` becomes all 16** — pass 1 already provisions all 16, so this Set is stale and currently disagrees with reality.
- [ ] **`module: null` is explicit for every ungated role.** No role may be absent from the map *(fail-closed: an unlisted role must not silently mean "ungated")*.
- [ ] 🛑 **`legacyBase` is documented as a DATA-COMPATIBILITY field, not identity.** It exists to read values written before the binding existed. **Nothing may construct an id from it.**

### Test — the `TSC-9` pattern, one layer down
- [ ] **Every role has a spec; every spec field is non-undefined.**
- [ ] **No duplicate `legacyBase`.**
- [ ] **Assert the census: 16 / 16 / 16 / 16.** 🟢 **The four derived lists must now be the same length.** A drift fails the suite.
- [ ] **Assert `module` is present (possibly `null`) for all 16.**

---

# PASS 3b · THE PARSE RATCHET — the metric that maintains itself

**`PRE-1d` made the prisma-import count a build artefact. Do the same here.**

- [ ] **ESLint `no-restricted-syntax`, `error`**, forbidding on any database-id expression:
  `.startsWith('db-…')` · `.split('-')` · `getBaseDbId` · direct `isSystemDatabase` outside the kernel
- [ ] **Grandfather the 28 files by name**, header comment:
  > *"These parse database ids. The binding is the truth; an id is never parsed. Do not add to this list. **Its length is the id-parsing metric.**"*
- [ ] **Report the exact allowlist length.** 🟢 **28 today, and it only falls.**
- [ ] 🔴 **Prove it fires** — a new file parsing an id fails the build. Paste the message. *(`PRE-1c`.)*

## Conversion order — by concentration, not by module
```
3b-1  lib/databaseRoute.ts  ·  lib/systemDatabases.ts        the primitives others call
3b-2  app/actions/pages.ts                                   🛑 ENTITLEMENT + WRITE PATH
3b-3  admin/database/[databaseId]/[pageId]/page.tsx (10)     routing
3b-4  PageModal · useGridColumns · DatabaseClone · NotionGrid · RecordDetailPage
3b-5  the 13-file tail, one commit
```
- [ ] 🛑 **`3b-2` is the one to slow down on.** Converting entitlement from prefix-match to a declared `module` field changes a permission decision. **Every gated database must be exercised before and after** — an over-gate locks Florin out of his own module; an under-gate hands a free tier something it did not buy.

---

# PASS 3c · DELETE THE RESOLVER
**Only when 3b's allowlist reaches zero.**
- [ ] **`getLockedDbId` deleted** — all four branches, including `return base // Legacy FOUNDER fallback`.
- [ ] **`relations/resolve.ts` loses its two prefix searches** (`:103`, `:107`).
- [ ] **`lockedDbUtils.ts` deleted**; `BASE_TO_KEY` survives only as `SYSTEM_DATABASES[*].legacyBase`.
- [ ] **Server:** `systemDatabaseId(tenantId, role)` — one door, throws if unbound. Becomes `scope.systemDatabase(role)` when `R1-4` lands.
- [ ] **Client:** `resolveDbId(role)` is a **plain map lookup returning `null`** on miss. No string work. *(Server resolves, client reads.)*

---

# 🔴 THE DEPENDENCY I MISSED — this IS `R1-1b`

`relations/resolve.ts:94` asks `BASE_TO_KEY[storedValue]` — *"is this stored relation target a base id rather than a real database id?"* **Relation targets in live data may hold `db-clients` instead of an id.** That is exactly what `R1-1b`'s `logicalKey` was specced to fix *(`coral-r1-census-findings.md:73` — 8 bare-id databases, 9,226 pages)*.

**`R1-1b` and pass 3 are the same problem seen from two ends.** Pass 3c cannot delete the legacy alias while stored data still needs it to be read.

## 🛑 MEASURE BEFORE SEQUENCING — Florin, production, read-only
```sql
-- which relation properties point at a legacy base id rather than a real database id?
SELECT d.id AS database_id, d.name, p->>'id' AS prop_id, p->>'name' AS prop_name,
       p->>'targetDatabaseId' AS target
FROM "GlobalDatabase" d,
     LATERAL jsonb_array_elements(CASE jsonb_typeof(d.properties)
                                  WHEN 'array' THEN d.properties ELSE '[]'::jsonb END) AS p
WHERE p->>'type' = 'relation'
  AND p->>'targetDatabaseId' IS NOT NULL
ORDER BY 1, 3;
```
**Any `target` that is not an existing `GlobalDatabase.id` is a stored legacy alias.** Count decides whether `logicalKey` is a backfill or a no-op.

---

# ORDER
```
3a one table            →  3b ratchet + convert (5 batches)  →  3c delete resolver
        ↓                            ↓
  fixes hr/journal-general     3b-2 is the careful one
        ↓
  R1-1b measurement (above) gates 3c only
```

## STILL FLORIN'S
- [ ] Load `/admin` as each tenant *(pass 2 self-heal)*
- [ ] The relation-target query above
- [ ] `db-projects-hr` — retire or keep
- [ ] `hr` → `db-hr` resolves to nothing: create it or drop the binding

## 🟢 WHY THIS IS WORTH THE SIZE
**Seventy-four parse sites exist because the kernel never answered "what are my system databases" in one place.** Five lists grew because five questions needed answering and there was nothing to ask.

**Pass 3a is one table. Everything after it is deletion.**
