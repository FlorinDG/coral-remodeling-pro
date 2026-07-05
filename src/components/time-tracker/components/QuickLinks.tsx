// @ts-nocheck
"use client";
import {
  Briefcase,
  BookOpen,
  Calendar,
  Clock,
  TrendingUp,
  ExternalLink,
  User,
  MapPin,
  Users,
  CheckSquare,
  Loader2,
} from 'lucide-react';
import { Link, usePathname } from "@/i18n/routing";

import { useUserRoles } from '@/components/time-tracker/hooks/useUserRoles';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
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
    id: 'timeoff',
    title: 'Time Off',
    description: 'Request vacation and leave',
    icon: <Calendar className="w-6 h-6" />,
    url: '/time-off',
    gradient: 'bg-primary',
    isInternal: true,
  },
  {
    id: 'profile',
    title: 'My Profile',
    description: 'Settings, preferences, and support',
    icon: <User className="w-6 h-6" />,
    url: '/profile',
    gradient: 'bg-secondary',
    isInternal: true,
  },
];

import { useAppBasePath } from '@/components/time-tracker/hooks/useAppBasePath';

export function QuickLinks() {
  const pathname = usePathname();
  const isWorkhub = pathname.startsWith('/workhub');
  const basePath = useAppBasePath();
  
  const { isAdmin } = useUserRoles();
  const visibleLinks = quickLinks.filter(link => {
    if (isWorkhub) {
      // Unclog the grid: remove wiki (moves to hamburger), performance (crashes), and profile (moves to hamburger)
      return link.id === 'timeoff';
    }
    return !link.adminOnly || isAdmin;
  });

  const getLinkUrl = (linkObj) => {
    if (isWorkhub) {
      if (linkObj.id === 'timeoff') return '/workhub/leave';
    }
    if (linkObj.isInternal) {
      return `${basePath}${linkObj.url}`;
    }
    return linkObj.url;
  };

  return (
    <section className="w-full">
      <h2 className="text-xl font-semibold text-foreground mb-6">Quick Access</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                href={getLinkUrl(link)}
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
              href={getLinkUrl(link)}
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
