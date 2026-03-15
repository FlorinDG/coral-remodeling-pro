import { create } from 'zustand';

interface BreadcrumbStore {
    pageTitle: string | null;
    pageSubtitle: string | null;
    setPageTitle: (title: string | null, subtitle?: string | null) => void;
}

export const useBreadcrumbStore = create<BreadcrumbStore>((set) => ({
    pageTitle: null,
    pageSubtitle: null,
    setPageTitle: (title, subtitle = null) => set({ pageTitle: title, pageSubtitle: subtitle }),
}));
