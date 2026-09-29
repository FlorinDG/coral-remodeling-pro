"use client";
import { useState, useEffect, useCallback } from 'react';
import { getHrAnnouncements, markHrAnnouncementRead } from '@/app/actions/hr-announcements';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'normal' | 'important' | 'urgent';
  createdAt: string;
  createdBy: string;
  authorName?: string;
  isRead?: boolean;
  [key: string]: any;
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);

    try {
      const data = await getHrAnnouncements();
      
      setAnnouncements(data);
      setUnreadCount(data.filter((a: any) => !a.isRead).length);
    } catch (err) {
      console.warn('[useAnnouncements] Error:', err);
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const markAsRead = useCallback(async (announcementId: string) => {
    try {
      await markHrAnnouncementRead(announcementId);
      setAnnouncements(prev =>
        prev.map(a => a.id === announcementId ? { ...a, isRead: true } : a)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('[useAnnouncements] Failed to mark read:', error);
    }
  }, []);

  return {
    announcements,
    loading,
    unreadCount,
    markAsRead,
    refetch: fetchAnnouncements,
  };
}
