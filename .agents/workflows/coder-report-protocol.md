# CORAL — CODER REPORT PROTOCOL — binding for every directive — Planner 2026-09-30

> **The report is a claim. The Planner verifies every line of it against the code.**
> A short accurate report is worth more than a long impressive one. **An unverifiable sentence is a defect in the report.**

---

# 1 · WHERE

```
.agents/reports/<ITEM-ID>.md          e.g. .agents/reports/ERR-1.md
```
- **One file per item.** 🛑 **No date in the filename** — the date lives inside.
- **A re-run or fix-up APPENDS** a `## REVISION n — <date>` section at the bottom. 🛑 **Never rewrite or delete an earlier section.**
- 🟢 **This path is inside every directive's blast radius automatically.** It is the ONLY file under `.agents/` the coder may write.
- **Committed as the item's LAST commit:** `docs(report): <ITEM-ID>` — staged by explicit path.
- 🛑 Your tool's own walkthrough/artifact files do not count. **If it is not in `.agents/reports/`, the Planner cannot read it.**

---

# 2 · THE SECTIONS — fixed order, all required

**A section with nothing in it says `None.` — literally.** `None.` is a claim and will be checked.

### 0 · Header
```
Item:            ERR-1
Directive:       .agents/workflows/coder-directive-err-1-describe-error.md
Directive blob:  <output of: git hash-object <directive path>>   ← which version you worked from
Start SHA:       <HEAD before your first commit>
End SHA:         <HEAD after your last code commit>
Branch:          develop
Date:            2026-09-30
```

### 1 · Outcome — one line
`DONE` · `PARTIAL — <what is missing>` · `STOPPED — <why>`

### 2 · Commits
| SHA | Message | Files | +/− |
|---|---|---|---|

### 3 · Checklist mirror
**Every `- [ ]` in the directive, in the directive's order, verbatim-short.** One row each.
| § | Item | Status | Evidence |
|---|---|---|---|
| 1 | Never throws | ✅ | `src/lib/describe-error.ts:12-40` try/catch; test `describe-error.test.ts:44` |

Status is exactly one of: **✅ done · ❌ not done · ⏭ skipped (reason) · 🟨 reported, not decided.**
🛑 **Evidence is a `file:line` at End SHA, or a command in §6. Never prose.**

### 4 · Files vs blast radius
Paste **verbatim**: `git diff --stat <Start SHA>..<End SHA>`. Then:
| File | In blast radius? |
|---|---|
🔴 **Any "No" row must be explained here. The expected count is zero.** A file outside the radius that is NOT listed here is the most serious defect a report can have.

### 5 · 🔴 Decisions I made that the directive did not state
**The most important section.** Every point where the directive left a choice open and you chose.
| Where (file:line) | The open question | Options I saw | What I chose | Why |
|---|---|---|---|---|
- Includes: naming, file placement, a helper you extracted, an order you picked, an edge case you handled, a type you widened, a test you added or skipped.
- 🛑 **If you think "that was too small to mention" — mention it.** The Planner decides what is small.

### 6 · Verification — commands, not descriptions
For every VERIFY step in the directive, and for `test:compile` / `test:lint` / the suite:
````
### VERIFY 2
$ grep -rnE "\.message \|\| ['\"\`]" src | wc -l
7
exit: 0
````
- **The exact command, the exit code of THAT command** (`cmd; echo "exit: $?"` — not the exit code of a pipe), **the output verbatim.**
- Output over 30 lines: first 30, then `… [trimmed: N more lines]`. 🛑 **Never paraphrase output.**
- 🛑 **A step you did not run says `NOT RUN — <reason>`.** Never "passes", "green", "works" without the output under it.

### 7 · Measurements
Every before/after number the directive asks for, with the command that produced each.

### 8 · 🟨 Report-only items
The tables the directive's 🟨 checkboxes ask for. Facts only — the decision is the Planner's.

### 9 · Not done, and why
Every skipped, fenced, blocked or deferred item. `file:line` + one sentence.

### 10 · Noticed, out of scope
Defects you saw and did **not** fix. `file:line` + one sentence each. 🟢 **This is valued — "we do not cover our eyes."** 🛑 **It is never a reason to change the file.**

### 11 · Uncertain
Anything you are not sure is correct: an edge case, a type you could not confirm, a behaviour you could not test. **Saying "I am not sure" costs nothing. A confident wrong claim costs a review cycle.**

---

# 3 · STYLE RULES

1. 🛑 **No adjectives of quality.** Not *robust, comprehensive, seamless, successfully, properly, fully, correctly, clean.* They carry no information and the Planner deletes them.
2. **Every claim carries `file:line` at End SHA, a SHA, or a command with its output.** A claim with none of these is removed.
3. **Code excerpts are copied from the file as it stands at End SHA** — re-read it; never quote from memory of what you intended.
4. **Numbers, not words:** "44 of 47 sites converted, 3 reported (§8)" — not "most sites".
5. **Same words as the directive.** If the directive says `describeError`, the report does not say "the error formatter".
6. **If an edit was truncated or partially applied, §1 says `PARTIAL` and §9 says where.** A truncated file reported as complete is the worst outcome.
7. **If you believe the directive is wrong, §1 says `STOPPED`, and §11 says why.** That is a good report, not a failed one.

---

# 4 · WHAT THE PLANNER DOES WITH IT
1. Checks §4 against `git diff --stat` independently.
2. Re-runs a sample of §6's commands. **Any mismatch invalidates the whole report**, not just that line.
3. Reads §5 first. Anything there the Planner would have decided differently becomes a revision.
4. Opens every `file:line` in §3 marked ✅.

🟢 **A report that makes this fast gets the next item sooner.**
