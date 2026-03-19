import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CalendarState {
    accounts: any[];
    portals: any[];
    isLoadingAccounts: boolean;
    error: string | null;

    // Actions
    fetchAccounts: () => Promise<void>;
    fetchPortals: () => Promise<void>;
}

export const useCalendarStore = create<CalendarState>()(
    persist(
        (set) => ({
            accounts: [],
            portals: [],
            isLoadingAccounts: true, // Start true for the first ever load
            error: null,

            fetchAccounts: async () => {
                set({ isLoadingAccounts: true, error: null });
                try {
                    const res = await fetch('/api/calendar/accounts');
                    if (res.ok) {
                        const data = await res.json();
                        set({ accounts: data.accounts || [], isLoadingAccounts: false });
                    } else {
                        set({ isLoadingAccounts: false, error: 'Failed to fetch accounts' });
                    }
                } catch (e: any) {
                    console.error("Failed to fetch accounts:", e);
                    set({ isLoadingAccounts: false, error: e.message });
                }
            },

            fetchPortals: async () => {
                try {
                    const res = await fetch('/api/calendar/portals');
                    if (res.ok) {
                        const data = await res.json();
                        set({ portals: data });
                    }
                } catch (e: any) {
                    console.error("Failed to fetch portals", e);
                }
            }
        }),
        {
            name: 'calendar-storage-v1',
            partialize: (state) => ({
                // Only persist the actual data, so isLoading resets correctly on mount
                accounts: state.accounts,
                portals: state.portals
            }),
        }
    )
);
