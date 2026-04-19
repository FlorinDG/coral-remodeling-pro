"use client";
import React, { useState, useEffect, useMemo } from "react";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { useSidebarStore, defaultSidebarItems } from "@/store/useSidebarStore";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { DraggableSidebarItem } from "@/components/admin/settings/DraggableSidebarItem";
import { Button } from "@/components/time-tracker/components/ui/button";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { useTabStore } from "@/store/useTabStore";
import { DraggableTabItem } from "@/components/admin/settings/DraggableTabItem";
import { useTenant } from "@/context/TenantContext";

import { settingsTabs } from "@/config/tabs";

import { usePageTitle } from '@/hooks/usePageTitle';

// Same mapping as AdminLayout — which module key requires which activeModule string(s)
const SIDEBAR_MODULE_MAP: Record<string, string[]> = {
    calendar:   ['CALENDAR'],
    email:      ['CRM'],
    tasks:      ['CRM'],
    files:      ['PROJECTS'],
    projects:   ['PROJECTS'],
    hr:         ['HR'],
    library:    ['DATABASES'],
    frontend:   ['WEBSITES'],
    // Always visible regardless of modules:
    // dashboard, financials, contacts, suppliers, settings
};

export default function SidebarOrderSettings() {
    usePageTitle('UI & Layouts');
    const { activeModules } = useTenant();
    const { items, setItems, resetToDefault } = useSidebarStore();

    // Filter to only the items the tenant has access to
    const allowedItems = useMemo(() =>
        defaultSidebarItems.filter(item => {
            const required = SIDEBAR_MODULE_MAP[item.id];
            if (!required) return true; // no gate → always show
            return required.some(m => activeModules.includes(m));
        }),
        [activeModules]
    );

    // Local drag state seeded from allowed items (merge with persisted order)
    const [localItems, setLocalItems] = useState(() =>
        // Respect saved order but only keep allowed entries
        items
            .filter(i => allowedItems.some(a => a.id === i.id))
            .concat(allowedItems.filter(a => !items.some(i => i.id === a.id)))
    );

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setLocalItems((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);

                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    // Sync local list when allowedItems changes (e.g. after TenantContext loads)
    useEffect(() => {
        setLocalItems(
            items
                .filter(i => allowedItems.some(a => a.id === i.id))
                .concat(allowedItems.filter(a => !items.some(i => i.id === a.id)))
        );
    }, [allowedItems]);

    const handleSave = () => {
        // Persist only the allowed items (never leak ungated items back to store)
        setItems(localItems);
        toast.success("Sidebar layout saved successfully");
    };

    const handleReset = () => {
        if (confirm("Are you sure you want to reset the sidebar to default order?")) {
            setLocalItems(allowedItems);
            setItems(allowedItems);
            toast.info("Sidebar reset to default layout");
        }
    }

    const hasChanges = JSON.stringify(localItems) !== JSON.stringify(
        items.filter(i => allowedItems.some(a => a.id === i.id))
            .concat(allowedItems.filter(a => !items.some(i => i.id === a.id)))
    );

    const { tabOrders, setTabOrder, resetTabOrder, getAllGroups, getGroupConfig } = useTabStore();
    const allGroups = getAllGroups();

    // Tab Layout Local State
    const [selectedGroupId, setSelectedGroupId] = useState<string>(allGroups[0]?.groupId || '');

    // Get the active group configuration to determine its default tabs
    const activeGroupConfig = getGroupConfig(selectedGroupId);

    // Fallback if no config found
    const defaultTabIds = activeGroupConfig?.defaultOrder || [];

    // Calculate the user's customized order, falling back to the default order
    const persistedOrderRaw = tabOrders[selectedGroupId] || defaultTabIds;
    // Crucial fix: Merge any newly deployed system tabs that aren't yet in the user's local storage cache
    const persistedOrder = [...new Set([...persistedOrderRaw, ...defaultTabIds])];

    // Manage local drag-and-drop state before saving
    const [localTabOrder, setLocalTabOrder] = useState<string[]>(persistedOrder);

    // Sync local state when changing groups or when global storage updates
    useEffect(() => {
        const raw = tabOrders[selectedGroupId] || getGroupConfig(selectedGroupId)?.defaultOrder || [];
        const defaults = getGroupConfig(selectedGroupId)?.defaultOrder || [];
        setLocalTabOrder([...new Set([...raw, ...defaults])]);
    }, [selectedGroupId, tabOrders]);

    const handleTabDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setLocalTabOrder((items) => {
                const oldIndex = items.indexOf(active.id as string);
                const newIndex = items.indexOf(over.id as string);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleSaveTabs = () => {
        setTabOrder(selectedGroupId, localTabOrder);
        toast.success("Module tabs layout saved successfully");
    };

    const handleResetTabs = () => {
        if (confirm("Are you sure you want to restore the default tab order for this module?")) {
            resetTabOrder(selectedGroupId);
            toast.info("Module tabs reset to default layout");
        }
    }

    const hasTabChanges = JSON.stringify(localTabOrder) !== JSON.stringify(persistedOrder);

    // Helper map to recreate full Tab objects for the Draggable component
    // We map over all the imported tabs to find the matching objects
    const allKnownTabs = [
        ...require('@/config/tabs').hrTabs,
        ...require('@/config/tabs').relationsTabs,
        ...require('@/config/tabs').frontendTabs,
        ...require('@/config/tabs').financialTabs,
        ...require('@/config/tabs').settingsTabs,
    ];

    // Build the rendered tab list by mapping the IDs back to their full objects
    const renderedTabs = localTabOrder.map(id => allKnownTabs.find(t => t.id === id)).filter(Boolean) as any[];

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={settingsTabs} groupId="settings" />
            <div className="w-full h-full p-6 pb-10 max-w-4xl space-y-12">

                {/* 1. SIDEBAR LAYOUT CONFIG */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-neutral-200 dark:border-white/10 pb-4">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Sidebar Layout</h1>
                            <p className="text-sm text-neutral-500 mt-1">Drag and drop to reorder your global admin navigation.</p>
                        </div>

                        <div className="flex gap-3">
                            <Button variant="outline" onClick={handleReset} className="gap-2">
                                <RotateCcw className="w-4 h-4" />
                                Reset Default
                            </Button>
                            <Button
                                onClick={handleSave}
                                className="gap-2 bg-[var(--brand-color,#d35400)] hover:opacity-90 text-white"
                                disabled={!hasChanges}
                            >
                                <Save className="w-4 h-4" />
                                Save Changes
                            </Button>
                        </div>
                    </div>

                    <div className="bg-neutral-50 dark:bg-black/50 border border-neutral-200 dark:border-white/10 rounded-xl p-6">
                        <DndContext
                            id="dnd-sidebar"
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                        >
                            <SortableContext
                                items={localItems.map(i => i.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="flex justify-center">
                                    <div className="w-full max-w-lg space-y-3">
                                        {localItems.map((item) => (
                                            <DraggableSidebarItem key={item.id} item={item} />
                                        ))}
                                    </div>
                                </div>
                            </SortableContext>
                        </DndContext>
                    </div>
                </div>

                {/* 2. MODULE TABS CONFIG */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-neutral-200 dark:border-white/10 pb-4">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Module Tabs Layout</h1>
                            <p className="text-sm text-neutral-500 mt-1">Reorder the horizontal navigation tabs for specific modules.</p>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Select Module:</label>
                                <select
                                    className="bg-white dark:bg-black border border-neutral-200 dark:border-white/10 text-sm rounded-lg px-3 py-2 outline-none focus:border-[var(--brand-color)] transition-colors"
                                    value={selectedGroupId}
                                    onChange={(e) => setSelectedGroupId(e.target.value)}
                                >
                                    {allGroups.map((group: { groupId: string, label: string }) => (
                                        <option key={group.groupId} value={group.groupId}>{group.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 border-l border-neutral-200 dark:border-white/10 pl-6">
                                <Button variant="outline" onClick={handleResetTabs} className="gap-2">
                                    <RotateCcw className="w-4 h-4" />
                                    Reset Default
                                </Button>
                                <Button
                                    onClick={handleSaveTabs}
                                    className="gap-2 bg-[var(--brand-color,#d35400)] hover:opacity-90 text-white"
                                    disabled={!hasTabChanges}
                                >
                                    <Save className="w-4 h-4" />
                                    Save Tabs
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-neutral-50 dark:bg-black/50 border border-neutral-200 dark:border-white/10 rounded-xl p-6">
                        <DndContext
                            id="dnd-tabs"
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleTabDragEnd}
                            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                        >
                            <SortableContext
                                items={localTabOrder}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="flex justify-center">
                                    <div className="w-full max-w-lg space-y-3">
                                        {renderedTabs.map((tab) => (
                                            <DraggableTabItem key={tab.id} tab={tab} />
                                        ))}
                                    </div>
                                </div>
                            </SortableContext>
                        </DndContext>
                    </div>
                </div>

            </div>
        </div>
    );
}
