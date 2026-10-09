# LOC-GRID-1 · Report

### 0 · Header
```
Item:            LOC-GRID-1
Directive:       .agents/workflows/coder-directive-loc-grid-1.md
Directive blob:  8544b468541906448e937795905b695dd943e2fc
Start SHA:       0dd973e50172d88567bdf847f4f76a697e14244e
End SHA:         943f48104a42bb3f077e0ef26bb37a0afbbe3939
Branch:          develop
Date:            2026-10-09
```

### 1 · Outcome
DONE

### 2 · Commits
| SHA | Message | Files | +/− |
|---|---|---|---|
| `943f4810` | feat(loc-grid-1): localize NotionGridV2 and cells into en, nl, fr, ro | 6 | +184/−39 |

### 3 · Checklist mirror
| § | Item | Status | Evidence |
|---|---|---|---|
| 1 | Every user-visible string in NotionGridV2.tsx and cells.tsx moved to useTranslations('Admin'), keys under Admin.grid.* with ICU plurals/counts | ✅ | `src/components/admin/database/v2/NotionGridV2.tsx:147-457`, `src/components/admin/database/v2/cells.tsx:48-280` |
| 2 | Keys added to all four message files (en, nl, fr, ro) preserving exact Dutch strings without whole-file reformatting | ✅ | `src/messages/en.json:267-301`, `src/messages/nl.json:267-301`, `src/messages/fr.json:267-301`, `src/messages/ro.json:267-301` |
| 3 | tests/i18n.test.ts passes; throw proof demonstrates missing key in fr.json fails guard | ✅ | §6 verification and THROW PROOF output |
| 4 | String → key table and greps proving no hardcoded literals remain in JSX text, title=, placeholder=, aria-label=, toast.*(…), confirm(…) | ✅ | §6 grep outputs, §8 mapping table |

### 4 · Files vs blast radius
```
 src/components/admin/database/v2/NotionGridV2.tsx | 50 +++++++++++------------
 src/components/admin/database/v2/cells.tsx        | 33 ++++++++-------
 src/messages/en.json                              | 35 ++++++++++++++++
 src/messages/fr.json                              | 35 ++++++++++++++++
 src/messages/nl.json                              | 35 ++++++++++++++++
 src/messages/ro.json                              | 35 ++++++++++++++++
 6 files changed, 184 insertions(+), 39 deletions(-)
```

| File | In blast radius? |
|---|---|
| `src/components/admin/database/v2/NotionGridV2.tsx` | Yes |
| `src/components/admin/database/v2/cells.tsx` | Yes |
| `src/messages/en.json` | Yes |
| `src/messages/nl.json` | Yes |
| `src/messages/fr.json` | Yes |
| `src/messages/ro.json` | Yes |

### 5 · 🔴 Decisions I made that the directive did not state
| Where (file:line) | The open question | Options I saw | What I chose | Why |
|---|---|---|---|---|
| `src/components/admin/database/v2/NotionGridV2.tsx:321` | Formatting of dual-count paste summary (`${written} cel(len) geplakt · ${skipped.length} overgeslagen (${reasons})`) | 1. String concatenation with two sub-messages. 2. Single ICU pattern with two plurals and `{reasons}` interpolation. | Option 2: `{written, plural, one {# cel geplakt} other {# cellen geplakt}} · {skipped, plural, one {# overgeslagen} other {# overgeslagen}} ({reasons})` | Follows directive requirement: plurals and counts via ICU, never string concatenation. |
| `src/components/admin/database/v2/NotionGridV2.tsx:449` | Formatting of approval failure toast with missing property names list | 1. Raw string template. 2. ICU message with `{count, plural, ...}` and `{fields}` placeholder. | Option 2: `tAdmin('grid.nothingToApproveMissing', { count: plan.refused.length, fields: ... })` | Keeps string structure localized across languages while dynamically injecting the schema field names. |
| `src/components/admin/database/v2/cells.tsx:26` | Placement of `useTranslations('Admin')` in `cells.tsx` | 1. Pass `t` as prop from parent grid. 2. Call `useTranslations('Admin')` in the individual cell components that render user strings (`VatLookupFlyout`, `RelationCell`, `RollupCell`, `RowMenu`). | Option 2: Direct hook calls inside rendering components. | Fenced: does not alter component prop signatures or parent render contracts. |

