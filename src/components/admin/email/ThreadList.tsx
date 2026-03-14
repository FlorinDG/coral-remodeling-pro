"use client";

import { useEmailStore, EmailThread } from "./store";
import { PenSquare, Search, Check, Clock, Archive } from "lucide-react";
import { cn } from "@/components/time-tracker/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ThreadActionsProps {
    threadId: string | number;
}

function ThreadActions({ threadId }: ThreadActionsProps) {
    // Mock actions for now. In reality, these would call a mutation to EmailEngine 
    return (
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => e.stopPropagation()} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <Check size={14} />
            </button>
            <button onClick={(e) => e.stopPropagation()} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <Clock size={14} />
            </button>
            <button onClick={(e) => e.stopPropagation()} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <Archive size={14} />
            </button>
        </div>
    );
}

export function ThreadList() {
    const activeFolder = useEmailStore((state) => state.activeFolder);
    const threads = useEmailStore((state) => state.threads);
    const selectedThreadId = useEmailStore((state) => state.selectedThreadId);
    const setSelectedThreadId = useEmailStore((state) => state.setSelectedThreadId);
    const searchQuery = useEmailStore((state) => state.searchQuery);

    // Filter threads simply for UI mockup
    const filteredThreads = threads.filter(t =>
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.emails[0]?.sender.firstName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col w-[400px] min-w-[300px] border-r border-border bg-background">
            {/* Header */}
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4 bg-card/50">
                <h1 className="flex items-center text-lg font-semibold capitalize text-foreground">
                    {activeFolder}
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {filteredThreads.length}
                    </span>
                </h1>
                <div className="flex items-center gap-1">
                    <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                        <Search size={16} />
                    </button>
                    <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors bg-primary/10 text-primary hover:bg-primary/20">
                        <PenSquare size={16} />
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {filteredThreads.length === 0 ? (
                    <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
                        No messages found in {activeFolder}.
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {filteredThreads.map((thread) => {
                            const latestEmail = thread.emails[0];
                            if (!latestEmail) return null;

                            const isSelected = selectedThreadId === thread.id;

                            // Format sender name properly
                            let senderName = "Unknown";
                            if (latestEmail.sender) {
                                senderName = `${latestEmail.sender.firstName} ${latestEmail.sender.lastName}`.trim();
                                if (!senderName) senderName = latestEmail.sender.email;
                            }

                            return (
                                <div
                                    key={thread.id}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setSelectedThreadId(thread.id);
                                        }
                                    }}
                                    onClick={() => setSelectedThreadId(thread.id)}
                                    className={cn(
                                        "w-full flex flex-col items-start gap-2 border-b border-border p-4 text-left text-sm cursor-pointer transition-colors group relative",
                                        isSelected ? "bg-accent/50" : "hover:bg-muted/50"
                                    )}
                                >
                                    <div className="flex w-full items-center justify-between">
                                        <span className="font-semibold text-foreground truncate max-w-[200px]">
                                            {senderName}
                                        </span>

                                        <div className="flex items-center">
                                            {/* Actions override timestamp on hover */}
                                            <div className="hidden group-hover:flex absolute right-4 top-4 bg-background/80 backdrop-blur pl-2">
                                                <ThreadActions threadId={thread.id} />
                                            </div>
                                            <span className={cn(
                                                "text-xs font-medium tabular-nums text-muted-foreground",
                                                "group-hover:opacity-0 transition-opacity" // Hide when actions show
                                            )}>
                                                {thread.lastActivityDate ? formatDistanceToNow(new Date(thread.lastActivityDate), { addSuffix: false }) : ''}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex w-full flex-col gap-1">
                                        <span className="font-medium text-foreground truncate">
                                            {thread.subject || "No Subject"}
                                        </span>
                                        <span className="line-clamp-2 text-xs text-muted-foreground">
                                            {latestEmail.body}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
