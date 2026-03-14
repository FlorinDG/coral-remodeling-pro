"use client";

import { EmailLayout } from "@/components/admin/email/EmailLayout";

export default function EmailPage() {
    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
            {/* Top Header Placeholder (To match overarching Admin Layout) */}
            <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4 bg-card z-10">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">Inbox</h2>
                    <p className="text-sm text-muted-foreground">Manage your communications and leads</p>
                </div>
            </div>

            {/* 3-Pane Mail Client */}
            <div className="flex-1 w-full h-full overflow-hidden relative">
                <EmailLayout />
            </div>
        </div>
    );
}
