# CORAL — 🟥 TRANSACTIONAL MAIL FAILS TO SEND — Planner spec 2026-09-09

> ⛔ **SUPERSEDED 2026-09-09 by `coral-blob-read-and-error-surfacing.md`.** The sweep behind MAIL-2 found the same defect in three shapes, one of which silently corrupts the accountant export. **Coder: work the superseding spec, not this one.** Kept for the reasoning trail.

**Florin:** *"Transactional mail fails to send. Toast text is 'failed to send'."*

**Status: one confirmed defect, one blind spot.** The blind spot is the reason we cannot name today's cause, so it is fixed first — the system must report its own failure before we theorise about it again.

---

## WHAT THE TOAST TELLS US

`ClientInvoiceEngine.tsx:858` already prints the server's error:
```js
toast.error(`Fout bij verzenden: ${response.error}`);
```
So the message is generic because **the server sent a generic message** — `send-invoice.ts:103`:
```js
return { success: false, error: err.message || "Failed to send email." };
```
That fallback fires only when the thrown value has **no `.message`**. Every explicit throw in that function *has* one (`Unauthorized for attachments`, `Failed to attach file X. Email not sent.`, and the Resend error's own message). So the failure is something the function does not anticipate, and the handler flattens it to a string that carries nothing.

**This is the actual bug to fix first.** We spent five rounds on OCC modelling a mechanism while the evidence sat in a log. Here there is not even a log worth reading — the error is discarded at the boundary. Fix the reporting, and the next failed send names its own cause on Florin's screen.

---

## FIX

- [ ] **MAIL-1 · THE ERROR MUST CARRY ITS OWN IDENTITY** 🟥 — `send-invoice.ts` and `send-quote.ts`, the outer `catch`:
  ```js
  } catch (err: any) {
      console.error("Failed to execute invoice mail dispatch:", err);
      const detail = err?.message || err?.cause?.message || err?.name || String(err);
      return { success: false, error: `[${err?.name ?? 'Error'}] ${detail}` };
  }
  ```
  No behaviour change, no new dependency. `String(err)` is the floor: an error object with no `message` still produces something identifying. **A user-facing failure may never resolve to a constant string** — see the directive added to `pd.md`.

- [ ] **MAIL-2 · `storage.read()` CANNOT READ A PRIVATE BLOB** 🟥 — confirmed defect, independent of today's symptom. `lib/storage/index.ts` → `read()`:
  ```js
  const fetchUrl = blob.downloadUrl ?? blob.url;
  const res = await fetch(fetchUrl);        // ✗ no token, and the blob is PRIVATE
  ```
  Blobs are written with `access: 'private'` (`put()`, same file). The app's own serving route `app/api/files/[...key]/route.ts:44` reads them the sanctioned way:
  ```js
  const result = await get(key, { token, access: 'private' });
  return new NextResponse(result.stream, …);
  ```
  `read()` must do the same — `get(key, { token: this.token, access: 'private' })`, then buffer the stream — instead of `list()` + unauthenticated `fetch`. **Two representations of "read a blob", one of them wrong**; the correct one already exists ten files away.

  Consequence today: `read()` throws → **ATT-3 correctly aborts the send** rather than mailing a partial document. So the annexes fix is behaving as designed on top of a read method that was written wrong. Attachments stopped vanishing silently and started taking the email down instead.

- [ ] **MAIL-3 · CONFIRM WHICH ONE IT WAS** 🟧 — after MAIL-1 ships, Florin sends once. The toast names the cause. If it is `Failed to attach file …`, MAIL-2 is the whole story; if it is anything else, this spec gets a second round with a real error string in hand. **Do not skip to a theory.**

- [ ] **MAIL-4 · SWEEP THE OTHER SIX** 🟨 — six `toast.error` sites in `src/` resolve to a constant (`'Verzenden mislukt.'`, `'Factuur aanmaken mislukt.'`, …) and discard the caught error. Same treatment: append the error detail. Each is a future evening of log-hunting avoided.

## VERIFY
1. Send an invoice with **no** attachments → succeeds, or fails with a **named** cause.
2. Send with two project files attached → three attachments arrive (re-runs the ATT verification, which MAIL-2 is required for).
3. Deliberately pass a bogus attachment key → toast names the file. Never a bare "failed to send".
4. Same four checks on a quotation.
5. `tsc --noEmit` clean; the 55 tests stay green.

## ORDER
**MAIL-1 first, alone, and ship it.** It costs one cron run and converts every future mail failure from an investigation into a sentence. MAIL-2 can ride along — it is a confirmed defect either way. MAIL-3 is Florin's five-second check afterwards.
