import { Search } from 'lucide-react';

interface FilterBarProps {
    onSearch: (query: string) => void;
    onFilterChange: (status: string) => void;
    statuses: string[];
    placeholder?: string;
}

export default function FilterBar({ onSearch, onFilterChange, statuses, placeholder = "Search..." }: FilterBarProps) {
    return (
        <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                    type="text"
                    placeholder={placeholder}
                    className="w-full bg-black/20 border border-white/5 rounded-xl pl-10 pr-4 py-2 text-sm focus:border-white/20 transition-colors outline-none"
                    onChange={(e) => onSearch(e.target.value)}
                />
            </div>
            <select
                className="bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-sm outline-none focus:border-white/20 cursor-pointer appearance-none"
                onChange={(e) => onFilterChange(e.target.value)}
            >
                <option value="ALL">All Status</option>
                {statuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                ))}
            </select>
        </div>
    );
}