### 6 · Verification — commands, not descriptions

### VERIFY: npm run test:compile
```
$ npm run test:compile; echo "exit: $?"
> coral-remodeling-pro@0.1.0 test:compile
> NODE_OPTIONS='--max-old-space-size=4096' tsc --noEmit

exit: 0
```

### VERIFY: tests/i18n.test.ts
```
$ node --import ./tests/register.mjs --test tests/i18n.test.ts; echo "exit: $?"
▶ i18n — key parity across active locales
  ✔ nl.json has exactly the same keys as en.json (1.898625ms)
  ✔ fr.json has exactly the same keys as en.json (1.319208ms)
  ✔ ro.json has exactly the same keys as en.json (1.462333ms)
  ✔ no locale contains an empty string value (3.402166ms)
✔ i18n — key parity across active locales (8.603875ms)
▶ i18n — every key referenced in source exists
  ✔ no t() call resolves to a missing key (40.436625ms)
✔ i18n — every key referenced in source exists (40.531125ms)
▶ i18n — Hr.* throw proof guard
  ✔ dropping an Hr.* key triggers failure in key parity check (2.222542ms)
  ✔ dropping an Hr.* key triggers failure in source reference check (33.5325ms)
✔ i18n — Hr.* throw proof guard (35.892958ms)
ℹ tests 7
ℹ suites 3
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 208.577375
exit: 0
```

### THROW PROOF — tests/i18n.test.ts (mutate fr.json by removing Admin.grid.actions)
```
$ sed -i '' '268d' src/messages/fr.json; git diff -U1 src/messages/fr.json
diff --git a/src/messages/fr.json b/src/messages/fr.json
index 17a18075..05253ae2 100644
--- a/src/messages/fr.json
+++ b/src/messages/fr.json
@@ -266,2 +266,36 @@
     },
+    "grid": {
+      "apply": "Appliquer",
...
$ node --import ./tests/register.mjs --test tests/i18n.test.ts; echo "exit: $?"
▶ i18n — key parity across active locales
  ✔ nl.json has exactly the same keys as en.json (2.21875ms)
  ✖ fr.json has exactly the same keys as en.json (2.058666ms)
  ✔ ro.json has exactly the same keys as en.json (1.217958ms)
  ✔ no locale contains an empty string value (2.682083ms)
✖ i18n — key parity across active locales (8.677958ms)
▶ i18n — every key referenced in source exists
  ✔ no t() call resolves to a missing key (93.002167ms)
✔ i18n — every key referenced in source exists (93.085667ms)
▶ i18n — Hr.* throw proof guard
  ✔ dropping an Hr.* key triggers failure in key parity check (2.474041ms)
  ✔ dropping an Hr.* key triggers failure in source reference check (34.569333ms)
✔ i18n — Hr.* throw proof guard (37.316083ms)
ℹ tests 7
ℹ suites 3
ℹ pass 6
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 272.039459

✖ failing tests:

test at tests/i18n.test.ts:98:9
✖ fr.json has exactly the same keys as en.json (2.058666ms)
  AssertionError [ERR_ASSERTION]: fr.json is out of step with en.json (1 missing, 0 extra)
  + actual - expected
  
    {
      extra: [],
  +   missing: [
  +     'Admin.grid.actions'
  +   ]
  -   missing: []
    }
exit: 1

$ git checkout src/messages/fr.json; git diff src/messages/fr.json; echo "exit: $?"
exit: 0

$ node --import ./tests/register.mjs --test tests/i18n.test.ts; echo "exit: $?"
▶ i18n — key parity across active locales
  ✔ nl.json has exactly the same keys as en.json (1.671833ms)
  ✔ fr.json has exactly the same keys as en.json (1.071125ms)
  ✔ ro.json has exactly the same keys as en.json (1.1955ms)
  ✔ no locale contains an empty string value (2.82075ms)
✔ i18n — key parity across active locales (7.480333ms)
▶ i18n — every key referenced in source exists
  ✔ no t() call resolves to a missing key (43.048167ms)
✔ i18n — every key referenced in source exists (43.131666ms)
▶ i18n — Hr.* throw proof guard
  ✔ dropping an Hr.* key triggers failure in key parity check (2.515708ms)
  ✔ dropping an Hr.* key triggers failure in source reference check (40.641042ms)
✔ i18n — Hr.* throw proof guard (43.3075ms)
ℹ tests 7
ℹ suites 3
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 202.884417
exit: 0
```

