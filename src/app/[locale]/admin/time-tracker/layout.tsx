"use client";
import "./time-tracker.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/components/time-tracker/contexts/AuthContext";
import { ThemeProvider } from "@/components/time-tracker/contexts/ThemeContext";
import { TooltipProvider } from "@/components/time-tracker/components/ui/tooltip";

const queryClient = new QueryClient();

export default function TimeTrackerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="time-tracker-theme min-h-screen">
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </div>
  );
}
