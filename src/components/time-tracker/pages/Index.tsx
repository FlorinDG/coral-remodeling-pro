"use client";
import { useEffect, useState } from 'react';
import { useRouter } from "@/i18n/routing";

import { Loader2 } from 'lucide-react';
import { Header } from '@/components/time-tracker/components/Header';
import { ClockButton } from '@/components/time-tracker/components/ClockButton';
import { QuickLinks } from '@/components/time-tracker/components/QuickLinks';
import { MySchedule } from '@/components/time-tracker/components/MySchedule';
import { Announcements } from '@/components/time-tracker/components/Announcements';
import { Documents } from '@/components/time-tracker/components/Documents';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';
import { SiteVisitModal } from '@/components/time-tracker/components/SiteVisitModal';

interface IndexProps {
  /** When true, hides standalone Header/Footer — used when rendered inside AdminLayout */
  embedded?: boolean;
}

export default function Index({ embedded = false }: IndexProps) {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [siteVisitOpen, setSiteVisitOpen] = useState(false);

  // Native push notifications callout removed per user request.

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  return (
    <div className={embedded ? '' : 'min-h-screen bg-background'}>
      {!embedded && <Header />}

      <main className={embedded ? 'py-2 md:py-4' : 'container mx-auto px-4 py-6 md:py-12'}>
        {/* Hero Section with Clock Button */}
        <section className="text-center mb-8 md:mb-16 lg:mb-20">
          <div className="max-w-2xl mx-auto mb-6 md:mb-10">
            <h1 className="text-2xl md:text-3xl lg:text-5xl font-bold text-foreground mb-2 md:mb-4 animate-fade-in">
              Welcome back, <span className="text-primary">{firstName}</span>
            </h1>
          </div>

          <div className="animate-fade-in flex flex-col items-center justify-center gap-4" style={{ animationDelay: '200ms' }}>
            <ClockButton />
            <Button variant="outline" className="rounded-full" onClick={() => setSiteVisitOpen(true)}>
              <MapPin className="w-4 h-4 mr-2" />
              Record Site Visit
            </Button>
          </div>
        </section>

        <SiteVisitModal 
          open={siteVisitOpen} 
          onClose={() => setSiteVisitOpen(false)} 
        />

        {/* Scheduled Shifts */}
        <div className="mb-8 md:mb-12 animate-fade-in" style={{ animationDelay: '300ms' }}>
          <MySchedule />
        </div>

        {/* Quick Links Section */}
        <QuickLinks />

        {/* Announcements Section */}
        <div className="mt-8 md:mt-12 animate-fade-in" style={{ animationDelay: '400ms' }}>
          <Announcements />
        </div>

        {/* Documents Section */}
        <div className="mt-8 md:mt-12 animate-fade-in" style={{ animationDelay: '500ms' }}>
          <Documents />
        </div>

      </main>

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
