import { MailSidebar } from "./MailSidebar";
import { ThreadList } from "./ThreadList";
import { EmailReader } from "./EmailReader";
import { useEffect } from "react";
import { useEmailStore } from "./store";

export function EmailLayout() {
    const fetchThreads = useEmailStore((state) => state.fetchThreads);

    useEffect(() => {
        // Fetch emails from proxy (will fall back to mock data safely if EmailEngine not configured)
        fetchThreads();
    }, [fetchThreads]);

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