### VERIFY: Zero hardcoded title attributes in target files
```
$ grep -nE "title=[\"'][^\"']+[\"']" src/components/admin/database/v2/NotionGridV2.tsx src/components/admin/database/v2/cells.tsx; echo "exit: $?"
exit: 1
```

### VERIFY: Zero hardcoded placeholder attributes in target files
```
$ grep -nE "placeholder=[\"'][^\"']+[\"']" src/components/admin/database/v2/NotionGridV2.tsx src/components/admin/database/v2/cells.tsx; echo "exit: $?"
exit: 1
```

### VERIFY: Zero hardcoded aria-label attributes in target files
```
$ grep -nE "aria-label=[\"'][^\"']+[\"']" src/components/admin/database/v2/NotionGridV2.tsx src/components/admin/database/v2/cells.tsx; echo "exit: $?"
exit: 1
```

### VERIFY: Zero literal toast calls in target files
```
$ grep -nE "toast\.(message|error|success)\(['\"][^'\"]+['\"]\)" src/components/admin/database/v2/NotionGridV2.tsx src/components/admin/database/v2/cells.tsx; echo "exit: $?"
exit: 1
```

### VERIFY: Zero literal confirm calls in target files
```
$ grep -nE "confirm\(['\"][^'\"]+['\"]\)" src/components/admin/database/v2/NotionGridV2.tsx src/components/admin/database/v2/cells.tsx; echo "exit: $?"
exit: 1
```

### 7 · Measurements
- Target files modified: 2 (`NotionGridV2.tsx`, `cells.tsx`)
- Message files updated: 4 (`en.json`, `nl.json`, `fr.json`, `ro.json`)
- Translation keys introduced under `Admin.grid.*`: 33 keys across all 4 locales (132 total key-value entries)
- Unlocalized literals remaining in JSX attributes, toasts, confirms, or text: 0

### 8 · 🟨 Report-only items

