"use client";

import React, { useEffect, useState } from 'react';
import { getLinkedRecordsForClient } from '@/app/actions/crm';
import { Briefcase, FileText, Receipt, ExternalLink, Loader2, Plus } from 'lucide-react';
import { Link } from '@/i18n/routing';

interface LinkedRecordsProps {
    databaseId: string;
    pageId: string;
}

export default function LinkedRecords({ databaseId, pageId }: LinkedRecordsProps) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{
        projects: any[];
        quotations: any[];
        invoices: any[];
    } | null>(null);

    const isClientDb = databaseId.includes('db-clients');

    useEffect(() => {
        if (!isClientDb) {
            setLoading(false);
            return;
        }

        getLinkedRecordsForClient(pageId).then(res => {
            if (res.success && res.data) {
                setData(res.data as any);
            }
            setLoading(false);
        });
    }, [pageId, isClientDb]);

    if (!isClientDb) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-neutral-400">
                <FileText className="w-8 h-8 opacity-20 mb-3" />
                <p className="text-xs">Select a client record to view linked items.</p>
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
            getLabel: (item: any) => `${item.projectCode}: ${item.name}`,
            getStatus: (item: any) => item.status,
        },
        {
            title: 'Quotations',
            icon: <FileText className="w-4 h-4 text-orange-500" />,
            items: data?.quotations || [],
            emptyMsg: 'No quotations found.',
            linkBase: '/admin/quotations/',
            getLabel: (item: any) => `${item.quoteNumber}`,
            getStatus: (item: any) => item.status,
            getValue: (item: any) => `€${item.total.toFixed(2)}`,
        },
        {
            title: 'Invoices',
            icon: <Receipt className="w-4 h-4 text-emerald-500" />,
            items: data?.invoices || [],
            emptyMsg: 'No invoices found.',
            linkBase: '/admin/financials/invoices/',
            getLabel: (item: any) => `${item.invoiceNumber}`,
            getStatus: (item: any) => item.status,
            getValue: (item: any) => `€${item.total.toFixed(2)}`,
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
                    {/* Add shortcut buttons if needed */}
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
