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
    const [loading, setLoading] = useState(isClientDb);
    const [data, setData] = useState<{
        projects: ProjectRecord[];
        quotations: QuotationRecord[];
        invoices: InvoiceRecord[];
    } | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const { resolveDbId } = useTenant();
    const router = useRouter();
    const params = useParams();
    const locale = (params.locale as string) || 'nl';

    const allDatabases = useDatabaseStore((state) => state.databases);
    const database = allDatabases.find((d: Database) => d.id === databaseId);
    const page = database?.pages.find((p: Page) => p.id === pageId);

    useEffect(() => {
        if (!isClientDb) return;

        getLinkedRecordsForClient(pageId).then(res => {
            if (res.success && res.data) {
                setData(res.data as {
                    projects: ProjectRecord[];
                    quotations: QuotationRecord[];
                    invoices: InvoiceRecord[];
                });
            }
            setLoading(false);
        });
    }, [pageId, isClientDb]);

    if (!isClientDb) {
        if (!database || !page) return null;

        const relationProps = database.properties.filter((p: Property) => p.type === 'relation');
        const activeRelations = relationProps.map((prop: Property) => {
            const ids = (page.properties[prop.id] as string[]) || [];
            if (ids.length === 0) return null;

            const targetDbId = prop.config?.relationDatabaseId;
            const targetDb = allDatabases.find((d: Database) => d.id === targetDbId);
            
            const linkedPages = ids.map(id => {
                const p = targetDb?.pages.find((pg: Page) => pg.id === id);
                if (!p) {
                    for (const d of allDatabases) {
                        const found = d.pages.find((pg: Page) => pg.id === id);
                        if (found) return { db: d, page: found };
                    }
                    return null;
                }
                return { db: targetDb, page: p };
            }).filter(Boolean);

            if (linkedPages.length === 0) return null;
            return { prop, linkedPages };
        }).filter(Boolean) as { prop: Property, linkedPages: { db: Database, page: Page }[] }[];

        if (activeRelations.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-neutral-400">
                    <ExternalLink className="w-8 h-8 opacity-20 mb-3" />
                    <p className="text-xs">No connected records found for this item.</p>
                </div>
            );
        }

        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex flex-col gap-4">
                    {activeRelations.map(rel => (
                        <div key={rel.prop.id} className="flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl p-4 shadow-sm">
                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-3">
                                {rel.prop.name}
                            </h3>
                            <div className="flex flex-col gap-2">
                                {rel.linkedPages.map((lp, idx) => (
                                    <Link
                                        key={idx}
                                        href={`/admin/database/${lp.db.id}/${lp.page.id}`}
                                        className="flex items-center justify-between p-3 bg-neutral-50/50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/10 rounded-xl hover:border-orange-500/50 hover:shadow-sm transition-all group"
                                    >
                                        <div className="flex flex-col min-w-0 pr-2">
                                            <span className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-orange-500 transition-colors truncate">
                                                {String(lp.page.properties['title'] || lp.page.properties['name'] || 'Untitled')}
                                            </span>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mt-1">
                                                {lp.db.name}
                                            </span>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-white/10 shrink-0 group-hover:bg-orange-50 dark:group-hover:bg-orange-500/10 transition-colors">
                                            <ExternalLink className="w-3.5 h-3.5 text-neutral-400 group-hover:text-orange-500 transition-colors" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
            </div>
        );
    }

    const sections = [
        {
            title: 'Projects',
            icon: <Briefcase className="w-4 h-4 text-blue-500" />,
            items: data?.projects || [],
            emptyMsg: 'No projects found.',
            linkBase: '/admin/projects-management/bordereau/',
            getLabel: (item: ProjectRecord) => `${item.projectCode}: ${item.name}`,
            getStatus: (item: ProjectRecord) => item.status,
            getValue: null as ((item: ProjectRecord) => string) | null,
        },
        {
            title: 'Quotations',
            icon: <FileText className="w-4 h-4 text-orange-500" />,
            items: data?.quotations || [],
            emptyMsg: 'No quotations found.',
            linkBase: '/admin/quotations/',
            getLabel: (item: QuotationRecord) => `${item.quoteNumber}`,
            getStatus: (item: QuotationRecord) => item.status,
            getValue: (item: QuotationRecord) => `€${item.total.toFixed(2)}`,
        },
        {
            title: 'Invoices',
            icon: <Receipt className="w-4 h-4 text-emerald-500" />,
            items: data?.invoices || [],
            emptyMsg: 'No invoices found.',
            linkBase: '/admin/financials/invoices/',
            getLabel: (item: InvoiceRecord) => `${item.invoiceNumber}`,
            getStatus: (item: InvoiceRecord) => item.status,
            getValue: (item: InvoiceRecord) => `€${item.total.toFixed(2)}`,
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <header className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-black tracking-tight">Customer Context</h2>
                    <p className="text-xs text-neutral-500">Cross-module links for this client.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        disabled={isCreating}
                        onClick={async () => {
                            setIsCreating(true);
                            const quoteDbId = resolveDbId('db-quotations');
                            const clientName = String(page?.properties['title'] || page?.properties['name'] || 'Client');
                            
                            const res = await createPageServerFirst(quoteDbId, {
                                betreft: `Offerte voor ${clientName}`,
                                client: [pageId],
                                status: 'opt-1776890873348', // Draft ID from db-quotations config
                            });

                            if (res.success) {
                                router.push(`/${locale}/admin/database/${quoteDbId}/${res.page.id}`);
                            } else {
                                setIsCreating(false);
                                console.error('Failed to create quotation:', res.error);
                            }
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isCreating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        Create Quotation
                    </button>
                </div>
            </header>

            <div className="flex flex-col gap-4">
                {sections.map(section => (
                    <div key={section.title} className="flex flex-col bg-neutral-50/50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/10 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-4">
                            {section.icon}
                            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                                {section.title}
                            </h3>
                            <span className="ml-auto text-[10px] font-bold text-neutral-400 bg-neutral-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
                                {section.items.length}
                            </span>
                        </div>

                        <div className="space-y-2 flex-1">
                            {section.items.length > 0 ? (
                                section.items.map(item => (
                                    <Link
                                        key={item.id}
                                        href={`${section.linkBase}${item.id}`}
                                        className="group flex flex-col p-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl hover:border-orange-500/50 hover:shadow-md transition-all"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="text-xs font-bold truncate group-hover:text-orange-500 transition-colors">
                                                {section.getLabel(item)}
                                            </span>
                                            <ExternalLink className="w-3 h-3 text-neutral-300 group-hover:text-orange-500 opacity-0 group-hover:opacity-100 transition-all shrink-0" />
                                        </div>
                                        <div className="flex items-center justify-between mt-1.5">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                                                {section.getStatus(item).replace('opt-', '').replace('_', ' ')}
                                            </span>
                                            {section.getValue && (
                                                <span className="text-[10px] font-mono font-bold text-neutral-600 dark:text-neutral-300">
                                                    {section.getValue(item)}
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-neutral-100 dark:border-white/5 rounded-xl">
                                    <p className="text-[10px] text-neutral-400 italic">{section.emptyMsg}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
