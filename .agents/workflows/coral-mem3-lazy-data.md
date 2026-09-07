# CORAL — MEM-3: STOP SHIPPING THE WHOLE TENANT TO RENDER ONE SCREEN — Planner spec 2026-08-18

## WHY
`app/actions/global-databases.ts:20-22`
```js
const dbs = await prisma.globalDatabase.findMany({
    where: { tenantId },
    include: { pages: true },   // ← every page of every database, blocks included
});
```
Production holds **9,776 `GlobalPage` rows** (~52 MB, mostly `blocks`/`properties` JSON). All of it is fetched, serialised, transferred, hydrated into Zustand, **and persisted to IndexedDB** — to render a single grid.

Measured cost (Vercel, one invoice page): **307 MB per invocation**, middleware 213 MB. Build needs `--max-old-space-size=4096`. Browser-side it produces the forced reloads. Every one of those is the same root cause.

**This is the last big resource item, and it gets much harder once tenants arrive.**

---

## 🚨 THE CRUX — why this cannot be done naively
**80 call sites across 20+ files read `.pages` from the store**, and many read *other* databases' pages. The worst case is the most common one:

`components/admin/database/columns/RelationColumn.tsx:74-79`
```js
const targetDatabase = useDatabaseStore(state => state.getDatabase(relationDatabaseId));
const page = targetDatabase.pages.find(p => p.id === id);   // label for a relation chip
```
Stop loading all pages and **every relation field goes blank** — client names on invoices, project names on tasks, supplier names on expenses. Same for mentions (`PropertyMentionBlock`), Kanban/Calendar/Gantt views, `useFilteredPages`, `useVatLookup`, the PDF templates, and the project rollups.

**Consumers that must keep working** (non-exhaustive, from the sweep):
`RelationColumn` · `PropertyMentionBlock` · `NotionGrid` · `ProjectDetailView` · `RecordDetailPage` · `DbPropertiesPanel` · `JournalCard` · `useVatLookup` · `useFilteredPages` · `CalendarView` · `KanbanView` · `GanttView` · `InvoiceRow` · `InvoicePDFTemplate` · `PurchaseInvoiceEngine` · `quote/[id]` · `bordereau/[id]` · `po/[id]`

---

## THE DESIGN — split **INDEX** from **CONTENT**
The insight: almost every cross-database read wants a **label**, not a record.

| | Contents | Size | Loaded |
|---|---|---|---|
| **INDEX** | `{ id, databaseId, title, + 2-3 display fields, updatedAt }` for every page | ~1–2 MB for 9,776 rows | **always**, as today |
| **CONTENT** | full `properties` + `blocks` | ~50 MB | **per database, on demand** |

Keeping a global index preserves the **synchronous store reads** the entire app depends on — no component has to become async — while removing ~95% of the payload. Relation chips, mentions, search and routing all resolve from the index.

---

## STAGED PLAN — each stage independently shippable and safe

### MEM-3a · ADD THE INDEX (purely additive — nothing breaks) 🟥 **do first**
- New server action `getGlobalPageIndex()` → `{ id, databaseId, title, displayFields, updatedAt }[]`, tenant-scoped. Prisma `select`, **never** `include: { pages: true }`.
- New store slice `pageIndex: Map<string, IndexEntry>` + `getPageLabel(id)` / `getPagesByDatabase(dbId)`.
- Point **label-only** consumers at it, with fallback to the full page if present:
  ```js
  const label = store.getPageLabel(id) ?? targetDatabase?.pages.find(p => p.id === id)?.properties.title;
  ```
- **Ships with the old path intact.** Nothing regresses; the index is simply available.

### MEM-3b · SPLIT THE SERVER ACTION 🟧
- `getGlobalDatabaseSchemas()` → databases **without** pages (properties, views, filters, name, icon).
- `getDatabasePages(databaseId, { limit, cursor, filters })` → pages for **one** database.
- Keep `getGlobalDatabases()` exported and working until 3c is verified.

### MEM-3c · LAZY-LOAD CONTENT PER DATABASE 🟧 — the actual win
- On mount, load **schemas + index** only.
- A database's pages load when a view of it mounts (`DatabaseClone` / `NotionGrid`), with a loading state.
- **Dirty pages are never evicted** — unsynced edits must survive (this is what `DATA-PERSIST-INTEGRITY` protects). Keep `dirtyPageIds` resident regardless of which database is active.
- **Behind a feature flag.** Old path stays one toggle away until it's proven on real data.

### MEM-3d · SERVER-SIDE ROLLUPS 🟨
`ProjectDetailView` and the cockpit currently scan client-side pages to sum linked quotes/invoices/expenses. Replace with a tenant-scoped aggregation endpoint returning the totals. Correct regardless of MEM-3 — the client should never fetch rows to count them.

### MEM-3e · WINDOWING WITHIN A DATABASE 🟨
`db-expenses` / `db-invoices` will keep growing. Cursor pagination + virtualised rows so one large database can't recreate the problem on its own.

---

## SAFETY
- **The characterization harness is the guard.** `tests/invoice-totals.test.ts` (22) and `tests/block-tree.test.ts` (18) must stay green — they pin the money math that these code paths feed.
- **Feature flag on 3c**, removable only after a week of real use.
- **Neon snapshot before promoting** (`pd.md`).
- **Tenant checklist** — the new endpoints are additional fan-out surfaces: tenant from session only, every query scoped, index must never leak another tenant's titles.
- **No `.catch(() => [])`** on any new fetch. A failed page load shows an error state; it does not render an empty grid. *(Three of this month's worst bugs were exactly that.)*

## ACCEPTANCE — measurable, not vibes
1. **Vercel invocation memory for an invoice page drops well below the 307 MB baseline** (target: under 100 MB). This is the headline number.
2. Initial payload to the browser shrinks by an order of magnitude; check the Network tab.
3. **Relation chips, mentions, Kanban/Calendar/Gantt, PDF templates and project totals all still render** — walk the 20-file consumer list above.
4. Editing a quote for 60s produces no memory growth trend in a heap snapshot.
5. Unsynced edits survive switching database views and a reload.
6. All 55 tests green.

## ORDER
**3a → 3b → 3c** (flagged) → verify a week → **3d → 3e**.
Do **not** bundle these. 3a alone is additive and safe; 3c is the one that can break the app, and it must be reversible with a toggle.
