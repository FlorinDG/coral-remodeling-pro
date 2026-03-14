"use client";
import React, { useState, useEffect } from "react";
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

export const settingsTabs = [
    { label: 'UI Layout', href: '/admin/settings/ui', id: 'ui' }
];

export default function SidebarOrderSettings() {
    const { items, setItems, resetToDefault } = useSidebarStore();
    const [localItems, setLocalItems] = useState(items);

    // Sync local state if global state changes (e.g. from reset)
    useEffect(() => {
        setLocalItems(items);
    }, [items]);

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

    const handleSave = () => {
        setItems(localItems);
        toast.success("Sidebar layout saved successfully");
    };

    const handleReset = () => {
        if (confirm("Are you sure you want to reset the sidebar to default order?")) {
            resetToDefault();
            toast.info("Sidebar reset to default layout");
        }
    }

    const hasChanges = JSON.stringify(localItems) !== JSON.stringify(items);

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={settingsTabs} />
            <div className="w-full h-full p-6 pb-10 max-w-3xl">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Sidebar Layout</h1>
                        <p className="text-sm text-neutral-500 mt-1">Drag and drop to reorder your admin sidebar navigation.</p>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" onClick={handleReset} className="gap-2">
                            <RotateCcw className="w-4 h-4" />
                            Reset Default
                        </Button>
                        <Button
                            onClick={handleSave}
                            className="gap-2 bg-[#d35400] hover:bg-[#e67e22] text-white"
                            disabled={!hasChanges}
                        >
                            <Save className="w-4 h-4" />
                            Save Changes
                        </Button>
                    </div>
                </div>

                <div className="bg-neutral-50 dark:bg-black/50 border border-neutral-200 dark:border-white/10 rounded-xl p-6">
                    <DndContext
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
        </div>
    );
}
