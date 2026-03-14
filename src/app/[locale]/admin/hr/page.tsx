"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/components/time-tracker/contexts/AuthContext";
import { ThemeProvider } from "@/components/time-tracker/contexts/ThemeContext";
import { TooltipProvider } from "@/components/time-tracker/components/ui/tooltip";
import { ScheduleManagement } from "@/components/time-tracker/components/admin/ScheduleManagement";
import "./time-tracker/time-tracker.css";

const queryClient = new QueryClient();

function ScheduleOverview() {
    return (
        <div className="flex flex-col gap-8 max-w-full">
            <div>
                <h3 className="text-xl font-semibold text-foreground mb-4">Team Planner & Roster</h3>
                <ScheduleManagement />
            </div>
        </div>
    );
}

function WorkHubWidget() {
    return (
        <div className="time-tracker-theme w-full">
            <QueryClientProvider client={queryClient}>
                <ThemeProvider>
                    <AuthProvider>
                        <TooltipProvider>
                            <ScheduleOverview />
                        </TooltipProvider>
                    </AuthProvider>
                </ThemeProvider>
            </QueryClientProvider>
        </div>
    );
}

import { Clock, PlusCircle } from "lucide-react";
import { Link } from "@/i18n/routing";

export default function HRPage() {
    return (
        <div className="flex flex-col gap-8 max-w-7xl mx-auto w-full pb-10">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Human Resources</h1>
                <p className="text-muted-foreground">Manage your team, track hours, and organize employee resources.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Time Tracker Module */}
                <Link href="/admin/hr/time-tracker" className="group">
                    <div className="flex flex-col h-full bg-card hover:bg-neutral-50 dark:hover:bg-neutral-900 border border-border rounded-xl p-6 transition-all duration-300 hover:shadow-md hover:border-primary/50 relative overflow-hidden">

                        <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                            <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                        </div>

                        <h2 className="text-xl font-semibold text-foreground mb-2 flex items-center justify-between">
                            Work Hub
                            <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-300">
                                <PlusCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                            </div>
                        </h2>

                        <p className="text-sm text-muted-foreground flex-1">
                            Monitor employee hours, review timesheets, approve time-off requests, and track real-time project schedules.
                        </p>

                        {/* Top Right Decoration */}
                        <div className="absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br from-orange-500/20 to-transparent rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    </div>
                </Link>

                {/* Coming Soon: Payroll */}
                <div className="flex flex-col h-full bg-card/50 border border-border border-dashed rounded-xl p-6 opacity-70">
                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-6 grayscale">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                            <rect width="20" height="14" x="2" y="5" rx="2" />
                            <line x1="2" x2="22" y1="10" y2="10" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-muted-foreground mb-2 flex items-center gap-3">
                        Payroll & Invoicing
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-neutral-200 dark:bg-neutral-800 text-neutral-500 px-2 py-0.5 rounded-full">Coming Soon</span>
                    </h2>
                    <p className="text-sm text-muted-foreground/70 flex-1">
                        Automate compensation distributions and contractor payouts directly from approved timesheets.
                    </p>
                </div>

                {/* Active: Employee Directory */}
                <Link href="/admin/hr/employees" className="group">
                    <div className="flex flex-col h-full bg-card hover:bg-neutral-50 dark:hover:bg-neutral-900 border border-border rounded-xl p-6 transition-all duration-300 hover:shadow-md hover:border-emerald-500/50 relative overflow-hidden">
                        <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-foreground mb-2 flex items-center justify-between">
                            Workforce Database
                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-300">
                                <PlusCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                        </h2>
                        <p className="text-sm text-muted-foreground flex-1">
                            Centralized repository for employee contracts, documentation, and compliance records.
                        </p>
                        <div className="absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    </div>
                </Link>
            </div>

            {/* Work Hub Scheduler Embed */}
            <div className="mt-8">
                <WorkHubWidget />
            </div>
        </div>
    );
}
