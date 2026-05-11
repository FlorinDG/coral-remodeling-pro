// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'normal' | 'important' | 'urgent';
  created_at: string;
  created_by: string;
  author_name?: string;
  is_read?: boolean;
}

export function useAnnouncements() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchAnnouncements = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      // Fetch announcements
      const { data: announcementData, error } = await supabase
        .from('announcements')
        .select('*, profiles:created_by(full_name)')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        // Table might not exist yet — graceful fallback
        console.warn('[useAnnouncements] Table may not exist:', error.message);
        setAnnouncements([]);
        setLoading(false);
        return;
      }

      // Fetch read status
      const { data: readData } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', user.id);

      const readIds = new Set((readData || []).map(r => r.announcement_id));

      const enriched: Announcement[] = (announcementData || []).map(a => ({
        id: a.id,
        title: a.title,
        content: a.content,
        priority: a.priority || 'normal',
        created_at: a.created_at,
        created_by: a.created_by,
        author_name: a.profiles?.full_name || 'Admin',
        is_read: readIds.has(a.id),
      }));

      setAnnouncements(enriched);
      setUnreadCount(enriched.filter(a => !a.is_read).length);
    } catch (err) {
      console.warn('[useAnnouncements] Error:', err);
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const markAsRead = useCallback(async (announcementId: string) => {
    if (!user?.id) return;

    await supabase
      .from('announcement_reads')
      .upsert({
        user_id: user.id,
        announcement_id: announcementId,
      }, {
        onConflict: 'user_id,announcement_id',
      });

    setAnnouncements(prev =>
      prev.map(a => a.id === announcementId ? { ...a, is_read: true } : a)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, [user?.id]);

  return {
    announcements,
    loading,
    unreadCount,
    markAsRead,
    refetch: fetchAnnouncements,
  };
}
