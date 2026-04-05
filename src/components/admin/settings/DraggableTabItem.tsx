"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { TabConfig } from "@/components/admin/ModuleTabs";

interface DraggableTabItemProps {
    tab: TabConfig;
}

export function DraggableTabItem({ tab }: DraggableTabItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: tab.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : 0,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-3 p-3 bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-lg shadow-sm ${isDragging ? "opacity-50 ring-2 ring-[var(--brand-color, #d35400)] relative z-50" : ""
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

            {/* Label */}
            <div className="flex items-center gap-3 flex-1">
                <div>
                    <span className="font-bold text-sm text-neutral-900 dark:text-white uppercase tracking-wider">{tab.label}</span>
                    <p className="text-[10px] uppercase tracking-widest text-neutral-400 mt-1 line-clamp-1">
                        URL: {tab.href}
                    </p>
                </div>
            </div>
        </div>
    );
}
