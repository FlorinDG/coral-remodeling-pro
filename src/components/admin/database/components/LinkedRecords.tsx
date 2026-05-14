"use client";

import React, { useEffect, useState } from 'react';
import { getLinkedRecordsForClient } from '@/app/actions/crm';
import { Briefcase, FileText, Receipt, ExternalLink, Loader2, Plus } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useDatabaseStore } from '@/components/admin/database/store';
import { Database, Page, Property } from '@/components/admin/database/types';
import { useTenant } from '@/context/TenantContext';
import { useRouter, useParams } from 'next/navigation';
import { createPageServerFirst } from '@/app/actions/pages';

interface LinkedRecordsProps {
    databaseId: string;
    pageId: string;
}

interface LinkedRecordBase {
    id: string;
    status: string;
}

interface ProjectRecord extends LinkedRecordBase {
    name: string;
    projectCode: string;
}

interface QuotationRecord extends LinkedRecordBase {
    quoteNumber: string;
    total: number;
}

interface InvoiceRecord extends LinkedRecordBase {
    invoiceNumber: string;
    total: number;
}

export default function LinkedRecords({ databaseId, pageId }: LinkedRecordsProps) {
    const isClientDb = databaseId.includes('db-clients');
    const [isCreating, setIsCreating] = useState<string | null>(null);

    const { resolveDbId } = useTenant();
    const router = useRouter();
    const params = useParams();
    const locale = (params.locale as string) || 'nl';

    const allDatabases = useDatabaseStore((state) => state.databases);
    const updatePageProperty = useDatabaseStore((state) => state.updatePageProperty);
    const createPage = useDatabaseStore((state) => state.createPage);

    const database = allDatabases.find((d: Database) => d.id === databaseId);
    const page = database?.pages.find((p: Page) => p.id === pageId);

    if (!database || !page) return null;

    const relationProps = database.properties.filter((p: Property) => p.type === 'relation');

    const handleCreateAndLink = async (prop: Property) => {
        const targetDbId = prop.config?.relationDatabaseId;
        if (!targetDbId) return;

        setIsCreating(prop.id);
        const resolvedTargetDbId = resolveDbId(targetDbId);
        const targetDb = allDatabases.find(d => d.id === resolvedTargetDbId);
        
        const clientName = String(page.properties['title'] || page.properties['name'] || 'Item');
        
        // Prepare initial properties for the new page
        const initialProps: Record<string, any> = {
            title: `New ${targetDb?.name || 'Item'} for ${clientName}`,
        };

        // If the target DB has a relation back to this DB, try to auto-link it
        // This is a "best effort" back-link
        const targetRelationToCurrent = targetDb?.properties.find(p => 
            p.type === 'relation' && p.config?.relationDatabaseId === databaseId
        );
        if (targetRelationToCurrent) {
            initialProps[targetRelationToCurrent.id] = [pageId];
        }

        // Create the page in the store
        const newPageId = createPage(resolvedTargetDbId, initialProps);

        // Link it to the current page
        const currentRelations = (page.properties[prop.id] as string[]) || [];
        updatePageProperty(databaseId, pageId, prop.id, [...currentRelations, newPageId]);

        // Navigate to the new page
        router.push(`/${locale}/admin/database/${resolvedTargetDbId}/${newPageId}`);
        setIsCreating(null);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {relationProps.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-neutral-400 border-2 border-dashed border-neutral-100 dark:border-white/5 rounded-2xl">
                    <ExternalLink className="w-8 h-8 opacity-20 mb-3" />
                    <p className="text-xs italic">No relationship fields defined for this database.</p>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                {relationProps.map(prop => {
                    const ids = (page.properties[prop.id] as string[]) || [];
                    const targetDbId = prop.config?.relationDatabaseId;
                    const resolvedTargetDbId = targetDbId ? resolveDbId(targetDbId) : null;
                    const targetDb = allDatabases.find(d => d.id === resolvedTargetDbId);
                    
                    const linkedPages = ids.map(id => {
                        const p = targetDb?.pages.find((pg: Page) => pg.id === id);
                        if (!p) {
                            // Fallback search across all DBs
                            for (const d of allDatabases) {
                                const found = d.pages.find((pg: Page) => pg.id === id);
                                if (found) return { db: d, page: found };
                            }
                            return null;
                        }
                        return { db: targetDb as Database, page: p };
                    }).filter(Boolean) as { db: Database, page: Page }[];

                    return (
                        <div key={prop.id} className="flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                            <div className="flex items-center justify-between px-4 py-3 bg-neutral-50/50 dark:bg-white/5 border-b border-neutral-100 dark:border-white/5">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                                    <Link2 className="w-3 h-3 opacity-50" />
                                    {prop.name}
                                </h3>
                                <button
                                    disabled={!!isCreating}
                                    onClick={() => handleCreateAndLink(prop)}
                                    className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-white/10 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isCreating === prop.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Plus className="w-2.5 h-2.5" />}
                                    Connect New
                                </button>
                            </div>

                            <div className="p-2 space-y-1.5">
                                {linkedPages.length > 0 ? (
                                    linkedPages.map((lp, idx) => (
                                        <button
                                            key={lp.page.id}
                                            onClick={() => router.push(`/${locale}/admin/database/${lp.db.id}/${lp.page.id}`)}
                                            className="w-full flex items-center justify-between p-2.5 bg-transparent hover:bg-neutral-50 dark:hover:bg-white/[0.03] border border-transparent hover:border-neutral-200 dark:hover:border-white/10 rounded-xl transition-all group text-left"
                                        >
                                            <div className="flex flex-col min-w-0 pr-2">
                                                <span className="text-xs font-bold text-neutral-900 dark:text-white group-hover:text-orange-500 transition-colors truncate">
                                                    {String(lp.page.properties['title'] || lp.page.properties['name'] || 'Untitled')}
                                                </span>
                                                <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mt-0.5">
                                                    {lp.db.name}
                                                </span>
                                            </div>
                                            <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-white/10 shrink-0 group-hover:bg-orange-500/10 transition-colors">
                                                <ExternalLink className="w-3 h-3 text-neutral-400 group-hover:text-orange-500 transition-colors" />
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="py-6 flex flex-col items-center justify-center text-neutral-400 opacity-50">
                                        <p className="text-[10px] italic">No records connected</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

import { Link2 } from 'lucide-react';
