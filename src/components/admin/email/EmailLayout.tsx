"use client";

import { MailSidebar } from "./MailSidebar";
import { ThreadList } from "./ThreadList";
import { EmailReader } from "./EmailReader";
import { useEffect, useState } from "react";
import { useEmailStore } from "./store";
import { useBreadcrumbStore } from "@/store/useBreadcrumbStore";

export function EmailLayout() {
    const fetchThreads = useEmailStore((state) => state.fetchThreads);
    const [isHydrated, setIsHydrated] = useState(false);
    const setPageTitle = useBreadcrumbStore((state) => state.setPageTitle);
    const activeFolder = useEmailStore((state) => state.activeFolder);
    const activeLabel = useEmailStore((state) => state.activeLabel);

    useEffect(() => {
        const timer = setTimeout(() => setIsHydrated(true), 0);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const title = (activeLabel || activeFolder).toUpperCase();
        setPageTitle(title);
        return () => setPageTitle(null);
    }, [activeFolder, activeLabel, setPageTitle]);

    useEffect(() => {
        fetchThreads();
    }, [fetchThreads]);

    if (!isHydrated) {
        return (
            <div className="flex w-full h-full items-center justify-center bg-background text-muted-foreground p-8">
                <div className="flex items-center gap-3">
                    <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary"></div>
                    <span>Initializing mailbox...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full h-full overflow-hidden bg-background">
            {/* 1. Left Sidebar (Folders) */}
            <MailSidebar />

            {/* 2. Middle Pane (Inbox List) */}
            <ThreadList />

            {/* 3. Right Pane (Email Body) */}
            <main className="flex flex-1 overflow-hidden">
                <EmailReader />
            </main>
        </div>
    );
}
