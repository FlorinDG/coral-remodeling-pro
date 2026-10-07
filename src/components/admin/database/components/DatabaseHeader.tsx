"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import {
    Table2,
    LayoutGrid,
    Calendar as CalendarIcon,
    Clock,
    Plus,
    ChevronDown,
    Edit,
    Trash2,
    Settings,
    WrapText,
    Download,
    Upload,
    Camera,
    Files,
    RefreshCw,
    Check,
    GanttChartSquare,
} from 'lucide-react';
import type { Database, DatabaseView } from '../types';
import type { SystemDatabaseRole } from '@/lib/kernel/system-databases';
import { BASE_TO_KEY } from '@/lib/kernel/system-databases';
import type { GridAccess } from '@/lib/records/grid-access';
import {
    computeDatabaseHeader,
    type ScreenTabItem,
    type ActionId,
    type ActionItem,
} from '@/lib/records/db-header';
import PropertiesDropdown from './PropertiesDropdown';
import FilterToolbar from './FilterToolbar';
import SortToolbar from './SortToolbar';
import { AccountantExportDialog } from './AccountantExportDialog';
import { SpreadsheetImportModal } from './SpreadsheetImportModal';
import { useDatabaseStore } from '../store';
import { useExportCSV } from '../hooks/useExportCSV';
import type { Page } from '../types';

export interface DatabaseHeaderProps {
    database: Database;
    activeView: DatabaseView | null;
    supportedViews: DatabaseView[];
    activeViewId: string | null;
    onSelectView: (viewId: string) => void;
    onAddView?: (type: 'table' | 'board' | 'calendar' | 'timeline') => void;
    onRenameView?: (viewId: string, newName: string) => void;
    onSetViewType?: (viewId: string, type: 'table' | 'board' | 'calendar' | 'timeline') => void;
    onDeleteView?: (viewId: string) => void;
    headerExtra?: React.ReactNode;
    screenTabs?: ScreenTabItem[] | null;
    onSelectScreenTab?: (tabId: string) => void;
    hideViewTabs?: boolean;
    surfaceKey?: string | null;
    userRole?: string | null;
    isSuperadmin?: boolean;
    isImpersonating?: boolean;
    access: GridAccess;
    isLockedSchema?: boolean;
    isUngated?: boolean;
    hasDatabases?: boolean;
    onAction?: (actionId: ActionId) => void;
    hardFilter?: { propertyId: string; value: string };
    selectedRowCount?: number;
    sortedPages?: Page[];
    selectedRowIds?: Set<string>;
}

