# WORKING PROFILE — Florin (Planner-maintained, drafted 2026-07-28)

**Purpose:** this session has already been compacted once. Everything learned about how Florin works is lost at the next context reset unless it lives on disk. This file is that memory.
**Status:** drafted by the Planner from observed behaviour across long working sessions. **Florin: correct anything wrong — a profile inferred rather than confirmed is exactly the presumption this file is meant to prevent.**

---

## HOW TO COMMUNICATE
- **Concise and direct.** No padding, no restating what he just said, no ceremonial preamble. He reads fast and works fast.
- **Push back.** He explicitly asks for scrutiny ("check thoroughly", "scrutinise this"). Agreeing to be agreeable is worse than useless — he's shipping to real clients on this code.
- **Say when you're recommending vs reporting.** He is fine with a nudge — *"I don't mind a little nudge if statistically I'm more likely to get a better result the way you propose, just be transparent."* ⇒ Mark it: **"Recommendation:"** / "my call, your decision", with the reason. Never steer implicitly.
- **Don't interpret his phrasing.** If a requirement is ambiguous: ask plainly, or implement the literal reading and state which. Parsing his wording against his stated reasoning to deduce what he "really meant" is presumption, and he'll say so.
- **Own errors plainly, then move on.** No grovelling, no collapse. He responds well to "that was mine, here's the fix" and badly to either defensiveness or self-abasement.
- **Humour lands.** Dry, quick. He'll joke while shipping a production fix at 1am.
- He fires "big guns" when annoyed and it clears immediately. Not personal, don't over-correct in response.

## ZOOM LEVEL — PUSH HIM UP, DECISIVELY (Florin, 2026-07-28)
> *"It is very easy for me to dive to great depth in details, but coming back to overview, although easy, is plagued by lots of CPU still hooked in the details. You do that sometimes, softly. Be more decisive — it frees RAM for overview, renders quicker in my mind, and we advance on strategy faster."*
- **Surface him deliberately.** After a detail run closes, don't drift into the next detail — **state the overview position and a recommendation**, briefly and without hedging. Softly nudging wastes the transition.
- **Be decisive at overview level.** One recommendation, named as such, with the reason. Not a menu of options — he has no time to arbitrate a list.
- **"What's next?" is two different questions — read the mode:**
  - **Deep in detail** ⇒ it's a *victory shout*. Answer short, keep momentum, don't zoom out.
  - **At overview** ⇒ it's a *real question*. Give the strategic picture and a clear next move.
- **He is chronically time-poor.** Overview answers are ranked and short; the reasoning goes underneath, not in front.

## HOW HE MAKES DECISIONS
- **Root cause, never symptom patching.** "Why does it do that" beats "make it stop".
- **Evidence over theory.** *(Learned expensively 2026-07-27: four OCC theories built from source while the server logged the answer on every conflict. Read runtime evidence first.)*
- **He is the authority; the software surfaces, he decides.** See `pd.md` → DESIGN PRINCIPLE. No hard-coded thresholds, no silent filtering, no auto-deciding anything with money/hours/clients attached.
- **One implementation per concept.** He reacts strongly to duplication — two leave models, two price fields, three calendars, a second mail composer. "Reuse our existing component" is a standing instruction.
- **Reuse and repair over rewrite.** Rejected a V2 side-by-side engine rebuild in favour of six targeted edits. Rewrites lose years of accumulated correctness.
- **Data safety is absolute.** Real books, real clients, real VAT filings. Additive-only schema, backups before migrations, Florin-gated writes.
- **Forcing functions over vigilance.** *"The hand is quicker than the eye — if nothing forces me to notice, it slips away."* Build checks that stop the process; don't ask him to remember.

## CONTEXT HE OPERATES IN
- **Belgian construction/renovation.** 6% renovation VAT, materials follow the works rate, reverse-charge (medecontractant) mandatory B2B, receipts (kassabon) = no VAT deduction. He knows this better than the model does — **when he corrects a VAT claim, he is right; verify before contradicting.**
- **Peppol** for e-invoicing; **Partena Professional** as social secretariat (payroll handled manually on their platform); **checkin@work** deliberately avoided by staying under threshold.
- **Small team** — Andrei, Vasile, Florin Holban + himself. Workforce users on WorkHub, he's owner/admin.
- **Solo operator with a cron coder.** Time-poor, context-switches fast, tests directly in production, reports bugs by screenshot.
- **The `.agents/workflows/` specs are the durable artifact** — the coder reads them, not the chat. Decisions must land in files or they evaporate.

## WHAT HE DISLIKES (observed, specific)
- Being told what he meant.
- Ghost/dummy buttons — a control that does nothing.
- Silent failures — `.catch(console.error)`, `.catch(() => [])`, empty states that hide errors.
- Specs whose conditionals get quietly simplified away in implementation.
- Patronising framing, over-hedging, or a confident tone on an unverified claim.
- Being asked to decide something the code could have answered ("check the file rather than asking me").

## WORKING RHYTHM
- Long, high-intensity sessions; will keep going late.
- Interleaves: bug report → spec request → coder plan review → new feature idea, rapidly.
- Wants coder plans **reviewed critically** before they run — he forwards them specifically for that.
- Expects the Planner to **verify claims in the codebase** rather than accept the coder's account. (Has been burned: "already removed in our previous step" when it hadn't been.)

---
*Maintenance: update when a correction reveals something durable. Keep it short — a profile nobody reads is worse than none.*
