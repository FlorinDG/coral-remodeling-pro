# CORAL — CODER DIRECTIVE — `SEND-1` · the send path conflicts with itself — Planner 2026-09-13

**🛑 PROMOTION BLOCKER.** Found by Florin on the first item of the staging pass: sending an invoice to his own address raised **"Sync Conflict — Someone else edited this page while you were working."**
`Your Edit: opt-sent` · `Latest Version: opt-draft`

**There is no someone else. The application is conflicting with itself, inside a single user action.**

---

## THE MECHANISM — two write doors, one operation

```
1.  send-invoice.ts:59        SERVER writes the record
      await updatePageServerFirst(invoiceId, { ...currentProps, receiptUrl: archiveResult.key })
      → persists receiptUrl. Does NOT set status. Record version moves.

2.  ClientInvoiceEngine.tsx:855   CLIENT then writes the same record
      updatePageProperties(invoicesDbId, invoice.id, { status: 'opt-sent', receiptUrl: ... })
      → carries the snapshot taken BEFORE step 1. Version is stale.

3.  OCC compares versions → mismatch → conflict dialog.
```

The client's snapshot still reads `opt-draft`, because it was captured before the server action ran. **Step 1 invalidates the snapshot that step 2 depends on** — and both steps are halves of one button press.

**`ClientInvoiceEngine.tsx:1108` has the identical shape on the Peppol path.** Two occurrences, one cause. Florin has not reached item 2 yet; **it will fail the same way.**

## 🔴 WHY THIS IS WORSE THAN AN ANNOYING DIALOG

**The status transition lives ONLY in the client write — the one that is blocked.** The server persists `receiptUrl` and nothing else. So the failure mode is:

> **The invoice is sent. The client receives it. The archive is written. And the record still says `opt-draft`.**

A sent invoice recorded as a draft is a reconciliation defect on a legally-binding document: it will not appear in "sent" lists, `invoice-overdue` (`route.ts:48`) only transitions records whose status is `opt-sent` so **it will never be marked overdue**, and the accountant export's view of the period is wrong.

Worse, the dialog **asks the user to resolve it** — and *"Latest Version: opt-draft"* is the plausible-looking choice. **We are inviting the user to discard the fact that they sent the invoice.**

## WHERE IT CAME FROM

`DOC-ARCH-1c` introduced the server-side write (step 1) so the archive key is persisted through the server door. **Correct in itself** — that work is why archiving is reliable. What it did not account for is the **pre-existing client write** that was already doing the status transition. Nobody removed it, so the record is now written twice from two places.

**This is `R2` announcing itself.** `R2-1` (one `saveRecord()`) and `R2-3` (one authority on "current") exist precisely to make this class impossible. **We are not doing `R2` now** — this is the minimum correct fix, shaped so `R2` absorbs it later.

---

## `SEND-1` · THE FIX — the server owns the whole transition 🟥

- [ ] **`send-invoice.ts` writes `status: 'opt-sent'` together with `receiptUrl`, in the same `updatePageServerFirst` call.** One write, one version bump, one authority. The send succeeded or it did not; the record must say so.
- [ ] **Delete the client's `updatePageProperties` call at `ClientInvoiceEngine.tsx:855`.** The client **refreshes** the record from the server response instead of writing it.
- [ ] **Same for the Peppol path at `ClientInvoiceEngine.tsx:1108`**, against whatever server route performs that send. **Fix both or neither** — leaving one is two conventions for one operation, which is the defect we are removing.
- [ ] **Ordering is not negotiable:** status is stamped **only after** the send reports success, in the same server write as `receiptUrl`. **Never stamp before transmission** — that is `BLOB-4`'s lesson, and `DOC-ARCH-1` already established archive-then-send.
- [ ] **The client's local store must end holding the server's version**, not an optimistic guess. Whatever the store's refresh mechanism is, **read it before writing a new one.**
- [ ] 🛑 **STOP AND ASK** if `updatePageServerFirst` cannot write `status` for a reason not visible here — e.g. a schema-declaration or export-lock interaction. **Do not work around it client-side.**

## ⚠️ CHECK BEFORE FIXING — is a real record already wrong?
Florin sent at least one invoice on **staging** while this was live. **Staging is a Neon branch, so production is unaffected** — but the same code is on `develop`, and `main` may have a similar (older) shape.
- [ ] Report whether any invoice exists with **`receiptUrl` set and `status = 'opt-draft'`**. That combination is the signature of this bug: archived, therefore sent, but recorded as a draft.
- [ ] **Report only. No data changes.** If any exist in production, Florin repairs them in the Neon editor.

## VERIFY
1. Send an invoice to your own address → **no conflict dialog.**
2. The record shows **`opt-sent`** immediately, and `receiptUrl` is set.
3. **Reload after the sync queue drains** → still `opt-sent`, still has `receiptUrl`. *(The `D1` clobber only appears after sync completes — checking early gives a false pass.)*
4. Same for the **Peppol** path.
5. Force a send failure → status stays `opt-draft`, **no `receiptUrl`**, and the error names the cause.
6. `npm run test:compile` · full suite green.

## PROHIBITIONS
- **No client-side write of `status` on the send path.** The server owns it.
- **No "refresh the snapshot then write again"** — that hides the race instead of removing the second door.
- **No suppressing or auto-resolving the conflict dialog.** The dialog is correct; the conflict is what must stop existing. Silencing it would leave the data defect and remove the only thing that reported it.
- **No changes outside `send-invoice.ts`, the Peppol send route, and `ClientInvoiceEngine.tsx`.**
- **No data migration.**

## GATE
**This fix is cherry-picked onto `release/2026-09-13`** — made on `develop`, then picked deliberately. *(`coral-promotion-plan.md`: "Do not batch a hotfix into this.")* **The staging pass restarts at item 1 afterwards.**
