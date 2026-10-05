/**
 * VIEW-SCOPE-1 · which views a screen shows. Pure, tested (tests/view-scope.test.ts).
 *
 * Florin 2026-10-05: "separate the scope of db options (filter, sort, etc) by view. with three views, one filter
 * affects them all and defeats the purpose of views." Filters and sorts were already stored per view — but every
 * SCREEN of one database (Facturen / Creditnota's / Proforma's on the invoices database; purchase invoices /
 * credit notes; each project-type tab) listed the SAME views and opened the first: a filter set on one screen
 * filtered the others. A screen now has its OWN views, keyed by its fixed filter.
 */

export interface ScopedView { id: string; surface?: string | null; filters?: unknown[]; sorts?: unknown[] }

/** A screen's key: its fixed filter ("docType=opt-credit-note"); none = the database's own screen. */
export function surfaceKey(fixedFilter: { propertyId: string; value: unknown } | null | undefined): string | null {
    if (!fixedFilter?.propertyId) return null;
    return `${fixedFilter.propertyId}=${String(fixedFilter.value ?? '')}`;
}

/** The views of a screen — never another screen's. */
export function viewsForSurface<V extends ScopedView>(views: V[] | null | undefined, surface: string | null): V[] {
    return (views || []).filter(v => (v.surface || null) === surface);
}

/**
 * The first view of a screen that has none yet: the database's own first view (columns, layout) WITHOUT its
 * filters and sorts — those belong to the view they were set on. Null when there is nothing to start from.
 */
export function seedSurfaceView<V extends ScopedView>(views: V[] | null | undefined, surface: string, newId: string): V | null {
    const base = viewsForSurface(views, null)[0] ?? (views || [])[0];
    if (!base) return null;
    return { ...base, id: newId, surface, filters: [], sorts: [] };
}

// ── Decision A (Florin 2026-10-05): the SCHEMA decides which fields exist; each VIEW decides order and visibility ──

export interface ViewPropertyState { propertyId: string; hidden?: boolean; order?: number; width?: number }
export interface ViewWithState { id: string; name?: string; surface?: string | null; propertiesState?: ViewPropertyState[] }

/** The views (names) in which a field is hidden — shown next to the field on the schema page. */
export function hiddenIn(views: ViewWithState[] | null | undefined, propertyId: string): string[] {
    return (views || []).filter(v => (v.propertiesState || []).some(ps => ps.propertyId === propertyId && ps.hidden)).map(v => v.name || v.id);
}

/**
 * A view's column state in the SCHEMA's order — "apply the schema order to this view". Hidden flags and any other
 * per-column state (width…) are kept; fields the view did not know yet come in visible.
 */
export function schemaOrderFor(view: ViewWithState, schemaIds: string[]): ViewPropertyState[] {
    const byId = new Map((view.propertiesState || []).map(ps => [ps.propertyId, ps]));
    return schemaIds.map((id, i) => ({ ...(byId.get(id) || {}), propertyId: id, hidden: byId.get(id)?.hidden ?? false, order: i }));
}

/** Field types that start HIDDEN in a view until the view shows them (COMMENTS-1: "usage by making it available in the view"). */
export const HIDDEN_BY_DEFAULT_TYPES: ReadonlySet<string> = new Set(['comments']);

/** Is this field hidden in this view? The view's own choice wins; without one, the type's default. */
export function isHiddenInView(state: { hidden?: boolean } | undefined, prop: { type?: string }): boolean {
    return state?.hidden ?? HIDDEN_BY_DEFAULT_TYPES.has(prop.type || '');
}
