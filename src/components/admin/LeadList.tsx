import { useState } from 'react';
import FilterBar from './FilterBar';
import StatusBadge from './StatusBadge';
import { ChevronRight, ChevronDown, Mail, Phone, MessageSquare, Clock, User, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { updateLeadStatus } from '@/app/actions/crm';

interface Lead {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    service: string;
    message?: string;
    status: string;
    createdAt: string;
}

interface LeadListProps {
    leads: Lead[];
}

export default function LeadList({ leads: initialLeads }: LeadListProps) {
    const t = useTranslations('Admin.leads');
    const [leads, setLeads] = useState(initialLeads);
    const [filter, setFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);

    const filteredLeads = leads.filter(lead => {
        const matchesFilter = filter === 'ALL' || lead.status === filter;
        const matchesSearch = lead.name.toLowerCase().includes(search.toLowerCase()) ||
            lead.email.toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const handleStatusUpdate = async (id: string, status: string) => {
        setUpdating(id);
        try {
            await updateLeadStatus(id, status);
            setLeads(prev => prev.map(lead => lead.id === id ? { ...lead, status } : lead));
        } catch {
            alert('Failed to update lead status');
        } finally {
            setUpdating(null);
        }
    };

    return (
        <div className="bg-neutral-50 dark:bg-white/5 rounded-3xl border border-neutral-200 dark:border-white/5 p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/10 rounded-2xl">
                        <User className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white leading-tight">
                            {t('title')}
                        </h2>
                        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-0.5">
                            Total: <span className="text-blue-500">{leads.length}</span> • New: <span className="text-green-500">{leads.filter(l => l.status === 'NEW').length}</span>
                        </p>
                    </div>
                </div>
                <span className="bg-black/5 dark:bg-white/10 text-xs px-3 py-1 rounded-full font-bold">{filteredLeads.length} matches</span>
            </div>

            <FilterBar
                onSearch={setSearch}
                onFilterChange={setFilter}
                statuses={['NEW', 'CONTACTED', 'CONVERTED', 'ARCHIVED']}
            />

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar mt-4">
                {filteredLeads.length === 0 && <p className="text-neutral-500 italic text-sm text-center py-10">{t('noLeads')}</p>}
                {filteredLeads.map(lead => (
                    <div
                        key={lead.id}
                        className={`group rounded-2xl transition-all border overflow-hidden ${expandedId === lead.id
                            ? 'bg-white dark:bg-white/10 border-[#d35400]/30 shadow-lg'
                            : 'bg-white/80 dark:bg-black/20 border-neutral-200 dark:border-white/5 hover:border-[#d35400]/20'
                            }`}
                    >
                        <div
                            className="p-4 flex justify-between items-center cursor-pointer"
                            onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${lead.status === 'NEW' ? 'bg-blue-500/10 text-blue-500' : 'bg-neutral-100 dark:bg-white/5 text-neutral-500'
                                    }`}>
                                    {lead.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-neutral-900 dark:text-white group-hover:text-[#d35400] transition-colors">{lead.name}</h3>
                                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">{lead.service} • {new Date(lead.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <StatusBadge status={lead.status} />
                                {expandedId === lead.id ? <ChevronDown className="w-4 h-4 text-[#d35400]" /> : <ChevronRight className="w-4 h-4 text-neutral-400" />}
                            </div>
                        </div>

                        {expandedId === lead.id && (
                            <div className="px-4 pb-4 pt-2 border-t border-neutral-100 dark:border-white/5 animate-in slide-in-from-top-2 duration-200">
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Contact Info</p>
                                        <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300 hover:text-[#d35400] transition-colors">
                                            <Mail className="w-3.5 h-3.5" /> {lead.email}
                                        </a>
                                        {lead.phone && (
                                            <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300 hover:text-[#d35400] transition-colors">
                                                <Phone className="w-3.5 h-3.5" /> {lead.phone}
                                            </a>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Inquiry Details</p>
                                        <div className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                                            <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                            <p className="italic leading-relaxed">"{lead.message || 'No message provided.'}"</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-white/5">
                                    <div className="flex gap-2">
                                        {['NEW', 'CONTACTED', 'CONVERTED', 'ARCHIVED'].map((status) => (
                                            <button
                                                key={status}
                                                onClick={() => handleStatusUpdate(lead.id, status)}
                                                disabled={updating === lead.id}
                                                className={`text-[9px] font-bold px-2 py-1 rounded-md uppercase tracking-wider transition-all ${lead.status === status
                                                    ? 'bg-[#d35400] text-white'
                                                    : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-white/10'
                                                    }`}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                    <button className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
