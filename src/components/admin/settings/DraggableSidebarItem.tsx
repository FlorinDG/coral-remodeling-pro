"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { SidebarItem, getIconComponent } from "@/store/useSidebarStore";

interface DraggableSidebarItemProps {
    item: SidebarItem;
}

export function DraggableSidebarItem({ item }: DraggableSidebarItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : 0,
    };

    const IconComponent = item.iconName ? getIconComponent(item.iconName) : null;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-3 p-3 bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-lg shadow-sm ${isDragging ? "opacity-50 ring-2 ring-[#d35400] relative z-50" : ""
                }`}
        >
            {/* Drag Handle */}
            <button
                className="cursor-grab hover:bg-neutral-100 dark:hover:bg-white/5 p-1 rounded-md text-neutral-400 hover:text-neutral-600 transition-colors"
                {...attributes}
                {...listeners}
                aria-label="Drag handle"
            >
                <GripVertical className="w-5 h-5" />
            </button>

            {/* Icon & Label */}
            <div className="flex items-center gap-3 flex-1">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-white/5 flex items-center justify-center text-neutral-500">
                    {IconComponent && <IconComponent className="w-4 h-4" />}
                </div>
                <div>
                    <span className="font-bold text-sm text-neutral-900 dark:text-white">{item.label}</span>
                    {item.children && (
                        <p className="text-xs text-neutral-500 line-clamp-1">
                            {item.children.length} sub-items
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
