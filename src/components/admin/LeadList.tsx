import { useState } from 'react';
import FilterBar from './FilterBar';
import StatusBadge from './StatusBadge';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Lead {
    id: string;
    name: string;
    email: string;
    service: string;
    message?: string;
    status: string;
    createdAt: string;
}

interface LeadListProps {
    leads: Lead[];
}

export default function LeadList({ leads }: LeadListProps) {
    const t = useTranslations('Admin.leads');
    const [filter, setFilter] = useState('ALL');
    const [search, setSearch] = useState('');

    const filteredLeads = leads.filter(lead => {
        const matchesFilter = filter === 'ALL' || lead.status === filter;
        const matchesSearch = lead.name.toLowerCase().includes(search.toLowerCase()) ||
            lead.email.toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    return (
        <div className="bg-neutral-50 dark:bg-white/5 rounded-3xl border border-neutral-200 dark:border-white/5 p-6 h-full flex flex-col">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-neutral-900 dark:text-white">
                {t('title')}
                <span className="bg-black/5 dark:bg-white/10 text-xs px-2 py-1 rounded-full">{filteredLeads.length}</span>
            </h2>

            <FilterBar
                onSearch={setSearch}
                onFilterChange={setFilter}
                statuses={['NEW', 'CONTACTED', 'CONVERTED', 'ARCHIVED']}
            />

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {filteredLeads.length === 0 && <p className="text-neutral-500 italic text-sm text-center py-10">{t('noLeads')}</p>}
                {filteredLeads.map(lead => (
                    <div key={lead.id} className="group p-4 rounded-xl bg-white/80 dark:bg-black/20 border border-neutral-200 dark:border-white/5 hover:border-[#d35400]/20 dark:hover:border-white/20 transition-all cursor-pointer flex justify-between items-center shadow-sm dark:shadow-none">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-sm text-neutral-900 dark:text-white group-hover:text-[#d35400] transition-colors">{lead.name}</h3>
                                <StatusBadge status={lead.status} />
                            </div>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">{lead.service} • {new Date(lead.createdAt).toLocaleDateString()}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-neutral-400 dark:text-neutral-600 group-hover:text-[#d35400] dark:group-hover:text-white transition-colors" />
                    </div>
                ))}
            </div>
        </div>
    );
}
