# CORAL — INCIDENT + DIRECTIVE — `CORE-3` · the audit op is not a Prisma promise — Planner 2026-09-29

> **Florin's screenshot:** *"All elements of the array need to be Prisma Client promises. Hint: Please make sure you are not awaiting the Prisma calls you intended to pass in the `$transaction` function."*

🔴 **This is the cause of "approve does not fire".** It is also the cause of every failed hour correction. **And the same defect sits in the accountant export.**

---

# 1 · THE DEFECT — one keyword

```ts
// src/lib/audit.ts:121-124
export async function buildAuditLogOperation(prismaClient: any, scope, event) {
    const data = await buildAuditLogData(scope, event);
    return prismaClient.auditLog.create({ data });      // ← a PrismaPromise
}
```

**The function is `async`.** `return prismaClient.auditLog.create(...)` inside an `async` function means the returned promise is **adopted and unwrapped** — so `await buildAuditLogOperation(...)` yields **the resolved `AuditLog` record**, not a `PrismaPromise`.

```ts
// src/app/api/hr/[entity]/route.ts:663, 676
const auditOp = await buildAuditLogOperation(prisma, {...}, {...});
const [updated] = await prisma.$transaction([
    prisma.clockEntry.update({ where: { id }, data }),
    auditOp,                                  // ← a plain object. Not a promise.
]);
```
🔴 **`$transaction` rejects the array, and every `PATCH /api/hr/clock-entries` throws.**

## 🔴 AND IT IS WORSE THAN A FAILURE
**Unwrapping EXECUTES the create.** The audit row is written the moment `buildAuditLogOperation` is awaited — **outside the transaction, before `$transaction` is even called, and it is never rolled back.**

> ### So the audit log now contains rows for edits that did not happen.
> **On a payroll and accounting surface, the log asserting a change that the record does not carry is the most damaging possible failure mode** — worse than the edit failing, because the failure is loud and the false record is silent.

- [ ] 🔴 **`CLEAN-12`: census the orphan audit rows.** `AuditLog` rows for `entityType = 'clockEntry'` whose `after` does not match the current `ClockEntry`. **Report the count per tenant. Do not delete anything** — Florin decides. *(This may also explain `CLEAN-11`'s −2.00 approved hours.)*

---

# 2 · THE SECOND SITE — 🔴 THE ACCOUNTANT EXPORT

```ts
// src/app/api/financials/export/route.ts:485-495, 525-545
const invoiceAuditLogs = await Promise.all(
    filteredInvoices.filter(…).map(inv => buildAuditLogOperation(prisma, auditScope, {…}))
);
…
const allOps = [...invoiceUpdates, ...expenseUpdates, ...invoiceAuditLogs, ...expenseAuditLogs];
await prisma.$transaction(allOps);
```
**`Promise.all` unwraps every one of them.** Identical defect, **and it is the route that sets `accountantExportedAt`** — the flag the export lock depends on.

- [ ] 🔴 **Establish what actually happens today:** run an accountant export on staging. **Does it 500? Do the audit rows exist? Are the invoices marked `accountantExportedAt`?** 🛑 **Report before fixing.** If the audit rows land and the invoice flags do not, **the log says "exported" for invoices that are not locked** — and `#7 Export lock` / `#8 Accountant export` are both resting on it.

---

# 3 · THE FIX — at the definition, not the two call sites

```ts
// src/lib/audit.ts
export function buildAuditLogOperation(prismaClient: any, scope: AuditScope, event: AuditEvent) { … }
                ↑ NOT async
```
🔴 **The problem is that a function returning a `PrismaPromise` cannot be `async`.** But it needs `await buildAuditLogData(…)` first, so it cannot simply drop the keyword.

- [ ] **Split the two concerns.** `buildAuditLogData` is the async part; **building the operation is synchronous.**
  ```ts
  // the caller awaits the DATA, then builds the OP synchronously
  const auditData = await buildAuditLogData(scope, event);
  const auditOp   = prisma.auditLog.create({ data: auditData });   // a real PrismaPromise
  await prisma.$transaction([prisma.clockEntry.update({…}), auditOp]);
  ```
  **Expose this as a synchronous `buildAuditLogOperation(prismaClient, auditData)`** taking already-resolved data, so the shape cannot be got wrong again.
- [ ] 🟢 **Name it so the constraint is visible.** A function whose result goes into `$transaction` must never be `async`. **Encode that in the name or the signature, not in a comment.**
- [ ] 🔴 **Fix BOTH call sites in the same pass.** *(`pd.md`: fix the definition, not the instance — `SEND-1` was fixed for invoices and not quotes, and `CSF-1` rev 1 repeated it.)*
- [ ] 🛑 **Do NOT "fix" this by removing the audit op from the transaction.** The audit and the change must succeed or fail together. **That atomicity is the entire point** — and it is what is broken right now.

## 🔴 THE RATCHET — this must not come back
- [ ] **A test that asserts `buildAuditLogOperation(...)` returns a `PrismaPromise`** — `typeof result.then === 'function'` **and** that it is *not* already resolved. **No database needed**; a stub `prismaClient` whose `auditLog.create` returns a sentinel is enough. *(Node test runner, zero deps, per the existing suite.)*
- [ ] 🟨 **Search for the shape elsewhere:** any `async` function that `return`s a `prisma.*.create/update/delete(...)` call. **Report every one, fix only these two.**

---

# 4 · WHAT THIS RETROACTIVELY EXPLAINS
- 🟢 **`HR-TS-1` "approve does not fire"** — solved. **No further diagnosis needed; the surfaced-error step in `HR-TS-1` §1a still ships**, because a payroll approval must never fail silently again.
- 🟢 **"the hours get corrected on exit with the cross, not on Save"** — `handleSave` throws and `setEditing` stays true; clicking X sets `editing = false` and the pane re-renders **from the `entry` prop, which never changed.** 🔴 **The corrected values Florin sees are almost certainly NOT in the database.**
  - [ ] **VERIFY IN THE DATABASE, not the UI.** Take an entry Florin recently "corrected", read its `clockInTime`/`clockOutTime` in Neon, and **compare to what the screen shows.** 🛑 **Report before changing anything.** *(If the UI is showing values the database does not hold, that is a second defect and a worse one.)*

# VERIFY
1. **Approve fires. The status changes and survives a reload.**
2. **An hour correction saves on the Save button**, and the value is **confirmed in the database**.
3. **The audit row exists for that change — exactly one.**
4. **Force a failure** (edit an approved entry without the unlock). 🔴 **No audit row is written.** *That is the proof the atomicity is restored.*
5. **Accountant export: the invoice flags and the audit rows agree.**
6. **The new test fails if `async` is put back on `buildAuditLogOperation`.**
7. `test:compile` · `test:lint` · suite — exit 0.
