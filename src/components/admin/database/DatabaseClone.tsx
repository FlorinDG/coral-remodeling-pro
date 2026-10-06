"use client";

import { useOldGrid } from '@/components/admin/database/v2/grid-v2-flag';
import { surfaceKey, viewsForSurface, seedSurfaceView } from '@/lib/records/view-scope';
import { isTenantDatabase } from '@/lib/relations/resolve';
import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useDatabaseStore } from '@/components/admin/database/store';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import PageModal from '@/components/admin/database/components/PageModal';
import { useTenant } from '@/context/TenantContext';
import { useSession } from 'next-auth/react';
import { DatabaseView } from './types';
import { SERVER_PROVISIONED_BASES } from '@/lib/systemDatabases';
import { BASE_TO_KEY } from '@/lib/kernel/system-databases';
import { useLocale } from 'next-intl';
import { getGlobalDatabases } from '@/app/actions/global-databases';
import DatabaseHeader from '@/components/admin/database/components/DatabaseHeader';
import { gridAccess } from '@/lib/records/grid-access';
import { isValidated } from '@/lib/records/validation';
import { useFilteredPages } from './hooks/useFilteredPages';
import { sortPages } from '@/lib/records/view-sort';
import type { ActionId } from '@/lib/records/db-header';

const NotionGridDynamic = dynamic(
  () => import('@/components/admin/database/NotionGrid'),
  { ssr: false, loading: () => <div className="w-full h-[600px] bg-neutral-50 dark:bg-neutral-900/50 animate-pulse rounded-b-xl border-x border-b border-neutral-200 dark:border-white/10" /> }
);

const NotionGridV2Dynamic = dynamic(
  () => import('@/components/admin/database/v2/NotionGridV2'),
  { ssr: false, loading: () => <div className="w-full h-[600px] bg-neutral-50 dark:bg-neutral-900/50 animate-pulse rounded-b-xl border-x border-b border-neutral-200 dark:border-white/10" /> }
);

const KanbanViewDynamic = dynamic(
  () => import('@/components/admin/database/views/KanbanView'),
  { ssr: false, loading: () => <div className="w-full h-[600px] bg-neutral-50 dark:bg-neutral-900/50 animate-pulse rounded-b-xl border-x border-b border-neutral-200 dark:border-white/10" /> }
);

const CalendarViewDynamic = dynamic(
  () => import('@/components/admin/database/views/CalendarView'),
  { ssr: false, loading: () => <div className="w-full h-[600px] bg-neutral-50 dark:bg-neutral-900/50 animate-pulse rounded-b-xl border-x border-b border-neutral-200 dark:border-white/10" /> }
);

const TimelineViewDynamic = dynamic(
  () => import('@/components/admin/database/views/TimelineView'),
  { ssr: false, loading: () => <div className="w-full h-[600px] bg-neutral-50 dark:bg-neutral-900/50 animate-pulse rounded-b-xl border-x border-b border-neutral-200 dark:border-white/10" /> }
);

interface DatabaseCloneProps {
  databaseId: string;
  headerExtra?: React.ReactNode;
  hideViewTabs?: boolean;
  hideFooterNew?: boolean;
  defaultFilter?: { propertyId: string; value: string };
  onOpenRecord?: (pageId: string) => void;
  onAction?: (actionId: ActionId) => void;
  /**
   * VALIDATE-1: a purchase screen shows only what COUNTS ('validated') or only what waits for a person
   * ('to-validate', the "Te valideren" screen, with its own views) — lib/records/validation isValidated.
   */
  validation?: 'validated' | 'to-validate';
}

