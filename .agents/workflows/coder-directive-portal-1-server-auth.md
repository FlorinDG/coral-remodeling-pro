# CORAL — CODER DIRECTIVE — `PORTAL-1` · portal auth moves server-side — Planner 2026-09-27

**The client portal has THREE answers to "who is allowed here", in one feature.** One of them is "nobody asked."

| Route | Enforces today |
|---|---|
| `api/portals/documents` · `media` | ✅ **the portal password, server-side** |
| `api/portals/messages` · `tasks` · `updates` | 🔴 `auth()` + `tenantId` — **an ERP session the client does not have** |
| `api/portals/slug/[slug]` **(read)** | 🔴 **nothing** |

**Consequence today: a client can upload a document and cannot post a message.**

---

# 1 · 🔴 THE READ ROUTE RETURNS EVERYTHING, UNAUTHENTICATED

`src/app/api/portals/slug/[slug]/route.ts:121-136`
```ts
const { password, budget, paidAmount, ...safePortal } = portal;
return NextResponse.json({
    ...finalPortal, tasks: mappedTasks,
    hasPassword: !!password,          // 🔴 a FLAG. The password is never verified here.
    linkedProjectData, quotes, invoices,
});
```
The gate lives in the browser — `app/[locale]/portal/[slug]/page.tsx:30`.

**So the payload — tasks, linked project data, quotes, invoices, budget, paidAmount — is served to anyone holding the slug, password or not.**

## Severity, stated accurately
- **The slug is `nanoid(10)`** — ~60 bits. 🟢 **Not enumerable. Nobody is harvesting portals.**
- 🔴 **But the password protects nothing against anyone who has the link.** A forwarded email, a screenshot, a pasted chat link, shared browser history — full access to that client's quotes and invoices.
- **The slug is the credential. The password is a UI curtain.** That is the defect: Florin set a password believing it guarded the data.

---

# 2 · THE FIX — reuse the pattern that already exists

🟢 **Do not invent an auth model. `documents/route.ts:27-33` already has the right one:**
```ts
if (portal.password) {
    if (!password) return NextResponse.json({ error: 'Password required' }, { status: 401 });
    const isValid = await bcrypt.compare(password, portal.password);
    if (!isValid)  return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
}
```

## `P1.1` · Gate the read route
- [ ] **`GET /api/portals/slug/[slug]` verifies before it returns content.** Accept the password via a **POST body or an `Authorization` header — never a query string** *(no credentials in URLs, they land in logs and history)*.
- [ ] **Two-stage response, so the UI still works:**
  - **unverified** → return ONLY what the login screen needs: `{ slug, clientName, projectTitle, hasPassword: true }`. 🛑 **No tasks, no quotes, no invoices, no budget, no linked project data.**
  - **verified** → the full payload as today.
- [ ] **`portal.password == null` → serve the full payload.** That is `PORTAL-4` and it is Florin's open decision; **do not change it here**, but note it in the report.

## `P1.2` · Issue a scoped session so it is verified ONCE
- [ ] **On success, set a short-lived signed httpOnly cookie scoped to that portal** — `portalId`, an expiry, and nothing else. **Not the password, not a bearer of the payload.**
- [ ] **Every portal route accepts that cookie** in place of re-sending the password.
- [ ] 🟢 **This is the seam `PT-5`'s `portalScope` will grow from.** Keep the verification in ONE helper — `lib/portal-auth.ts` — so `portalScope` replaces one function, not five routes.

## `P1.3` · One model across all five write routes
- [ ] **`messages` · `tasks` · `updates`: drop `auth()` + `tenantId`.** Use the same portal verification. 🔴 **This is what makes portal writes work for a client at all.**
- [ ] **`tenantId` comes from the PORTAL record**, never from a session and never from the body. *(`R1-3`: the server never trusts a supplied id.)*
- [ ] **`documents` · `media`: repoint at the shared helper.** Behaviour unchanged.
- [ ] 🛑 **Do NOT add `authorSide` yet.** That is `PT-1` and it needs the scope. **This directive changes who may write, not what is recorded.**

---

# 3 · VERIFY
1. `GET` the slug route **with no credential** on a password-protected portal → **only** `{ slug, clientName, projectTitle, hasPassword }`. 🛑 **A `quotes` or `invoices` key in that response is a fail.**
2. Same with a **wrong** password → **401**.
3. Correct password → full payload, and the cookie is set.
4. With the cookie, **no password resent**: the portal loads and a message posts successfully.
5. **A client posts a message / updates a task / adds an update** — all three now succeed without an ERP session. **They 401 today; record before and after.**
6. `documents` and `media` still work, unchanged.
7. A portal with `password == null` → full payload, no credential. **Report this as the `PORTAL-4` behaviour, unchanged.**
8. 🔴 **The cookie is scoped to ONE portal.** Obtain a cookie for portal A, call every route with portal B's id → **401 or 404 on every one.**
9. `eslint src --quiet` exit 0 · suite 0 fail / 13 todo · `npm run test:compile` exit 0.

## PROHIBITIONS
- 🛑 **No credential in a query string or a URL.**
- 🛑 **No password, hash, or portal id in `localStorage`.** httpOnly cookie only.
- 🛑 **Do not touch `ClientPortal.password`'s nullability** — Florin's decision *(`PORTAL-4`)*.
- 🛑 **No 2FA in this pass** *(`PORTAL-3`)*. **A second factor on a client-side gate is decoration on decoration** — this directive is what makes 2FA worth adding.
- 🛑 **No `authorSide`, no schema change.**

## 🟢 WHY THIS IS FIRST
**It is the only security item on the board**, it is small, it depends on nothing, and **it is the precondition for `portalScope`, `PT-1` and 2FA** — all three of which are pointless on top of a gate enforced in the browser.
