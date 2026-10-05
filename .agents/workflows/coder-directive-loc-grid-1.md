# CODER DIRECTIVE — LOC-GRID-1 · the new grid speaks the user's language

**Planner 2026-10-05. ONE milestone: do it, report `.agents/reports/LOC-GRID-1.md`, push, STOP.**
`coder-report-protocol.md` §3a (THROW PROOF) and §3b (a fence is a wall) are binding.
**Start only after DB-HEADER-1 M2 is reviewed** (it touches the same toolbar). Before you start: `git log -1` — work
on the current HEAD; the Planner may have changed these files since the directive was written.

## Why
The new grid (`NotionGridV2`, "Raster V2") becomes the default grid. Its visible text is hard-coded Dutch: toasts
("Dit document is geëxporteerd…", "Alleen-lezen: hier kan niets geplakt worden.", "geen getal", "geen geldig
e-mailadres", "Geen van de geselecteerde records…"), buttons and labels ("Tekst afbreken", "Verwijderen", "Wissen",
"geselecteerd", "Nieuw", "Goedkeuren", "Import", "Export"), titles ("Openen", "Acties", "Breedte", "Lange tekst…"),
cell texts ("Peppol actief", "Doeldatabase niet gevonden", "Opzoeken…", "Toepassen", …), confirm dialogs.
The ERP runs in en / nl / fr / ro (next-intl, `src/messages/*.json`).

## Do
1. Every user-visible string in `src/components/admin/database/v2/NotionGridV2.tsx` and
   `src/components/admin/database/v2/cells.tsx` → `useTranslations('Admin')`, keys under **`Admin.grid.*`**
   (new namespace; reuse an EXISTING key only where its meaning is identical — e.g. `Admin.comments.*`,
   `Admin.db.col.*`). Plurals / counts via ICU (`{count, plural, …}`), never string concatenation.
2. Add the keys to **all four** `src/messages/{en,nl,fr,ro}.json`. The Dutch text = today's string, unchanged.
   Insert keys without reformatting the files (the diff must show only added lines + the touched line).
3. `tests/i18n.test.ts` already fails on a referenced key that is missing — that is your guard. THROW PROOF:
   remove one new key from `fr.json`, show the test fail, restore.
4. Report: a table *string → key* for every string moved, and a grep showing no Dutch/English literal left in
   JSX text, `title=`, `placeholder=`, `aria-label=`, `toast.*(…)`, `confirm(…)` of the two files.

## 🛑 FENCE
May change: the two files above (strings ONLY — no logic, no class names, no handlers, no reordering) and the four
message files. Everything else read-only. A string you cannot move without touching logic: leave it, list it in §9.
