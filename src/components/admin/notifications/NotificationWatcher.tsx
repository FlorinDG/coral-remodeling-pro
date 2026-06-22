'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function NotificationWatcher() {
    const router = useRouter();
    const shownIdsRef = useRef<Set<string>>(new Set());
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = async () => {
        try {
            const res = await fetch('/api/notifications?status=unread');
            if (!res.ok) return;
            const data = await res.json();
            
            if (data.unreadCount !== undefined) {
                setUnreadCount(data.unreadCount);
                window.dispatchEvent(new CustomEvent('notif-count-update', { detail: data.unreadCount }));
            }

            const items = data.items || [];
            
            items.forEach((notif: any) => {
                if (!shownIdsRef.current.has(notif.id)) {
                    shownIdsRef.current.add(notif.id);
                    toast(notif.title, {
                        id: notif.id,
                        description: notif.body,
                        duration: Infinity,
                        action: {
                            label: 'View',
                            onClick: () => {
                                // Mark read and navigate
                                fetch('/api/notifications/mark-read', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ ids: [notif.id] })
                                }).then(() => {
                                    window.dispatchEvent(new CustomEvent('notif-refresh'));
                                });
                                toast.dismiss(notif.id);
                                router.push(notif.href);
                            }
                        },
                        onDismiss: () => {
                            // Do nothing, it will re-trigger next time if still unread
                        }
                    });
                }
            });
        } catch (e) {
            console.error('Failed to fetch notifications', e);
        }
    };

    useEffect(() => {
        fetchNotifications();

        const interval = setInterval(() => {
            fetchNotifications();
        }, 30000); // 30s poll

        const handleFocus = () => {
            fetchNotifications();
        };
        
        const handleRefresh = () => {
            fetchNotifications();
        };

        window.addEventListener('focus', handleFocus);
        window.addEventListener('notif-refresh', handleRefresh);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('notif-refresh', handleRefresh);
        };
    }, []);

    return null;
}
