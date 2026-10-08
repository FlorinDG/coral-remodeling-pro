"use client";
import { useEffect, useState } from "react";
import { ScheduleManagement } from "@/components/time-tracker/components/admin/ScheduleManagement";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { hrTabs } from "@/config/tabs";
import { useTranslations } from "next-intl";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function Page() {
    const t = useTranslations("Hr.scheduler");
    usePageTitle(t('pageTitle'));
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 0);
        return () => clearTimeout(timer);
    }, []);

    if (!mounted) {
        return null; // Prevent hydration mismatch on the client
    }

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={hrTabs} groupId="hr" />
            <div className="w-full flex-1 flex flex-col pt-6 min-h-0">
                <div className="hidden md:flex flex-1 flex-col">
                    <ScheduleManagement />
                </div>
                <div className="md:hidden flex flex-1 flex-col items-center pt-20 p-6 text-center">
                    <div className="bg-neutral-100 dark:bg-white/5 rounded-2xl p-6 max-w-sm">
                        <h3 className="text-lg font-bold mb-2">{t('desktopOnlyTitle')}</h3>
                        <p className="text-sm text-muted-foreground">
                            {t('desktopOnlyDesc')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
