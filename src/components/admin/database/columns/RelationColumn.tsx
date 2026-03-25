import React, { useMemo, useRef, useState, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CellProps, Column } from 'react-datasheet-grid';
import { useDatabaseStore } from '../store';
import { Link } from 'lucide-react';

interface RelationComponentProps extends CellProps<any, any> {
    relationDatabaseId: string;
    propId: string;
}

const RelationComponent = ({ rowData, setRowData, focus, active, stopEditing, relationDatabaseId, propId }: RelationComponentProps) => {
    const cellRef = useRef<HTMLDivElement>(null);
    const [rect, setRect] = useState<DOMRect | null>(null);

    // Manage portal position
    useLayoutEffect(() => {
        if ((focus || active) && cellRef.current) {
            setRect(cellRef.current.getBoundingClientRect());
        }
    }, [focus, active]);

    // Keep position updated on scroll/resize
    useEffect(() => {
        if (!focus && !active) return;

        const updateRect = () => {
            if (cellRef.current) setRect(cellRef.current.getBoundingClientRect());
        };

        window.addEventListener('scroll', updateRect, true);
        window.addEventListener('resize', updateRect);

        return () => {
            window.removeEventListener('scroll', updateRect, true);
            window.removeEventListener('resize', updateRect);
        };
    }, [focus, active]);

    // Extract relation array directly from the full row object
    const rawValue = rowData?.properties?.[propId];
    const value = Array.isArray(rawValue) ? rawValue : (typeof rawValue === 'string' && rawValue ? [rawValue] : []);

    // Subscribe to the target database to fetch titles
    const targetDatabase = useDatabaseStore(state => state.databases.find(db => db.id === relationDatabaseId));

    const selectedTitles = useMemo(() => {
        if (!targetDatabase || value.length === 0) return [];
        return value.map(id => {
            const page = targetDatabase.pages.find(p => p.id === id);
            return (page?.properties['title'] as string) || 'Untitled';
        });
    }, [targetDatabase, value]);

    if (!focus && !active) {
        if (selectedTitles.length === 0) {
            return <div className="w-full h-full p-2 flex items-center text-neutral-400 text-sm">Empty</div>;
        }
        return (
            <div className="w-full h-full p-2 flex items-center gap-1 overflow-x-auto no-scrollbar">
                {selectedTitles.map((title, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded text-xs whitespace-nowrap">
                        <Link className="w-3 h-3" />
                        {title}
                    </span>
                ))}
            </div>
        );
    }

    // Interactive Edit Mode (Combobox)
    const dropdownMenu = rect ? (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 99999, pointerEvents: 'none' }}>
            <div
                className="bg-white dark:bg-neutral-900 border border-blue-500 shadow-xl flex flex-col p-2 animate-in fade-in duration-100 rounded-b-md"
                style={{
                    position: 'absolute',
                    top: rect.bottom,
                    left: rect.left,
                    width: Math.max(250, rect.width),
                    height: 'auto',
                    maxHeight: '250px',
                    pointerEvents: 'auto',
                    boxSizing: 'border-box'
                }}
            >
                <div className="text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wider">Select Pages</div>

                {/* Current Selections */}
                {selectedTitles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                        {value.map((id, i) => (
                            <span key={id} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                                <Link className="w-3 h-3" />
                                {selectedTitles[i]}
                                <button
                                    className="ml-1 hover:text-blue-900 dark:hover:text-blue-100"
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

                {/* List of avaiable pages in target DB */}
                <div className="flex flex-col gap-0.5 overflow-y-auto">
                    {targetDatabase?.pages.map(page => {
                        const title = (page.properties['title'] as string) || 'Untitled';
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
                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 font-medium'
                                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                    }`}
                            >
                                {title}
                            </button>
                        )
                    })}
                </div>

                {/* Click outside trap to close */}
                <div
                    style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'auto' }}
                    onPointerDown={(e) => {
                        e.preventDefault();
                        stopEditing({ nextRow: false });
                    }}
                />
            </div>
        </div>
    ) : null;

    return (
        <div ref={cellRef} className="w-full h-full relative border border-blue-500 border-b-0 rounded-t-sm shadow-[0_0_0_1px_rgba(59,130,246,0.3)] bg-white dark:bg-neutral-900 flex items-center px-1">
            {selectedTitles.length === 0 ? (
                <span className="text-neutral-400 text-sm pl-1">Empty</span>
            ) : (
                <div className="flex items-center gap-1 overflow-hidden">
                    <Link className="w-3 h-3 text-blue-500 ml-1 shrink-0" />
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">
                        {selectedTitles.join(', ')}
                    </span>
                </div>
            )}
            {typeof document !== 'undefined' && createPortal(dropdownMenu, document.body)}
        </div>
    );
};

export const relationColumn = (propId: string, relationDatabaseId: string): Column<any, any> => ({
    component: (props) => <RelationComponent {...props} relationDatabaseId={relationDatabaseId} propId={propId} />,
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
