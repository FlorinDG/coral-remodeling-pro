# SECRETS-AT-REST-1 — stored secrets are encrypted in the database (Planner directive, 2026-10-10)

**Read first:** `coder-report-protocol.md` §3a (tests run the REAL code) and §3b (a blocked step STOPS).
**Florin's decisions (2026-10-10):** it goes to the coder; when `ENCRYPTION_KEY` is missing the app **keeps working and
flags it** — new values are stored unencrypted, a value already encrypted fails with a named error, and a warning is
shown. 🛑 **NOTHING may stop the Peppol inbox from receiving** — a plaintext value stays readable in every case.

## Why
Stored as plain text today (verified): `ConnectedEmailAccount.password`, `.accessToken`, `.refreshToken` (mailbox
IMAP/SMTP password, Gmail OAuth tokens) and `Tenant.eInvoiceApiKey` (the e-invoice.be / Peppol API key). Anyone with
read access to the database (a dump, a branch, a log) reads them. Login and portal passwords are hashed — not in scope.
(`lib/encryption.ts` was dead code with a built-in key — deleted 58b9bc4f; do not revive it.)

## The design (do not change it — STOP and report if a step does not fit)
**A1 · `src/lib/secrets.ts`** (server-only; the one place `ENCRYPTION_KEY` is read, like `lib/auth-secret.ts`):
- `sealSecret(plain: string | null | undefined): string | null` — null/'' → null. Key present → `enc:v1:` + base64url of
  `iv(12) | authTag(16) | ciphertext`, **AES-256-GCM**, key = `scryptSync(ENCRYPTION_KEY, 'coral-secrets-v1', 32)`
  (derived once, memoized). Key missing → return the plain value unchanged and `console.error` ONCE per process
  `[secrets] ENCRYPTION_KEY is not set — secrets are stored unencrypted`.
- `openSecret(stored: string | null | undefined): string | null` — null → null. No `enc:v1:` prefix → the value IS the
  plaintext (legacy / no key): return it. Prefixed + key → decrypt; a wrong key or tampered value → throw
  `SecretUnavailableError` (named, message without the value). Prefixed + no key → throw `SecretUnavailableError`.
- `isSealed(stored)`, `secretsKeyConfigured()`.
- Plain fields only — no parameter properties in classes (the test runner can't parse them).

**A2 · the doors** (callers never touch the columns directly):
- `src/lib/data/mail-account-secrets.ts`: `mailAccountCredentials(db, accountId)` → `{ password, accessToken,
  refreshToken }` opened; `writeMailAccountCredentials(db, accountId | upsert input, plain)` seals. **Self-healing**: when
  a read finds a plaintext value and the key IS configured, it seals it and writes it back (same door, after the read;
  a failure to write back is logged, never thrown).
- `src/lib/data/peppol-credentials.ts`: `peppolApiKey(tenantId)` (platform door — tenant-level config) opened, with the
  same self-healing; `setPeppolApiKey(tenantId, plain)` seals.

**A3 · every caller uses the doors** (census, verified 2026-10-10 — re-check, list any you find extra):
- e-invoice key: `lib/e-invoice.ts`, `api/peppol/inbox/route.ts`, `api/peppol/inbox/[id]/route.ts`,
  `api/peppol/send/route.ts`, `api/peppol/validate/route.ts`, `api/peppol/register/route.ts`,
  `api/peppol/onboard/route.ts`, `actions/send-invoice.ts`, `actions/superadmin.ts` (health check: reads it).
- mailbox: `api/email/route.ts` (IMAP login: password / OAuth), `api/email/accounts/route.ts`,
  `api/email/connect/google/callback/route.ts` (the upsert writes tokens).
- A select that only checks presence (`eInvoiceApiKey: true` → "connected?") stays a presence check — do not decrypt it.

**A4 · the flag:** the superadmin Peppol health (`getTenantPeppolHealth`) and the tenant's email/Peppol settings show a
warning (i18n, 4 locales: `System.secretsKeyMissing`) when `secretsKeyConfigured()` is false.

## Tests (each with a THROW PROOF: break the real code, paste the failure, restore)
1. Round trip; two seals of the same value differ (random IV); a tampered value / wrong key → `SecretUnavailableError`.
2. No key: seal returns the plaintext; open of a plaintext returns it; open of a sealed value → the named error.
3. **Peppol inbox safety:** with NO key, `peppolApiKey` of a plaintext stored key returns it (the inbox keeps receiving).
4. Self-healing: a plaintext read with the key configured is written back sealed (fake db); a write-back failure does not
   throw.
5. Census: no file outside the two doors and `lib/secrets.ts` reads `.eInvoiceApiKey`, `.password`, `.accessToken` or
   `.refreshToken` of these models for its VALUE (presence selects allowed, listed in the test).

## Fence
Touch only: `src/lib/secrets.ts` (new), the two doors (new), the callers in A3, the settings/health UI for A4, messages
(4 locales), new tests. **No schema change, no package change, no migration.** Do not change the inbox's logic — only
where it gets the key.

## Florin, before or after the deploy (not the coder)
Set `ENCRYPTION_KEY` in Vercel (Production, Preview, Development) — a long random value (`openssl rand -base64 48`) —
and **keep a copy outside Vercel**: losing it makes the sealed values unreadable (mailboxes must reconnect, the Peppol key
must be re-entered). Until it is set, nothing changes and the warning shows.

## Done means
tsc clean, full `node --test` green, lint without new errors, one commit per step (A1…A4, tests with their step),
report `.agents/reports/SECRETS-AT-REST-1.md` per `coder-report-protocol.md`, push develop, STOP.
