import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { hrTabs, relationsTabs, frontendTabs, financialTabs, settingsTabs } from '@/config/tabs';

interface TabGroup {
    groupId: string;
    label: string;
    defaultOrder: string[];
}

const DEFAULT_GROUPS: Record<string, TabGroup> = {
    hr: { groupId: 'hr', label: 'HR MODULE', defaultOrder: hrTabs.map(t => t.id) },
    relations: { groupId: 'relations', label: 'RELATIONS MODULE', defaultOrder: relationsTabs.map(t => t.id) },
    frontend: { groupId: 'frontend', label: 'WEBSITE MODULE', defaultOrder: frontendTabs.map(t => t.id) },
    financials: { groupId: 'financials', label: 'FINANCIALS MODULE', defaultOrder: financialTabs.map(t => t.id) },
    settings: { groupId: 'settings', label: 'SETTINGS MODULE', defaultOrder: settingsTabs.map(t => t.id) }
};

interface TabStore {
    // Record mapping groupId to an array of tab IDs in the user's preferred order
    tabOrders: Record<string, string[]>;

    // Actions
    setTabOrder: (groupId: string, newOrder: string[]) => void;
    resetTabOrder: (groupId: string) => void;

    // Helpers
    getGroupConfig: (groupId: string) => TabGroup | undefined;
    getAllGroups: () => TabGroup[];
}

export const useTabStore = create<TabStore>()(
    persist(
        (set, get) => ({
            tabOrders: {},

            setTabOrder: (groupId, newOrder) =>
                set((state) => ({
                    tabOrders: {
                        ...state.tabOrders,
                        [groupId]: newOrder
                    }
                })),

            resetTabOrder: (groupId) =>
                set((state) => {
                    const newOrders = { ...state.tabOrders };
                    delete newOrders[groupId];
                    return { tabOrders: newOrders };
                }),

            getGroupConfig: (groupId) => DEFAULT_GROUPS[groupId],

            getAllGroups: () => Object.values(DEFAULT_GROUPS)
        }),
        {
            name: 'admin-module-tabs-storage',
            version: 2,
            migrate: (persistedState: any, version: number) => {
                if (version < 2) {
                    return { tabOrders: {} };
                }
                return persistedState as TabStore;
            }
        }
    )
);
