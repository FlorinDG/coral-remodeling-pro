"use client";
import { useState } from 'react';
import { Header } from '@/components/time-tracker/components/Header';
import { ClockButton } from '@/components/time-tracker/components/ClockButton';
import { MySchedule } from '@/components/time-tracker/components/MySchedule';
import { Announcements } from '@/components/time-tracker/components/Announcements';
import { Documents } from '@/components/time-tracker/components/Documents';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { useUserRoles } from '@/components/time-tracker/hooks/useUserRoles';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';
import { SiteVisitModal } from '@/components/time-tracker/components/SiteVisitModal';

interface IndexProps {
  /** When true, hides standalone Header/Footer — used when rendered inside AdminLayout */
  embedded?: boolean;
}

export default function Index({ embedded = false }: IndexProps) {
  const { user, loading } = useAuth();
  const { isAdmin } = useUserRoles();
  const [siteVisitOpen, setSiteVisitOpen] = useState(false);

  if (loading) {
    return (
      <div className={embedded ? 'py-4 space-y-4 animate-pulse' : 'min-h-screen bg-background container mx-auto px-4 py-8 space-y-4 animate-pulse'}>
        <div className="h-7 w-44 bg-muted rounded-lg mb-6" />
        <div className="space-y-3">
          <div className="h-20 bg-muted/60 rounded-xl" />
          <div className="h-20 bg-muted/60 rounded-xl" />
          <div className="h-20 bg-muted/60 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={embedded ? '' : 'min-h-screen bg-background'}>
      {!embedded && <Header />}

      <main className={embedded ? 'py-2 md:py-4 pb-36 md:pb-28' : 'container mx-auto px-4 py-6 md:py-12 pb-36 md:pb-28'}>
        {isAdmin && (
          <div className="flex justify-end mb-4 px-4 md:px-0">
            <Button variant="outline" size="sm" className="rounded-full text-sm" onClick={() => setSiteVisitOpen(true)}>
              <MapPin className="w-4 h-4 mr-1.5" />
              Record Site Visit
            </Button>
          </div>
        )}

        {isAdmin && (
          <SiteVisitModal 
            open={siteVisitOpen} 
            onClose={() => setSiteVisitOpen(false)} 
          />
        )}

        {/* Scheduled Shifts — the primary content */}
        <div className="mb-8 md:mb-12 animate-fade-in">
          <MySchedule />
        </div>

        {/* Announcements Section */}
        <div className="mt-8 md:mt-12 animate-fade-in">
          <Announcements />
        </div>

        {/* Documents Section */}
        <div className="mt-8 md:mt-12 animate-fade-in">
          <Documents />
        </div>
      </main>

      {/* Clock Button — Fixed directly above bottom nav, visible on all scroll positions */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] md:bottom-6 left-0 right-0 z-40 p-4 pointer-events-none flex justify-center">
        <div className="w-full max-w-sm pointer-events-auto">
          <ClockButton />
        </div>
      </div>

      {/* Footer — standalone mode only */}
      {!embedded && (
        <footer className="border-t border-border mt-12 md:mt-16">
          <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
            <p>WorkHub — Time & Task Management</p>
          </div>
        </footer>
      )}
    </div>
  );
}
