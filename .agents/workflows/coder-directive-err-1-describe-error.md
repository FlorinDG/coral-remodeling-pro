# CORAL — CODER DIRECTIVE — `ERR-1` · one definition of "what went wrong" — Planner 2026-09-30

```
BLAST RADIUS — only these files may change in this pass:
  src/lib/describe-error.ts                      (NEW)
  tests/describe-error.test.ts                   (NEW)
  + the files listed in §3, and ONLY at the lines that match §3's pattern
  .agents/reports/ERR-1.md                       (NEW — per coder-report-protocol.md)
Anything else: STOP AND REPORT. Do not change it, even if it is wrong.
A better idea is a report, not a commit.
No branch move, no checkout, no promotion, no deploy, no migration, no schema change.
```

🔴 **HARD FENCE — another writer is working in this repo at the same time.** These files are **NOT yours in this pass, even if §3's grep lists them later**:
```
src/app/api/hr/[entity]/route.ts          src/components/time-tracker/hooks/useScheduledShifts.ts
src/components/time-tracker/hooks/useClockEntries.ts   src/components/time-tracker/hooks/useTimer.ts
src/components/time-tracker/components/ClockButton.tsx src/components/time-tracker/components/MySchedule.tsx
src/components/time-tracker/i18n/**       src/app/[locale]/admin/hr/timesheets/ManualEntryModal.tsx
src/app/api/hr/timesheet-export/**        src/app/api/hr/timesheet-reports/**    src/lib/data/shift-brief.ts
eslint.config.mjs                         .agents/**   (except .agents/reports/ERR-1.md)
```
🛑 **Never `git checkout`, `git switch`, `git stash`, `git reset`, or `git add -A` / `git add .`.** Stage files **by explicit path only.** Commit on `develop` as it stands.

---

# 0 · WHY — `pd.md` ERROR-SURFACING DIRECTIVE, applied to the definition, not the instance

The rule: **no user-facing error may resolve to a constant string.** The compliant chain is already written **by hand, four times**:
```ts
send-invoice.ts:150              err?.message || err?.cause?.message || err?.name || String(err)
send-quote.ts:140                (same)
ProjectDetailView.tsx:570        (same)
ClientInvoiceEngine.tsx:911,1930 (same)
```
And the non-compliant form — **`err.message || 'Some constant'`** — appears at **~45 sites in ~33 files** (measured 2026-09-30).
🔴 **One concept, written ~50 times.** The fix is **one function**, and every site calls it. *(`pd.md` 4w Q1/Q2.)*

---

# 1 · THE HELPER — exactly this contract

```ts
// src/lib/describe-error.ts  — pure. No imports. Safe on server AND client.
export function describeError(err: unknown): string
```
Returns **`"<Name>: <message>"`**, resolved as:
1. **name** = `err.name` if a non-empty string, else `"Error"`.
2. **message** = first non-empty string of: `err.message` → `err.cause?.message` → `String(err.cause)` if cause exists and is not an object → **`String(err)`** if that is not `"[object Object]"` → `JSON.stringify(err)` (guarded by try/catch) → `"(no detail)"`.
3. If `err` is a **string**: return it unchanged. If `null`/`undefined`: return `"Error: (no detail)"`.
4. 🛑 **Never throws.** Every property access is guarded (`err` may be a Proxy, a frozen object, or have a throwing getter — wrap the whole body in try/catch returning `"Error: (undescribable)"`).
5. 🛑 **No i18n, no truncation, no logging inside it.** It describes; callers decide.

**Rejected alternatives — do not implement:** returning an object `{name, message}` *(every caller would re-join it differently — the defect again)*; a `toast` wrapper *(mixes description with display)*; putting it in `src/lib/kernel/` *(it is not identity; the kernel stays small)*.

---

# 2 · THE TEST — `tests/describe-error.test.ts`
Same style as `tests/duration.test.ts` (`node:test`, `node:assert/strict`, import with the `.ts` extension). Cases, at minimum:
- `new TypeError('x')` → `"TypeError: x"`
- `new Error('')` with `cause: new Error('root')` → `"Error: root"`
- `{ message: 'm' }` (plain object) → `"Error: m"`
- `{ code: 'P2022' }` → `"Error: {\"code\":\"P2022\"}"`
- `'plain string'` → `'plain string'`
- `null`, `undefined` → `"Error: (no detail)"`
- an object whose `message` getter throws → does **not** throw
- a circular object → does **not** throw

---

# 3 · THE CONVERSION — candidates, NOT findings

