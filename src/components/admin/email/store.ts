"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Temporary mock types based on leerob/next-email-client schema
export type EmailFolder = 'inbox' | 'sent' | 'drafts' | 'starred' | 'archive' | 'trash';

export interface EmailMessage {
    id: number;
    threadId: number;
    senderId: number;
    recipientId: number;
    subject: string;
    snippet: string;
    body: string;
    isRead: boolean;
    sentDate: string;
    sender: {
        id?: string | number;
        firstName: string;
        lastName: string;
        email: string;
        avatarUrl?: string;
    };
    attachments?: Array<{
        filename: string;
        contentType: string;
        size: number;
        data?: string; // base64 encoded
    }>;
}

export interface EmailThread {
    id: number | string;
    subject: string;
    isRead: boolean;
    lastActivityDate: string;
    emails: EmailMessage[];
}

interface EmailState {
    activeFolder: EmailFolder;
    activeLabel: string | null;
    selectedThreadId: number | string | null;
    threads: EmailThread[];
    searchQuery: string;
    isLoading: boolean;
    error: string | null;

    // Actions
    setActiveFolder: (folder: EmailFolder) => void;
    setActiveLabel: (label: string | null) => void;
    setSelectedThreadId: (id: number | string | null) => void;
    setSearchQuery: (query: string) => void;
    setThreads: (threads: EmailThread[]) => void;
    fetchThreads: (folder?: EmailFolder, silent?: boolean, label?: string | null) => Promise<void>;
}

export const useEmailStore = create<EmailState>()(
    persist(
        (set, get) => ({
            activeFolder: 'inbox',
            activeLabel: null,
            selectedThreadId: null,
            threads: [],
            searchQuery: '',
            isLoading: false,
            error: null,

            setActiveFolder: (folder) => {
                set({ activeFolder: folder, activeLabel: null });
                get().fetchThreads(folder, false, null);
            },
            setActiveLabel: (label) => {
                set({ activeLabel: label });
                get().fetchThreads(get().activeFolder, false, label);
            },
            setSelectedThreadId: (id) => set({ selectedThreadId: id }),
            setSearchQuery: (query) => set({ searchQuery: query }),
            setThreads: (threads) => set({ threads }),

            fetchThreads: async (folder, silent = false, labelArg) => {
                const activeFolder = folder || get().activeFolder;
                const activeLabel = labelArg !== undefined ? labelArg : get().activeLabel;
                if (!silent) set({ isLoading: true, error: null });

                try {
                    let url = `/api/email?folder=${activeFolder}`;
                    if (activeLabel) {
                        url += `&label=${encodeURIComponent(activeLabel)}`;
                    }
                    const res = await fetch(url);
                    if (!res.ok) throw new Error("Failed to load emails");

                    const data = await res.json();
                    set({ threads: data.threads, isLoading: false, error: null });
                } catch (err: any) {
                    console.error("fetchThreads Error:", err);
                    set({ error: err.message, isLoading: false });
                }
            }
        }),
        {
            name: 'email-storage-v1',
            partialize: (state) => ({
                activeFolder: state.activeFolder,
                activeLabel: state.activeLabel,
                searchQuery: state.searchQuery,
                threads: state.threads.map(thread => ({
                    ...thread,
                    emails: thread.emails.map(email => {
                        // Omit bulky data from localStorage to prevent QuotaExceededError
                        const { body, attachments, ...lightweightEmail } = email;
                        return lightweightEmail;
                    })
                }))
            })
        }
    )
);
