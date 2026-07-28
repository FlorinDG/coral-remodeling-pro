# TIMESHEETS PAGE — i18n KEY BLOCK (ready to paste)

**Problem:** `app/[locale]/admin/hr/timesheets/page.tsx:40` calls `useTranslations('Hr.timesheets')`, but the keys don't exist in `messages/{en,nl,fr}.json` — so next-intl falls back to rendering the key path itself (`Hr.timesheets.title`, `HR.TIMESHEETS.TOTALHOURS`). Every visible label is a variable name.

**Fix:** merge the blocks below into the existing **`"Hr"`** object in each file (`messages/en.json` already has `"Hr"` at ~line 790 — add `"timesheets"` inside it; do **not** create a second `Hr` node).

**Keys are the 28 actually called by the page** (grepped from source), plus the StatCard labels and the filter/grouping labels that are currently **hardcoded English** and must be routed through i18n too (TSP-B2).

> **NL labels are Florin-confirmed** (`coral-timesheets-page.md`): `Te beoordelen` · `Goedgekeurd` · `Geweigerd` · `Loopt nog` · `Niet toegewezen` · `Factureerbaar`/`Intern` · `Geklokt`/`Handmatig`/`Aangepast`. **`Te beoordelen`, NOT `In behandeling`** — the latter implies someone is already working it.
> **NB — one to fix in code, not here:** the page contains `t('Bulk action failed')` — a literal English sentence passed as a key. Replace with `t('bulkActionFailed')`.

---

## `messages/en.json` → inside `"Hr"`
```json
"timesheets": {
  "title": "Timesheets / Work Orders",
  "subtitle": "Overview of worked hours, approvals and reports.",
  "loading": "Loading…",
  "noEntries": "No entries found.",
  "noEntriesInPeriod": "No entries in this period.",
  "noEntriesInPeriodHint": "{count} entries exist outside this range.",
  "widenPeriod": "Show a wider period",
  "loadFailed": "Could not load timesheets. Please retry.",
  "retry": "Retry",
  "na": "—",

  "manualAdd": "Add manually",
  "export": "Export",
  "xlsx": "Excel (XLSX)",
  "csv": "CSV",
  "pdf": "PDF work order",

  "period": "Period",
  "periodThisWeek": "This week",
  "periodLastWeek": "Last week",
  "periodThisMonth": "This month",
  "periodLastMonth": "Last month",
  "periodCustom": "Custom range",
  "allWorkers": "All workers",
  "allProjects": "All projects",
  "allSources": "All sources",
  "allBillable": "Billable and internal",

  "all": "All",
  "flat": "Flat",
  "byWorker": "By worker",
  "byProject": "By project",

  "totalHours": "Total hours",
  "billableInternal": "Billable / internal",
  "approvedPending": "Approved / to review",
  "unattributedHours": "Unattributed hours",

  "date": "Date",
  "workforceMember": "Worker",
  "duration": "Duration",
  "project": "Project",
  "billable": "Billable",
  "internal": "Internal",
  "description": "Description",
  "status": "Status",
  "source": "Source",
  "media": "Media",
  "actions": "Actions",
  "approvedBy": "Approved by",
  "approvedAt": "Approved on",

  "approvalStatus": "Approval status",
  "statusTeBeoordelen": "To review",
  "statusGoedgekeurd": "Approved",
  "statusGeweigerd": "Denied",
  "statusLooptNog": "Still running",
  "unattributed": "Unattributed",

  "sourceClocked": "Clocked",
  "sourceManual": "Manual",
  "sourceAdjusted": "Adjusted",

  "approve": "Approve",
  "deny": "Deny",
  "viewTimesheet": "View work order",
  "bulkApprove": "Approve selection",
  "bulkDeny": "Deny selection",
  "bulkConfirm": "Approve {count} entries ({hours})?",
  "bulkActionFailed": "Bulk action failed.",
  "selectedCount": "{count} selected",

  "hoursShort": "h",
  "minutesShort": "m"
}
```

