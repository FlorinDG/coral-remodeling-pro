"use client";

import { surfaceKey, viewsForSurface, seedSurfaceView } from '@/lib/records/view-scope';
import { isTenantDatabase } from '@/lib/relations/resolve';
import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useDatabaseStore } from '@/components/admin/database/store';
import { LayoutGrid, Table2, Calendar as CalendarIcon, Plus, GanttChartSquare, Settings, Clock, ChevronDown, Edit, Trash2 } from 'lucide-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import PageModal from '@/components/admin/database/components/PageModal';
import { useTenant } from '@/context/TenantContext';
import { useSession } from 'next-auth/react';
import { Property, DatabaseView } from './types';
import { SERVER_PROVISIONED_BASES } from '@/lib/systemDatabases';
import { BASE_TO_KEY } from '@/lib/kernel/system-databases';
import { t } from '@/lib/document-i18n';
import { useLocale } from 'next-intl';
import { getGlobalDatabases } from '@/app/actions/global-databases';

const NotionGridDynamic = dynamic(
  () => import('@/components/admin/database/NotionGrid'),
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
}

export default function DatabaseClone({ databaseId, headerExtra, hideViewTabs, hideFooterNew, defaultFilter, onOpenRecord }: DatabaseCloneProps) {
  // Resolve the base locked DB name to the tenant-scoped actual ID
  const { activeModules, resolveDbId } = useTenant();
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
  const isUngated = isStoreUngated || isSuperAdmin;

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
  const surface = surfaceKey(defaultFilter);
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

  // Renaming state
  const [renamingViewId, setRenamingViewId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const [showViewTypeSelector, setShowViewTypeSelector] = useState(false);
  const [selectorPosition, setSelectorPosition] = useState({ top: 0, left: 0 });

  // View context menu state
  const [viewMenuOpenId, setViewMenuOpenId] = useState<string | null>(null);
  const [viewMenuPosition, setViewMenuPosition] = useState({ top: 0, left: 0 });
  const viewMenuRef = React.useRef<HTMLDivElement>(null);

  const updateView = useDatabaseStore(state => state.updateView);
  const addView = useDatabaseStore(state => state.addView);

  const handleRenameStart = (viewId: string, currentName: string) => {
    setRenamingViewId(viewId);
    setRenamingValue(currentName);
  };

  const handleRenameSave = () => {
    if (renamingViewId && renamingValue.trim()) {
      updateView(resolvedId, renamingViewId, { name: renamingValue.trim() });
    }
    setRenamingViewId(null);
  };

  const handleAddView = (type: 'table' | 'board' | 'calendar' | 'timeline') => {
    const names = { table: 'Table', board: 'Board', calendar: 'Calendar', timeline: 'Timeline' };
    addView(resolvedId, {
      name: names[type],
      type,
      ...(surface ? { surface } : {}),
      config: type === 'board' ? { groupByPropertyId: 'status' } : {}
    });
    setShowViewTypeSelector(false);
  };

  const handleSetViewType = (viewId: string, type: 'table' | 'board' | 'calendar' | 'timeline') => {
    const updates: Partial<DatabaseView> = { type };
    if (type === 'board') {
      updates.config = { groupByPropertyId: 'status' };
    } else {
      updates.config = {};
    }
    updateView(resolvedId, viewId, updates);
    setViewMenuOpenId(null);
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
      setViewMenuOpenId(null);
    }
  };

  const handleOpenViewMenu = (e: React.MouseEvent, viewId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    let top = 0;
    let left = 0;
    if (e.type === 'contextmenu') {
      top = e.clientY + 5;
      left = e.clientX;
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      top = rect.bottom + 5;
      left = rect.left;
    }
    
    setViewMenuOpenId(viewId);
    setViewMenuPosition({ top, left });
  };

  // Initialize synchronously to avoid a second re-render after mounting
  const [activeViewId, setActiveViewId] = useState<string | null>(() => {
    const own = viewsForSurface(database?.views, surface);
    return own.length > 0 ? own[0].id : null;
  });

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

  const viewSelectorRef = React.useRef<HTMLDivElement>(null);
  const addViewButtonRef = React.useRef<HTMLButtonElement>(null);

  // Close view selector on click outside
  useEffect(() => {
    if (!showViewTypeSelector) return;
    const handleClick = (e: MouseEvent) => {
      // In a Portal, we need to check if the click was inside the portal content
      if (viewSelectorRef.current?.contains(e.target as Node)) return;
      if (addViewButtonRef.current?.contains(e.target as Node)) return;
      setShowViewTypeSelector(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showViewTypeSelector]);

  // Close view context menu on click outside
  useEffect(() => {
    if (!viewMenuOpenId) return;
    const handleClick = (e: MouseEvent) => {
      if (viewMenuRef.current?.contains(e.target as Node)) return;
      setViewMenuOpenId(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [viewMenuOpenId]);

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

    if (isTenantDatabase(resolvedId, 'db-expenses')) {
      const store = useDatabaseStore.getState();
      // Migrate: add Inbox view if missing
      const hasInbox = database.views.some(v => v.id === 'vw-expenses-inbox');
      if (!hasInbox) {
        store.addView(resolvedId, {
          id: 'vw-expenses-inbox',
          name: 'Inbox / Te verwerken',
          type: 'table',
          filterGroups: [{
            id: 'fg-inbox',
            operator: 'and',
            filters: [{
              id: 'flt-not-approved',
              propertyId: 'reviewStatus',
              operator: 'does_not_equal',
              value: 'Goedgekeurd'
            }]
          }]
        });
      }
    }
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

  const activeView = supportedViews.find(v => v.id === activeViewId) || supportedViews[0];

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

  const getViewIcon = (type: string) => {
    switch (type) {
      case 'table': return <Table2 className="w-4 h-4" />;
      case 'board': return <LayoutGrid className="w-4 h-4" />;
      case 'calendar': return <CalendarIcon className="w-4 h-4" />;
      case 'timeline': return <Clock className="w-4 h-4" />;
      default: return <Table2 className="w-4 h-4" />;
    }
  };

  const headerTabs = (
    <>
      {headerExtra}

      {/* EDIT SCHEMA FIELDS GLOBAL BUTTON — Shown for non-system DBs or ungated system DBs */}
      {(!isLockedSchemaDB || isUngated) && (
        <Link href={`/admin/settings/databases/${resolvedId}`} className="flex items-center gap-1.5 text-neutral-500 hover:text-[var(--brand-color,#d35400)] px-3 py-1 mx-2 mb-[5px] bg-neutral-100 dark:bg-white/5 hover:bg-[var(--brand-color,#d35400)]/10 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors shrink-0">
          <Settings className="w-3.5 h-3.5" /> {isUngated ? 'Edit Custom Fields' : 'Edit Schema Fields'}
        </Link>
      )}

      {(!hideViewTabs && supportedViews.length > 0) && (
        <div className="flex items-end gap-1 overflow-x-auto no-scrollbar h-full pt-1">
          {supportedViews.map((view) => {
            const isActive = view.id === activeViewId;
            const isRenaming = renamingViewId === view.id;

            return (
              <div key={view.id} className="relative flex items-center group">
                {isRenaming ? (
                  <div className="flex items-center bg-white dark:bg-neutral-800 rounded-t-lg px-2 py-1 mb-[-1px] border-b-2 border-orange-500 shadow-sm z-10">
                    <input
                      autoFocus
                      className="text-sm font-semibold bg-transparent outline-none w-24 text-neutral-900 dark:text-white"
                      value={renamingValue}
                      onChange={(e) => setRenamingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSave();
                        if (e.key === 'Escape') setRenamingViewId(null);
                      }}
                      onBlur={handleRenameSave}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveViewId(view.id)}
                    onDoubleClick={() => handleRenameStart(view.id, view.name)}
                    onContextMenu={(e) => handleOpenViewMenu(e, view.id)}
                    className={`flex items-center gap-2 pl-3 pr-2 py-2.5 pb-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap -mb-[1px] ${isActive
                      ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                      : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                      }`}
                  >
                    {getViewIcon(view.type)}
                    <span>{view.name}</span>
                    <span
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleOpenViewMenu(e, view.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 inline-flex items-center justify-center"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </span>
                  </button>
                )}
              </div>
            );
          })}

          {(hasDatabases) && (
            <div className="relative">
              <button
                ref={addViewButtonRef}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Plus button clicked');
                  if (addViewButtonRef.current) {
                    const rect = addViewButtonRef.current.getBoundingClientRect();
                    setSelectorPosition({ top: rect.bottom + 5, left: rect.left });
                  }
                  setShowViewTypeSelector(prev => !prev);
                }}
                className={`p-1.5 ml-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors mb-1.5 rounded-md ${showViewTypeSelector ? 'bg-neutral-100 dark:bg-white/10' : ''}`}
                title="Add View"
              >
                <Plus className="w-4 h-4" />
              </button>

              {showViewTypeSelector && typeof document !== 'undefined' && createPortal(
                <div 
                  ref={viewSelectorRef}
                  style={{ 
                    position: 'fixed', 
                    top: selectorPosition.top, 
                    left: selectorPosition.left,
                    zIndex: 9999
                  }}
                  className="w-44 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-2xl p-1.5 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 ring-4 ring-black/5"
                >
                  <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-100 dark:border-white/5 mb-1">
                    Add View Type
                  </div>
                  <button onClick={() => handleAddView('table')} className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg transition-colors text-left">
                    <Table2 className="w-4 h-4" /> Table
                  </button>
                  <button onClick={() => handleAddView('board')} className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg transition-colors text-left">
                    <LayoutGrid className="w-4 h-4" /> Board
                  </button>
                  <button onClick={() => handleAddView('calendar')} className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg transition-colors text-left">
                    <CalendarIcon className="w-4 h-4" /> Calendar
                  </button>
                  <button onClick={() => handleAddView('timeline')} className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg transition-colors text-left">
                    <GanttChartSquare className="w-4 h-4" /> Timeline
                  </button>
                </div>,
                document.body
              )}
            </div>
          )}
        </div>
      )}

      {viewMenuOpenId && typeof document !== 'undefined' && (() => {
        const targetView = supportedViews.find(v => v.id === viewMenuOpenId);
        if (!targetView) return null;
        return createPortal(
          <div
            ref={viewMenuRef}
            style={{
              position: 'fixed',
              top: viewMenuPosition.top,
              left: viewMenuPosition.left,
              zIndex: 9999
            }}
            className="w-48 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-2xl p-1.5 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 ring-4 ring-black/5"
          >
            <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-100 dark:border-white/5 mb-1">
              View Options
            </div>
            
            <button
              onClick={() => {
                handleRenameStart(targetView.id, targetView.name);
                setViewMenuOpenId(null);
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg transition-colors text-left"
            >
              <Edit className="w-4 h-4 text-neutral-400" /> Rename View
            </button>
            
            <div className="mt-1.5 border-t border-neutral-100 dark:border-white/5 pt-1.5">
              <div className="px-3 py-1 text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                Change Type To
              </div>
              <button
                onClick={() => handleSetViewType(targetView.id, 'table')}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-lg transition-colors text-left ${
                  targetView.type === 'table'
                    ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5'
                }`}
              >
                <Table2 className="w-4 h-4" /> Table
              </button>
              <button
                onClick={() => handleSetViewType(targetView.id, 'board')}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-lg transition-colors text-left ${
                  targetView.type === 'board'
                    ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5'
                }`}
              >
                <LayoutGrid className="w-4 h-4" /> Board
              </button>
              <button
                onClick={() => handleSetViewType(targetView.id, 'calendar')}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-lg transition-colors text-left ${
                  targetView.type === 'calendar'
                    ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5'
                }`}
              >
                <CalendarIcon className="w-4 h-4" /> Calendar
              </button>
              <button
                onClick={() => handleSetViewType(targetView.id, 'timeline')}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-lg transition-colors text-left ${
                  targetView.type === 'timeline'
                    ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5'
                }`}
              >
                <Clock className="w-4 h-4" /> Timeline
              </button>
            </div>
            
            {supportedViews.length > 1 && (
              <div className="mt-1.5 border-t border-neutral-100 dark:border-white/5 pt-1.5">
                <button
                  onClick={() => handleDeleteView(targetView.id)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors text-left"
                >
                  <Trash2 className="w-4 h-4 text-red-500" /> Delete View
                </button>
              </div>
            )}
          </div>,
          document.body
        );
      })()}
    </>
  );

  return (
    <div className="flex flex-col w-full h-full min-w-0 min-h-0 bg-transparent relative">
      <div 
        className={`flex-1 min-w-0 min-h-0 w-full h-full relative ${projectIdParam || openParam ? 'pointer-events-none' : ''}`}
        inert={projectIdParam || openParam ? true : undefined}
      >
        {activeView.type === 'table' && <NotionGridDynamic databaseId={database.id} viewId={activeView.id} renderTabs={headerTabs} lockedSchema={isLockedSchemaDB && !isUngated && !hasDatabases} preventDelete={role === 'invoices' ? (row: Record<string, unknown>) => { const s = String((row?.properties as Record<string, unknown>)?.status || row?.status || 'opt-draft'); return s !== 'opt-draft'; } : undefined} hideFooterNew={!!hideFooterNew} hardFilter={defaultFilter} onOpenRecord={onOpenRecord} />}
        {activeView.type === 'board' && <KanbanViewDynamic databaseId={database.id} viewId={activeView.id} renderTabs={headerTabs} hardFilter={defaultFilter} onOpenRecord={onOpenRecord} onOpenEditor={handleOpenEditor} />}
        {activeView.type === 'calendar' && <CalendarViewDynamic databaseId={database.id} viewId={activeView.id} renderTabs={headerTabs} />}
        {activeView.type === 'timeline' && <TimelineViewDynamic databaseId={database.id} viewId={activeView.id} renderTabs={headerTabs} />}
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
