import { useState } from 'react';
import FilterBar from './FilterBar';
import StatusBadge from './StatusBadge';
import { Calendar, Clock, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Booking {
    id: string;
    clientName: string;
    clientEmail: string;
    serviceType: string;
    date: string;
    timeSlot: string;
    status: string;
}

interface BookingListProps {
    bookings: Booking[];
}

export default function BookingList({ bookings }: BookingListProps) {
    const t = useTranslations('Admin.bookings');
    const [filter, setFilter] = useState('ALL');
    const [search, setSearch] = useState('');

    const filteredBookings = bookings.filter(booking => {
        const matchesFilter = filter === 'ALL' || booking.status === filter;
        const matchesSearch = booking.clientName.toLowerCase().includes(search.toLowerCase()) ||
            booking.clientEmail.toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    return (
        <div className="bg-neutral-50 dark:bg-white/5 rounded-3xl border border-neutral-200 dark:border-white/5 p-6 h-full flex flex-col">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-neutral-900 dark:text-white">
                {t('title')}
                <span className="bg-black/5 dark:bg-white/10 text-xs px-2 py-1 rounded-full">{filteredBookings.length}</span>
            </h2>

            <FilterBar
                onSearch={setSearch}
                onFilterChange={setFilter}
                statuses={['PENDING', 'CONFIRMED', 'CANCELLED']}
            />

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {filteredBookings.length === 0 && <p className="text-neutral-500 italic text-sm text-center py-10">{t('noBookings')}</p>}
                {filteredBookings.map(booking => (
                    <div key={booking.id} className="group p-4 rounded-xl bg-white/80 dark:bg-black/20 border border-neutral-200 dark:border-white/5 hover:border-[#d35400]/20 dark:hover:border-white/20 transition-all cursor-pointer flex justify-between items-center shadow-sm dark:shadow-none">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-sm text-neutral-900 dark:text-white group-hover:text-[#d35400] transition-colors">{booking.clientName}</h3>
                                <StatusBadge status={booking.status} />
                            </div>
                            <div className="flex gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(booking.date).toLocaleDateString()}</span>
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {booking.timeSlot}</span>
                            </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-neutral-400 dark:text-neutral-600 group-hover:text-[#d35400] dark:group-hover:text-white transition-colors" />
                    </div>
                ))}
            </div>
        </div>
    );
}