export default function DatabaseHeader({
    database,
    activeView,
    supportedViews,
    activeViewId,
    onSelectView,
    onAddView,
    onRenameView,
    onSetViewType,
    onDeleteView,
    headerExtra,
    screenTabs,
    onSelectScreenTab,
    hideViewTabs = false,
    surfaceKey,
    userRole,
    isSuperadmin,
    isImpersonating,
    access,
    isLockedSchema = false,
    isUngated = false,
    hasDatabases = false,
    onAction,
    hardFilter,
    selectedRowCount = 0,
    sortedPages,
    selectedRowIds,
}: DatabaseHeaderProps) {
    const tAdmin = useTranslations('Admin');
    const updateView = useDatabaseStore(state => state.updateView);

    // Compute canonical header rules
    const role: SystemDatabaseRole | 'custom' =
        (database.logicalKey as SystemDatabaseRole) ||
        (database.id in BASE_TO_KEY ? BASE_TO_KEY[database.id] : 'custom');

    const headerResult = computeDatabaseHeader({
        role,
        surfaceKey,
        databaseName: database.name,
        databaseIcon: database.icon,
        databaseId: database.id,
        userRole,
        isSuperadmin,
        isImpersonating,
        access,
        selectedRowCount,
        totalRowCount: database.pages?.length ?? 0,
        activeViewType: activeView?.type,
        activeViewId: activeView?.id,
        isLockedSchema,
        isUngated,
        screenTabs,
    });

    const resolveTranslation = (key: string): string => {
        if (key.startsWith('Admin.')) {
            return tAdmin(key.replace(/^Admin\./, ''));
        }
        return tAdmin(key);
    };

    // Export CSV
    const exportCsv = useExportCSV({
        database,
        filteredPages: sortedPages || [],
        selectedRowIds,
    });

    // Modals
    const [isAccountantOpen, setIsAccountantOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);

    // View Renaming
    const [renamingViewId, setRenamingViewId] = useState<string | null>(null);
    const [renamingValue, setRenamingValue] = useState('');

    const handleRenameStart = (viewId: string, currentName: string) => {
        setRenamingViewId(viewId);
        setRenamingValue(currentName);
    };

    const handleRenameSave = () => {
        if (renamingViewId && renamingValue.trim() && onRenameView) {
            onRenameView(renamingViewId, renamingValue.trim());
        }
        setRenamingViewId(null);
    };

    // View Type Selector Dropdown Portal
    const [showViewTypeSelector, setShowViewTypeSelector] = useState(false);
    const [selectorPosition, setSelectorPosition] = useState({ top: 0, left: 0 });
    const addViewButtonRef = useRef<HTMLButtonElement>(null);

    // View Context Menu Portal
    const [viewMenuOpenId, setViewMenuOpenId] = useState<string | null>(null);
    const [viewMenuPosition, setViewMenuPosition] = useState({ top: 0, left: 0 });

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

    const getViewIcon = (type: string) => {
        switch (type) {
            case 'table': return <Table2 className="w-4 h-4" />;
            case 'board': return <LayoutGrid className="w-4 h-4" />;
            case 'calendar': return <CalendarIcon className="w-4 h-4" />;
            case 'timeline': return <Clock className="w-4 h-4" />;
            default: return <Table2 className="w-4 h-4" />;
        }
    };

    const getActionIcon = (iconName: ActionItem['icon']) => {
        switch (iconName) {
            case 'camera': return <Camera className="w-3.5 h-3.5" />;
            case 'files': return <Files className="w-3.5 h-3.5" />;
            case 'plus': return <Plus className="w-3.5 h-3.5" />;
            case 'check': return <Check className="w-3.5 h-3.5" />;
            case 'refresh': return <RefreshCw className="w-3.5 h-3.5" />;
            default: return null;
        }
    };

    const wrap = activeView?.wrapText ?? false;
    const isTwoLevel =
        (headerResult.screenTabs && headerResult.screenTabs.length > 0) ||
        headerResult.actions.length > 0;

    // View tabs component
    const renderViewTabsList = () => {
        if (!headerResult.showViewTabs || hideViewTabs || supportedViews.length === 0) {
            return null;
        }

        return (
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
                                    type="button"
                                    onClick={() => onSelectView(view.id)}
                                    onDoubleClick={() => handleRenameStart(view.id, view.name)}
                                    onContextMenu={(e) => handleOpenViewMenu(e, view.id)}
                                    className={`flex items-center gap-2 pl-3 pr-2 py-2 pb-1.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap -mb-[1px] ${isActive
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

                {hasDatabases && onAddView && (
                    <div className="relative">
                        <button
                            ref={addViewButtonRef}
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (addViewButtonRef.current) {
                                    const rect = addViewButtonRef.current.getBoundingClientRect();
                                    setSelectorPosition({ top: rect.bottom + 5, left: rect.left });
                                }
                                setShowViewTypeSelector((prev) => !prev);
                            }}
                            className={`p-1.5 ml-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors mb-1 rounded-md ${showViewTypeSelector ? 'bg-neutral-100 dark:bg-white/10' : ''}`}
                            title="Add View"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        );
    };

    // Toolbar buttons component
    const renderToolbarItems = () => (
        <div className="flex items-center gap-1.5 flex-wrap ml-auto">
            {headerExtra}

            {headerResult.schemaLink && (
                <Link
                    href={headerResult.schemaLink.href}
                    className="flex items-center gap-1.5 text-neutral-500 hover:text-[var(--brand-color,#d35400)] px-2.5 py-1 bg-neutral-100 dark:bg-white/5 hover:bg-[var(--brand-color,#d35400)]/10 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors shrink-0"
                >
                    <Settings className="w-3.5 h-3.5" />
                    {resolveTranslation(headerResult.schemaLink.labelKey)}
                </Link>
            )}


            {headerResult.toolbar.showAccountantExport && (
                <button
                    type="button"
                    onClick={() => setIsAccountantOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition shrink-0"
                >
                    📦 {tAdmin('accountant_export_button')}
                </button>
            )}

            {headerResult.toolbar.showImportCsv && (
                <button
                    type="button"
                    onClick={() => setIsImportOpen(true)}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 rounded transition shrink-0"
                >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import</span>
                </button>
            )}

            {headerResult.toolbar.showProperties && activeView && (
                <PropertiesDropdown databaseId={database.id} viewId={activeView.id} />
            )}

            {headerResult.toolbar.showFilter && activeView && (
                <FilterToolbar databaseId={database.id} viewId={activeView.id} />
            )}

            {headerResult.toolbar.showSort && activeView && (
                <SortToolbar databaseId={database.id} viewId={activeView.id} />
            )}

            {headerResult.toolbar.showWrapText && activeView && (
                <button
                    type="button"
                    aria-pressed={wrap}
                    title="Lange tekst over meerdere regels tonen (per weergave)"
                    onClick={() => updateView(database.id, activeView.id, { wrapText: !wrap })}
                    className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded transition shrink-0 ${wrap ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5'}`}
                >
                    <WrapText className="w-3.5 h-3.5" />
                    <span>{tAdmin('dbHeader.wrapText')}</span>
                </button>
            )}

            {headerResult.toolbar.showExportCsv && (
                <button
                    type="button"
                    onClick={exportCsv}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 rounded transition shrink-0"
                >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export</span>
                </button>
            )}
        </div>
    );

    return (
        <div className="flex flex-col w-full bg-white dark:bg-neutral-900 rounded-t-xl border-x border-t border-b border-neutral-200 dark:border-white/10 shadow-sm">
            {isTwoLevel ? (
                <>
                    {/* Level 1: Brand & Screen Context / Actions */}
                    <div className="px-4 py-2 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/70 dark:bg-neutral-900/70 flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                            {headerResult.screenTabs && headerResult.screenTabs.length > 0 ? (
                                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                                    {headerResult.screenTabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => onSelectScreenTab?.(tab.id)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${tab.active ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    {headerResult.title.icon && (
                                        <span className="text-base">{headerResult.title.icon}</span>
                                    )}
                                    <h2 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                                        {headerResult.title.name}
                                    </h2>
                                    <span className="text-[11px] bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-2 py-0.5 rounded-full font-medium">
                                        {headerResult.title.rowCount}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Declared Actions & Schema Pill */}
                        <div className="flex items-center gap-2 ml-auto">
                            {/* a page action shows only where the page handles it (VALIDATE-1: "Te valideren" validates, it does not scan) */}
                            {onAction && headerResult.actions.map((act) => {
                                const variantClasses =
                                    act.variant === 'primary'
                                        ? 'bg-[var(--brand-color,#d35400)] text-white hover:opacity-90 shadow-sm'
                                        : act.variant === 'secondary'
                                        ? 'bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-white/15'
                                        : act.variant === 'badge'
                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                                        : 'border border-neutral-300 dark:border-white/10 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-white/5';

                                return (
                                    <button
                                        key={act.id}
                                        type="button"
                                        onClick={() => onAction?.(act.id)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${variantClasses}`}
                                    >
                                        {getActionIcon(act.icon)}
                                        <span>{resolveTranslation(act.labelKey)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Level 2: View & Grid Navigation */}
                    <div className="px-3 pt-1 pb-1 flex items-end justify-between gap-2 flex-wrap">
                        <div className="flex items-end min-w-0 pr-2">
                            {renderViewTabsList()}
                        </div>
                        {renderToolbarItems()}
                    </div>
                </>
            ) : (
                /* Collapsed Single Compact Bar */
                <div className="px-3 pt-1.5 pb-1 flex items-end justify-between gap-2 flex-wrap">
                    <div className="flex items-end min-w-0 pr-2 gap-3">
                        <div className="flex items-center gap-2 pb-1.5">
                            {headerResult.title.icon && (
                                <span className="text-base">{headerResult.title.icon}</span>
                            )}
                            <h2 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                                {headerResult.title.name}
                            </h2>
                            <span className="text-[11px] bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-2 py-0.5 rounded-full font-medium">
                                {headerResult.title.rowCount}
                            </span>
                        </div>
                        {renderViewTabsList()}
                    </div>
                    {renderToolbarItems()}
                </div>
            )}

            {/* View Type Selector Portal (C10: fixed backdrop pattern) */}
            {showViewTypeSelector && typeof document !== 'undefined' && createPortal(
                <>
                    <div
                        className="fixed inset-0 z-[99998]"
                        onMouseDown={() => setShowViewTypeSelector(false)}
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div
                        style={{
                            position: 'fixed',
                            top: selectorPosition.top,
                            left: selectorPosition.left,
                            zIndex: 99999,
                        }}
                        className="w-44 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-2xl p-1.5 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 ring-4 ring-black/5"
                    >
                        <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-100 dark:border-white/5 mb-1">
                            Add View Type
                        </div>
                        <button
                            type="button"
                            onClick={() => { onAddView?.('table'); setShowViewTypeSelector(false); }}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg transition-colors text-left"
                        >
                            <Table2 className="w-4 h-4" /> Table
                        </button>
                        <button
                            type="button"
                            onClick={() => { onAddView?.('board'); setShowViewTypeSelector(false); }}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg transition-colors text-left"
                        >
                            <LayoutGrid className="w-4 h-4" /> Board
                        </button>
                        <button
                            type="button"
                            onClick={() => { onAddView?.('calendar'); setShowViewTypeSelector(false); }}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg transition-colors text-left"
                        >
                            <CalendarIcon className="w-4 h-4" /> Calendar
                        </button>
                        <button
                            type="button"
                            onClick={() => { onAddView?.('timeline'); setShowViewTypeSelector(false); }}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg transition-colors text-left"
                        >
                            <GanttChartSquare className="w-4 h-4" /> Timeline
                        </button>
                    </div>
                </>,
                document.body
            )}

            {/* View Context Menu Portal (C10: fixed backdrop pattern) */}
            {viewMenuOpenId && typeof document !== 'undefined' && (() => {
                const targetView = supportedViews.find((v) => v.id === viewMenuOpenId);
                if (!targetView) return null;
                return createPortal(
                    <>
                        <div
                            className="fixed inset-0 z-[99998]"
                            onMouseDown={() => setViewMenuOpenId(null)}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div
                            style={{
                                position: 'fixed',
                                top: viewMenuPosition.top,
                                left: viewMenuPosition.left,
                                zIndex: 99999,
                            }}
                            className="w-48 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-2xl p-1.5 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 ring-4 ring-black/5"
                        >
                            <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-100 dark:border-white/5 mb-1">
                                View Options
                            </div>

                            <button
                                type="button"
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
                                    type="button"
                                    onClick={() => { onSetViewType?.(targetView.id, 'table'); setViewMenuOpenId(null); }}
                                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-lg transition-colors text-left ${targetView.type === 'table'
                                        ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium'
                                        : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5'
                                        }`}
                                >
                                    <Table2 className="w-4 h-4" /> Table
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { onSetViewType?.(targetView.id, 'board'); setViewMenuOpenId(null); }}
                                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-lg transition-colors text-left ${targetView.type === 'board'
                                        ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium'
                                        : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5'
                                        }`}
                                >
                                    <LayoutGrid className="w-4 h-4" /> Board
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { onSetViewType?.(targetView.id, 'calendar'); setViewMenuOpenId(null); }}
                                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-lg transition-colors text-left ${targetView.type === 'calendar'
                                        ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium'
                                        : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5'
                                        }`}
                                >
                                    <CalendarIcon className="w-4 h-4" /> Calendar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { onSetViewType?.(targetView.id, 'timeline'); setViewMenuOpenId(null); }}
                                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-lg transition-colors text-left ${targetView.type === 'timeline'
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
                                        type="button"
                                        onClick={() => { onDeleteView?.(targetView.id); setViewMenuOpenId(null); }}
                                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors text-left"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-500" /> Delete View
                                    </button>
                                </div>
                            )}
                        </div>
                    </>,
                    document.body
                );
            })()}

            {/* Accountant Export Dialog */}
            {isAccountantOpen && (
                <AccountantExportDialog
                    isOpen={isAccountantOpen}
                    onClose={() => setIsAccountantOpen(false)}
                />
            )}

            {/* Spreadsheet Import Modal */}
            {isImportOpen && (
                <SpreadsheetImportModal
                    isOpen={isImportOpen}
                    onClose={() => setIsImportOpen(false)}
                    databaseId={database.id}
                />
            )}
        </div>
    );
}
