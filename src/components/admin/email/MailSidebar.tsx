"use client";

import { useState } from "react";
import { useEmailStore, EmailFolder } from "./store";
import { cn } from "@/components/time-tracker/lib/utils";
import { Inbox, Send, FileText, Star, Archive, Trash, Tag, Settings, Plus } from "lucide-react";
import { AccountSettingsModal } from "./AccountSettingsModal";

interface SidebarItem {
    id: EmailFolder;
    label: string;
    icon: React.ElementType;
    count?: number;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, count: 12 },
    { id: 'starred', label: 'Starred', icon: Star },
    { id: 'sent', label: 'Sent', icon: Send },
    { id: 'drafts', label: 'Drafts', icon: FileText, count: 3 },
    { id: 'archive', label: 'Archive', icon: Archive },
    { id: 'trash', label: 'Trash', icon: Trash },
];

export function MailSidebar() {
    const activeFolder = useEmailStore((state) => state.activeFolder);
    const setActiveFolder = useEmailStore((state) => state.setActiveFolder);
    const activeLabel = useEmailStore((state) => state.activeLabel);
    const setActiveLabel = useEmailStore((state) => state.setActiveLabel);
    const isLoading = useEmailStore((state) => state.isLoading);
    const threads = useEmailStore((state) => state.threads);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    return (
        <div className="w-64 min-w-[16rem] h-full border-r border-border bg-card flex-col hidden md:flex relative overflow-hidden">
            <div className="p-4 border-b border-border z-10 bg-card shrink-0 flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">Mailboxes</h2>
                {isLoading && (
                    <div className="flex h-4 w-4 items-center justify-center">
                        <div className="h-3 w-3 animate-spin rounded-full border-b-2 border-[var(--brand-color,#d35400)]"></div>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto py-4 w-full relative z-0 pb-20">
                <nav className="space-y-1 px-2">
                    {SIDEBAR_ITEMS.map((item) => {
                        const isActive = activeFolder === item.id;
                        const Icon = item.icon;

                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveFolder(item.id)}
                                className={cn(
                                    "w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon className="w-4 h-4" />
                                    {item.label}
                                </div>
                                {(isActive ? threads.length : item.count) !== undefined && (isActive ? threads.length > 0 : !!item.count) && (
                                    <span className={cn(
                                        "text-xs px-2 py-0.5 rounded-full",
                                        isActive ? "bg-primary-foreground/20" : "bg-muted-foreground/20"
                                    )}>
                                        {isActive ? threads.length : item.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                <div className="mt-8">
                    <div className="px-4 mb-2">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Labels
                        </h3>
                    </div>
                    <nav className="space-y-1 px-2">
                        {['Leads', 'Invoices', 'System'].map((label) => {
                            const isLabelActive = activeLabel === label;
                            return (
                                <button
                                    key={label}
                                    onClick={() => setActiveLabel(label)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                        isLabelActive
                                            ? "bg-muted text-foreground"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <Tag className="w-3.5 h-3.5" />
                                    {label}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-4 border-t border-border bg-card z-10 shrink-0">
                <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-semibold bg-[var(--brand-color,#d35400)] text-white hover:opacity-90 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Connect Account
                </button>
            </div>

            <AccountSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </div>
    );
}
