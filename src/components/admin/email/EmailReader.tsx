"use client";

import { useState, useMemo } from "react";
import { useEmailStore } from "./store";
import { format } from "date-fns";
import { MoreVertical, Trash2, Paperclip, Reply, ReplyAll, Forward, Archive, Mail, Download } from "lucide-react";
import { Button } from "@/components/time-tracker/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/time-tracker/components/ui/dropdown-menu";
import { AttachmentViewerModal } from "./AttachmentViewerModal";

export function EmailReader() {
    const selectedThreadId = useEmailStore((state) => state.selectedThreadId);
    const threads = useEmailStore((state) => state.threads);

    const thread = threads.find((t) => t.id === selectedThreadId);

    const [expandedEmails, setExpandedEmails] = useState<Set<string | number>>(new Set());
    const [prevThreadId, setPrevThreadId] = useState<string | number | undefined>(undefined);
    const [viewerAttachment, setViewerAttachment] = useState<{
        filename: string;
        contentType: string;
        data?: string;
        size?: number;
    } | null>(null);

    // Expand the newest email by default when the thread changes
    if (thread && thread.id !== prevThreadId) {
        setPrevThreadId(thread.id);
        if (thread.emails.length > 0) {
            setExpandedEmails(new Set([thread.emails[0].id]));
        }
    }

    // Aggregate all attachments for the active thread
    const threadAttachments = useMemo(() => {
        if (!thread) return [];
        return thread.emails.flatMap(e => e.attachments || []);
    }, [thread]);

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

    if (!thread || thread.emails.length === 0) {
        return (
            <div className="flex h-full flex-1 items-center justify-center p-8 text-center text-muted-foreground bg-background">
                Message not found.
            </div>
        );
    }

    const toggleEmail = (id: string | number) => {
        const next = new Set(expandedEmails);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setExpandedEmails(next);
    };

    return (
        <div className="flex h-full flex-1 flex-col overflow-hidden bg-background">
            {/* Reader Toolbar */}
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <Archive className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <Mail className="h-4 w-4" />
                    </Button>
                    <div className="h-4 w-[1px] bg-border mx-2" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <Reply className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <ReplyAll className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <Forward className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    {/* Compact Attachments Bar with Dropdown */}
                    {threadAttachments.length > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="flex h-8 items-center gap-1.5 px-3 py-1.5 bg-muted/30 hover:bg-muted/50 rounded-full border border-border mr-2 transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-primary/20">
                                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs font-medium text-foreground">{threadAttachments.length} file(s)</span>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64 max-h-[300px] overflow-y-auto z-50">
                                <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold bg-background sticky top-0 pb-2">
                                    Thread Attachments
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {threadAttachments.map((att, idx) => (
                                    <DropdownMenuItem key={idx} asChild className="cursor-pointer py-2">
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setViewerAttachment(att);
                                            }}
                                            className="flex items-start gap-2 w-full outline-none text-left"
                                        >
                                            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                                            <div className="flex flex-col overflow-hidden items-start">
                                                <span className="truncate w-full text-sm font-medium">{att.filename}</span>
                                                <span className="text-[10px] text-muted-foreground uppercase mt-0.5" >
                                                    {att.contentType?.split('/')[1] || 'FILE'} • {Math.round((att.size || 0) / 1024)} KB
                                                </span>
                                            </div>
                                            <Download className="h-3.5 w-3.5 ml-auto shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                                        </button>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Reader Content Area */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="mx-auto max-w-4xl space-y-6">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground mb-8">
                        {thread.subject || "No Subject"}
                    </h1>

                    <div className="space-y-3">
                        {thread.emails.map((email) => {
                            const senderName = `${email.sender.firstName} ${email.sender.lastName}`.trim() || email.sender.email;
                            const isExpanded = expandedEmails.has(email.id);

                            return (
                                <div
                                    key={email.id}
                                    className={`rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-all duration-200 ${isExpanded ? 'p-6' : 'p-3 hover:bg-muted/30 cursor-pointer'
                                        }`}
                                    onClick={() => !isExpanded && toggleEmail(email.id)}
                                >
                                    {isExpanded ? (
                                        // Expanded Email View
                                        <>
                                            <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4 cursor-pointer" onClick={() => toggleEmail(email.id)}>
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
                                                    {format(new Date(email.sentDate), 'MMM d, h:mm a')}
                                                </div>
                                            </div>

                                            <div
                                                className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed overflow-hidden"
                                                dangerouslySetInnerHTML={{ __html: email.body }}
                                            />

                                            {/* Local Email Attachments for the expanded view */}
                                            {email.attachments && email.attachments.length > 0 && (
                                                <div className="mt-6 pt-6 border-t border-border flex flex-wrap gap-2">
                                                    {email.attachments.map((att, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setViewerAttachment(att);
                                                            }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-accent/30 hover:bg-accent text-xs transition-colors text-foreground font-medium"
                                                        >
                                                            <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                            <span className="truncate max-w-[150px]">{att.filename}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        // Collapsed Accordion Header
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="font-medium text-foreground text-sm shrink-0 w-32 truncate">
                                                    {senderName}
                                                </div>
                                                <div className="text-muted-foreground text-sm truncate opacity-70">
                                                    {email.snippet}
                                                </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground shrink-0">
                                                {format(new Date(email.sentDate), 'MMM d, h:mm a')}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="pt-6">
                        <Button variant="outline" className="gap-2">
                            <Reply className="h-4 w-4" />
                            Reply
                        </Button>
                    </div>
                </div>
            </div>

            {/* In-Browser Secure Attachment Preview */}
            <AttachmentViewerModal
                attachment={viewerAttachment}
                onClose={() => setViewerAttachment(null)}
            />
        </div>
    );
}
