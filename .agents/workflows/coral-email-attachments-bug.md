# CORAL — 🟥🟥 SELECTED EMAIL ATTACHMENTS ARE SILENTLY DROPPED — Planner 2026-07-29

**Florin:** *"Check whether the attachments selected to be sent with an invoice, by mail, to a private client, are actually sent — Resend has only delivered the invoice, not the other documents."*

**Confirmed: they are not sent. The email reports success, the client receives only the invoice PDF, and nothing tells you the annexes were omitted.** Affects **invoices AND quotations** identically.

---

## THE CHAIN

1. **`lib/storage/index.ts`** — `BlobStorageProvider.list()` returns
   ```ts
   { key: b.pathname,            // e.g. "t_<tenantId>/project/<id>/plan.pdf"
     url: this.get(b.pathname) } // ⚠️ "/api/files/…" — the PROXIED, authenticated route
   ```
   `get()` is documented in the interface as *"Returns the serving URL (/api/files/…)"* (`:22`). **It is not a Vercel Blob URL.**

2. **`QuoteSendModal.tsx`** — collects `selectedFileKeys` (the **pathnames**) and passes them to `onSend(subject, body, attachmentKeys)`. Correct.

3. **`app/actions/send-invoice.ts:55-72`** (and **`send-quote.ts:55-72`**, identical):
   ```js
   if (!key.startsWith(`t_${tenantId}/`)) continue;   // ✓ passes — keys ARE pathnames
   const meta = await head(key, { token });            // ✗ @vercel/blob head() wants a URL
   if (meta?.downloadUrl) { … push attachment … }
   } catch (err) {
       console.error("Failed to fetch extra attachment:", key, err);   // ✗ swallowed
   }
   ```
   `head()` from `@vercel/blob` expects a **blob URL**, not a pathname. Given a pathname it throws — the `catch` logs to the server console and the loop moves on.

4. **Result:** `emailAttachments` contains only the invoice PDF. Resend sends successfully. The action returns success. **You are told the mail went out; you are not told it went out incomplete.**

**Root of the root:** both send actions reach **past the storage abstraction** to `@vercel/blob` directly. `StorageProvider` has **no `read`/`head`/`download` method at all** — so there was no sanctioned way to fetch bytes server-side, and the code improvised one that doesn't work with the key format the abstraction hands out.

---

## FIX

- [ ] **ATT-1 · Give the storage layer a read method** 🟥 — add to `StorageProvider` / `BlobStorageProvider`:
  ```ts
  async read(key: string): Promise<Buffer> {
      const found = await vercelList({ prefix: key, limit: 1, token: this.token });
      const blob = found.blobs[0];
      if (!blob) throw new Error(`Blob not found: ${key}`);
      const res = await fetch(blob.downloadUrl ?? blob.url);
      if (!res.ok) throw new Error(`Blob fetch failed (${res.status}): ${key}`);
      return Buffer.from(await res.arrayBuffer());
  }
  ```
  Resolves pathname → blob properly. **Nothing outside `lib/storage` may import `@vercel/blob` again** — that inconsistency is the bug.

- [ ] **ATT-2 · Both send actions use `storage.read(key)`** 🟥 — `send-invoice.ts` and `send-quote.ts`. Keep the `t_${tenantId}/` tenant check (it's correct and necessary).

- [ ] **ATT-3 · FAIL LOUDLY — do not send a partial email silently** 🟥 — if any selected attachment cannot be fetched:
  - **abort the send** and return an error naming the file(s), **or** (if you prefer to allow it) require an explicit confirmation listing exactly what will be omitted;
  - never `catch → console.error → continue`. A client-facing document that went out missing its annexes needs re-sending, and you must know **before** the client reads it, not after.
  *(`pd.md` → FORCING FUNCTIONS #1: no silent failure on a user-visible action. This is the most expensive instance found so far — it misrepresents what a client received.)*

- [ ] **ATT-4 · Confirm and record what was actually attached** 🟧 — the success toast lists the attached filenames, and the sent-record/audit entry stores the attachment list. Then "did the client get the plan?" is answerable from the record instead of from memory.

- [ ] **ATT-5 · Re-send the affected invoice(s)** 🟨 (Florin) — any invoice already sent with annexes selected went out with the PDF only. Worth identifying and re-sending.

## VERIFY
1. Select two project files + the invoice → send to a test address → **three** attachments arrive.
2. Deliberately break one key → the send **fails with the filename**, or asks for explicit confirmation. It never silently sends a partial mail.
3. Same on a quotation.
4. Success toast lists the attached files; the record shows them afterwards.
