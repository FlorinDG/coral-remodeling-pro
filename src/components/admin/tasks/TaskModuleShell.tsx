'use client';

import { useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useDatabaseStore } from '@/components/admin/database/store';
import { useTenant } from '@/context/TenantContext';
import { Page, PropertyValue } from '@/components/admin/database/types';
import { TaskSidebar } from './TaskSidebar';
import { TaskListView } from './TaskListView';
import { TaskQuickAdd, ParsedTask } from './TaskQuickAdd';
import { TaskDetailPanel } from './TaskDetailPanel';
import { TaskContextMenu } from './TaskContextMenu';
import { TaskBoardView } from './TaskBoardView';
import { ReviewMode } from './ReviewMode';
import { DependencyGraph } from './DependencyGraph';
import { PerspectiveBuilder } from './PerspectiveBuilder';
import { useTaskFilter, ActivePerspective } from './hooks/useTaskFilter';
import { useMyDayReset } from './hooks/useMyDayReset';
import { useRecurrence } from './hooks/useRecurrence';
import { FilterRule } from '@/components/admin/database/types';
import { Layers, Kanban, Eye, Network, Plus, ArrowLeft } from 'lucide-react';
import { useRouter } from '@/i18n/routing';

export default function TaskModuleShell() {
    const router = useRouter();
    const { data: session } = useSession();
    const userId = session?.user?.id || 'admin';
    const { isEnterprise, activeModules } = useTenant();

    // ── Database Store ────────────────────────────────────────────────────────
        const db = useDatabaseStore(state => state.getDatabase('db-tasks'));
    const createPage = useDatabaseStore(state => state.createPage);
    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);
    const deletePage = useDatabaseStore(state => state.deletePage);
    const addView = useDatabaseStore(state => state.addView);

    // ── Selected perspective & task states ────────────────────────────────────
    const [perspective, setPerspective] = useState<ActivePerspective>({
        type: 'smart-list',
        id: 'my-day',
        name: 'My Day',
    });
    const [selectedPageId, setSelectedPageId] = useState<string | undefined>(undefined);
    const [contextMenu, setContextMenu] = useState<{
        page: Page;
        x: number;
        y: number;
    } | null>(null);
    const [activeView, setActiveView] = useState<'list' | 'board' | 'review' | 'dependencies'>('list');
    const [showPerspBuilder, setShowPerspBuilder] = useState(false);

    const pages = db?.pages || [];
    const selectedPage = pages.find(p => p.id === selectedPageId);

    const handleSavePerspective = (name: string, filters: FilterRule[]) => {
        addView('db-tasks', {
            name,
            type: 'table',
            filters,
        });
        setShowPerspBuilder(false);

        // Synchronously fetch store state to find the newly added view's ID
        const updatedDb = useDatabaseStore.getState().getDatabase('db-tasks');
        const newView = updatedDb?.views?.find(v => v.name === name);
        if (newView) {
            setPerspective({
                type: 'custom',
                id: newView.id,
                name,
                filters,
            });
        }
    };

    const defaultViewIds = ['view-task-table', 'view-task-board', 'view-task-calendar', 'view-task-today', 'view-task-myday', 'view-task-flagged'];
    const savedPerspectives = (db?.views || [])
        .filter(v => !defaultViewIds.includes(v.id))
        .map(v => ({
            id: v.id,
            name: v.name,
            filters: v.filters || [],
        }));

    // ── Task Filter & Groups ──────────────────────────────────────────────────
    const { groups, flat: filteredPages } = useTaskFilter({
        pages,
        perspective,
        userId,
        groupBySection: true,
    });

    // ── Midnight My Day Reset ─────────────────────────────────────────────────
    useMyDayReset(() => {
        pages.forEach(p => {
            const status = p.properties['prop-task-status'] as string;
            const myDay = p.properties['prop-task-my-day'] as boolean;
            if (myDay && (status === 'opt-done' || status === 'opt-dropped')) {
                updatePageProperty('db-tasks', p.id, 'prop-task-my-day', false);
            }
        });
    });

    const { handleTaskComplete } = useRecurrence({
        createPage: async (props) => {
            createPage('db-tasks', props as Record<string, PropertyValue>);
        },
    });

    // ── Operations ────────────────────────────────────────────────────────────
    const handleQuickAdd = async (parsed: ParsedTask) => {
        const initialProps: Record<string, PropertyValue> = {
            title:                  parsed.title,
            'prop-task-status':     'opt-todo',
            'prop-task-priority':   parsed.priority || 'opt-p4',
            'prop-task-due':        parsed.due || '',
            'prop-task-tags':       parsed.tags || [],
            'prop-task-my-day':     perspective.id === 'my-day',
            'prop-task-flagged':    perspective.id === 'flagged' || !!parsed.defer,
            'prop-task-section':    '',
            'prop-task-recurrence': parsed.recurrence || '',
            'prop-task-defer':      parsed.defer || '',
            'prop-task-estimated':  parsed.estimated || null,
            'prop-task-completed-at': '',
            'prop-task-reviewed-at':  '',
            'prop-task-depends-on':   [],
            'prop-task-notes':      '',
        };

        // If active perspective is a tag, pre-apply that tag
        if (perspective.type === 'tag' && perspective.tagId) {
            initialProps['prop-task-tags'] = Array.from(new Set([...(parsed.tags || []), perspective.tagId]));
        }

        const newPage = createPage('db-tasks', initialProps);
        setSelectedPageId(newPage.id);
    };

    const handleComplete = (page: Page) => {
        const current = page.properties['prop-task-status'] as string;
        const next = current === 'opt-done' ? 'opt-todo' : 'opt-done';

        updatePageProperty('db-tasks', page.id, 'prop-task-status', next);

        if (next === 'opt-done') {
            updatePageProperty('db-tasks', page.id, 'prop-task-completed-at', new Date().toISOString());
            handleTaskComplete(page);
        } else {
            updatePageProperty('db-tasks', page.id, 'prop-task-completed-at', '');
        }
    };

    const handleToggleMyDay = (page: Page) => {
        const current = page.properties['prop-task-my-day'] as boolean;
        updatePageProperty('db-tasks', page.id, 'prop-task-my-day', !current);
    };

    const handleToggleFlag = (page: Page) => {
        const current = page.properties['prop-task-flagged'] as boolean;
        updatePageProperty('db-tasks', page.id, 'prop-task-flagged', !current);
    };

    const handleUpdate = (pageId: string, props: Partial<Record<string, unknown>>) => {
        Object.entries(props).forEach(([key, val]) => {
            updatePageProperty('db-tasks', pageId, key, val as PropertyValue);
        });
    };

    const handleDelete = (pageId: string) => {
        deletePage('db-tasks', pageId);
        if (selectedPageId === pageId) setSelectedPageId(undefined);
    };

    const handleDuplicate = (page: Page) => {
        const freshProps = {
            ...page.properties,
            title: `${page.properties['title'] || 'Untitled'} (Copy)`,
            'prop-task-status':       'opt-todo',
            'prop-task-completed-at': '',
            'prop-task-my-day':       false,
        };
        const newPage = createPage('db-tasks', freshProps, undefined, page.blocks);
        setSelectedPageId(newPage.id);
    };

    const handleSetPriority = (page: Page, p: string) => {
        updatePageProperty('db-tasks', page.id, 'prop-task-priority', p);
    };

    if (!db) {
        return (
            <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500 border-neutral-200" />
                <p className="mt-4 text-sm text-neutral-500 font-medium">Synchronizing task board...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 w-full h-full min-h-0 flex bg-white dark:bg-neutral-950 overflow-hidden relative select-none">
            {/* Left Sidebar */}
            <div className="w-64 border-r border-neutral-200 dark:border-white/10 hidden md:block">
                <TaskSidebar
                    pages={pages}
                    userId={userId}
                    activePerspective={perspective}
                    onSelectPerspective={setPerspective}
                    isEnterprise={isEnterprise}
                    activeModules={activeModules}
                    savedPerspectives={savedPerspectives}
                    onNewPerspective={() => setShowPerspBuilder(true)}
                />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex min-w-0 h-full relative">
                
                {/* Task List Container (Shrinks when detail is open on Desktop, hides on Mobile) */}
                <div className={`flex flex-col h-full transition-all duration-300 ${
                    selectedPage 
                        ? 'hidden lg:flex lg:w-[45%] xl:w-[40%] border-r border-neutral-200 dark:border-white/10' 
                        : 'flex-1 w-full'
                }`}>
                {/* View Switcher Header */}
                <div className="px-4 py-2 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between bg-white dark:bg-neutral-950 flex-shrink-0">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setActiveView('list')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                                ${activeView === 'list'
                                    ? 'bg-neutral-100 dark:bg-white/10 text-neutral-950 dark:text-white'
                                    : 'text-neutral-500 hover:text-neutral-950 dark:hover:text-white'
                                }`}
                        >
                            <Layers className="w-3.5 h-3.5" />
                            List View
                        </button>
                        <button
                            onClick={() => setActiveView('board')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                                ${activeView === 'board'
                                    ? 'bg-neutral-100 dark:bg-white/10 text-neutral-950 dark:text-white'
                                    : 'text-neutral-500 hover:text-neutral-950 dark:hover:text-white'
                                }`}
                        >
                            <Kanban className="w-3.5 h-3.5" />
                            Board
                        </button>
                        <button
                            onClick={() => setActiveView('review')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                                ${activeView === 'review'
                                    ? 'bg-neutral-100 dark:bg-white/10 text-neutral-950 dark:text-white'
                                    : 'text-neutral-500 hover:text-neutral-950 dark:hover:text-white'
                                }`}
                        >
                            <Eye className="w-3.5 h-3.5" />
                            GTD Review
                        </button>
                        <button
                            onClick={() => setActiveView('dependencies')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                                ${activeView === 'dependencies'
                                    ? 'bg-neutral-100 dark:bg-white/10 text-neutral-950 dark:text-white'
                                    : 'text-neutral-500 hover:text-neutral-950 dark:hover:text-white'
                                }`}
                        >
                            <Network className="w-3.5 h-3.5" />
                            Dependencies
                        </button>
                    </div>

                    {/* Explicit New Task Button */}
                    <button
                        onClick={() => {
                            const newPage = createPage('db-tasks', {
                                title: 'New Task',
                                'prop-task-status': 'opt-todo',
                                'prop-task-priority': 'opt-p4',
                                'prop-task-my-day': perspective.id === 'my-day',
                            } as Record<string, PropertyValue>);
                            setSelectedPageId(newPage.id);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white transition-colors shadow-sm"
                    >
                        <Plus className="w-3.5 h-3.5" /> New Task
                    </button>
                </div>

                {activeView === 'list' && (
                    <TaskListView
                        perspectiveName={perspective.name}
                        groups={groups}
                        selectedPageId={selectedPageId}
                        onPageClick={p => setSelectedPageId(p.id)}
                        onComplete={handleComplete}
                        onToggleMyDay={handleToggleMyDay}
                        onToggleFlag={handleToggleFlag}
                        onContextMenu={(e, page) => {
                            e.preventDefault();
                            setContextMenu({ page, x: e.clientX, y: e.clientY });
                        }}
                        onDelete={p => handleDelete(p.id)}
                        onUpdateTitle={(pageId, title) => updatePageProperty('db-tasks', pageId, 'title', title)}
                    />
                )}
                {activeView === 'board' && (
                    <TaskBoardView
                        pages={filteredPages}
                        onUpdateStatus={(pageId, status) => updatePageProperty('db-tasks', pageId, 'prop-task-status', status)}
                        onPageClick={p => setSelectedPageId(p.id)}
                        onUpdateTitle={(pageId, title) => updatePageProperty('db-tasks', pageId, 'title', title)}
                        onUpdatePriority={(pageId, priority) => updatePageProperty('db-tasks', pageId, 'prop-task-priority', priority)}
                        onUpdateDue={(pageId, due) => updatePageProperty('db-tasks', pageId, 'prop-task-due', due)}
                    />
                )}

                {activeView === 'review' && (
                    !isEnterprise ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-neutral-50 dark:bg-neutral-900/10">
                            <Eye className="w-12 h-12 text-purple-400 mb-3" />
                            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">GTD Review Mode is Enterprise</h3>
                            <p className="text-xs text-neutral-500 max-w-xs mb-4">
                                Triaging inbox tasks one-by-one is an Enterprise workflow. Upgrade your plan to unlock next-level productivity.
                            </p>
                        </div>
                    ) : (
                        <ReviewMode
                            pages={pages}
                            onUpdatePage={handleUpdate}
                            onComplete={handleComplete}
                        />
                    )
                )}

                {activeView === 'dependencies' && (
                    !isEnterprise ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-neutral-50 dark:bg-neutral-900/10">
                            <Network className="w-12 h-12 text-indigo-400 mb-3" />
                            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">Dependency Flow is Enterprise</h3>
                            <p className="text-xs text-neutral-500 max-w-xs mb-4">
                                Visualizing sequential task prerequisite streams is gated by Enterprise. Elevate your plan to unlock.
                            </p>
                        </div>
                    ) : (
                        <DependencyGraph
                            pages={pages}
                            onPageClick={p => setSelectedPageId(p.id)}
                        />
                    )
                )}

                {/* Quick Add Bar */}
                <div className="p-4 bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-white/10">
                    <TaskQuickAdd
                        onAdd={handleQuickAdd}
                        placeholder={
                            perspective.id === 'my-day'
                                ? 'Add task to My Day… (p1 #urgent tomorrow)'
                                : 'Add task… (p1 #urgent tomorrow ~30m every monday)'
                        }
                    />
                </div>
            </div>

            {/* Split-pane Detail View */}
            {selectedPage && (
                <div className="flex-1 flex flex-col min-w-0 h-full bg-white dark:bg-neutral-950 overflow-hidden animate-in fade-in slide-in-from-right-8 duration-300">
                    {/* Mobile back button */}
                    <div className="lg:hidden flex items-center p-3 border-b border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900/50">
                        <button 
                            onClick={() => setSelectedPageId(undefined)} 
                            className="flex items-center gap-2 text-sm font-semibold text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" /> 
                            Back to List
                        </button>
                    </div>
                    <div className="flex-1 min-h-0">
                        <TaskDetailPanel
                            page={selectedPage}
                            onClose={() => setSelectedPageId(undefined)}
                            onUpdate={handleUpdate}
                            onDelete={handleDelete}
                            onOpenFullPage={(pageId) => {
                                router.push(`/admin/database/${db.id}/${pageId}`);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>

            {/* Context Menu */}
            {contextMenu && (
                <TaskContextMenu
                    page={contextMenu.page}
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    onSetPriority={handleSetPriority}
                    onSetDue={page => {
                        // Focus due date in detail panel
                        setSelectedPageId(page.id);
                    }}
                    onSetDefer={page => {
                        setSelectedPageId(page.id);
                    }}
                    onToggleMyDay={handleToggleMyDay}
                    onToggleFlag={handleToggleFlag}
                    onDuplicate={handleDuplicate}
                    onDelete={p => handleDelete(p.id)}
                />
            )}
            {showPerspBuilder && (
                <PerspectiveBuilder
                    database={db}
                    onClose={() => setShowPerspBuilder(false)}
                    onSave={handleSavePerspective}
                />
            )}
        </div>
    );
}
