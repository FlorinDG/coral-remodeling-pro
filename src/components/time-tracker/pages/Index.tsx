"use client";
import { useEffect } from 'react';
import { useRouter } from "@/i18n/routing";

import { Loader2 } from 'lucide-react';
import { Header } from '@/components/time-tracker/components/Header';
import { ClockButton } from '@/components/time-tracker/components/ClockButton';
import { QuickLinks } from '@/components/time-tracker/components/QuickLinks';
import { NotificationSettings } from '@/components/time-tracker/components/NotificationSettings';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';

export default function Index() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    // We are trusting NextAuth to protect the /admin route.
    // TimeTracker's internal Supabase auth redirect is disabled here.
  }, [user, loading]);

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
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 md:py-12">
        {/* Hero Section with Clock Button */}
        <section className="text-center mb-16 md:mb-20">
          <div className="max-w-2xl mx-auto mb-10">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 animate-fade-in">
              Welcome back, <span className="text-primary">{firstName}</span>
            </h1>
          </div>

          <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
            <ClockButton />
          </div>
        </section>

        {/* Quick Links Section */}
        <QuickLinks />

        {/* Notifications Section */}
        <section className="mt-16 space-y-6">
          <h2 className="text-2xl font-bold text-foreground">Notifications</h2>
          <NotificationSettings />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>WorkHub — Time & Task Management</p>
        </div>
      </footer>
    </div>
  );
}
