import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import QuotationRow from './QuotationRow';
import { Block } from '@/components/admin/database/types';

interface SortableQuotationRowProps {
    block: Block;
    index: number;
    depth?: number;
    onUpdate: (id: string, updates: Partial<Block>) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    hasLibraryAccess?: boolean;
    vatCalcMode?: 'lines' | 'total';
    language?: string;
    isDraggingGlobal?: boolean;
    isInactive?: boolean;
}

export default function SortableQuotationRow(props: SortableQuotationRowProps) {
    const { block, depth = 0 } = props;
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: block.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className={`relative group w-full ${props.isDraggingGlobal && !isDragging ? 'opacity-90' : ''}`}>
            <div style={{ paddingLeft: `${depth * 24}px` }}>
                <QuotationRow
                    {...props}
                    dragHandleProps={{ ...attributes, ...listeners }}
                    isDragging={isDragging}
                />
            </div>
        </div>
    );
}
