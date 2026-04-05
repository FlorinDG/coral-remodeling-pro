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
        default: return LayoutDashboard;
    }
};

export const defaultSidebarItems: SidebarItem[] = [
    { id: 'calendar', iconName: 'Calendar', label: 'CALENDAR', href: '/admin/calendar' },
    { id: 'dashboard', iconName: 'LayoutDashboard', label: 'DASHBOARD', href: '/admin/dashboard' },
    { id: 'email', iconName: 'Mail', label: 'EMAIL', href: '/admin/email' },
    { id: 'files', iconName: 'Library', label: 'FILES', href: '/admin/files' },
    { id: 'financials', iconName: 'Landmark', label: 'FINANCIALS', href: '/admin/financials/expenses/invoices' },
    { id: 'frontend', iconName: 'Globe', label: 'WEBSITE', href: '/admin/content' },
    { id: 'hr', iconName: 'CircleDollarSign', label: 'HR', href: '/admin/hr/time-tracker' },
    { id: 'library', iconName: 'Library', label: 'LIBRARY', href: '/admin/library/articles' },
    { id: 'projects', iconName: 'Briefcase', label: 'PROJECTS', href: '/admin/projects-management' },
    { id: 'contacts', iconName: 'Users', label: 'CONTACTS', href: '/admin/contacts' },
    { id: 'suppliers', iconName: 'Truck', label: 'SUPPLIERS', href: '/admin/suppliers' },
    { id: 'settings', iconName: 'Settings', label: 'SETTINGS', href: '/admin/settings/company-info' },
    { id: 'tasks', iconName: 'BriefcaseBusiness', label: 'TASKS', href: '/admin/tasks' },
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
            version: 13, // bump version to fix settings default redirect
            migrate: (persistedState: any, version: number) => {
                if (version < 13) {
                    return { items: defaultSidebarItems };
                }
                return persistedState as SidebarStore;
            }
        }
    )
);
