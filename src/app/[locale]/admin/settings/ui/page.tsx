"use client";
import React, { useState, useEffect, useMemo } from "react";
import ModuleTabs from "@/components/admin/ModuleTabs";

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

import { Button } from "@/components/ui/button";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { useTabStore } from "@/store/useTabStore";
import { DraggableTabItem } from "@/components/admin/settings/DraggableTabItem";
import { useTenant } from "@/context/TenantContext";
import SearchableSelect from '@/components/ui/SearchableSelect';

import { getFilteredSettingsTabs } from "@/config/tabs";

import { usePageTitle } from '@/hooks/usePageTitle';



export default function SidebarOrderSettings() {
    usePageTitle('UI & Layouts');
    const { activeModules } = useTenant();


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
        ...require('@/config/tabs').frontendTabs,
        ...require('@/config/tabs').financialTabs,
        ...require('@/config/tabs').settingsTabs,
    ];

    // Build the rendered tab list by mapping the IDs back to their full objects
    const renderedTabs = localTabOrder.map(id => allKnownTabs.find(t => t.id === id)).filter(Boolean) as any[];

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={getFilteredSettingsTabs(activeModules)} groupId="settings" />
            <div className="w-full h-full p-6 pb-10 max-w-4xl space-y-12">

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
                                <SearchableSelect
                                    value={selectedGroupId}
                                    onChange={(val) => setSelectedGroupId(val)}
                                    options={allGroups.map((group: { groupId: string, label: string }) => ({
                                        value: group.groupId,
                                        label: group.label,
                                    }))}
                                    placeholder="Select module"
                                    className="w-48"
                                />
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
