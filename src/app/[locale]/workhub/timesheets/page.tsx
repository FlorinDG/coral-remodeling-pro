"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/components/time-tracker/contexts/AuthContext";
import { ThemeProvider } from "@/components/time-tracker/contexts/ThemeContext";
import { TooltipProvider } from "@/components/time-tracker/components/ui/tooltip";
import "@/app/[locale]/admin/hr/time-tracker/time-tracker.css";
import dynamic from "next/dynamic";

const PerformanceView = dynamic(
    () => import("@/components/time-tracker/pages/Performance"),
    { ssr: false }
);

const queryClient = new QueryClient();

/**
 * WorkHub Timesheets — re-uses the Performance/Timesheets component
 * for weekly/monthly time tracking reports.
 */
export default function WorkHubTimesheetsPage() {
    return (
        <div className="time-tracker-theme">
            <QueryClientProvider client={queryClient}>
                <ThemeProvider>
                    <AuthProvider>
                        <TooltipProvider>
                            <div className="max-w-4xl mx-auto px-4 py-4">
                                <h1 className="text-xl font-black tracking-tight mb-4 text-neutral-900 dark:text-white">Timesheets & Reports</h1>
                                <PerformanceView />
                            </div>
                        </TooltipProvider>
                    </AuthProvider>
                </ThemeProvider>
            </QueryClientProvider>
        </div>
    );
}
