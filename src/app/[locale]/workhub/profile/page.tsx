"use client";

import { useSession } from "next-auth/react";
import { User, Mail, Shield, Clock, MapPin } from "lucide-react";
import { ThemeProvider } from "@/components/time-tracker/contexts/ThemeContext";

export default function WorkerProfilePage() {
    const { data: session } = useSession();
    const user = session?.user;

    if (!user) return null;

    const initials = user.name
        ? user.name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()
        : "U";

    return (
        <ThemeProvider>
            <div className="max-w-3xl mx-auto px-4 py-8">
                <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
                    <div className="bg-primary/10 px-8 py-12 flex flex-col items-center justify-center border-b border-neutral-200 dark:border-neutral-800">
                        <div className="w-24 h-24 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xl font-black mb-4">
                            {initials}
                        </div>
                        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
                            {user.name || "Worker"}
                        </h1>
                        <p className="text-primary font-medium mt-1 uppercase tracking-wider text-sm">
                            Workforce Member
                        </p>
                    </div>

                    <div className="p-8">
                        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-neutral-900 dark:text-white">
                            <User className="w-5 h-5 text-primary" />
                            Account Details
                        </h2>

                        <div className="space-y-6">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                                    <Mail className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-neutral-500 dark:text-neutral-400">Email Address</p>
                                    <p className="font-medium text-neutral-900 dark:text-white">{user.email || "No email"}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                                    <Shield className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-neutral-500 dark:text-neutral-400">System Role</p>
                                    <p className="font-medium text-neutral-900 dark:text-white">
                                        {user.role === 'TENANT_ENTERPRISE_WORKFORCE' ? 'Field Workforce' : user.role}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 pt-8 border-t border-neutral-200 dark:border-neutral-800">
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center">
                                To update your profile details, please contact your team supervisor or HR administrator.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </ThemeProvider>
    );
}
