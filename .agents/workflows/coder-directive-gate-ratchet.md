# CORAL — CODER DIRECTIVE — `PRE-1d` · the gate ratchet — Planner 2026-09-21

**Run 5 is accepted — 14 of 15 items verified against the repo.** `PRE-1` is the exception, and it is the item the whole run was ordered around.

---

## WHAT IS ALREADY RIGHT — do not touch
```js
✅ error — only src/lib/storage/** imports @vercel/blob        (BLOB-3, finally enforced)
✅ error — L0 modules may not import from components/app       (PRE-1)
✅ non-boundary rules downgraded to warnings                   (correct: visibility now, cleanup in LOC-2/3)
✅ src/components/time-tracker/** removed from globalIgnores   (PRE-1b)
```

## 🔴 THE GAP — two rules are commented out
```js
// ❌ cron must not import prisma            "to be switched on when R5 lands"
// ❌ nothing outside lib/data touches prisma "to be switched on when R1-4 lands"
```
**A commented-out rule is not a rule — it is a note.** It enforces nothing, fails nothing, and depends on someone remembering to uncomment it months from now.

*(The Planner's wording — "ready ahead of R5" — invited this reading. **The instruction was loose; the work was reasonable.** This directive replaces it.)*

---

# `PRE-1d` · TURN THEM ON AS **RATCHETS**, NOT DEFERRALS

**The pattern: enable the rule as an `error` now, and name the current violations as explicit exceptions.** Existing code is grandfathered by name; **new code cannot join it.**

**Why this beats deferral:** the risk is not the 121 files that already import prisma — **it is the 122nd.** A deferred rule permits it silently. A ratchet fails it on the first commit.

## `PRE-1d.1` · Cron — 2 violations, enable now
```
src/app/api/cron/invoice-overdue/route.ts
src/app/api/cron/reminders/route.ts
```
- [ ] Enable the `R5-3` rule as **`error`** for `src/app/api/cron/**`.
- [ ] **Name those two files as exceptions** — an `ignores` entry listing them explicitly, with a comment saying they are grandfathered and `R5` removes them.
- [ ] 🔴 **Any NEW cron route that imports prisma fails the build.** That is the entire point: `R5` is months away and cron routes get added in the meantime.

## `PRE-1d.2` · The seraph pre-gate — allowlist the 121, block the 122nd
- [ ] Enable the `R1-5` rule as **`error`** for `src/**`, ignoring `src/lib/data/**` and `src/lib/prisma.ts`.
- [ ] 🔴 **Generate the exception list from the current state** — the files that import `@/lib/prisma` today — and paste it into the config as a named `ignores` array with a header comment:
  > *"GRANDFATHERED — these files import prisma directly and predate the seraph. `R1-7` removes them one module at a time. **Do not add to this list.** The length of this array is the DI progress metric (`coral-decision-dependency-injection.md`)."*
- [ ] **Report the exact length of that array.** It should equal today's count.
- [ ] 🟢 **This replaces the manual grep.** From now on the metric is maintained by the build, not by memory — **which is what "the gate makes displacement automatic" was supposed to mean.**

## `PRE-1d.3` · Prove both — `PRE-1c`, still outstanding
- [ ] **Add a deliberate violation of each of the four rules, one at a time.** Watch the build fail. Remove it.
- [ ] **Paste the four failure messages into the report.** 🛑 **An untested gate is not a gate** — and two of these have never fired.

---

## VERIFY
1. `grep -c "^\s*//" eslint.config.mjs` — **no commented-out rule blocks remain.** All four are live.
2. A new file under `src/app/api/cron/` importing prisma → **build fails.**
3. A new file anywhere importing `@/lib/prisma` → **build fails.**
4. The two grandfathered cron routes and the existing prisma importers → **still pass.**
5. `npm run validate` clean · full suite green.
6. **Report:** the grandfathered array length · the four failure messages · the prisma-import count.

## PROHIBITIONS
- 🛑 **No commented-out rules.** If a rule cannot be on, it does not go in the file — it goes in the roadmap.
- 🛑 **No widening an exception to make something pass.** A new violation is a stop-and-ask, never an added line in the allowlist.
- 🛑 **No boundary rule as a warning.** 1478 warnings already exist; a 1479th is invisible. **Boundary rules are errors or they are decoration.**
- **No behaviour change anywhere.** This is configuration only.

---

## 🟨 ALSO — two small follow-ups found while verifying the journal
Not blocking, and they belong to `AUDIT-UNRESOLVED`:
- [ ] `journal/page.tsx:786` still compares `entry.databaseId === GENERAL_DB_ID` **unresolved**, while `:99` resolves and `:575` handles the suffixed form. **One line.**
- [ ] `journal/page.tsx:99` — `resolveDbId(GENERAL_DB_ID) || GENERAL_DB_ID` is a **fail-open fallback**. Harmless today; 🔴 **it must die with `R1-2`'s fail-closed resolver.** Add a `TODO(R1-2)` so it is found.
