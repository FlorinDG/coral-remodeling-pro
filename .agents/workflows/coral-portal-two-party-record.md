# CORAL — CLIENT PORTAL · THE TWO-PARTY RECORD — Florin 2026-09-27

> **Florin:** *"portal writes as client. authorship is not only code logic, but actual real life consequence of instructions given. what client writes is read-only for erp, and it has to be loud, obvious in the ui as well. what tenant writes is read-only for client. all tenant data is read-only for client in portal UI, albeit exportable where applicable."*

**This is not access control. It is an append-only record between two parties, neither of whom can alter the other's statements.** A client writing *"proceed with option B"* is an instruction with cost attached. **If the tenant can edit it afterwards, the record is worthless the day it is needed.**

---

# 1 · 🔴 AUTHORSHIP DOES NOT EXIST IN THE DATA

| Record | Author field | Reality |
|---|---|---|
| `Message` | `sender String` | 🔴 **free text, taken from the request body** — the writer declares who they are |
| `ProjectUpdate` | — | 🔴 **none** |
| `Document` | — | 🔴 **none** |
| `ProjectMedia` | — | 🔴 **none** |
| `Task` | — | 🔴 **none** |

```ts
// api/portals/messages/route.ts
const { portalId, projectId, content, sender, fileUrl, replyToId } = body;
//                                   ^^^^^^ authorship is a CLAIM, not a fact
```

> ## The rule cannot be enforced until the data records which side wrote each row.
**Schema first. Then the gate. Then the UI.** In that order — a loud UI over unrecorded authorship is theatre.

---

# 2 · THE SHAPE

## `PT-1` · `authorSide` on all five records
```prisma
enum AuthorSide { CLIENT TENANT }

model Message {
  authorSide  AuthorSide          // 🔴 set by the SCOPE, never by the payload
  authorId    String?             // the User, when TENANT; null when CLIENT
  authorLabel String              // display name at time of writing — frozen
}
```
- [ ] **`authorSide` is written from the scope**, exactly as `tenantId` is *(`R1-3`: the server never trusts a supplied id — and never a supplied author)*.
- [ ] **`Message.sender` is replaced, not kept.** A free-text author beside a real one is two representations of one fact.
- [ ] **`authorLabel` is frozen at write time.** A renamed employee must not retroactively change who said something. *(Same reason invoices freeze the client address.)*
- [ ] **Backfill:** existing rows get `authorSide` inferred **once**, from `sender` where it exists and `TENANT` where it does not, and 🔴 **flagged as inferred** — `authorSideInferred Boolean @default(false)`. **An inferred author must never be presented as a recorded one.**

## `PT-2` · The gate refuses cross-side mutation
- [ ] **`UPDATE` / `DELETE` where `authorSide != scope.side` → refused.** In the scoped client, **not in a route** *(`TSC-0 D7`, and `TSC-4` is the record of what per-route improvisation produces)*.
- [ ] **Append-only for the other side.** A correction is a **new entry**, never an edit. *(The pattern already in the ERP: the export lock seals the envelope and leaves the letter editable — here the letter is sealed too.)*
- [ ] 🛑 **The tenant cannot delete a client message.** Not soft-delete, not hide. **If it can vanish, it was never evidence.**
- [ ] **Nothing about this is conditional on plan or role.** *(A `TENANT_ADMIN` is still the tenant side.)*

## `PT-3` · 🟨 FIELD-LEVEL EXCEPTION — status is not authorship
**Florin's rule, read literally, forbids a client from ticking a task the tenant created.** That is presumably wanted, so the distinction is:
- **Record-level immutable:** the words. `content`, `title`, `name`, `caption`, attachments.
- **Field-level permitted:** the **response**. `Task.status`, a document acknowledgement, an approval.
- [ ] **A response is a NEW FACT about a record, not an edit of it.** Prefer a separate row — `TaskResponse { taskId, authorSide, status, at }` — over mutating `Task.status`, so the history survives and *who marked it done, when* is answerable.
- [ ] 🔴 **FLORIN TO CONFIRM:** may a client mark a tenant-created task done? If yes, it is a response, not an edit.

## `PT-4` · Loud in the UI, both ways
- [ ] **Every entry carries its side visibly** — not a subtle tint. **The client sees which of their own instructions are on record**, and the tenant sees what the client actually said.
- [ ] **A tenant viewing a client entry sees it as unmodifiable**, with no edit affordance at all. *(Not disabled — absent. A greyed-out edit button invites a support request.)*
- [ ] **Inferred authorship is marked as such** until a human confirms it.

## `PT-5` · Tenant data is read-only to the client, and exportable
- [ ] **Quotes, invoices, project data: read + export, never write.** Enforced by the scope; the UI merely reflects it.
- [ ] **Export is a right, not a leak** — a client may take away what concerns them. `isContractor` already narrows the field set *(budget, paidAmount)*; **that becomes part of the grant rather than a branch in a route**.

---

# 3 · WHERE IT LIVES

| Layer | What |
|---|---|
| **L0 kernel** | `AuthorSide` as a type. Nothing else — authorship is a fact, not a computation. |
| **SERAPH** | `portalScope(portalId, secret)` — a **third constructor of the same scope**, beside `scopeFromSession` and `systemScope` *(`TSC-0 D3/D5`)*. It carries the tenant **and the side**. 🟢 **No new principal type** — what flows downstream is the identical `TenantScopedClient`. |
| **L1 core** | `authorSide` injection on write · cross-side refusal · the response record. **Written once**, like the Class-B parent check. |
| **L2 module** | The portal UI, and the ERP's view of portal traffic. **Neither decides anything** — both ask. |

## 🔴 Why a scope constructor and NOT a restricted user
A `User` row for a client means a person who can never log in, who lands in seat counts (`includedUsers` is in pricing today, unenforced but coming), in the `db-hr` employee projection, in team pickers, in every user list — **and you spend a year excluding it from things.** *"A user who is not a user"* is a second representation of **person**, which is the defect class this whole month has been removing.

**A third constructor adds no principal type.** The seraph does not care how a scope was built — *that was the design*.

---

# 4 · 🛑 AND FIRST: THE PORTAL HAS TWO AUTH MODELS TODAY
| Route | Enforces |
|---|---|
| `documents` · `media` | ✅ **the portal password, server-side** |
| `messages` · `tasks` · `updates` | 🔴 **`auth()` + tenantId** — an ERP session the client does not have |
| `slug/[slug]` **(read)** | 🔴 **nothing** — returns tasks, project data, **quotes, invoices**, budget with `hasPassword` as a flag *(`PORTAL-1`)* |

**Three answers to "who is allowed here," in one feature.** So a client can upload a document and **cannot post a message**.

🟢 **`portalScope` collapses all three** — and it is what makes portal writes work for the client at all, which is why this lands *before* 2FA. **A second factor on a client-side gate is decoration on decoration.**

---

# ORDER
```
PORTAL-1 server-side verification  →  portalScope (with R1-4)  →  PT-1 authorSide + backfill
   →  PT-2 cross-side refusal  →  PT-3 response records  →  PT-4 loud UI  →  PORTAL-3 2FA
```

## FLORIN'S DECISIONS
- [ ] **May a client mark a tenant-created task done?** *(If yes: a response, not an edit — `PT-3`.)*
- [ ] **Is `password` nullable on purpose** — a portal with no credential, link-only? *(`PORTAL-4`.)*
- [ ] **What is exportable to a client**, precisely: their own quotes and invoices, and what else?
- [ ] **What happens to the existing rows** whose authorship is unknown — inferred and flagged, or left blank and marked unattributed?
