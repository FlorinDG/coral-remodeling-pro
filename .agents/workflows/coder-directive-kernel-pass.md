# CORAL — CODER DIRECTIVE — `KERN-1…3` · the kernel pass — Planner 2026-09-21

**Florin, 2026-09-21:** *"Let us fix the pain in the kernel for now. Not all needs action today, but some major points do."*

## 📍 FIRST, THE HONEST PICTURE — the kernel is the healthiest layer
**26 items, 10 open** — and **six of the ten are absent capability, not pain**: `SMS-0…3` *(decided, deferred)*, `R5-0` and `IMP-0` *(both blocked on `R1-2`'s fail-closed resolver)*, `REM-3` *(needs the push decisions)*.

**So there are three things actually worth doing**, and only two of them hurt today.

---

# 🔴 `KERN-1` · `BLOB-6` — TWO READERS OF ONE URL FORMAT, ONE DECODES AND ONE DOES NOT
**Re-rated from P3 to P0.** This is not latent and it is on the money path.

```ts
// api/files/[...key]/route.ts:26        ✅ DECODES
const key = rawKeySegments.map(s => decodeURIComponent(s)).join('/');

// lib/storage/index.ts:53  resolveDocumentKey   ❌ DOES NOT
key = key.replace(/^\/api\/files\//, '');        // strips the prefix, never decodes
...
if (tenantId && !key.startsWith(`t_${tenantId}/`)) return null;   // ← fails on %2F
```

**And the write path produces the encoded form:**
```ts
// TicketCaptureModal.tsx:318
receiptUrl = `/api/files/${encodeURIComponent(uploadRes.key)}`;
```
`encodeURIComponent` encodes `/` as `%2F`. So a stored `receiptUrl` can be
`/api/files/t_abc%2Freceipts%2Fplan%202.pdf`, which `resolveDocumentKey` reduces to
`t_abc%2Freceipts%2Fplan%202.pdf` — **which does not start with `t_abc/`, so it returns `null`.**

### Why this is P0
`resolveDocumentKey` is called at **`financials/export/route.ts:369` and `:405`** — the accountant export. A `null` result pushes the document into `failedDocuments`, and **`BLOB-4` strict aborts the entire export.**

> **One expense ticket captured through the mobile modal can block an entire quarterly accountant export.**

The same encoded form is written by `DocumentViewerCard:11`, `SupplierQuotationsCard:218` and `m/tasks:1586`. **The API route tolerates it; the export does not.** *(Florin's export succeeded on 31 documents, so his current data does not contain an affected `receiptUrl` — **that is luck, not safety.**)*

- [ ] **`resolveDocumentKey` decodes** — after stripping `/api/files/`, and for the URL branch, **per path segment**, exactly as `route.ts:26` does.
- [ ] **Decode defensively**: a key that is already decoded must survive unchanged, and a malformed sequence must return `null` rather than throw.
- [ ] 🔴 **The real fix is one function, not two behaviours.** `route.ts:26` and `resolveDocumentKey` are **two readers of one format** — extract the parse into **one exported helper in `lib/storage`** and have the route call it. *Defect shape #1, on the document path.*
- [ ] 🛑 **Do not change the tenant-prefix assert.** It is the file security model and must be byte-identical afterwards.
- [ ] **REPORT, do not fix:** count `receiptUrl` values across invoices and expenses that contain `%2F` or `%20`. **Read-only. Florin decides on any repair.**

### VERIFY
1. A receipt captured through `TicketCaptureModal` with a **space in the filename** appears in the accountant export.
2. A bare key (`t_x/receipts/a.pdf`) still resolves — **no regression**.
3. A key from **another tenant** still returns `null`.
4. A malformed percent sequence returns `null`, does not throw.
5. `grep -rn "decodeURIComponent" src/app/api/files src/lib/storage` → the parse exists **once**.

---

# 🟧 `KERN-2` · `MODAL-HAZE` — every dialog in the app renders blurred on odd sizes
```jsx
// ui/dialog.tsx:58
"fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] … zoom-in-95 slide-in-from-top-[48%]"
// ui/dialog.tsx:23
"fixed inset-0 … backdrop-blur-sm"
```
A 50% translate on an **odd** panel width lands on a **half pixel**. Combined with the zoom/slide animation and the backdrop blur, text renders soft. **One file, every `Dialog` in the application.**

- [ ] **Centre without a fractional transform** — the overlay becomes a flex container and the content is centred by layout, so no `translate-x/y-[-50%]` remains. *(Radix supports this; the transform is a default, not a requirement.)*
- [ ] Keep the open/close animation, **but it must not leave a fractional transform in the resting state.**
- [ ] If flex centring is not viable, the fallback is to snap to whole pixels — **but prefer removing the transform to compensating for it.**
- [ ] **Check every dialog size**, including odd widths and long content, light and dark.
- [ ] 🛑 **`ui/dialog.tsx` only.** Do not touch `BottomSheet` — mobile sheets do not use this centring.

---

# 🟨 `KERN-3` · `CUSTOM-1` — `mintDatabaseId`. Not pain, but ready and P0.
Identity minting belongs in the kernel (`pd.md` IDENTITY DIRECTIVE). **It kills a defect class rather than a defect.**

- [ ] **`mintDatabaseId()`** — server-side, the only source of a new database identifier.
- [ ] 🔴 **Delete the `specificId` parameter** from `createDatabase` (`store.ts:175, 859, 865`). **A caller learns an identity; it never chooses one.**
- [ ] With `specificId` gone, **`DatabaseClone:983` can no longer auto-create a database in the browser** — `CUSTOM-4` falls out as a consequence rather than a task.
- [ ] 🛑 **This changes provisioning behaviour.** If removing `specificId` breaks a seeding path, **STOP AND REPORT** — do not reinstate it under another name.
- [ ] **Sequencing note:** this is safe to do before `R1`, and it makes `R1-1b` cheaper. **Florin's call on timing.**

---

---

# 🔍 `KERN-3` REVIEW — Planner, 2026-09-21. **Half done, and the half that is missing is labelled as done.**

**Florin: *"Let it stay there, but put it in the list, do not drop it from view."*** Recorded. **The capability stays; the claim about it must not.**

## ✅ WHAT LANDED — the objective is met
| | |
|---|---|
| `grep -rn "specificId" src` | **zero** — a caller can no longer choose an identity |
| `DatabaseClone.tsx` | **no `createDatabase` call at all.** The browser auto-creation path is gone. |
| `journal/page.tsx` | **no `createDatabase` call.** Its `if (!db)` block is gone. |
| Remaining callers | **one** — `dynamic-db/page.tsx:26`, dead behind the name guard, owned by `CUSTOM-6` |

**Both real browser-creation paths are dead. That was the point, and it is done.**

## 🔴 `KERN-3b` · THE DOCSTRING ASSERTS A PROPERTY THE CODE DOES NOT HAVE
```ts
// src/lib/database-identity.ts
/** mintDatabaseId() — server-side, the only source of a new database identifier. */
export function mintDatabaseId(): string { return uuidv4(); }
```
**Its only caller is `store.ts:866`** — and `store.ts` opens with `zustand`, `idb-keyval` and React hooks. **That is the browser.**

**So this is `uuidv4()` renamed, carrying a comment that says the opposite of what happens.** The parameter is gone — real and valuable — but the *minting* is still client-side, which is the other half of the IDENTITY DIRECTIVE: *"Minting is a KERNEL function. Not a module, not a leaf, and **never a browser**."*

### Why this is worse than an inaccurate comment
**`CUSTOM-6` wires up that dead button. At that exact moment client-side minting becomes live again — and a docstring reading "server-side" is precisely what carries it through review.**
We removed the capability and left a sign pointing back to it. **A false comment on a kernel primitive is load-bearing in the wrong direction.**

### The work — small, and none of it changes behaviour
- [ ] 🔴 **Correct the docstring to what is true.** Something like:
  > *"Mints a database identifier. **Currently invoked client-side from the Zustand store — this is NOT yet the server-side minting required by `pd.md`'s IDENTITY DIRECTIVE.** `CUSTOM-6` must call a server action; it must not call this from the browser. Tracked as `KERN-3b`."*
  **Do not soften it. The next reader is the person about to wire the button.**
- [ ] **Mark `store.createDatabase` the same way** — one comment at the implementation: *must not be wired to UI until minting moves server-side.*
- [ ] 🛑 **No behaviour change in this item.** Do not move minting now, do not delete `store.createDatabase`, do not touch the dead button. **Florin has chosen to leave the capability in place; only the claim is wrong.**

### `KERN-3c` · the real completion — **NOT NOW**
- [ ] Minting moves behind a **server action**; `store.createDatabase` stops minting and receives the id from the server. **Lands with `CUSTOM-2` (provisioning as a callable capability) or `CUSTOM-6`, whichever comes first.**
- [ ] 🔴 **`CUSTOM-6` cannot be considered complete while it mints in the browser.** Written into that item so the requirement arrives with the work instead of depending on memory.

### VERIFY (`KERN-3b`)
1. `src/lib/database-identity.ts` no longer claims to be server-side.
2. `grep -rn "server-side" src/lib/database-identity.ts` → **zero**, or only inside a sentence describing what is still *required*.
3. `grep -rn "specificId" src` → **still zero.**
4. **No behaviour change.** Full suite green, `npm run test:compile` clean.

---

## NOT IN THIS PASS — and why
| Item | Why not |
|---|---|
| `R5-0` tenant job runner · `IMP-0` acting-scope | **Both need `R1-2`'s fail-closed resolver.** Built now, they would wrap a fail-open default and claim a guarantee they cannot deliver. |
| `SMS-0…3` | Decided and deferred. No current pain. |
| `REM-3` service worker / push | Needs the reminder decisions first. |

## ORDER
**`KERN-1` first** — it is the only one that can break a legally-significant process, and the report half is read-only. `KERN-2` is independent and visible daily. `KERN-3` when Florin wants it.

---

*Housekeeping, unrelated: there are untracked local duplicates in the working tree — `m/tasks/page 2.tsx`, `DocumentViewerCard 2.tsx`. **Not in git** (`git ls-files | grep " 2\." → 0`), so harmless to the build, but worth deleting locally before one gets edited by mistake.*
