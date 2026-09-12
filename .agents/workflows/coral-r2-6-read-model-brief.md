# ✅ ANSWERED — (c) STATED HYBRID (Florin, 2026-09-12)

> *"A hybrid solution is the way, because signal to no signal while doing a site visit must not mean that the tenant all of a sudden cannot complete his work, or worse, look unprofessional in front of a client."*

**The decision is recorded in `coral-r2-write-path.md` → `R2-6`, with the layer boundary and two binding design rules.** The brief below is kept as the reasoning trail.

⚠️ **One correction to this brief, in Florin's own words:** it framed offline as *"capture in a basement"* vs *"read a quote on site"* and guessed the first. **Both were too weak.** The requirement is that a tenant on site, in front of a client, losing signal, can still **complete the work in front of them** — and knows *before* leaving what they have with them. That is a stronger requirement than either option offered, and it is what makes (c) the answer rather than a compromise.

---

# R2-6 · THE READ MODEL — decision brief for Florin — Planner 2026-09-12

One page. The decision is: **how does a screen get the records it renders?** It does not block anything until Phase 4, but it decides what `R2-4` *is*, so deciding it cold beats deciding it under pressure.

---

## WHERE WE ACTUALLY ARE

**Two read models are already running, and nobody wrote that down.**

| | Model | Used by |
|---|---|---|
| **1** | **Zustand store holds whole databases** — hydrate, then read `.pages` synchronously | grid, engines, projects, journal, mobile — most of the app |
| **2** | **Query-per-view** (React Query `5.90.21`, installed and wired in `AdminLayout` + `WorkHubProviders`) | `useClockEntries`, all of WorkHub |

Model 1 was "the store holds everything". `MEM-3c` made it lazy — **a patch on a model, not a model** — and that is exactly why it fails silently: every surface must *remember* to ask, and forgetting yields an empty list rather than an error. `LAZY-1` found **16 of 19 surfaces** had forgotten.

**That is the honest starting point: not a clean model with a bug, but two models and a patch.**

---

## THE THREE OPTIONS

### (a) Keep the store + lazy loading, and make it enforced
The store stays the model. `LAZY-2`'s accessor makes not-loaded impossible to mistake for empty, and that becomes the only sanctioned way in.

**For:** smallest change · offline works *by construction* — the IndexedDB copy is what makes your phone capture survive a dead signal · synchronous reads, so no component becomes async · `R2-4` stays a tidy re-seam.
**Against:** still two models (WorkHub keeps its own) · memory grows with the tenant, so a big database is still a big client · every "which databases does this screen need" question stays a judgement call.

### (b) Shrink to index + per-view queries
Keep a **small always-loaded index** (`id`, `databaseId`, `title`, `updatedAt` — ~1–2 MB, built by `MEM-3a`) for labels and chips. Everything else becomes a query for exactly what a screen renders.

**For:** **one** read model, converging with what WorkHub already does · the `LAZY-1` bug class becomes **unexpressible** — there is no "loaded" state to forget · memory stops tracking tenant size, which matters when tenants arrive · filtering and pagination move to Postgres, which is good at it.
**Against:** **offline stops being free** — it has to be built deliberately (see below) · components that read synchronously today become async, which is real work across the grid and engines · more round-trips unless queries are shaped well.

### (c) Stated hybrid
Index + queries for **lists and search**; the store retained **only** for the record currently being edited, plus the sync queue and dirty-page protection.

**For:** offline keeps working where it matters (the thing you are editing) · the index kills the label problem · the 52 MB list problem goes away.
**Against:** two mechanisms by design, so the boundary must be written down and enforced — otherwise it degrades into today's situation, which is also "two mechanisms", just undocumented.

---

## THE ONE THING THAT SHOULD DECIDE IT

**Offline.** Everything else is engineering preference; this is a business question.

Today, offline works **as a side effect**: the store persists to IndexedDB, so your phone has a copy. Under (b) that side effect disappears and offline becomes a feature someone must build.

So: **how much do you need to work without signal?**
- *"Capture a task and log an expense in a basement"* → you need very little, and (b) is affordable — the sync queue already handles pending writes; only the read side changes.
- *"Open a quote on site with no bars and read the lines"* → that is a real offline requirement, and (a) or (c) protect it much more cheaply.

**You are the only person who knows which of those is true.** My read of your week says the first — capture and quick checks on the phone, real work at a desk — which points to **(c)**, then **(b)** later if it proves out.

---

## PLANNER RECOMMENDATION — **(c), and do nothing extra now**

1. `LAZY-2` is being built **regardless**, and it is the seam: with every consumer behind one accessor, swapping the read model costs *one file* instead of fifty-three. That is the whole reason it is `1.2` and not a patch.
2. **Decide the direction now, execute it in Phase 4.** Knowing we are heading for (c) changes `R2-4` from *"split the store into four parts"* to *"shrink the store to the edited record + sync queue"* — different work, same slot.
3. **No new dependency, no rewrite this month.** React Query is already installed and already doing model 2. Convergence means using what is there, not adding anything.

**What I need from you is one word — (a), (b) or (c)** — plus, if you can, which of the two offline sentences above matches your week. I will write it into `R2-6` and `R2-4` follows from it.

**If you would rather not decide yet:** say so and I will default to (a) for planning purposes and re-raise it before Phase 4 starts. That is a real option — it costs nothing as long as `LAZY-2` lands, because the seam is what keeps the choice open.
