# CORAL — PLAN — CLEARING THE `@ts-nocheck` SURFACE — Planner 2026-09-28

> **Florin:** *"do not let errors trail. write a plan to solve what we stumbled upon now, pain as it may."*

**Lifting the directive on ONE file found a latent crash and a dead feature.** 21 files carry it. **This is not background debt — it is 21 files in which any data change is unsafe**, and `INC-1` is what that costs.

**This is not new work.** It is `SUPA-2` batches 2.2–2.6, parked under `WH-3`, re-framed with a method that does not require converting everything at once.

---

# 1 · WHAT ONE FILE TOLD US

`EditShiftDialog.tsx` — 915 lines, 24 errors:

| Category | Count | Nature |
|---|---|---|
| **Casing renames** | 10 | `shift_date` → `shiftDate`. Mechanical. |
| **Semantic mappings** | 11 | 🔴 `file_path` → **`url`**, `file_name` → **`name`**, `file_size` → **`size`**. *Different field names, not casing.* |
| **Phantom field** | — | 🔴 `source_project_id` **exists in no model.** Whatever it drives is already dead. |
| **Cross-record** | 1 | `st.task_id` on `ShiftTask`. |
| **Real bugs** | 2 | 🔴 `fileInputRef` **undefined** — a crash if that path runs. A missing `ProjectAttachment` export. |

🛑 **Do not extrapolate from this.** One file is not a sample. **Phase 0 exists to produce the real number** — the Planner has been wrong four times this week by estimating instead of measuring.

---

# 2 · THE INSIGHT THAT MAKES THIS TRACTABLE

> ## You do not have to fix a file's errors to remove `@ts-nocheck`.
> ## You have to fix the dangerous ones and **localise** the rest.

| | `@ts-nocheck` | `@ts-expect-error` |
|---|---|---|
| Scope | **the whole file** | **one line** |
| A NEW error elsewhere in the file | 🔴 invisible | ✅ caught |
| The silenced reads | 🔴 **unenumerable** | ✅ **greppable, countable** |

**That is the whole of `INC-1`.** The write was removed because its readers could not be enumerated. Line-level silencing makes them enumerable **without converting a single one**.

🟢 **So the blocker stops being all-or-nothing and becomes a ratchet**: a file with 24 errors becomes a file with 24 named exceptions, the file is checked from that moment, and the count only falls.

---

# 3 · THE PHASES

## `TD-0` · MEASURE THE WHOLE SURFACE — throwaway, one operation
- [ ] **On a scratch branch, lift all 37 directives from all 21 files. Change nothing else.**
- [ ] `npm run test:compile`. **Report:**
  - total errors, **and per file**
  - **by category:** casing rename · semantic mapping · phantom field · real bug · type debt (`any`, missing props)
  - 🔴 **every "real bug" listed individually** — those are live defects nobody can currently see
- [ ] 🛑 **Fix nothing. Revert the branch.**
- [ ] **This number sizes everything below and is the only honest input to sequencing.**

## `TD-1` · THE REAL BUGS — immediately, regardless of everything else
- [ ] **Whatever `TD-0` finds in the "real bug" column is fixed first**, in its own commit, each with a named symptom.
- [ ] `fileInputRef` is already one: **an undefined variable in shipping code.**
- [ ] 🟢 **These are the reason this plan is urgent rather than tidy.**

## `TD-2` · THE PHANTOMS — decided, not renamed
- [ ] **A field read from no model means a feature that already does nothing.** `source_project_id` is the first.
- [ ] **Each one: implement it, or delete the code that reads it.** 🛑 **Never rename a phantom** — that manufactures a plausible field for something that was never there.
- [ ] **Florin decides any that are product questions.**

## `TD-3` · BLANKET → TARGETED, file by file
**The core move. One file per commit.**
- [ ] Remove `@ts-nocheck` (**both copies** — 17 files carry it twice).
- [ ] **Every remaining error gets a line-level `@ts-expect-error` naming its category:**
  ```ts
  // @ts-expect-error SUPA-2: snake_case read, Supabase-era shape
  // @ts-expect-error SUPA-2-SEMANTIC: file_path → ShiftAttachment.url
  // @ts-expect-error TD: pre-existing type debt, unrelated to the shape
  ```
- [ ] 🟢 **The file is now type-checked.** A new error in it fails the build.
- [ ] **Order: fewest errors first.** Momentum, and the method is proven on cheap files before the expensive ones.
- [ ] **Metrics after every file:** `@ts-nocheck` files · total `@ts-expect-error` · of which `SUPA-2`.

## `TD-4` · CONVERT, BY CATEGORY NOT BY FILE
- [ ] **Casing renames** — mechanical, in bulk, one record type per commit.
- [ ] 🔴 **Semantic mappings — one at a time, reading the Prisma model.** `file_path → url` is not a rename. **No find-and-replace, ever.** *(`full_name` is the standing example: it compiles and renders blank.)*
- [ ] **Each converted read deletes its `@ts-expect-error`.** 🟢 **If the comment stays and the error is gone, the build fails** — `@ts-expect-error` is self-cleaning. **The ratchet maintains itself.**

## `TD-5` · THE BRIDGE COMES OUT — the rule that `INC-1` cost us
- [ ] **A field's WRITE is removed only in the commit that converts its LAST reader.**
- [ ] **Readers are countable:** `grep "SUPA-2: .*shift_date"`. **When the count is zero, the write goes.**
- [ ] 🛑 **Never strip the type, remove the write, and convert later.** That sentence is `INC-1`.

---

# 4 · THE RATCHET
- [ ] **`@ts-nocheck` is forbidden by ESLint, `error`, with the 21 files grandfathered** *(`ban-ts-comment` already warns — make it an error for `nocheck` specifically)*.
- [ ] **The allowlist only falls. A new file may never join it.**
- [ ] **`@ts-expect-error` is permitted but counted**, and its count is the debt.
- [ ] 🟢 **Two numbers, both monotonic: files unchecked → 0, expected errors → 0.**

---

# 5 · WHAT THIS COSTS, HONESTLY
- **`TD-0`** is hours. It is also the only step that can be sized right now.
- **`TD-3`** is 21 commits, and each one **makes a file safe before anything is converted** — the safety arrives early, the conversion can take as long as it takes.
- **`TD-4`** is the long tail and it is the part that can be interleaved with feature work.
- 🔴 **`TD-1` is not optional and is not deferrable.** Undefined variables in shipping code are crashes waiting for a code path.

## 🛑 SEQUENCING AGAINST EVERYTHING ELSE
- **`INC-1`'s bridge lands first.** Production is broken; the bridge holds while this plan runs.
- **`KERN-7b` stays paused** until `TD-3` reaches the files it touches — two conversions over one surface cannot be reverted independently.
- **`WH-2`** — repair versus rebuild — is **better decided after `TD-0`**, because the real error count across 21 files is the missing input. **A file that needs 40 exceptions is arguing for rebuild; a file that needs 3 is arguing for repair.**

---

## 🟢 WHY THIS IS WORTH THE PAIN
**`@ts-nocheck` did not hide type errors. It hid a crash, a dead feature, and the readers whose invisibility broke production for every tenant.**

**The compiler is the only tool that enumerates readers.** Twenty-one files opted out of it, and the first one we asked answered with twenty-four things nobody knew.
