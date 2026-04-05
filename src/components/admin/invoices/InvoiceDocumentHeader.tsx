import React from 'react';
import { Page } from '@/components/admin/database/types';
import { User, Briefcase, FileText } from 'lucide-react';
import { useDatabaseStore } from '@/components/admin/database/store';

interface InvoiceDocumentHeaderProps {
    invoice: Page;
    onUpdateProperty: (key: string, value: any) => void;
}

export default function InvoiceDocumentHeader({ invoice, onUpdateProperty }: InvoiceDocumentHeaderProps) {
    const betreft = (invoice.properties?.['betreft'] as string) || '';
    const clientId = (invoice.properties?.['client'] as string) || '';
    const projectId = (invoice.properties?.['project'] as string) || '';

    // We can pull actual client data from db-clients later when wired up fully,
    // for now we provide a sleek manual override and relation picker visual layout.

    return (
        <div className="w-full flex flex-col gap-8 mb-12 relative p-8 bg-white dark:bg-[#111] rounded-xl border border-neutral-200 dark:border-white/10 shadow-sm">

            {/* Top Split: Company Logo & Info vs Client Info */}
            <div className="flex justify-between items-start w-full">

                {/* Left: Company Identity */}
                <div className="flex flex-col gap-1 text-sm text-neutral-500 dark:text-neutral-400">
                    <div className="text-2xl font-black text-black dark:text-white tracking-widest uppercase mb-2">
                        CORAL
                    </div>
                    <p>Coral Remodeling Pro</p>
                    <p>BTW: BE 0123.456.789</p>
                    <p>info@coral-remodeling.be</p>
                    <p>+32 400 00 00 00</p>
                    <p>Antwerp, Belgium</p>
                </div>

                {/* Right: Client / Relation Picker */}
                <div className="flex flex-col items-end gap-2 text-right">
                    <div className="text-xs uppercase tracking-widest font-bold text-neutral-400 mb-1">Factuur Voor</div>

                    {/* Placeholder for Client Selection */}
                    <div className="flex items-center gap-2 bg-neutral-100 dark:bg-white/5 px-4 py-2 rounded-lg cursor-pointer hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors">
                        <User className="w-4 h-4 text-neutral-500" />
                        <span className="text-sm font-medium text-black dark:text-white">
                            {clientId ? 'Client Relation Linked' : 'Selecteer Klant (Client)...'}
                        </span>
                    </div>

                    {/* Placeholder for Project Selection */}
                    <div className="flex items-center gap-2 bg-neutral-100 dark:bg-white/5 px-4 py-2 rounded-lg cursor-pointer hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors mt-1">
                        <Briefcase className="w-4 h-4 text-neutral-500" />
                        <span className="text-sm font-medium text-black dark:text-white">
                            {projectId ? 'Project Linked' : 'Koppel Project (Optioneel)'}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 bg-neutral-100 dark:bg-white/5 px-4 py-2 rounded-lg cursor-pointer hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors mt-1">
                        <FileText className="w-4 h-4 text-neutral-500" />
                        <span className="text-sm font-medium text-black dark:text-white">
                            Factuur nr: {invoice.id.slice(0, 8).toUpperCase()}
                        </span>
                    </div>
                </div>

            </div>

            {/* Betreft (Subject) Hero Input */}
            <div className="w-full mt-4 flex items-center gap-3 bg-neutral-50/50 dark:bg-[#111] py-1.5 px-3 rounded border border-neutral-200 dark:border-neutral-800 focus-within:border-blue-500 transition-colors">
                <label className="text-[11px] uppercase tracking-widest font-bold text-neutral-400 whitespace-nowrap">Betreft:</label>
                <input
                    type="text"
                    value={betreft}
                    onChange={(e) => onUpdateProperty('betreft', e.target.value)}
                    placeholder="e.g. Volledig badkamer renovatie incl. sanitair..."
                    className="flex-1 w-full text-base font-bold bg-transparent border-none outline-none focus:ring-0 placeholder:text-neutral-300 dark:placeholder:text-neutral-700 p-0 text-black dark:text-white"
                />
            </div>

        </div>
    );
}
