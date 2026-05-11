"use client";
import { Documents } from "@/components/time-tracker/components/Documents";
import { Header } from "@/components/time-tracker/components/Header";
import { useAuth } from "@/components/time-tracker/contexts/AuthContext";
import { Loader2, ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/routing";

export default function DocumentsPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Link
          href="/admin/hr/time-tracker"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Work Hub
        </Link>

        <Documents />
      </main>
    </div>
  );
}
