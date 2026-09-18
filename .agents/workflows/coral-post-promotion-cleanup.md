# CORAL — POST-PROMOTION CLEANUP — the parked list — Planner 2026-09-13

**Nothing in this file is touched before `main` is current.** These are logged so they are not lost, and deliberately **not** fixed during the release freeze — each is a config change that would invalidate the staging pass in progress. `coral-promotion-plan.md`: *"Do not batch a hotfix into this."*

---

## 🟧 `CLEAN-1` · `next.config.ts` — the build is not linting
```
⚠ `eslint` configuration in next.config.ts is no longer supported.
⚠ Invalid next.config.ts options detected: Unrecognized key(s) in object: 'eslint'
```
Next 16 removed the `eslint` key, so the block is **ignored** — `next build` runs no lint.

**Why this is more than tidiness:** `R1-4/5` specifies a **CI import-boundary gate** as the seraph's enforcement (*"no code below the gate can construct an unscoped client"*). **That gate cannot ride on `next build`.** It needs its own CI step.
- [ ] Remove the dead `eslint` key.
- [ ] Add an explicit lint step to CI.
- [ ] **Note for `R1`:** the import-boundary gate is a separate command, not a build side effect.

---

## 🟧 `CLEAN-2` · `middleware` → `proxy` (Next 16 deprecation)
```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```
Still functional; no urgency from Next's side.

**🔴 Do not do this as a standalone rename.** Middleware is where auth and tenant routing run — **seraph territory.** A rename there with no isolation tests in place is a change to the tenant boundary made for cosmetic reasons.
- [ ] **Fold into `R1`**, where `tests/tenant-isolation.test.ts` will already exist to prove the boundary still holds afterwards.

---

## 🟨 `CLEAN-3` · npm noise — informational only
- `node-domexception@1.0.0`, `glob@10.5.0` deprecated — **transitive**, not direct dependencies. Nothing to do until the parents update.
- `npm warn allow-scripts` — npm's new install-script approval notice, listing 10 packages (`@prisma/client`, `@prisma/engines`, `prisma`, `sharp`, `@swc/core`, `tesseract.js`, `core-js`, `@parcel/watcher`, `postinstall-postinstall`, `unrs-resolver`). **Advisory. The build succeeded, so Prisma's postinstall ran.**
- [ ] Optional: `npm approve-scripts` to silence, once. Low value.

---

## 🟧 `CLEAN-4` · Preview shared production's database — standing condition, now fixed
Until 2026-09-13, `DATABASE_URL`/`DIRECT_URL` were set to **All Environments**, so **every preview deployment ever made pointed at production data.** Now split: Production → production branch, Preview → Neon `staging` branch.
- [ ] **Verify the split held** — change something visible on preview, confirm production does not show it. *(Pending Florin.)*
- [ ] **A database branch does not isolate everything.** Still shared with production on preview: **Resend** (email really sends), **Peppol** (real network, irreversible), **Vercel Blob** (same token, so staging archives land in the production store). Worth scoping per-environment eventually; **not before the merge.**

---

## 🟥 `CLEAN-5` · `reminders` cron — do NOT register
`src/app/api/cron/reminders/route.ts` is unregistered in `vercel.json` and **must stay that way** until `REM-2` rewrites it. Registering it would schedule an unfiltered cross-tenant `findMany`.
See `coral-task-reminders.md` and `coral-r5-scheduled-work.md`. **Also: its `CRON_SECRET` check passes when the variable is unset — fail-open.** Fixed at L1 under `R5`.

---

## 🟧 `CLEAN-6` · `NEXT_PUBLIC_APP_URL` — a hardcoded production fallback in 12 places
```ts
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.coral-group.be';
```
`send-invoice.ts:67` · `send-quote.ts:67` · `accept-quote.ts:78` · `stripe/portal` ×3 · `settings/billing/portal` ×2 · `email/connect/google` ×4.

**Found 2026-09-13 on the staging pass:** the emailed invoice link pointed at **production**, where the staging invoice does not exist → 404. Fixed by scoping `NEXT_PUBLIC_APP_URL` to Preview. *(It is a `NEXT_PUBLIC_` var — baked at build time, so the redeploy is mandatory, not optional.)*

**Why it is worth fixing rather than just configuring:** the fallback means **any environment without the variable silently addresses production.** It is not an error, it is not logged, and it looks right until someone clicks a link. The same constant also reaches **Stripe return URLs and Google OAuth callbacks**, where pointing at the wrong origin is a broken payment flow or a failed token exchange rather than a 404.
- [ ] One resolver — `lib/app-url.ts` — used by all 12 call sites.
- [ ] **It throws when unset rather than guessing.** Fail closed. The whole point is that a missing value must be loud.

---

## 🔔 `CLEAN-7` · REMINDER — next time anyone opens `ClientInvoiceEngine.tsx`
**Planner-flagged 2026-09-17, deliberately not fixed alone.** In the `SEND-1` refresh (`:868` email path, `:1140` Peppol path):
```js
...(serverPage?.properties || {}),
status: 'opt-sent',          // ← asserted AFTER the server spread
```
If `serverPage` is ever null, **the client asserts "sent" without server confirmation** — the optimistic override we spent two days removing, in miniature. Harmless today because the server always sets `status` on success (`send-invoice.ts:124`, `peppol/send:241,484`), so it is redundant rather than wrong.
- [ ] **Trust `serverPage` entirely**; if it is null, surface that instead of assuming success.
- [ ] Also check: **test count moved 125 → 124** at `d07f98b`. Confirm a test was *superseded*, not dropped.

---

## ORDER
`CLEAN-4` verification is **part of the staging pass**, not cleanup. `CLEAN-1` and `CLEAN-3` are free-standing and can go on `develop` any time after the merge. `CLEAN-2` and `CLEAN-5` belong to `R1` and `R5` respectively and **must not be done alone.**
