"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useDatabaseStore } from '@/components/admin/database/store';
import { LayoutGrid, Table2, Calendar as CalendarIcon, Plus } from 'lucide-react';

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

interface DatabaseCloneProps {
  databaseId: string;
  headerExtra?: React.ReactNode;
  hideViewTabs?: boolean;
}

export default function DatabaseClone({ databaseId, headerExtra, hideViewTabs }: DatabaseCloneProps) {
  const database = useDatabaseStore(state => state.getDatabase(databaseId));

  // Initialize synchronously to avoid a second re-render after mounting
  const [activeViewId, setActiveViewId] = useState<string | null>(() => {
    return database?.views && database.views.length > 0 ? database.views[0].id : null;
  });

  // Keep activeViewId synced if the current view is somehow deleted
  useEffect(() => {
    if (database && activeViewId) {
      const viewExists = database.views.some(v => v.id === activeViewId);
      if (!viewExists && database.views.length > 0) {
        setActiveViewId(database.views[0].id);
      }
    }
  }, [database, activeViewId]);

  if (!database) return null;

  const activeView = database.views.find(v => v.id === activeViewId) || database.views[0];

  const getViewIcon = (type: string) => {
    switch (type) {
      case 'table': return <Table2 className="w-4 h-4" />;
      case 'board': return <LayoutGrid className="w-4 h-4" />;
      case 'calendar': return <CalendarIcon className="w-4 h-4" />;
      default: return <Table2 className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex flex-col w-full h-full min-w-0 min-h-0 bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
      {/* View Tabs Bar */}
      <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-white/10 px-2 pt-2 bg-neutral-50 dark:bg-white/5 overflow-x-auto no-scrollbar">
        {headerExtra}
        {!hideViewTabs && database.views.map((view) => {
          const isActive = view.id === activeViewId;
          return (
            <button
              key={view.id}
              onClick={() => setActiveViewId(view.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${isActive
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
            >
              {getViewIcon(view.type)}
              {view.name}
            </button>
          );
        })}
        {/* Simplified Add View Button */}
        {!hideViewTabs && (
          <button
            className="p-2 ml-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            title="Add View"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* View Content Area */}
      <div className="flex-1 min-w-0 min-h-0 w-full h-full overflow-hidden relative">
        {activeView.type === 'table' && <NotionGridDynamic databaseId={database.id} />}
        {activeView.type === 'board' && <BoardViewDynamic databaseId={database.id} viewId={activeView.id} />}
        {activeView.type === 'calendar' && <CalendarViewDynamic databaseId={database.id} viewId={activeView.id} />}
      </div>
    </div>
  );
}
