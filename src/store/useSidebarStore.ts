import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    LayoutDashboard,
    Globe,
    UsersRound,
    Mail,
    Users,
    FileSignature,
    BriefcaseBusiness,
    Landmark,
    CircleDollarSign,
    Truck,
    User,
    RefreshCw,
    Calendar,
    Library,
    Settings,
    Briefcase,
    TrendingUp,
} from 'lucide-react';

export type SidebarItem = {
    id: string; // Unique identifier for drag-and-drop
    iconName?: string; // Store icon name as string for persistence (optional for children)
    label: string;
    href?: string;
    children?: SidebarItem[];
    isSubCategory?: boolean;
};

// Map icon names back to Lucide components
export const getIconComponent = (iconName: string) => {
    switch (iconName) {
        case 'LayoutDashboard': return LayoutDashboard;
        case 'Globe': return Globe;
        case 'UsersRound': return UsersRound;
        case 'Mail': return Mail;
        case 'Users': return Users;
        case 'FileSignature': return FileSignature;
        case 'BriefcaseBusiness': return BriefcaseBusiness;
        case 'Briefcase': return Briefcase;
        case 'Landmark': return Landmark;
        case 'CircleDollarSign': return CircleDollarSign;
        case 'Truck': return Truck;
        case 'User': return User;
        case 'RefreshCw': return RefreshCw;
        case 'Calendar': return Calendar;
        case 'Library': return Library;
        case 'Settings': return Settings;
        case 'TrendingUp': return TrendingUp;
        default: return LayoutDashboard;
    }
};

export const defaultSidebarItems: SidebarItem[] = [
    { id: 'dashboard',  iconName: 'LayoutDashboard', label: 'DASHBOARD',  href: '/admin/dashboard' },
    { id: 'email',      iconName: 'Mail',             label: 'EMAIL',      href: '/admin/email' },
    { id: 'financials', iconName: 'Landmark',         label: 'FINANCIALS', href: '/admin/financials/expenses/invoices' },
    { id: 'library',    iconName: 'Library',          label: 'LIBRARY',    href: '/admin/library/articles' },
    { id: 'contacts',   iconName: 'Users',            label: 'CONTACTS',   href: '/admin/contacts' },
    { id: 'suppliers',  iconName: 'Truck',            label: 'SUPPLIERS',  href: '/admin/suppliers' },
    { id: 'sales',      iconName: 'TrendingUp',       label: 'SALES',      href: '/admin/crm' },
    { id: 'projects',   iconName: 'Briefcase',        label: 'PROJECTS',   href: '/admin/projects-management' },
    { id: 'portals',    iconName: 'UsersRound',       label: 'PORTALS',    href: '/admin/portals' },
    { id: 'hr',         iconName: 'CircleDollarSign', label: 'HR',         href: '/admin/hr/time-tracker' },
    { id: 'calendar',   iconName: 'Calendar',         label: 'CALENDAR',   href: '/admin/calendar' },
    { id: 'tasks',      iconName: 'BriefcaseBusiness',label: 'TASKS',      href: '/admin/tasks' },
    { id: 'files',      iconName: 'Library',          label: 'FILES',      href: '/admin/files' },
    { id: 'frontend',   iconName: 'Globe',            label: 'WEBSITE',    href: '/admin/content' },
    { id: 'settings',   iconName: 'Settings',         label: 'SETTINGS',   href: '/admin/settings/company-info' },
];

interface SidebarStore {
    items: SidebarItem[];
    setItems: (items: SidebarItem[]) => void;
    resetToDefault: () => void;
}

export const useSidebarStore = create<SidebarStore>()(
    persist(
        (set) => ({
            items: defaultSidebarItems,
            setItems: (items) => set({ items }),
            resetToDefault: () => set({ items: defaultSidebarItems }),
        }),
        {
            name: 'admin-sidebar-storage',
            version: 15, // bump: added PORTALS standalone sidebar item
            migrate: (persistedState: any, version: number) => {
                if (version < 15) {
                    return { items: defaultSidebarItems };
                }
                return persistedState as SidebarStore;
            }
        }
    )
);
