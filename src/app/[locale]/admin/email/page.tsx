"use client";

import { EmailLayout } from "@/components/admin/email/EmailLayout";

export default function EmailPage() {
    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
            {/* 3-Pane Mail Client */}
            <div className="flex-1 w-full h-full overflow-hidden relative border-t border-border">
                <EmailLayout />
            </div>
        </div>
    );
}
