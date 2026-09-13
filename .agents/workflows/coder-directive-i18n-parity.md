# CORAL — CODER DIRECTIVE — `I18N-1…3` · dedupe first, then translate — Planner 2026-09-13

**Task as received:** *"Ensure parity across all active locales so Romanian (`ro.json`) is in lockstep with `en.json`, `nl.json`, and `fr.json` rather than lagging behind."*

**The goal is right. The order matters, and doing it as stated would bake a defect into four files.** Promotion gate `G-3`.

---

## 📊 MEASURED, NOT ASSUMED (Planner, 2026-09-13)

```
en 835 keys · nl 835 · fr 835 · ro 731
nl missing 0, extra 0   ✅
fr missing 0, extra 0   ✅
ro missing 104, extra 0
```

**All 104 missing Romanian keys are in ONE namespace**, and it is the namespace that is broken:

| | |
|---|---|
| `Hr.timesheets` (top level) | **65 keys** |
| `Tasks.Hr.timesheets` (nested under `Tasks`) | **39 keys** |
| Identical? | **No.** Partially overlapping, neither is a subset. |
| What the code reads | **`Hr.timesheets` only** — `useTranslations('Hr.timesheets')` in `page.tsx:41`, `TimesheetFilterBar.tsx:13`, `DateRangePicker.tsx:24`, `TimesheetEntryDetail.tsx:17` |
| What reads `Tasks.Hr.*` | **Nothing. Zero call sites.** |

**`Tasks.Hr.timesheets` is a dead sideways copy of a live namespace** — defect shape #1, in the locale files. It exists in `en`, `nl` and `fr`, which is why they show as "in lockstep": **they are in lockstep about a duplicate.**

### 🔴 Why the order is not negotiable
`104 = 65 + 39`. Translating to parity as stated means **writing 39 Romanian strings for keys no code will ever read**, and promoting the duplicate from three files to four. The next person to add a timesheet label then has two plausible places to put it, and a 50% chance of picking the one that does not render.

**Dedupe first and the real Romanian work is 65 keys, not 104.**

---

## `I18N-1` · REMOVE THE DUPLICATE NAMESPACE 🟥 — *do this first*

- [ ] **Verify the claim before acting on it.** `grep -rn "useTranslations('Tasks.Hr\|Tasks\.Hr\." src` → **expected: zero call sites.** 🛑 **If any call site exists, STOP and report** — the namespace is live and this directive is wrong.
- [ ] For each of the 39 keys in `Tasks.Hr.timesheets`, decide **one** outcome:
  - key **also exists** in top-level `Hr.timesheets` → **delete the `Tasks.Hr` copy.**
  - key exists **only** in `Tasks.Hr.timesheets` → **move it to `Hr.timesheets`**, then delete. *(15 keys are in this group: `allMembers`, `approved`, `customDateRange`, `denied`, `exportCsv`, `exportPdf`, `exportXlsx`, `markedForCheck`, `member`, `noDescription`, `notAttributed`, `pending`, `stillClockedIn`, `system`, `timeOptions`.)*
  - **Where both copies exist and the TEXT DIFFERS, do not guess.** List them and **ask Florin** which wording is current. A silently-chosen label is a wrong label in front of a client.
- [ ] **Delete the `Tasks.Hr` block entirely** from `en.json`, `nl.json`, `fr.json`. `ro.json` never had it — **do not add it.**
- [ ] **Grep gate:** `grep -rn '"Hr"' src/messages/` → `Hr` appears **only at top level**, never nested.

## `I18N-2` · THE 48 KEYS REFERENCED BUT MISSING EVERYWHERE 🟥

The suite's actual failure: **48 keys called by `t()` that exist in no locale file** — they render as raw variable names on screen.

- [ ] Add them to **`en`, `nl`, `fr`** with real translations, and to `ro` under `I18N-3`.
- [ ] ⚠️ **`Admin.db.col.` is NOT a missing translation — it is a bug.** The trailing dot is an **empty suffix being concatenated** in `ColumnHeader.tsx` and `PropertiesDropdown.tsx`. **Fix the call site.** 🛑 **Adding a key literally named `Admin.db.col.` is prohibited** — it silences the test and leaves the defect.
- [ ] Note `Hr.timesheets.unknownWorker`, `unassignedProject` and `editingApprovedOn` are missing from **both** namespaces — they are genuinely new keys, not casualties of the split.

## `I18N-3` · ROMANIAN TO LOCKSTEP 🟧 — *after `I18N-1` and `I18N-2`*

- [ ] Translate the remaining `Hr.timesheets` gap (**65 keys, not 104**) plus the `I18N-2` additions into `ro.json`.
- [ ] **Real Romanian.** 🛑 **English text in `ro.json` is prohibited** — it passes the key-parity test while leaving the screen untranslated, which is worse than an honest gap because the gap is then invisible.
- [ ] **Enforce it:** add `'ro'` to `ACTIVE_LOCALES` in `tests/i18n.test.ts` and **delete the "known laggard" carve-out** (`:150-156`). A tracked exception that is no longer needed is a future excuse.
- [ ] Same for `nl` and `fr` on the new keys — **parity is four locales or it is not parity.**

---

## PROHIBITIONS
- 🛑 **Do not weaken the test to make it green.** No allowlist, no `skip`, no narrowing the source scan, no removing assertions. **The only permitted change to `tests/i18n.test.ts` is ADDING `'ro'` to `ACTIVE_LOCALES` and removing the carve-out it replaces.**
- 🛑 **No English strings in `nl.json`, `fr.json` or `ro.json`.**
- 🛑 **No key named `Admin.db.col.`** — fix the concatenation.
- 🛑 **Do not add `Tasks.Hr` to `ro.json`.**
- 🛑 **Do not resolve a conflicting wording by picking one.** Ask.
- No changes outside `src/messages/*.json`, `tests/i18n.test.ts`, and the two call sites named in `I18N-2`.

## GATES
- `node --experimental-strip-types --import ./tests/register.mjs --test 'tests/*.test.ts'` → **116/116**, zero failures.
- `npm run test:compile` clean.
- Key counts: **`en == nl == fr == ro`**, and **all four below 835** — the count must *drop*, because 39 dead keys were removed. **A result of 835 across four files means the duplicate was translated instead of deleted.**
- `grep -rn "Tasks\.Hr" src` → **zero.**

**This is the last gate before `release/2026-09` is cut. A suite with a permanent red has no signal — the point is not 48 labels, it is that the 117th failure must be visible.**
