"use client";

import React, { useMemo } from 'react';
import { useDatabaseStore } from '../store';
import { Gantt } from '@svar-ui/react-gantt';
import '@svar-ui/react-gantt/style.css';

class GanttErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any, info: any }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null, info: null };
    }
    static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
    componentDidCatch(error: any, errorInfo: any) { this.setState({ error, info: errorInfo }); }
    render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 bg-red-100 dark:bg-red-900/20 text-red-900 dark:text-red-200 w-full h-[600px] overflow-auto text-xs font-mono">
                    <h3 className="font-bold text-red-600 dark:text-red-400 mb-2">Gantt Boundary Crash:</h3>
                    <p className="mb-4">{this.state.error?.toString()}</p>
                    <pre className="whitespace-pre-wrap">{this.state.info?.componentStack}</pre>
                </div>
            );
        }
        return this.props.children;
    }
}

export default function GanttView({ databaseId, viewId, renderTabs }: { databaseId: string, viewId: string, renderTabs?: React.ReactNode }) {
    const database = useDatabaseStore(state => state.getDatabase(databaseId));

    const tasks = useMemo(() => {
        if (!database || !database.pages) return [];
        return database.pages.map(page => {
            const parseDateSafe = (dateVal: any, offsetDays: number = 0): Date => {
                if (!dateVal) return new Date(Date.now() + 86400000 * offsetDays);
                const str = String(dateVal);
                const euroMatch = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
                if (euroMatch) {
                    const [_, day, month, year] = euroMatch;
                    return new Date(Number(year), Number(month) - 1, Number(day));
                }
                const parsed = new Date(str);
                return isNaN(parsed.getTime()) ? new Date(Date.now() + 86400000 * offsetDays) : parsed;
            };

            const start = parseDateSafe(page.properties['prop-start-date'], 0);
            const end = parseDateSafe(page.properties['prop-end-date'], 3);
            const duration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));

            return {
                id: page.id,
                text: String(page.properties['title'] || 'Untitled Project'),
                start,
                duration
            };
        });
    }, [database]);

    if (!database) return <div className="p-8 text-neutral-500">Loading Timeline Data...</div>;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black w-full border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm relative">
            <div className="px-3 pt-2.5 pb-0 border-b border-[rgba(0,0,0,0.1)] dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 flex items-end justify-between relative z-[60] flex-wrap gap-2">
                <div className="flex items-end pr-2 shrink-0">
                    {renderTabs ? renderTabs : (
                        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2 pb-2">
                            {database.icon && <span>{database.icon}</span>}
                            {database.name}
                        </h2>
                    )}
                </div>
            </div>

            <div className="w-full h-[600px] flex-1 relative overflow-hidden bg-white dark:bg-black p-0">
                {tasks.length > 0 ? (
                    <GanttErrorBoundary>
                        <Gantt tasks={tasks} />
                    </GanttErrorBoundary>
                ) : (
                    <div className="flex flex-col items-center justify-center w-full h-full text-neutral-400">
                        <p className="text-sm font-bold tracking-tight">Timeline Empty</p>
                    </div>
                )}
            </div>
        </div>
    );
}
