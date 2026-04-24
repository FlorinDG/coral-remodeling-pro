// @ts-nocheck
"use client";
// @ts-nocheck — Legacy Supabase component, progressive migration to camelCase
import {
  Briefcase,
  BookOpen,
  Calendar,
  Clock,
  TrendingUp,
  ExternalLink,
  Shield,
  MapPin,
  Users,
  CheckSquare,
  Loader2,
} from 'lucide-react';
import { Link } from "@/i18n/routing";

import { useUserRoles } from '@/components/time-tracker/hooks/useUserRoles';
import { useScheduledShifts } from '@/components/time-tracker/hooks/useScheduledShifts';
import { useShiftTasks } from '@/components/time-tracker/hooks/useTasks';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';

interface QuickLink {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  url: string;
  gradient: string;
  isInternal?: boolean;
  adminOnly?: boolean;
  managerOnly?: boolean;
}

const quickLinks: QuickLink[] = [
  {
    id: 'wiki',
    title: 'Company Wiki',
    description: 'Policies, procedures, and resources',
    icon: <BookOpen className="w-6 h-6" />,
    url: '#',
    gradient: 'bg-secondary',
  },
  {
    id: 'timeoff',
    title: 'Time Off',
    description: 'Request vacation and leave',
    icon: <Calendar className="w-6 h-6" />,
    url: '/time-off',
    gradient: 'bg-primary',
    isInternal: true,
  },
  {
    id: 'performance',
    title: 'Performance',
    description: 'Track your stats and request time off',
    icon: <TrendingUp className="w-6 h-6" />,
    url: '/performance',
    gradient: 'bg-primary',
    isInternal: true,
  },
  {
    id: 'admin',
    title: 'Admin Dashboard',
    description: 'Manage users, roles, and schedules',
    icon: <Shield className="w-6 h-6" />,
    url: '/admin',
    gradient: 'bg-destructive',
    isInternal: true,
    adminOnly: true,
  },
];

export function QuickLinks() {
  const { user } = useAuth();
  const { isAdmin } = useUserRoles();
  const { shifts, loading: schedulesLoading } = useScheduledShifts();

  const visibleLinks = quickLinks.filter(link => !link.adminOnly || isAdmin);

  // Get the next upcoming shift for the current user
  const now = new Date();
  const nextShift = shifts
    .filter(s => {
      if (s.user_id !== user?.id) return false;
      const shiftDate = parseISO(s.shift_date);
      return shiftDate >= new Date(now.toDateString());
    })
    .sort((a, b) => {
      const dateA = parseISO(a.shift_date);
      const dateB = parseISO(b.shift_date);
      if (dateA.getTime() !== dateB.getTime()) return dateA.getTime() - dateB.getTime();
      return a.shift_start.localeCompare(b.shift_start);
    })[0];

  // Get tasks for the next shift
  const { shiftTasks, loading: tasksLoading } = useShiftTasks(nextShift?.id || '');
  const pendingTasks = shiftTasks.filter(st => st.status === 'pending');

  return (
    <section className="w-full">
      <h2 className="text-xl font-semibold text-foreground mb-6">Quick Access</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* My Schedule Card */}
        <Link
          href="/admin/hr/time-tracker/schedule"
          className="link-card group animate-fade-in"
        >
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-secondary-foreground mb-4 group-hover:scale-110 transition-transform duration-300">
            <Clock className="w-6 h-6" />
          </div>

          <div className="flex-1">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              My Schedule
            </h3>
            {schedulesLoading ? (
              <div className="flex items-center gap-2 mt-1">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : nextShift ? (
              <div className="text-sm text-muted-foreground mt-1 space-y-1">
                <div>
                  <span className="font-medium text-foreground">
                    {isToday(parseISO(nextShift.shift_date))
                      ? 'Today'
                      : isTomorrow(parseISO(nextShift.shift_date))
                        ? 'Tomorrow'
                        : format(parseISO(nextShift.shift_date), 'EEEE, MMM d')}
                  </span>
                  <span> · {nextShift.shift_start} - {nextShift.shift_end}</span>
                </div>
                {nextShift.project?.name && (
                  <div className="flex items-center gap-1 text-xs">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{nextShift.project.name}</span>
                  </div>
                )}
                {nextShift.role && (
                  <div className="flex items-center gap-1 text-xs">
                    <Users className="h-3 w-3" />
                    <span>{nextShift.role}</span>
                  </div>
                )}
                {!tasksLoading && pendingTasks.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-primary">
                    <CheckSquare className="h-3 w-3" />
                    <span>{pendingTasks.length} task{pendingTasks.length !== 1 ? 's' : ''} assigned</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">
                No shifts scheduled
              </p>
            )}
          </div>
        </Link>

        {/* Navigation Links */}
        {visibleLinks.map((link, index) => {
          const content = (
            <>
              <div className={`w-12 h-12 rounded-xl ${link.gradient} flex items-center justify-center text-primary-foreground mb-4 group-hover:scale-110 transition-transform duration-300`}>
                {link.icon}
              </div>

              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {link.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {link.description}
                  </p>
                </div>
                {!link.isInternal && (
                  <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                )}
              </div>
            </>
          );

          if (link.isInternal) {
            return (
              <Link
                key={link.id}
                href={link.url}
                className="link-card group animate-fade-in"
                style={{ animationDelay: `${(index + 1) * 100}ms` }}
              >
                {content}
              </Link>
            );
          }

          return (
            <a
              key={link.id}
              href={link.url}
              target={link.url.startsWith('http') ? '_blank' : undefined}
              rel={link.url.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="link-card group animate-fade-in"
              style={{ animationDelay: `${(index + 1) * 100}ms` }}
            >
              {content}
            </a>
          );
        })}
      </div>
    </section>
  );
}
