"use client";

import React, { useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useDatabaseStore } from '@/components/admin/database/store';
import { Users, Plus, Building2, Phone, Mail, Search } from 'lucide-react';
import CreateClientModal from '@/components/admin/invoices/CreateClientModal';
import { Page } from '@/components/admin/database/types';

const FALLBACK_PAGES: Page[] = [];

export default function MobileClientsPage() {
    const { resolveDbId } = useTenant();
    const getDatabase = useDatabaseStore(s => s.getDatabase);
    const createPage = useDatabaseStore(s => s.createPage);
    const clientsDbId = resolveDbId('db-clients');

    const [showNewClientModal, setShowNewClientModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

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
                    <h1 className="text-lg font-black tracking-tight">Clients</h1>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">Directory</p>
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
                    placeholder="Search clients..."
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
                        {searchQuery ? 'No clients found' : 'No clients yet'}
                    </p>
                    <p className="text-xs text-neutral-400 mt-1 max-w-[250px]">
                        {searchQuery ? 'Try a different search term.' : 'Add your first client to start creating invoices.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-2 pb-20">
                    {clients.map(client => (
                        <div
                            key={client.id}
                            className="p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/5 shadow-sm"
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[var(--brand-color,#d35400)]/10 text-[var(--brand-color,#d35400)] flex items-center justify-center text-sm font-bold uppercase shrink-0">
                                    {client.name.charAt(0)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">{client.name}</p>
                                    {client.company && (
                                        <p className="text-xs text-neutral-500 flex items-center gap-1.5 mt-1 truncate">
                                            <Building2 className="w-3.5 h-3.5" />
                                            {client.company}
                                        </p>
                                    )}
                                    {client.vat && (
                                        <p className="text-[10px] font-medium text-neutral-400 mt-1 uppercase tracking-wider">
                                            {client.vat}
                                        </p>
                                    )}
                                    
                                    {(client.phone || client.email) && (
                                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-dashed border-neutral-100 dark:border-white/5">
                                            {client.phone && (
                                                <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:text-[var(--brand-color)]">
                                                    <Phone className="w-3.5 h-3.5" />
                                                    Call
                                                </a>
                                            )}
                                            {client.email && (
                                                <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:text-[var(--brand-color)]">
                                                    <Mail className="w-3.5 h-3.5" />
                                                    Email
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
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
        </div>
    );
}
