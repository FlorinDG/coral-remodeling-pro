"use client";

import { Suspense } from "react";
import { EmailLayout } from "@/components/admin/email/EmailLayout";
import { useTenant } from "@/context/TenantContext";
import LockedFeature from "@/components/admin/LockedFeature";

export default function EmailPage() {
    const { planType, isEnterprise } = useTenant();

    if (!isEnterprise) {
        return (
            <div className="flex h-[calc(100vh-4rem)] flex-col">
                <LockedFeature
                    label="Email Client"
                    requiredPlan="ENTERPRISE"
                    currentPlan={planType}
                    description="The in-app email client lets you compose, send, and manage email directly from CoralOS. Transactional email (invoices, quotations) is available on all plans via Resend."
                />
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
            {/* 3-Pane Mail Client */}
            <div className="flex-1 w-full h-full overflow-hidden relative border-t border-border">
                <Suspense fallback={
                    <div className="flex w-full h-full items-center justify-center text-muted-foreground">
                        <div className="flex items-center gap-3">
                            <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary"></div>
                            <span>Loading email client...</span>
                        </div>
                    </div>
                }>
                    <EmailLayout />
                </Suspense>
            </div>
        </div>
    );
}