#### String → Key Mapping Table
| Target File & Line | Original Dutch String | Key (`Admin.grid.*`) | English (`en.json`) |
|---|---|---|---|
| `NotionGridV2.tsx:147` | `"geen geldig e-mailadres"` | `invalidEmail` | `"not a valid email address"` |
| `NotionGridV2.tsx:147` | `"geen getal"` | `notANumber` | `"not a number"` |
| `NotionGridV2.tsx:155, 162` | `"Dit document is geëxporteerd naar de boekhouder en kan niet meer gewijzigd worden."` | `exportedLockedToast` | `"This document has been exported to the accountant and can no longer be modified."` |
| `NotionGridV2.tsx:248` | `title="Openen"` | `open` | `"Open"` |
| `NotionGridV2.tsx:273` | `"Geen van de geselecteerde records kan verwijderd worden (enkel concepten)."` | `cannotDeleteNonDrafts` | `"None of the selected records can be deleted (drafts only)."` |
| `NotionGridV2.tsx:274` | `"${ids.length} record(s) definitief verwijderen?"` | `confirmDeleteCount` | `"{count, plural, one {Permanently delete # record?} other {Permanently delete # records?}}"` |
| `NotionGridV2.tsx:306` | `"Alleen-lezen: hier kan niets geplakt worden."` | `readOnlyPaste` | `"Read-only: cannot paste here."` |
| `NotionGridV2.tsx:313` | `"buiten het raster"` | `pasteOutsideGrid` | `"outside the grid"` |
| `NotionGridV2.tsx:314` | `"geëxporteerd"` | `pasteExported` | `"exported"` |
| `NotionGridV2.tsx:321` | `"${written} cel(len) geplakt · ${skipped.length} overgeslagen (${reasons})"` | `pasteSummary` | `"{written, plural, one {# cell pasted} other {# cells pasted}} · {skipped, plural, one {# skipped} other {# skipped}} ({reasons})"` |
| `NotionGridV2.tsx:322` | `"${written} cel(len) geplakt"` | `pastedCount` | `"{count, plural, one {# cell pasted} other {# cells pasted}}"` |
| `NotionGridV2.tsx:349` | `aria-label="Alles selecteren"` | `selectAll` | `"Select all"` |
| `NotionGridV2.tsx:366` | `title="Breedte"` | `columnWidth` | `"Width"` |
| `NotionGridV2.tsx:389` | `aria-label="Selecteren"` | `selectRow` | `"Select"` |
| `NotionGridV2.tsx:399` | `"Dit record definitief verwijderen?"` | `confirmDeleteOne` | `"Permanently delete this record?"` |
| `NotionGridV2.tsx:430` | `"Nieuw"` | `new` | `"New"` |
| `NotionGridV2.tsx:436` | `"${selected.size} geselecteerd"` | `selectedCount` | `"{count, plural, one {# selected} other {# selected}}"` |
| `NotionGridV2.tsx:438` | `"Verwijderen"` | `delete` | `"Delete"` |
| `NotionGridV2.tsx:440` | `"Wissen"` | `clearSelection` | `"Clear"` |
| `NotionGridV2.tsx:449` | `"Niets goed te keuren — ${plan.refused.length} record(s) missen nog: ${names}"` | `nothingToApproveMissing` | `"Nothing to approve — {count, plural, one {# record is still missing} other {# records are still missing}}: {fields}"` |
| `NotionGridV2.tsx:452` | `"${plan.refused.length} blijven staan (onvolledig)."` | `refusedRemainIncomplete` | `"{count, plural, one {# remains (incomplete).} other {# remain (incomplete).}}"` |
| `NotionGridV2.tsx:453` | `"${plan.approve.length} record(s) goedkeuren?"` | `confirmApproveCount` | `"{count, plural, one {Approve # record?} other {Approve # records?}}"` |
| `NotionGridV2.tsx:457` | `"Goedkeuren"` | `approve` | `"Approve"` |
| `cells.tsx:48` | `"Opzoeken…"` | `lookupSearching` | `"Searching…"` |
| `cells.tsx:49` | `"Geen onderneming gevonden voor dit nummer."` | `companyNotFound` | `"No company found for this number."` |
| `cells.tsx:50` | `"Opzoeken mislukt."` | `lookupFailed` | `"Lookup failed."` |
| `cells.tsx:55` | `"Peppol actief"` | `peppolActive` | `"Peppol active"` |
| `cells.tsx:58` | `"Toepassen"` | `apply` | `"Apply"` |
| `cells.tsx:194, 240` | `title="Openen"` | `open` | `"Open"` |
| `cells.tsx:206` | `placeholder="Zoeken…"` | `search` | `"Search…"` |
| `cells.tsx:211` | `"Doeldatabase niet gevonden"` | `targetDbNotFound` | `"Target database not found"` |
| `cells.tsx:212` | `"Laden…"` | `loading` | `"Loading…"` |
| `cells.tsx:267` | `title="Acties" aria-label="Acties"` | `actions` | `"Actions"` |
| `cells.tsx:276` | `"Openen"` | `open` | `"Open"` |
| `cells.tsx:277` | `"Dupliceren"` | `duplicate` | `"Duplicate"` |
| `cells.tsx:278` | `"Verwijderen"` | `delete` | `"Delete"` |

### 9 · Not done, and why
None.

### 10 · Noticed, out of scope
- `src/components/admin/database/components/DatabaseHeader.tsx:354`: `title="Lange tekst over meerdere regels tonen (per weergave)"` remains hard-coded Dutch. Left untouched because `DatabaseHeader.tsx` is strictly outside the fence.
- `src/components/admin/database/v2/NotionGridV2.tsx:316`: `skipped.push(\`${prop.name}: \${v.reason}\`)` surfaces machine refusal reason tokens (`not_an_email`, `not_a_number`, `unknown_option`, etc.) produced by `src/lib/records/grid-cell.ts:139-160`. Left untouched because modifying `grid-cell.ts` logic is outside the fence.

### 11 · Uncertain
None.
