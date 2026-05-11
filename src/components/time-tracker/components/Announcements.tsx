// @ts-nocheck
"use client";
import { useState } from 'react';
import {
  Bell, ChevronRight, Circle, AlertTriangle, Info,
  CheckCircle2, X
} from 'lucide-react';
import { useAnnouncements, Announcement } from '@/components/time-tracker/hooks/useAnnouncements';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

function PriorityIcon({ priority }: { priority: string }) {
  switch (priority) {
    case 'urgent':
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case 'important':
      return <Info className="w-4 h-4 text-amber-500" />;
    default:
      return <Circle className="w-3 h-3 text-primary" />;
  }
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'normal') return null;

  const styles = priority === 'urgent'
    ? 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'
    : 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';

  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles}`}>
      {priority}
    </span>
  );
}

export function Announcements() {
  const { announcements, loading, unreadCount, markAsRead } = useAnnouncements();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Don't render at all if there are no announcements (table may not exist)
  if (loading || announcements.length === 0) return null;

  const handleExpand = (announcement: Announcement) => {
    if (expandedId === announcement.id) {
      setExpandedId(null);
    } else {
      setExpandedId(announcement.id);
      if (!announcement.is_read) {
        markAsRead(announcement.id);
      }
    }
  };

  return (
    <section className="w-full animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-foreground">Announcements</h2>
          {unreadCount > 0 && (
            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold text-white bg-primary rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {announcements.slice(0, 5).map(announcement => {
          const isExpanded = expandedId === announcement.id;
          const timeAgo = formatDistanceToNow(parseISO(announcement.created_at), { addSuffix: true });

          return (
            <button
              key={announcement.id}
              onClick={() => handleExpand(announcement)}
              className={`
                w-full text-left bg-card border rounded-xl transition-all duration-200
                hover:shadow-sm hover:border-primary/30
                ${!announcement.is_read
                  ? 'border-primary/30 bg-primary/[0.02]'
                  : 'border-border'
                }
              `}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Unread indicator */}
                  <div className="mt-1 flex-shrink-0">
                    {!announcement.is_read ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-muted" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <PriorityIcon priority={announcement.priority} />
                      <h3 className={`text-sm font-semibold truncate ${
                        !announcement.is_read ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {announcement.title}
                      </h3>
                      <PriorityBadge priority={announcement.priority} />
                    </div>

                    {/* Snippet or full content */}
                    <p className={`text-sm text-muted-foreground ${isExpanded ? '' : 'line-clamp-2'}`}>
                      {announcement.content}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{announcement.author_name}</span>
                      <span>·</span>
                      <span>{timeAgo}</span>
                      {announcement.is_read && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-0.5 text-secondary">
                            <CheckCircle2 className="w-3 h-3" />
                            Read
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expand indicator */}
                  <ChevronRight className={`w-4 h-4 text-muted-foreground flex-shrink-0 mt-1 transition-transform duration-200 ${
                    isExpanded ? 'rotate-90' : ''
                  }`} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
