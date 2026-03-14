"use client";
import { useEffect, useState } from "react";
import Index from "@/components/time-tracker/pages/Index";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { hrTabs } from "@/config/tabs";

export default function Page() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={hrTabs} />
            <div className="w-full h-full p-6">
                <Index />
            </div>
        </div>
    );
}
