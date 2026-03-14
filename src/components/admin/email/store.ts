"use client";

import { create } from 'zustand';

// Temporary mock types based on leerob/next-email-client schema
export type EmailFolder = 'inbox' | 'sent' | 'drafts' | 'starred' | 'archive' | 'trash';

export interface EmailMessage {
    id: number;
    threadId: number;
    senderId: number;
    recipientId: number;
    subject: string;
    body: string;
    sentDate: string;
    sender: {
        id?: string | number;
        firstName: string;
        lastName: string;
        email: string;
        avatarUrl?: string;
    };
}

export interface EmailThread {
    id: number | string;
    subject: string;
    lastActivityDate: string;
    emails: EmailMessage[];
}

interface EmailState {
    activeFolder: EmailFolder;
    selectedThreadId: number | string | null;
    threads: EmailThread[];
    searchQuery: string;
    isLoading: boolean;
    error: string | null;

    // Actions
    setActiveFolder: (folder: EmailFolder) => void;
    setSelectedThreadId: (id: number | string | null) => void;
    setSearchQuery: (query: string) => void;
    setThreads: (threads: EmailThread[]) => void;
    fetchThreads: (folder?: EmailFolder) => Promise<void>;
}

export const useEmailStore = create<EmailState>((set, get) => ({
    activeFolder: 'inbox',
    selectedThreadId: null,
    threads: [],
    searchQuery: '',
    isLoading: false,
    error: null,

    setActiveFolder: (folder) => {
        set({ activeFolder: folder });
        get().fetchThreads(folder);
    },
    setSelectedThreadId: (id) => set({ selectedThreadId: id }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setThreads: (threads) => set({ threads }),

    fetchThreads: async (folder) => {
        const activeFolder = folder || get().activeFolder;
        set({ isLoading: true, error: null });

        try {
            const res = await fetch(`/api/email?folder=${activeFolder}`);
            if (!res.ok) throw new Error("Failed to load emails");

            const data = await res.json();
            set({ threads: data.threads, isLoading: false });
        } catch (err: any) {
            console.error("fetchThreads Error:", err);
            set({ error: err.message, isLoading: false });
        }
    }
}));
