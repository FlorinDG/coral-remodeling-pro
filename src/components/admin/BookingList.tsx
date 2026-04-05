"use client";

import { useState } from 'react';
import FilterBar from './FilterBar';
import StatusBadge from './StatusBadge';
import { Calendar, Clock, ChevronRight, ChevronDown, Mail, User, Trash2, CalendarCheck, CheckSquare, Square, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { updateBookingStatus, deleteBooking, bulkDeleteBookings } from '@/app/actions/crm';

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

export default function BookingList({ bookings: initialBookings }: BookingListProps) {
    const t = useTranslations('Admin.bookings');
    const [bookings, setBookings] = useState(initialBookings);
    const [filter, setFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const filteredBookings = bookings.filter(booking => {
        const matchesFilter = filter === 'ALL' || booking.status === filter;
        const matchesSearch = booking.clientName.toLowerCase().includes(search.toLowerCase()) ||
            booking.clientEmail.toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const handleStatusUpdate = async (id: string, status: string) => {
        setUpdating(id);
        try {
            await updateBookingStatus(id, status);
            setBookings(prev => prev.map(booking => booking.id === id ? { ...booking, status } : booking));
        } catch {
            alert('Failed to update booking status');
        } finally {
            setUpdating(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this booking?')) return;
        setUpdating(id);
        try {
            await deleteBooking(id);
            setBookings(prev => prev.filter(booking => booking.id !== id));
        } catch {
            alert('Failed to delete booking');
        } finally {
            setUpdating(null);
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredBookings.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredBookings.map(b => b.id)));
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Delete ${selectedIds.size} selected bookings?`)) return;
        setUpdating('BULK');
        try {
            const ids = Array.from(selectedIds) as string[];
            await bulkDeleteBookings(ids);
            setBookings(prev => prev.filter(booking => !selectedIds.has(booking.id)));
            setSelectedIds(new Set());
        } catch {
            alert('Failed to delete bookings');
        } finally {
            setUpdating(null);
        }
    };

    return (
        <div className="bg-neutral-50 dark:bg-white/5 rounded-3xl border border-neutral-200 dark:border-white/5 p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-green-500/10 rounded-2xl">
                        <CalendarCheck className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white leading-tight">
                            {t('title')}
                        </h2>
                        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-0.5">
                            Active: <span className="text-green-500">{bookings.filter(b => b.status === 'CONFIRMED').length}</span> • Pending: <span className="text-yellow-500">{bookings.filter(b => b.status === 'PENDING').length}</span>
                        </p>
                    </div>
                </div>
                <span className="bg-black/5 dark:bg-white/10 text-xs px-3 py-1 rounded-full font-bold">{filteredBookings.length} matches</span>
            </div>

            {selectedIds.size > 0 && (
                <div className="mb-4 flex items-center justify-between bg-green-500/10 border border-green-500/20 px-4 py-2 rounded-xl animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-green-500">{selectedIds.size} SELECTED</span>
                        <div className="h-4 w-px bg-green-500/20" />
                        <button
                            onClick={handleBulkDelete}
                            disabled={updating === 'BULK'}
                            className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600 transition-colors flex items-center gap-1.5"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> DELETE ALL
                        </button>
                    </div>
                    <button onClick={() => setSelectedIds(new Set())} className="text-neutral-400 hover:text-neutral-600 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            <FilterBar
                onSearch={setSearch}
                onFilterChange={setFilter}
                statuses={['PENDING', 'CONFIRMED', 'CANCELLED']}
            />

            <div className="flex items-center justify-between mt-4 mb-2 px-2">
                <button
                    onClick={toggleSelectAll}
                    className="text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-[var(--brand-color,#d35400)] transition-colors flex items-center gap-2"
                >
                    {selectedIds.size === filteredBookings.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    {selectedIds.size === filteredBookings.length ? 'DESELECT ALL' : 'SELECT ALL'}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar mt-2">
                {filteredBookings.length === 0 && <p className="text-neutral-500 italic text-sm text-center py-10">{t('noBookings')}</p>}
                {filteredBookings.map(booking => (
                    <div
                        key={booking.id}
                        className={`group rounded-2xl transition-all border overflow-hidden ${expandedId === booking.id
                            ? 'bg-white dark:bg-white/10 border-[var(--brand-color,#d35400)]/30 shadow-lg'
                            : 'bg-white/80 dark:bg-black/20 border-neutral-200 dark:border-white/5 hover:border-[var(--brand-color,#d35400)]/20'
                            } ${selectedIds.has(booking.id) ? 'ring-2 ring-green-500/30 border-green-500/50' : ''}`}
                    >
                        <div className="flex items-center">
                            <div className="pl-4">
                                <button
                                    onClick={() => toggleSelect(booking.id)}
                                    className={`p-1 rounded-md transition-colors ${selectedIds.has(booking.id) ? 'text-green-500' : 'text-neutral-300 hover:text-neutral-400'}`}
                                >
                                    {selectedIds.has(booking.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                </button>
                            </div>
                            <div
                                className="p-4 flex-1 flex justify-between items-center cursor-pointer"
                                onClick={() => setExpandedId(expandedId === booking.id ? null : booking.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${booking.status === 'CONFIRMED' ? 'bg-green-500/10 text-green-500' : 'bg-neutral-100 dark:bg-white/5 text-neutral-500'
                                        }`}>
                                        <Calendar className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm text-neutral-900 dark:text-white group-hover:text-[var(--brand-color,#d35400)] transition-colors">{booking.clientName}</h3>
                                        <div className="flex gap-3 text-[10px] text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">
                                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(booking.date).toLocaleDateString()}</span>
                                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {booking.timeSlot}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <StatusBadge status={booking.status} />
                                    {expandedId === booking.id ? <ChevronDown className="w-4 h-4 text-[var(--brand-color,#d35400)]" /> : <ChevronRight className="w-4 h-4 text-neutral-400" />}
                                </div>
                            </div>
                        </div>

                        {expandedId === booking.id && (
                            <div className="px-4 pb-4 pt-2 ml-14 border-t border-neutral-100 dark:border-white/5 animate-in slide-in-from-top-2 duration-200">
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Client Contact</p>
                                        <a href={`mailto:${booking.clientEmail}`} className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300 hover:text-[var(--brand-color,#d35400)] transition-colors">
                                            <Mail className="w-3.5 h-3.5" /> {booking.clientEmail}
                                        </a>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Appointment</p>
                                        <p className="text-xs text-neutral-600 dark:text-neutral-300 font-bold">{booking.serviceType}</p>
                                        <p className="text-xs text-neutral-500">Confirmed for {booking.timeSlot} on {new Date(booking.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-white/5">
                                    <div className="flex gap-2">
                                        {['PENDING', 'CONFIRMED', 'CANCELLED'].map((status) => (
                                            <button
                                                key={status}
                                                onClick={() => handleStatusUpdate(booking.id, status)}
                                                disabled={!!updating}
                                                className={`text-[9px] font-bold px-2 py-1 rounded-md uppercase tracking-wider transition-all ${booking.status === status
                                                    ? 'bg-[var(--brand-color,#d35400)] text-white'
                                                    : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-white/10'
                                                    }`}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => handleDelete(booking.id)}
                                        disabled={!!updating}
                                        className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
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
