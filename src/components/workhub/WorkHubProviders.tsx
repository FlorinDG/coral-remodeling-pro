"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/components/time-tracker/contexts/AuthContext";
import { ThemeProvider } from "@/components/time-tracker/contexts/ThemeContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState } from "react";
import "@/app/[locale]/admin/hr/time-tracker/time-tracker.css";

export function WorkHubProviders({ children }: { children: React.ReactNode }) {
    // Keep queryClient in state so it doesn't get recreated on re-renders
    const [queryClient] = useState(() => new QueryClient());

    return (
        <div className="time-tracker-theme h-full">
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
