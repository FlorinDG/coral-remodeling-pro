'use client';

import React, { useEffect, useState } from 'react';
import { useDatabaseStore } from '@/components/admin/database/store';
import { Database } from '@/components/admin/database/types';
import { Database as DatabaseIcon, Tag, Boxes, ArrowRight, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DatabaseListSettingsPage() {
    const databases = useDatabaseStore(state => state.databases);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return <div className="p-8"><div className="w-full h-32 bg-neutral-100 dark:bg-white/5 animate-pulse rounded-xl" /></div>;

    return (
        <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                    <DatabaseIcon className="w-6 h-6 text-blue-500" />
                    Global Databases Schema
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Configure the architectural properties, relationships, and structural currency types for your headless databases.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {databases.filter(db => !db.isTemplate).map(db => (
                    <Link
                        key={db.id}
                        href={`/admin/settings/databases/${db.id}`}
                        className="group flex flex-col p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all w-full text-left"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                    {db.icon ? (
                                        <span className="text-base">{db.icon}</span>
                                    ) : (
                                        <Boxes className="w-4 h-4" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-neutral-900 dark:text-white text-base">
                                        {db.name}
                                    </h3>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 mt-0.5">
                                        <Tag className="w-3 h-3" />
                                        {db.properties.length} Properties
                                    </p>
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-neutral-50 dark:bg-white/5 text-neutral-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/20 group-hover:text-blue-600 transition-colors">
                                <ArrowRight className="w-4 h-4 translate-x-0 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                        </div>

                        {db.description && (
                            <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">
                                {db.description}
                            </p>
                        )}

                        <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-white/5 flex flex-wrap gap-2">
                            {db.properties.slice(0, 4).map(prop => (
                                <span key={prop.id} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-neutral-100 dark:bg-white/10 text-neutral-500 dark:text-neutral-400">
                                    {prop.name}
                                </span>
                            ))}
                            {db.properties.length > 4 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-neutral-50 dark:bg-white/5 text-neutral-400">
                                    +{db.properties.length - 4} more
                                </span>
                            )}
                        </div>
                    </Link>
                ))}
            </div>

            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 border-dashed flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 flex items-center justify-center text-neutral-400 mb-3 shadow-sm">
                    <Settings2 className="w-5 h-5 -rotate-90" />
                </div>
                <h3 className="text-sm font-medium text-neutral-900 dark:text-white mb-1">Advanced Schema Management</h3>
                <p className="text-xs text-neutral-500 max-w-sm">Select a database above to structurally modify its columns, map relation targets, and inject calculated formulas.</p>
            </div>
        </div>
    );
}