## `messages/nl.json` → inside `"Hr"`
```json
"timesheets": {
  "title": "Uren / Werkbonnen",
  "subtitle": "Overzicht van gewerkte uren, goedkeuringen en rapporten.",
  "loading": "Laden…",
  "noEntries": "Geen registraties gevonden.",
  "noEntriesInPeriod": "Geen registraties in deze periode.",
  "noEntriesInPeriodHint": "{count} registraties vallen buiten dit bereik.",
  "widenPeriod": "Toon een ruimere periode",
  "loadFailed": "Uren konden niet geladen worden. Probeer opnieuw.",
  "retry": "Opnieuw proberen",
  "na": "—",

  "manualAdd": "Manueel toevoegen",
  "export": "Exporteren",
  "xlsx": "Excel (XLSX)",
  "csv": "CSV",
  "pdf": "Werkbon (PDF)",

  "period": "Periode",
  "periodThisWeek": "Deze week",
  "periodLastWeek": "Vorige week",
  "periodThisMonth": "Deze maand",
  "periodLastMonth": "Vorige maand",
  "periodCustom": "Aangepaste periode",
  "allWorkers": "Alle medewerkers",
  "allProjects": "Alle projecten",
  "allSources": "Alle bronnen",
  "allBillable": "Factureerbaar en intern",

  "all": "Alles",
  "flat": "Plat",
  "byWorker": "Per medewerker",
  "byProject": "Per project",

  "totalHours": "Totaal uren",
  "billableInternal": "Factureerbaar / intern",
  "approvedPending": "Goedgekeurd / te beoordelen",
  "unattributedHours": "Niet toegewezen uren",

  "date": "Datum",
  "workforceMember": "Medewerker",
  "duration": "Duur",
  "project": "Project",
  "billable": "Factureerbaar",
  "internal": "Intern",
  "description": "Omschrijving",
  "status": "Status",
  "source": "Bron",
  "media": "Media",
  "actions": "Acties",
  "approvedBy": "Goedgekeurd door",
  "approvedAt": "Goedgekeurd op",

  "approvalStatus": "Goedkeuringsstatus",
  "statusTeBeoordelen": "Te beoordelen",
  "statusGoedgekeurd": "Goedgekeurd",
  "statusGeweigerd": "Geweigerd",
  "statusLooptNog": "Loopt nog",
  "unattributed": "Niet toegewezen",

  "sourceClocked": "Geklokt",
  "sourceManual": "Handmatig",
  "sourceAdjusted": "Aangepast",

  "approve": "Goedkeuren",
  "deny": "Weigeren",
  "viewTimesheet": "Werkbon bekijken",
  "bulkApprove": "Selectie goedkeuren",
  "bulkDeny": "Selectie weigeren",
  "bulkConfirm": "{count} registraties goedkeuren ({hours})?",
  "bulkActionFailed": "Bulkactie mislukt.",
  "selectedCount": "{count} geselecteerd",

  "hoursShort": "u",
  "minutesShort": "m"
}
```

## `messages/fr.json` → inside `"Hr"`
```json
"timesheets": {
  "title": "Heures / Bons de travail",
  "subtitle": "Aperçu des heures prestées, des approbations et des rapports.",
  "loading": "Chargement…",
  "noEntries": "Aucun enregistrement trouvé.",
  "noEntriesInPeriod": "Aucun enregistrement sur cette période.",
  "noEntriesInPeriodHint": "{count} enregistrements se situent en dehors de cette période.",
  "widenPeriod": "Afficher une période plus large",
  "loadFailed": "Impossible de charger les heures. Veuillez réessayer.",
  "retry": "Réessayer",
  "na": "—",

  "manualAdd": "Ajouter manuellement",
  "export": "Exporter",
  "xlsx": "Excel (XLSX)",
  "csv": "CSV",
  "pdf": "Bon de travail (PDF)",

  "period": "Période",
  "periodThisWeek": "Cette semaine",
  "periodLastWeek": "Semaine dernière",
  "periodThisMonth": "Ce mois-ci",
  "periodLastMonth": "Le mois dernier",
  "periodCustom": "Période personnalisée",
  "allWorkers": "Tous les collaborateurs",
  "allProjects": "Tous les projets",
  "allSources": "Toutes les sources",
  "allBillable": "Facturable et interne",

  "all": "Tout",
  "flat": "Liste",
  "byWorker": "Par collaborateur",
  "byProject": "Par projet",

  "totalHours": "Total des heures",
  "billableInternal": "Facturable / interne",
  "approvedPending": "Approuvé / à vérifier",
  "unattributedHours": "Heures non attribuées",

  "date": "Date",
  "workforceMember": "Collaborateur",
  "duration": "Durée",
  "project": "Projet",
  "billable": "Facturable",
  "internal": "Interne",
  "description": "Description",
  "status": "Statut",
  "source": "Source",
  "media": "Médias",
  "actions": "Actions",
  "approvedBy": "Approuvé par",
  "approvedAt": "Approuvé le",

  "approvalStatus": "Statut d'approbation",
  "statusTeBeoordelen": "À vérifier",
  "statusGoedgekeurd": "Approuvé",
  "statusGeweigerd": "Refusé",
  "statusLooptNog": "En cours",
  "unattributed": "Non attribué",

  "sourceClocked": "Pointé",
  "sourceManual": "Manuel",
  "sourceAdjusted": "Ajusté",

  "approve": "Approuver",
  "deny": "Refuser",
  "viewTimesheet": "Voir le bon de travail",
  "bulkApprove": "Approuver la sélection",
  "bulkDeny": "Refuser la sélection",
  "bulkConfirm": "Approuver {count} enregistrements ({hours}) ?",
  "bulkActionFailed": "Échec de l'action groupée.",
  "selectedCount": "{count} sélectionné(s)",

  "hoursShort": "h",
  "minutesShort": "min"
}
```

---
## Notes for the coder
1. **Merge into the existing `"Hr"` object** — don't create a duplicate node; JSON silently keeps only the last one, which is exactly the kind of failure that shows up as "some labels work, some don't".
2. **Route the hardcoded strings through i18n too** — "Period", "All Workers", "All Projects", "All Sources", "Flat", "By Worker", "By Project" are currently literal English in the component. Keys for them are included above.
3. **Fix `t('Bulk action failed')`** → `t('bulkActionFailed')`.
4. **Keys must exist in all three files.** A key present in `en` but missing in `nl` renders the raw path for Dutch users only — invisible to a developer testing in English. Worth a CI check that the three files have identical key sets.
