"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useDatabaseStore } from '@/components/admin/database/store';
import { LayoutGrid, Table2, Calendar as CalendarIcon, Plus, GanttChartSquare, Settings, Database as DatabaseIcon } from 'lucide-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import PageModal from '@/components/admin/database/components/PageModal';
import { useTenant } from '@/context/TenantContext';

const NotionGridDynamic = dynamic(
  () => import('@/components/admin/database/NotionGrid'),
  { ssr: false, loading: () => <div className="w-full h-[600px] bg-neutral-50 dark:bg-neutral-900/50 animate-pulse rounded-b-xl border-x border-b border-neutral-200 dark:border-white/10" /> }
);

const BoardViewDynamic = dynamic(
  () => import('@/components/admin/database/views/BoardView'),
  { ssr: false, loading: () => <div className="w-full h-[600px] bg-neutral-50 dark:bg-neutral-900/50 animate-pulse rounded-b-xl border-x border-b border-neutral-200 dark:border-white/10" /> }
);

const CalendarViewDynamic = dynamic(
  () => import('@/components/admin/database/views/CalendarView'),
  { ssr: false, loading: () => <div className="w-full h-[600px] bg-neutral-50 dark:bg-neutral-900/50 animate-pulse rounded-b-xl border-x border-b border-neutral-200 dark:border-white/10" /> }
);

const GanttViewDynamic = dynamic(
  () => import('@/components/admin/database/views/GanttView'),
  { ssr: false, loading: () => <div className="w-full h-[600px] bg-neutral-50 dark:bg-neutral-900/50 animate-pulse rounded-b-xl border-x border-b border-neutral-200 dark:border-white/10" /> }
);

interface DatabaseCloneProps {
  databaseId: string;
  headerExtra?: React.ReactNode;
  hideViewTabs?: boolean;
}

