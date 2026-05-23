"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Index from "@/components/time-tracker/pages/Index";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { hrTabs } from "@/config/tabs";
import { usePageTitle } from "@/hooks/usePageTitle";

// Workforce roles see the standalone PWA-style WorkHub.
// Everyone else sees it embedded inside AdminLayout with HR tabs.
const WORKFORCE_ROLES = ['TENANT_ENTERPRISE_WORKFORCE'];

export default function Page() {
    usePageTitle('Workhub');
    const { data: session } = useSession();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 0);
        return () => clearTimeout(timer);
    }, []);

    if (!mounted) {
        return null;
    }

    const role = session?.user?.role ?? '';
    const isWorkforce = WORKFORCE_ROLES.includes(role);

    // Workforce: full standalone PWA experience (Header + Footer inside Index)
    if (isWorkforce) {
        return (
            <div className="w-full h-full">
                <Index embedded={false} />
            </div>
        );
    }

    // Everyone else: embedded inside AdminLayout with HR module tabs
    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={hrTabs} groupId="hr" />
            <div className="w-full h-full p-6">
                <Index embedded={true} />
            </div>
        </div>
    );
}
