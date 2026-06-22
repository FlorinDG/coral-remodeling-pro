'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function NotificationBell() {
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    useEffect(() => {
        const handleCountUpdate = (e: any) => setUnreadCount(e.detail);
        window.addEventListener('notif-count-update', handleCountUpdate);
        return () => window.removeEventListener('notif-count-update', handleCountUpdate);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            fetchHistory();
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/notifications?status=all');
            const data = await res.json();
            setNotifications(data.items || []);
            setUnreadCount(data.unreadCount || 0);
        } catch (e) {
            console.error('Failed to fetch notifications history', e);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await fetch('/api/notifications/mark-read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: 'all' })
            });
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, status: 'READ' })));
            window.dispatchEvent(new CustomEvent('notif-refresh'));
            toast.success('All notifications marked as read');
        } catch (e) {
            toast.error('Failed to mark all as read');
        }
    };

    const handleItemClick = async (notif: any) => {
        setIsOpen(false);
        if (notif.status === 'UNREAD') {
            await fetch('/api/notifications/mark-read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [notif.id] })
            });
            window.dispatchEvent(new CustomEvent('notif-refresh'));
        }
        toast.dismiss(notif.id);
        router.push(notif.href);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
            >
                <Bell className="w-5 h-5 text-neutral-600 dark:text-neutral-300" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-black"></span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 max-h-96 bg-white dark:bg-black border border-neutral-200 dark:border-white/10 shadow-xl rounded-xl z-50 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-white/10 shrink-0">
                        <h3 className="font-bold text-sm">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            >
                                <Check className="w-3 h-3" /> Mark all read
                            </button>
                        )}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="p-4 text-center text-xs text-neutral-500">Loading...</div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center text-neutral-500">
                                <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">No notifications</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-neutral-100 dark:divide-white/5">
                                {notifications.map(notif => (
                                    <div
                                        key={notif.id}
                                        onClick={() => handleItemClick(notif)}
                                        className={`p-3 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors ${
                                            notif.status === 'UNREAD' ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className={`text-sm font-semibold truncate ${notif.status === 'UNREAD' ? 'text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-neutral-300'}`}>
                                                        {notif.title}
                                                    </p>
                                                    {notif.status === 'UNREAD' && (
                                                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-0.5">
                                                    {notif.body}
                                                </p>
                                                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1.5 uppercase tracking-wider">
                                                    {new Date(notif.createdAt).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
