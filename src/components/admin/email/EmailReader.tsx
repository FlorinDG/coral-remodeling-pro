"use client";

import { useEmailStore } from "./store";
import { format } from "date-fns";
import { CornerUpLeft, MoreVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/time-tracker/components/ui/button";

export function EmailReader() {
    const selectedThreadId = useEmailStore((state) => state.selectedThreadId);
    const threads = useEmailStore((state) => state.threads);

    if (!selectedThreadId) {
        return (
            <div className="flex h-full flex-1 items-center justify-center p-8 text-center text-muted-foreground bg-background">
                <div className="max-w-sm">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <svg
                            className="h-6 w-6 text-muted-foreground"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-foreground">Select a message</h3>
                    <p className="mt-1 text-sm">Choose an email from the list on the left to read its contents.</p>
                </div>
            </div>
        );
    }

    const thread = threads.find((t) => t.id === selectedThreadId);

    if (!thread || thread.emails.length === 0) {
        return (
            <div className="flex h-full flex-1 items-center justify-center p-8 text-center text-muted-foreground bg-background">
                Message not found.
            </div>
        );
    }

    return (
        <div className="flex h-full flex-1 flex-col overflow-hidden bg-background">
            {/* Reader Toolbar */}
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="h-4 w-[1px] bg-border mx-1" />
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <CornerUpLeft className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Reader Content Area */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="mx-auto max-w-4xl space-y-8">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        {thread.subject || "No Subject"}
                    </h1>

                    <div className="space-y-6">
                        {thread.emails.map((email) => {
                            const senderName = `${email.sender.firstName} ${email.sender.lastName}`.trim() || email.sender.email;

                            return (
                                <div key={email.id} className="rounded-xl border border-border bg-card shadow-sm p-6 overflow-hidden">
                                    <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            {/* Avatar */}
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                                                {email.sender.firstName?.[0] || email.sender.email[0].toUpperCase()}
                                            </div>
                                            <div className="grid gap-1">
                                                <div className="font-semibold text-foreground">
                                                    {senderName}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    to {email.recipientId === thread.emails[0].sender.id ? 'Me' : 'All'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-sm text-muted-foreground shrink-0">
                                            {format(new Date(email.sentDate), 'MMM d, yyyy, h:mm a')}
                                        </div>
                                    </div>

                                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-foreground leading-relaxed">
                                        {email.body}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="pt-4">
                        <Button variant="outline" className="gap-2">
                            <CornerUpLeft className="h-4 w-4" />
                            Reply to thread
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
