import React, { useMemo, useRef, useState, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CellProps, Column } from 'react-datasheet-grid';
import { useDatabaseStore } from '../store';
import { Link, Search, ExternalLink, Plus, Loader2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useRelationTarget, resolveRelationTitle } from '@/lib/relations/resolve';

interface RelationComponentProps extends CellProps<any, any> {
    relationDatabaseId: string;
    propId: string;
    displayPropertyId?: string;
}

const RelationComponent = ({ rowData, setRowData, focus, active, stopEditing, relationDatabaseId, propId, displayPropertyId = 'title' }: RelationComponentProps) => {
    const cellRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Native Click Away Listener for robust dismissal beyond React-Datasheet-Grid
    useEffect(() => {
        if (!focus && !active) return;

        const handleClickOutside = (e: MouseEvent | TouchEvent) => {
            // If we click inside the popover or inside the cell itself, do nothing
            if (
                popoverRef.current?.contains(e.target as Node) ||
                cellRef.current?.contains(e.target as Node)
            ) {
                return;
            }
            // Otherwise, we clicked completely outside. Force dismount!
            stopEditing({ nextRow: false });
        };

        const handleWheelOutside = (e: WheelEvent) => {
            if (popoverRef.current?.contains(e.target as Node)) {
                return;
            }
            stopEditing({ nextRow: false });
        };

        document.addEventListener('mousedown', handleClickOutside, true);
        document.addEventListener('touchstart', handleClickOutside, true);
        window.addEventListener('wheel', handleWheelOutside, true);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
            document.removeEventListener('touchstart', handleClickOutside, true);
            window.removeEventListener('wheel', handleWheelOutside, true);
        };
    }, [focus, active, stopEditing]);

    // Position detection for portal
    useLayoutEffect(() => {
        if (!cellRef.current || (!focus && !active)) return;

        const updateRect = () => {
            if (cellRef.current) {
                setRect(cellRef.current.getBoundingClientRect());
            }
        };

        updateRect();
        window.addEventListener('scroll', updateRect, true);
        window.addEventListener('resize', updateRect);

        return () => {
            window.removeEventListener('scroll', updateRect, true);
            window.removeEventListener('resize', updateRect);
        };
    }, [focus, active]);

    // Extract relation array directly from the full row object
    const rawValue = rowData?.properties?.[propId];
    const value = useMemo(() => Array.isArray(rawValue) ? rawValue : (typeof rawValue === 'string' && rawValue ? [rawValue] : []), [rawValue]);

    // Subscribe to unified relation resolver
    const { status: relationStatus, databaseId: resolvedDbId, options: relationOptions, targetDatabase } = useRelationTarget(relationDatabaseId, { displayPropertyId });
    const pageIndex = useDatabaseStore(state => state.pageIndex);

    const selectedItems = useMemo(() => {
        if (value.length === 0) return [];
        return value.map(id => {
            const title = resolveRelationTitle(id, { pageIndex, targetDatabase, displayPropertyId }) || 'Untitled';
            return { id, title };
        });
    }, [pageIndex, targetDatabase, value, displayPropertyId]);

    const selectedTitles = useMemo(() => selectedItems.map(item => item.title), [selectedItems]);

    const filteredTargetPages = useMemo(() => {
        if (!searchQuery.trim()) return relationOptions;
        return relationOptions.filter(opt => opt.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [relationOptions, searchQuery]);

    const router = useRouter();
    const locale = useLocale();

    if (!focus && !active) {
        if (selectedItems.length === 0) {
            if (relationStatus === 'unknown-database') {
                return (
                    <div className="w-full h-full p-2 flex items-center text-red-500 text-xs font-mono" title={`Relation target ${relationDatabaseId} not found for this tenant`}>
                        <AlertCircle className="w-3 h-3 mr-1 text-red-500 shrink-0" />
                        Target DB error
                    </div>
                );
            }
            return <div className="w-full h-full p-2 flex items-center text-neutral-400 text-sm">Empty</div>;
        }
        return (
            <div className="w-full h-full p-2 flex items-center gap-1 overflow-x-auto no-scrollbar">
                {selectedItems.map((item, i) => (
                    <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded text-xs whitespace-nowrap group">
                        <Link className="w-3 h-3 opacity-50" />
                        <span className="px-0.5">{item.title}</span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/${locale}/admin/database/${resolvedDbId}/${item.id}`);
                            }}
                            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all ml-0.5 text-orange-500 hover:text-orange-600"
                            title="Open related record"
                        >
                            <ExternalLink className="w-3 h-3" />
                        </button>
                    </span>
                ))}
            </div>
        );
    }

    // Interactive Edit Mode (Combobox)
    const dropdownMenu = rect ? (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 99999, pointerEvents: 'none' }}>
            <div
                ref={popoverRef}
                className="bg-white dark:bg-neutral-900 border border-orange-500 shadow-xl flex flex-col p-2 animate-in fade-in duration-100 rounded-b-md"
                style={{
                    position: 'absolute',
                    top: (() => {
                        const spaceBelow = window.innerHeight - rect.bottom;
                        const spaceAbove = rect.top;
                        const maxH = 350;
                        if (spaceBelow < maxH && spaceAbove > spaceBelow) {
                            return rect.top - Math.min(maxH, spaceAbove - 16);
                        }
                        return rect.bottom;
                    })(),
                    left: Math.min(rect.left, window.innerWidth - Math.max(300, rect.width)),
                    width: Math.max(300, rect.width),
                    height: 'auto',
                    maxHeight: (() => {
                        const spaceBelow = window.innerHeight - rect.bottom;
                        const spaceAbove = rect.top;
                        const maxH = 350;
                        if (spaceBelow < maxH && spaceAbove > spaceBelow) {
                            return Math.min(maxH, spaceAbove - 16);
                        }
                        return Math.min(maxH, spaceBelow - 16);
                    })(),
                    pointerEvents: 'auto',
                    boxSizing: 'border-box'
                }}
            >
                <div className="flex items-center gap-2 mb-3">
                    <Search className="w-4 h-4 text-neutral-400 shrink-0" />
                    <input
                        type="text"
                        autoFocus
                        placeholder="Search related pages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-transparent border-none text-sm outline-none text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400"
                        onPointerDown={(e) => e.stopPropagation()} // Prevent drag locks
                        onKeyDown={(e) => e.stopPropagation()} // Prevent grid catching typing
                    />
                </div>

                {/* Current Selections */}
                {selectedTitles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                        {value.map((id, i) => (
                            <span key={id} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-xs">
                                <Link className="w-3 h-3" />
                                {selectedTitles[i]}
                                <button
                                    className="ml-1 hover:text-orange-900 dark:hover:text-orange-100"
                                    onPointerDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const nextValue = value.filter(v => v !== id);
                                        setRowData({
                                            ...rowData,
                                            properties: { ...(rowData?.properties || {}), [propId]: nextValue }
                                        });
                                    }}
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                {/* List of available pages in target DB */}
                <div className="flex flex-col gap-0.5 overflow-y-auto max-h-48">
                    {relationStatus === 'unknown-database' ? (
                        <div className="text-xs text-red-500 font-medium p-2 flex items-center gap-1.5 bg-red-50 dark:bg-red-950/40 rounded">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Relation target {relationDatabaseId} not found for this tenant</span>
                        </div>
                    ) : relationStatus === 'not-loaded' ? (
                        <div className="text-xs text-neutral-400 p-2 flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
                            <span>Loading records...</span>
                        </div>
                    ) : filteredTargetPages.length === 0 ? (
                        <div className="text-xs text-neutral-400 italic p-2 text-center">
                            {searchQuery ? 'No matching pages' : 'No records available'}
                        </div>
                    ) : (
                        filteredTargetPages.map(page => {
                            const title = page.title || 'Untitled';
                            const isSelected = value.includes(page.id);

                            return (
                                <button
                                    key={page.id}
                                    onPointerDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (isSelected) {
                                            const nextValue = value.filter(v => v !== page.id);
                                            setRowData({
                                                ...rowData,
                                                properties: { ...(rowData?.properties || {}), [propId]: nextValue }
                                            });
                                        } else {
                                            const nextValue = [...value, page.id];
                                            setRowData({
                                                ...rowData,
                                                properties: { ...(rowData?.properties || {}), [propId]: nextValue }
                                            });
                                        }
                                    }}
                                    className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${isSelected
                                        ? 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 font-medium'
                                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                        }`}
                                >
                                    {title}
                                </button>
                            );
                        })
                    )}
                </div>

                {relationStatus !== 'unknown-database' && searchQuery.trim() && !filteredTargetPages.some(p => p.title.toLowerCase() === searchQuery.trim().toLowerCase()) && (
                    <button
                        onPointerDown={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const { createPage } = useDatabaseStore.getState();
                            
                            const newPage = createPage(resolvedDbId, {
                                [displayPropertyId]: searchQuery.trim()
                            });

                            const nextValue = [...value, newPage.id];
                            setRowData({
                                ...rowData,
                                properties: { ...(rowData?.properties || {}), [propId]: nextValue }
                            });
                            
                            setSearchQuery('');
                            // Dispatch event to open the page modal for required info
                            window.dispatchEvent(new CustomEvent('open-relation-modal', {
                                detail: { databaseId: resolvedDbId, pageId: newPage.id }
                            }));
                        }}
                        className="w-full text-left px-2 py-2 mt-1 border-t border-neutral-100 dark:border-white/5 text-sm transition-colors text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 font-medium flex items-center gap-1.5"
                    >
                        <Plus className="w-4 h-4" />
                        Create "{searchQuery.trim()}"
                    </button>
                )}
            </div>
        </div>
    ) : null;

    return (
        <div ref={cellRef} className="w-full h-full relative border border-orange-500 border-b-0 rounded-t-sm shadow-[0_0_0_1px_rgba(59,130,246,0.3)] bg-white dark:bg-neutral-900 flex items-center px-1">
            {selectedTitles.length === 0 ? (
                <span className="text-neutral-400 text-sm pl-1">Empty</span>
            ) : (
                <div className="flex items-center gap-1 overflow-hidden">
                    <Link className="w-3 h-3 text-orange-500 ml-1 shrink-0" />
                    <span className="text-sm font-medium text-orange-600 dark:text-orange-400 truncate">
                        {selectedTitles.join(', ')}
                    </span>
                </div>
            )}
            {typeof document !== 'undefined' && createPortal(dropdownMenu, document.body)}
        </div>
    );
};

export const relationColumn = (propId: string, relationDatabaseId: string, displayPropertyId?: string): Column<any, any> => ({
    component: (props) => <RelationComponent {...props} relationDatabaseId={relationDatabaseId} propId={propId} displayPropertyId={displayPropertyId} />,
    keepFocus: true,
    deleteValue: ({ rowData }) => ({
        ...rowData,
        properties: { ...(rowData?.properties || {}), [propId]: [] }
    }),
    copyValue: ({ rowData }) => {
        const val = rowData?.properties?.[propId];
        return Array.isArray(val) ? val.join(',') : '';
    },
    pasteValue: ({ rowData, value }) => {
        let parsed: string[] = [];
        if (value) {
            parsed = String(value).split(',').map(s => s.trim()).filter(Boolean);
        }
        return { ...rowData, properties: { ...(rowData?.properties || {}), [propId]: parsed } };
    },
    isCellEmpty: ({ rowData }) => {
        const val = rowData?.properties?.[propId];
        return !val || val.length === 0;
    },
});