```bash
grep -rnE "\.message \|\| ['\"\`]" src
```
🔴 **This grep over-matches. It is a candidate list.** Convert a site **only if the left operand is a caught error** — the variable of a `catch (x)`, a `.catch(x => …)` argument, or a `useQuery`/`useMutation` `error`. 

**Known NON-errors — leave untouched:**
```
src/components/admin/LeadList.tsx:208                 lead.message   (a lead's text)
src/lib/email.ts:37                                   lead.message   (a lead's text)
src/components/admin/invoices/ClientInvoiceEngine.tsx:398,400   res.message (an API response field)
src/lib/storage/index.ts:182                          classification, not display
```
Any other site where you cannot tell → **🟨 list it in the report, do not convert.**

**The conversion — keep the human context, add the identity:**
```ts
// before
toast.error(e.message || 'Failed to activate Peppol', { id: 'peppol-activate' });
// after
console.error('[company-info] Peppol activation failed', e);
toast.error(`Failed to activate Peppol — ${describeError(e)}`, { id: 'peppol-activate' });
```
- [ ] **The existing constant stays, as the PREFIX.** 🛑 **Do not translate it, reword it, or move it into `t()` in this pass** — hardcoded strings are a real defect but a separate one. **Report** each hardcoded one you touch (file:line) as `ERR-1-i18n`.
- [ ] **`console.error` the raw error** at the site **if the site does not already log it.** One line, a `[file-tag]` prefix.
- [ ] **Server routes returning JSON** (`NextResponse.json({ error: … })`): same — `error: \`<existing constant> — ${describeError(e)}\``. 🛑 **Do not change status codes or response shape.**
- [ ] **Error-boundary pages** (`error.tsx`, `admin/error.tsx`, `global-error.tsx`, `ErrorBoundary.tsx`): render `describeError(error)` in place of the `name || … : message || …` pair. 🛑 Change nothing else in those files.
- [ ] **The four hand-written compliant chains in §0** → `describeError(...)`. 🟢 These are the definition moving into one place.

## 3b · 🟨 REPORT ONLY — do not change
```bash
grep -rnE "\.catch\(console\.error\)" src          # 6 sites
grep -rnE "\.catch\(\(\) => (\[\]|null|\{\})\)" src  # 12 sites
```
For each: **file:line, and whether its result reaches something a user sees.** 🛑 **Change none of them.** Whether each is a user-visible path is a judgement the Planner makes.

---

# 4 · COMMITS
- **Commit 1:** `feat(err-1): describeError helper + tests` — the two new files only.
- **Commits 2…n:** `refactor(err-1): <area> — N sites` — **at most ~8 files per commit**, grouped by directory (`app/actions`, `app/api`, `components/admin`, `components/time-tracker`, pages). Message carries the count.
- 🛑 **Every commit passes `test:compile`, `test:lint` and the suite on its own.**

---

# 5 · VERIFY — must be able to catch divergence
1. `node --import ./tests/register.mjs --test tests/describe-error.test.ts` → all green.
2. `grep -rnE "\.message \|\| ['\"\`]" src` → **only** the §3 known non-errors and any 🟨-reported sites remain. **Report the before/after counts.**
3. `grep -rn "cause?.message" src` → **only `src/lib/describe-error.ts`.**
4. `git diff --stat <start>..HEAD` → no file from the §0 HARD FENCE, no `eslint.config.mjs`, no `.agents/**`.
5. `grep -rn "describeError" src | wc -l` ≥ the number of converted sites. **Report both numbers.**
6. `git diff <start>..HEAD -- src | grep -E "^\+.*status:" ` → **empty** (no status code changed).
7. `npm run test:compile` · `npm run test:lint` · `node --import ./tests/register.mjs --test 'tests/*.test.ts'` — exit 0.

## PROHIBITIONS
- 🛑 **No ESLint rule in this pass.** *(The ratchet is `ERR-1b`; `eslint.config.mjs` already has two `no-restricted-syntax` blocks and a third can silently override them — that is a Planner decision.)*
- 🛑 **No i18n changes. No behaviour change beyond the message text and an added `console.error`.**
- 🛑 **Do not touch any file in the HARD FENCE**, even if the grep lists it.
- 🛑 **Do not "improve" surrounding error handling** — retries, fallbacks, status codes, response shapes. A better idea is a report.

## REPORT — `.agents/reports/ERR-1.md`, per `coder-report-protocol.md`, committed last
Item-specific content for its sections: **§7** before/after grep counts and the `describeError` call count · **§8** the §3b table and every 🟨 site with a reason · **§10** every `ERR-1-i18n` site · **§2** the site count per commit.