export default function DatabaseClone({ databaseId, headerExtra, hideViewTabs, hideFooterNew, defaultFilter, onOpenRecord, onAction, validation }: DatabaseCloneProps) {
  // Resolve the base locked DB name to the tenant-scoped actual ID
  const { activeModules, resolveDbId, isEnterprise } = useTenant();
  const { data: session } = useSession();
  const resolvedId = resolveDbId(databaseId);
  const database = useDatabaseStore(state => state.getDatabase(resolvedId));
  const loadDatabasePages = useDatabaseStore(state => state.loadDatabasePages);
  const isPagesLoaded = useDatabaseStore(state => state.loadedDatabaseIds.includes(resolvedId));
  const isPagesLoading = useDatabaseStore(state => state.loadingDatabaseIds.includes(resolvedId));

  useEffect(() => {
    if (resolvedId && !isPagesLoaded && !isPagesLoading) {
      loadDatabasePages(resolvedId).catch((err) => {
        console.error(`[DatabaseClone] Failed to load pages for ${resolvedId}:`, err);
      });
    }
  }, [resolvedId, isPagesLoaded, isPagesLoading, loadDatabasePages]);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const projectIdParam = searchParams.get('projectId');
  const openParam = searchParams.get('open');
  const locale = useLocale();

  const hasCRM = activeModules.includes('CRM');
  const hasDatabases = activeModules.includes('DATABASES');

  const role = database?.logicalKey || (databaseId in BASE_TO_KEY ? BASE_TO_KEY[databaseId] : null);
  const isImmutableContactDB = role === 'clients' || role === 'suppliers';
  const isLockedSchemaDB = role != null;
  const isStoreUngated = useDatabaseStore(state => state.isSchemaUngated(databaseId));
  const isSuperAdmin = (session?.user?.role as string) === 'SUPERADMIN' || (session?.user?.role as string) === 'PLATFORM_ADMIN';
  // GRID-REPLACE-1: the new grid, per database, switched on by the superadmin (also while impersonating) to try it.
  // GRID-REPLACE-4: the new grid for everyone; anyone may fall back to the old one on a database for a week.
  const [oldGrid, setOldGrid] = useOldGrid(resolvedId);
  const gridV2 = !oldGrid;
  const isUngated = isStoreUngated || isSuperAdmin;
  const access = useMemo(() => gridAccess({
    userRole: session?.user?.role as string | undefined,
    logicalKey: role,
    isEnterprise,   // the PLAN (TenantContext: ENTERPRISE / FOUNDER / CUSTOM) — ENTERPRISE is not a module
  }), [session?.user?.role, role, isEnterprise]);

    const handleOpenEditor = (pageId: string) => {
    if (role === 'quotations') {
      router.push(`/${locale}/admin/quotations/${pageId}`);
    } else {
      router.push(`/${locale}/admin/database/${databaseId}/${pageId}`);
    }
  };

  const handleCloseProjectModal = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('projectId');
    router.replace(`${pathname}?${newParams.toString()}`);
  }

  const handleCloseOpenModal = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('open');
    router.replace(`${pathname}?${newParams.toString()}`);
  }

  // Restrict to Single View "All Contacts" for Free Tier on Contact Databases
  // VIEW-SCOPE-1: this screen's own views (a screen with a fixed filter — credit notes, proformas, a project type —
  // never shares views, and so never filters or sorts, with another screen of the same database).
  const surface = validation === 'to-validate' ? [surfaceKey(defaultFilter), 'to-validate'].filter(Boolean).join('|') : surfaceKey(defaultFilter);
  const supportedViews = useMemo(() => {
    if (!database) return [];
    let views = viewsForSurface(database.views, surface);
    if (isImmutableContactDB && !hasCRM) {
      if (views.length > 0) {
        views = [views.find(v => v.name.toLowerCase().includes('all')) || views[0]];
      }
    }
    return views;
  }, [database, isImmutableContactDB, hasCRM, surface]);

  const updateView = useDatabaseStore(state => state.updateView);
  const addView = useDatabaseStore(state => state.addView);

  const handleAddView = (type: 'table' | 'board' | 'calendar' | 'timeline') => {
    const names = { table: 'Table', board: 'Board', calendar: 'Calendar', timeline: 'Timeline' };
    addView(resolvedId, {
      name: names[type],
      type,
      ...(surface ? { surface } : {}),
      config: type === 'board' ? { groupByPropertyId: 'status' } : {}
    });
  };

  const handleSetViewType = (viewId: string, type: 'table' | 'board' | 'calendar' | 'timeline') => {
    const updates: Partial<DatabaseView> = { type };
    if (type === 'board') {
      updates.config = { groupByPropertyId: 'status' };
    } else {
      updates.config = {};
    }
    updateView(resolvedId, viewId, updates);
  };

  const handleDeleteView = (viewId: string) => {
    if (supportedViews.length <= 1) {
      return;
    }
    if (window.confirm("Are you sure you want to delete this view?")) {
      if (viewId === activeViewId) {
        const otherView = supportedViews.find(v => v.id !== viewId);
        if (otherView) {
          setActiveViewId(otherView.id);
        }
      }
      useDatabaseStore.getState().deleteView(resolvedId, viewId);
    }
  };

  // Initialize synchronously to avoid a second re-render after mounting
  const [activeViewId, setActiveViewId] = useState<string | null>(() => {
    const own = viewsForSurface(database?.views, surface);
    return own.length > 0 ? own[0].id : null;
  });

  const activeView = supportedViews.find(v => v.id === activeViewId) || supportedViews[0];

  // C8: Precompute filtered and sorted pages once, shared by DatabaseHeader and grids
  const allDatabases = useDatabaseStore(state => state.databases);
  const filteredPages = useFilteredPages({
    database,
    activeView: activeView ?? undefined,
    hardFilter: defaultFilter,
    allDatabases,
  });
  const screenPages = useMemo(() => (validation ? filteredPages.filter(p => isValidated(p.properties) === (validation === 'validated')) : filteredPages), [filteredPages, validation]);
  const sortedPages = useMemo(() => sortPages(screenPages, activeView?.sorts ?? [], Date.now()), [screenPages, activeView?.sorts]);

  // C7: Shared row selection across DatabaseHeader and grids
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setSelectedRowIds(new Set());
  }, [activeViewId, resolvedId]);

  // A screen without views of its own gets one, once: the base layout without the base view's filters/sorts.
  useEffect(() => {
    if (!database || !surface) return;
    if (viewsForSurface(database.views, surface).length > 0) return;
    const seeded = seedSurfaceView(database.views, surface, crypto.randomUUID());
    if (seeded) useDatabaseStore.getState().addView(resolvedId, seeded);
  }, [database, surface, resolvedId]);

  // Keep activeViewId on one of THIS screen's views (deleted, not yet seeded, or another screen's)
  useEffect(() => {
    if (!database) return;
    if (!activeViewId || !supportedViews.some(v => v.id === activeViewId)) {
      if (supportedViews.length > 0) setActiveViewId(supportedViews[0].id);
    }
  }, [database, activeViewId, supportedViews]);

  // Auto-instantiate uninitialized databases instead of showing a manual button
  const [autoInitializing, setAutoInitializing] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Wait for Zustand store hydration from IndexedDB before auto-creating
  useEffect(() => {
    if (useDatabaseStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useDatabaseStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    return unsub;
  }, []);

  // ── View defaults on first open (views only — never fields). The fields of a system database are the KERNEL's,
  // reconciled on the server at every layout load (KERN-SCHEMA-1); the browser-side copy of that enforcement that
  // lived here (missing canonical fields, the accountantExportedAt type) is deleted — DB-DEF-1, 2026-10-05.
  useEffect(() => {
    if (!hydrated || !database) return;

    // Seed default hidden columns ONCE per view, flagging defaultPropsSeeded: true
    // on both paths (seeded vs already configured) so absence of state is never re-inferred.
    // Skips entirely if all views already have defaultPropsSeeded: true (no gratuitous syncDb/updatedAt bump).
    if (database.views && database.views.length > 0) {
      const unseededViews = database.views.filter(v => !v.defaultPropsSeeded);
      if (unseededViews.length > 0) {
        let hiddenPropsForDb: string[] = [];
        if (isTenantDatabase(resolvedId, 'db-expenses')) {
          hiddenPropsForDb = ['betreft', 'source', 'peppolDocId'];
        } else if (isTenantDatabase(resolvedId, 'db-articles')) {
          hiddenPropsForDb = ['prop-art-brand', 'prop-art-packaging', 'prop-art-coverage', 'prop-art-pcs-pack', 'prop-art-min-order', 'prop-art-variants'];
        } else if (isTenantDatabase(resolvedId, 'db-1')) {
          hiddenPropsForDb = [
            'prop-admin-department', 'prop-admin-recurring', 'prop-admin-compliance-date',
            'prop-bizdev-opportunity-value', 'prop-bizdev-win-probability', 'prop-bizdev-stage',
            'prop-bizdev-source', 'prop-bizdev-crm-link', 'prop-linked-projects',
            'prop-rate-person-hour', 'prop-rate-equipment-hour', 'prop-actual-equipment-hours',
          ];
        }

        const updatedViews = database.views.map(view => {
          if (view.defaultPropsSeeded) return view;

          const isUnconfigured = !view.propertiesState || view.propertiesState.length === 0;
          if (isUnconfigured && hiddenPropsForDb.length > 0) {
            const initialStates = hiddenPropsForDb.map(propId => ({ propertyId: propId, hidden: true }));
            return {
              ...view,
              defaultPropsSeeded: true,
              propertiesState: initialStates,
            };
          }

          // View is already configured or DB requires no default hiding: flag as seeded
          return {
            ...view,
            defaultPropsSeeded: true,
          };
        });

        useDatabaseStore.getState().updateDatabase(resolvedId, { views: updatedViews });
      }
    }

    // (2026-10-05, Florin "d — go") The client-side data migrations that ran here on every mount are deleted:
    // they WROTE records from the browser (project type → Operations; invoice / expense docType guessed from a
    // "CN-" title; every expense without a review status → "Goedgekeurd", i.e. auto-approved past the inbox) and
    // re-asserted schema options the kernel schema already carries (system-schemas.ts). Data repairs go through
    // the SQL procedure (.agents/workflows/sql), schema through the kernel — never a browser on page load.

    // VALIDATE-1: the purchase-invoice "Inbox" VIEW is no longer seeded here — the "Te valideren" SCREEN replaced it
    // (.agents/workflows/sql/expenses-inbox-view-remove.sql removes the old view from the database definitions).
  }, [hydrated, database, resolvedId]);


  // ── Self-healing: if the store doesn't have this DB after hydration,
  // fetch ALL databases from the server and re-hydrate the store.
  // This covers the case where the layout's getGlobalDatabases() failed
  // or was too slow — the component rescues itself instead of spinning forever.
  const [clientFetchAttempted, setClientFetchAttempted] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (database || autoInitializing || clientFetchAttempted) return;

    // For server-provisioned databases, NEVER auto-create locally.
    // Instead, fetch from the server — they're guaranteed to exist in Postgres.
    if (SERVER_PROVISIONED_BASES.has(databaseId)) {
      setClientFetchAttempted(true);
      console.log(`[DatabaseClone] ${resolvedId} missing from store — fetching from server`);
      getGlobalDatabases().then(serverDbs => {
        if (serverDbs.length > 0) {
          console.log(`[DatabaseClone] Got ${serverDbs.length} DBs from server — hydrating store`);
          useDatabaseStore.getState().hydrateDatabases(serverDbs);
        } else {
          console.warn('[DatabaseClone] Server returned 0 databases');
        }
      }).catch(e => console.error('[DatabaseClone] Server fetch failed:', e));
      return;
    }
  }, [database, databaseId, resolvedId, autoInitializing, hydrated, clientFetchAttempted]);

  if (!database || (!isPagesLoaded && isPagesLoading && (!database.pages || database.pages.length === 0))) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-white/10 p-8 text-center space-y-4 m-6">
        <div className="w-8 h-8 border-2 border-neutral-300 border-t-[var(--brand-color,#d35400)] rounded-full animate-spin" />
        <p className="text-sm text-neutral-500 font-medium">{!database ? 'Initializing workspace...' : 'Loading database records...'}</p>
      </div>
    );
  }

  // Guard: database exists but has no views yet (newly provisioned stub with views: []).
  // Create a default table view and wait for it to be stored before rendering.
  if (!activeView) {
    // A screen with base views to start from is seeded by the effect above (VIEW-SCOPE-1) — not here.
    if (!autoInitializing && !(surface && database.views.length > 0)) {
      setAutoInitializing(true);
      useDatabaseStore.getState().addView(resolvedId, { name: 'All', type: 'table', propertiesState: [], ...(surface ? { surface } : {}) });
      // addView is synchronous in the store — next render will have a view.
      setAutoInitializing(false);
    }
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-white/10 p-8 text-center space-y-4 m-6">
        <div className="w-8 h-8 border-2 border-neutral-300 border-t-[var(--brand-color,#d35400)] rounded-full animate-spin" />
        <p className="text-sm text-neutral-500 font-medium">Initializing view...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full min-w-0 min-h-0 bg-transparent relative">
      <DatabaseHeader
        database={database}
        activeView={activeView}
        supportedViews={supportedViews}
        activeViewId={activeViewId}
        onSelectView={setActiveViewId}
        onAddView={handleAddView}
        onRenameView={(viewId, name) => updateView(resolvedId, viewId, { name })}
        onSetViewType={handleSetViewType}
        onDeleteView={handleDeleteView}
        headerExtra={headerExtra}
        hideViewTabs={hideViewTabs}
        surfaceKey={surface}
        userRole={session?.user?.role as string | undefined}
        isSuperadmin={isSuperAdmin}
        isImpersonating={!!(session?.user as { isImpersonating?: boolean } | undefined)?.isImpersonating}
        access={access}
        isLockedSchema={isLockedSchemaDB && !isUngated && !hasDatabases}
        isUngated={isUngated}
        hasDatabases={hasDatabases}
        oldGrid={oldGrid}
        onToggleOldGrid={() => setOldGrid(!oldGrid)}
        onAction={onAction}
        hardFilter={defaultFilter}
        sortedPages={sortedPages}
        selectedRowIds={selectedRowIds}
      />
      <div 
        className={`flex-1 min-w-0 min-h-0 w-full h-full relative ${projectIdParam || openParam ? 'pointer-events-none' : ''}`}
        inert={projectIdParam || openParam ? true : undefined}
      >
        {activeView.type === 'table' && gridV2 && (
          <NotionGridV2Dynamic databaseId={database.id} viewId={activeView.id} validationScreen={validation} hideToolbar hardFilter={defaultFilter} onOpenRecord={onOpenRecord} hideFooterNew={!!hideFooterNew}
            lockedSchema={isLockedSchemaDB && !isUngated && !hasDatabases}
            preventDelete={role === 'invoices' ? (row) => { const s = String((row?.properties as Record<string, unknown>)?.status || 'opt-draft'); return s !== 'opt-draft'; } : undefined}
            selected={selectedRowIds}
            onSelectedChange={setSelectedRowIds}
            sortedPages={sortedPages}
          />
        )}
        {activeView.type === 'table' && !gridV2 && <NotionGridDynamic databaseId={database.id} viewId={activeView.id} hideHeader lockedSchema={isLockedSchemaDB && !isUngated && !hasDatabases} preventDelete={role === 'invoices' ? (row: Record<string, unknown>) => { const s = String((row?.properties as Record<string, unknown>)?.status || row?.status || 'opt-draft'); return s !== 'opt-draft'; } : undefined} hideFooterNew={!!hideFooterNew} hardFilter={defaultFilter} onOpenRecord={onOpenRecord} />}
        {activeView.type === 'board' && <KanbanViewDynamic databaseId={database.id} viewId={activeView.id} hideHeader hardFilter={defaultFilter} onOpenRecord={onOpenRecord} onOpenEditor={handleOpenEditor} />}
        {activeView.type === 'calendar' && <CalendarViewDynamic databaseId={database.id} viewId={activeView.id} hideHeader />}
        {activeView.type === 'timeline' && <TimelineViewDynamic databaseId={database.id} viewId={activeView.id} hideHeader />}
      </div>

      {projectIdParam && (
        <PageModal
          databaseId={database.id}
          pageId={projectIdParam}
          onClose={handleCloseProjectModal}
        />
      )}

      {openParam && (
        <PageModal
          databaseId={database.id}
          pageId={openParam}
          onClose={handleCloseOpenModal}
        />
      )}
    </div>
  );
}
