"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import React, { useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useDatabaseStore } from '@/components/admin/database/store';
import { Users, Plus, Building2, Phone, Mail, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import CreateClientModal from '@/components/admin/invoices/CreateClientModal';
import PageModal from '@/components/admin/database/components/PageModal';
import { Page } from '@/components/admin/database/types';

const FALLBACK_PAGES: Page[] = [];

export default function MobileClientsPage() {
    const t = useTranslations('Mobile');
    const { resolveDbId } = useTenant();
    const getDatabase = useDatabaseStore(s => s.getDatabase);
    const createPage = useDatabaseStore(s => s.createPage);
    const clientsDbId = resolveDbId('db-clients');

    const [showNewClientModal, setShowNewClientModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activePageId, setActivePageId] = useState<string | null>(null);

    const db = getDatabase(clientsDbId);
    const rawPages = db?.pages || FALLBACK_PAGES;

    const clients = rawPages.map(p => {
        const props = p.properties as Record<string, any>;
        return {
            id: p.id,
            name: String(props['title'] || 'Unnamed Client'),
            company: String(props['company'] || ''),
            vat: String(props['vat'] || ''),
            phone: String(props['phone'] || ''),
            email: String(props['email'] || ''),
        };
    }).filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.vat.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));

    const handleClientCreated = () => {
        setShowNewClientModal(false);
    };

    return (
        <div className="max-w-lg mx-auto px-4 py-4 space-y-4 relative min-h-[calc(100vh-8rem)]">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-black tracking-tight">{t('cli_title')}</h1>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">{t('cli_subtitle')}</p>
                </div>
                <button
                    onClick={() => setShowNewClientModal(true)}
                    className="w-8 h-8 rounded-full bg-[var(--brand-color,#d35400)] text-white flex items-center justify-center shadow-md active:scale-95 transition-all"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={t('cli_search')}
                    className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:border-[var(--brand-color)] focus:ring-1 focus:ring-[var(--brand-color)] transition-all"
                />
            </div>

            {/* List */}
            {clients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center mb-4">
                        <Users className="w-7 h-7 text-neutral-300 dark:text-neutral-600" />
                    </div>
                    <p className="text-sm font-semibold text-neutral-500">
                        {searchQuery ? t('cli_empty_search') : t('cli_empty_title')}
                    </p>
                    <p className="text-xs text-neutral-400 mt-1 max-w-[250px]">
                        {searchQuery ? t('cli_empty_search_desc') : t('cli_empty_desc')}
                    </p>
                </div>
            ) : (
                <div className="pb-20">
                    <div className="divide-y divide-neutral-100 dark:divide-white/5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/5 overflow-hidden">
                        {clients.map(client => (
                            <div
                                key={client.id}
                                onClick={() => setActivePageId(client.id)}
                                className="p-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors cursor-pointer"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-sm font-bold text-neutral-900 dark:text-white truncate">{client.name}</span>
                                            {client.company && <span className="text-xs text-neutral-400 truncate">({client.company})</span>}
                                        </div>
                                        {client.vat && (
                                            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mt-0.5">
                                                {client.vat}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                        {client.phone && (
                                            <a href={`tel:${client.phone}`} className="p-2 bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/5 rounded-xl text-neutral-600 dark:text-neutral-400 hover:text-[var(--brand-color)] hover:bg-[var(--brand-color)]/10 transition-colors">
                                                <Phone className="w-4 h-4" />
                                            </a>
                                        )}
                                        {client.email && (
                                            <a href={`mailto:${client.email}`} className="p-2 bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/5 rounded-xl text-neutral-600 dark:text-neutral-400 hover:text-[var(--brand-color)] hover:bg-[var(--brand-color)]/10 transition-colors">
                                                <Mail className="w-4 h-4" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Create Client Modal */}
            <CreateClientModal
                isOpen={showNewClientModal}
                onClose={() => setShowNewClientModal(false)}
                onCreated={handleClientCreated}
                createPage={createPage}
                clientsDbId={clientsDbId}
            />

            {activePageId && (
                <PageModal
                    onClose={() => setActivePageId(null)}
                    databaseId={clientsDbId}
                    pageId={activePageId}
                />
            )}
        </div>
    );
}
