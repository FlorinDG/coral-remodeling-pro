"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/components/time-tracker/contexts/AuthContext";
import { ThemeProvider } from "@/components/time-tracker/contexts/ThemeContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/app/[locale]/admin/hr/time-tracker/time-tracker.css";
import dynamic from "next/dynamic";

const ScheduleView = dynamic(
    () => import("@/components/time-tracker/pages/Schedule"),
    { ssr: false }
);

const queryClient = new QueryClient();

export default function WorkHubSchedulePage() {
    return (
        <div className="time-tracker-theme">
            <QueryClientProvider client={queryClient}>
                <ThemeProvider>
                    <AuthProvider>
                        <TooltipProvider>
                            <div className="max-w-6xl mx-auto px-4 py-4">
                                <h1 className="text-xl font-black tracking-tight mb-4 text-neutral-900 dark:text-white">Workforce Schedule</h1>
                                <ScheduleView />
                            </div>
                        </TooltipProvider>
                    </AuthProvider>
                </ThemeProvider>
            </QueryClientProvider>
        </div>
    );
}
