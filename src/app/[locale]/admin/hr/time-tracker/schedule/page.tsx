"use client";
import { useEffect, useState } from "react";
import { ScheduleManagement } from "@/components/time-tracker/components/admin/ScheduleManagement";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { hrTabs } from "@/config/tabs";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function Page() {
    usePageTitle('Workforce Scheduler');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null; // Prevent hydration mismatch on the client
    }

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={hrTabs} groupId="hr" />
            <div className="w-full flex-1 flex flex-col pt-6 min-h-0">
                <ScheduleManagement />
            </div>
        </div>
    );
}
