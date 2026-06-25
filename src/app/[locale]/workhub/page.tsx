"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/components/time-tracker/contexts/AuthContext";
import { ThemeProvider } from "@/components/time-tracker/contexts/ThemeContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "@/components/time-tracker/pages/Index";
import "@/app/[locale]/admin/hr/time-tracker/time-tracker.css";

const queryClient = new QueryClient();

/**
 * WorkHub Home — the clock-in/out dashboard.
 * Reuses the same Index component from the admin HR Work Hub,
 * but renders standalone (embedded=true, no ModuleTabs).
 */
export default function WorkHubHomePage() {
    return (
        <div className="time-tracker-theme">
            <QueryClientProvider client={queryClient}>
                <ThemeProvider>
                    <AuthProvider>
                        <TooltipProvider>
                            <div className="max-w-4xl mx-auto px-4 py-4">
                                <Index embedded={true} />
                            </div>
                        </TooltipProvider>
                    </AuthProvider>
                </ThemeProvider>
            </QueryClientProvider>
        </div>
    );
}