export default function DatabaseClone({ databaseId, headerExtra, hideViewTabs }: DatabaseCloneProps) {
  const database = useDatabaseStore(state => state.getDatabase(databaseId));
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const projectIdParam = searchParams.get('projectId');

  const { activeModules } = useTenant();
  const hasCRM = activeModules.includes('CRM');
  const hasDatabases = activeModules.includes('DATABASES');

  const isImmutableContactDB = databaseId === 'db-clients' || databaseId === 'db-suppliers';

  const handleCloseProjectModal = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('projectId');
    router.replace(`${pathname}?${newParams.toString()}`);
  }

  // Initialize synchronously to avoid a second re-render after mounting
  const [activeViewId, setActiveViewId] = useState<string | null>(() => {
    const supportedViews = database?.views?.filter(v => v.type !== 'timeline') || [];
    return supportedViews.length > 0 ? supportedViews[0].id : null;
  });

  // Keep activeViewId synced if the current view is somehow deleted
  useEffect(() => {
    if (database && activeViewId) {
      const supportedViews = database.views.filter(v => v.type !== 'timeline');
      const viewExists = supportedViews.some(v => v.id === activeViewId);
      if (!viewExists && supportedViews.length > 0) {
        setActiveViewId(supportedViews[0].id);
      }
    }
  }, [database, activeViewId]);

  // Auto-instantiate uninitialized databases instead of showing a manual button
  const [autoInitializing, setAutoInitializing] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Wait for Zustand store hydration from IndexedDB before auto-creating
  useEffect(() => {
    const unsub = useDatabaseStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    // If already hydrated (store was loaded before this component mounted)
    if (useDatabaseStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) return; // Don't act before store is loaded from IndexedDB
    if (database || autoInitializing) return; // Already exists or already creating

    // Double-check the store directly (in case of race condition)
    const existing = useDatabaseStore.getState().getDatabase(databaseId);
    if (existing) return;

    setAutoInitializing(true);
    let parsedName = 'New Workspace';
    if (databaseId === 'db-quotations') parsedName = 'Quotations';
    if (databaseId === 'db-articles') parsedName = 'Material Articles';
    if (databaseId === 'db-bestek') parsedName = 'Bestek Templates';
    if (databaseId === 'db-1') parsedName = 'Projects';

    let customProps = undefined;
    if (databaseId === 'db-quotations') {
      customProps = [
        { id: 'title', name: 'Quote Number', type: 'text' },
        { id: 'client', name: 'Client', type: 'relation', config: { targetDatabaseId: 'db-clients' } },
        { id: 'project', name: 'Project', type: 'relation', config: { targetDatabaseId: 'db-1' } },
        { id: 'status', name: 'Status', type: 'select', config: { options: [{ id: 'opt1', value: 'DRAFT', color: 'gray' }, { id: 'opt2', value: 'ACCEPTED', color: 'green' }, { id: 'opt3', value: 'REJECTED', color: 'red' }] } },
        { id: 'date', name: 'Date', type: 'date' },
        { id: 'betreft', name: 'Betreft', type: 'text' }
      ];
    }

    useDatabaseStore.getState().createDatabase(parsedName, undefined, databaseId, customProps as any);
  }, [database, databaseId, autoInitializing, hydrated]);

  if (!database) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-white/10 p-8 text-center space-y-4 m-6">
        <div className="w-8 h-8 border-2 border-neutral-300 border-t-[var(--brand-color,#d35400)] rounded-full animate-spin" />
        <p className="text-sm text-neutral-500 font-medium">Initializing workspace...</p>
      </div>
    );
  }

  // Restrict to Single View "All Contacts" for Free Tier on Contact Databases
  let supportedViews = database.views.filter(v => v.type !== 'timeline');
  if (isImmutableContactDB && !hasCRM) {
    if (supportedViews.length > 0) {
      supportedViews = [supportedViews.find(v => v.name.toLowerCase().includes('all')) || supportedViews[0]];
    }
  }

  const activeView = supportedViews.find(v => v.id === activeViewId) || supportedViews[0] || database.views[0];

  const getViewIcon = (type: string) => {
    switch (type) {
      case 'table': return <Table2 className="w-4 h-4" />;
      case 'board': return <LayoutGrid className="w-4 h-4" />;
      case 'calendar': return <CalendarIcon className="w-4 h-4" />;
      case 'timeline': return <GanttChartSquare className="w-4 h-4" />;
      default: return <Table2 className="w-4 h-4" />;
    }
  };

  const headerTabs = (
    <>
      {headerExtra}

      {/* EDIT SCHEMA FIELDS GLOBAL BUTTON */}
      {(!isImmutableContactDB || hasDatabases) && (
        <Link href={`/admin/settings/databases/${databaseId}`} className="flex items-center gap-1.5 text-neutral-500 hover:text-[var(--brand-color,#d35400)] px-3 py-1 mx-2 mb-[5px] bg-neutral-100 dark:bg-white/5 hover:bg-[var(--brand-color,#d35400)]/10 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors shrink-0">
          <Settings className="w-3.5 h-3.5" /> Edit Schema Fields
        </Link>
      )}

      {(!hideViewTabs && supportedViews.length > 0) && (
        <div className="flex items-end gap-1 overflow-x-auto no-scrollbar h-full pt-1">
          {supportedViews.map((view) => {
            const isActive = view.id === activeViewId;
            return (
              <button
                key={view.id}
                onClick={() => setActiveViewId(view.id)}
                className={`flex items-center gap-2 px-3 py-2.5 pb-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap -mb-[1px] ${isActive
                  ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                  }`}
              >
                {getViewIcon(view.type)}
                {view.name}
              </button>
            );
          })}

          {(hasDatabases) && (
            <button
              className="p-1.5 ml-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors mb-1.5"
              title="Add View"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="flex flex-col w-full h-full min-w-0 min-h-0 bg-transparent relative">
      <div className="flex-1 min-w-0 min-h-0 w-full h-full overflow-hidden relative">
        {activeView.type === 'table' && <NotionGridDynamic databaseId={database.id} viewId={activeView.id} renderTabs={headerTabs} />}
        {activeView.type === 'board' && <BoardViewDynamic databaseId={database.id} viewId={activeView.id} renderTabs={headerTabs} />}
        {activeView.type === 'calendar' && <CalendarViewDynamic databaseId={database.id} viewId={activeView.id} renderTabs={headerTabs} />}
        {activeView.type === 'timeline' && <GanttViewDynamic databaseId={database.id} viewId={activeView.id} renderTabs={headerTabs} />}
      </div>

      {projectIdParam && (
        <PageModal
          databaseId={database.id}
          pageId={projectIdParam}
          onClose={handleCloseProjectModal}
        />
      )}
    </div>
  );
}
