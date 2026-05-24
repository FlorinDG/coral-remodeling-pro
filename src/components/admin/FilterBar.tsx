import { useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import SearchableSelect from '@/components/ui/SearchableSelect';

interface FilterBarProps {
    onSearch: (query: string) => void;
    onFilterChange: (status: string) => void;
    statuses: string[];
    placeholder?: string;
}

export default function FilterBar({ onSearch, onFilterChange, statuses, placeholder }: FilterBarProps) {
    const t = useTranslations('Admin.filter');
    const ts = useTranslations('Admin.status');
    const [statusValue, setStatusValue] = useState('ALL');

    return (
        <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                    type="text"
                    placeholder={placeholder || t('search')}
                    className="w-full bg-white dark:bg-black/20 border border-neutral-200 dark:border-white/5 rounded-xl pl-10 pr-4 py-2 text-sm focus:border-[var(--brand-color,#d35400)] transition-colors outline-none text-neutral-900 dark:text-white"
                    onChange={(e) => onSearch(e.target.value)}
                />
            </div>
            <div className="min-w-[160px]">
                <SearchableSelect
                    options={[
                        { value: 'ALL', label: t('all') },
                        ...statuses.map(status => ({ value: status, label: ts(status) })),
                    ]}
                    value={statusValue}
                    onChange={(v) => { setStatusValue(v); onFilterChange(v); }}
                    placeholder={t('all')}
                    searchPlaceholder="Filter..."
                />
            </div>
        </div>
    );
}
