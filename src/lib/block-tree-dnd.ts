import { arrayMove } from '@dnd-kit/sortable';
import type { UniqueIdentifier } from '@dnd-kit/core';
import type { Block } from '@/components/admin/database/types';

export interface FlattenedBlock extends Block {
    parentId: string | null;
    depth: number;
    index: number;
    isHidden?: boolean;
}

// ── Shared Core ─────────────────────────────────────────────────────────

export function countBlocks(blocks: Block[]): number {
    return blocks.reduce((acc, block) => {
        return acc + 1 + countBlocks(block.children || []);
    }, 0);
}

export function assertTreeInvariants(before: Block[], after: Block[]): boolean {
    const beforeCount = countBlocks(before);
    const afterCount = countBlocks(after);
    
    if (beforeCount !== afterCount) {
        console.error(`DnD Invariant Failed: Block count mismatch. Before: ${beforeCount}, After: ${afterCount}`);
        return false;
    }
    
    const getIds = (blocks: Block[]): string[] => {
        return blocks.flatMap(b => [b.id, ...getIds(b.children || [])]);
    };
    
    const beforeIds = getIds(before).sort();
    const afterIds = getIds(after).sort();
    
    const sameIds = beforeIds.length === afterIds.length && beforeIds.every((id, i) => id === afterIds[i]);
    if (!sameIds) {
        console.error('DnD Invariant Failed: ID set mismatch.');
        return false;
    }
    
    return true;
}



export function flattenBlocks(blocks: Block[], parentId: string | null = null, depth: number = 0, isParentCollapsed: boolean = false): FlattenedBlock[] {
    return blocks.reduce<FlattenedBlock[]>((acc, block, index) => {
        const isContainer = block.type === 'section' || block.type === 'subsection' || block.type === 'post';
        const isCollapsed = block.properties?.isCollapsed === true;
        const hidden = isParentCollapsed;
        
        return [
            ...acc,
            { ...block, parentId, depth, index, isHidden: hidden },
            ...(isContainer ? flattenBlocks(block.children || [], block.id, depth + 1, hidden || isCollapsed) : []),
        ];
    }, []);
}

export function buildBlocks(flattenedItems: FlattenedBlock[]): Block[] {
    const root: { id: string; children: Block[] } = { id: 'root', children: [] };
    const nodes: Record<string, { id: string; children: Block[]; [key: string]: any }> = {
        [root.id]: root,
    };
    // Containers get their children rebuilt from the flattened list, so they start empty.
    // NON-containers (e.g. a `line` carrying subcomponents/variants) were never flattened —
    // their children must be carried through untouched, or a single drag silently deletes
    // billable detail from the document. Guarded by tests/block-tree.test.ts.
    const items = flattenedItems.map((item) => ({
        ...item,
        children: isContainer(item.type ?? '') ? [] : (item.children ?? []),
    }));

    for (const item of items) {
        const { id, children, depth, parentId, index, ...rest } = item;
        nodes[id] = { id, children, ...rest };
    }

    for (const item of items) {
        const node = nodes[item.id] as Block;
        if (item.parentId && nodes[item.parentId]) {
            nodes[item.parentId].children.push(node);
        } else {
            root.children.push(node);
        }
    }

    return root.children;
}

// ── Type-Aware Constraints ──────────────────────────────────────────────
const CONTAINERS = ['section', 'subsection', 'post'] as const;

export const isContainer = (type: string) => CONTAINERS.includes(type as any);

export const canNest = (childType: string, parentType: string): boolean => {
    if (parentType === 'root') return true;
    return isContainer(parentType);
};

export function getBlockProjection(
    items: FlattenedBlock[],
    activeId: UniqueIdentifier,
    overId: UniqueIdentifier,
    dragOffset: number,
    indentationWidth: number
) {
    const overItemIndex = items.findIndex(({ id }) => id === overId);
    const activeItemIndex = items.findIndex(({ id }) => id === activeId);
    const activeItem = items[activeItemIndex];

    const newItems = arrayMove(items, activeItemIndex, overItemIndex);
    const previousItem = newItems[overItemIndex - 1];
    const nextItem = newItems[overItemIndex + 1];

    const dragDepth = dragOffset / indentationWidth;
    const projectedDepth = activeItem.depth + dragDepth;

    const maxDepth = getMaxDepth({ previousItem });
    const minDepth = getMinDepth({ nextItem });

    let depth = projectedDepth;

    if (projectedDepth >= maxDepth) {
        depth = maxDepth;
    } else if (projectedDepth < minDepth) {
        depth = minDepth;
    }

    const parentId = getParentId();

    return {
        depth,
        maxDepth,
        minDepth,
        parentId,
    };

    function getMaxDepth({ previousItem }: { previousItem?: FlattenedBlock }) {
        if (!previousItem) return 0;
        
        let current: FlattenedBlock | undefined = previousItem;
        let maxAllowedDepth = 0;
        
        // Check if the previous item itself can be a parent
        if (canNest(activeItem.type || 'line', previousItem.type || 'line')) {
            return previousItem.depth + 1;
        }

        // If it can't, walk up the hierarchy to find a valid parent
        let foundParentDepth = -1;
        
        const previousItemIndex = newItems.findIndex(i => i.id === previousItem.id);
        const ancestors = newItems.slice(0, previousItemIndex + 1).reverse();
        
        for (const ancestor of ancestors) {
            // Find ancestors by walking up depths
            if (ancestor.depth < current.depth) {
                if (canNest(activeItem.type || 'line', ancestor.type || 'line')) {
                    foundParentDepth = ancestor.depth;
                    break;
                }
                current = ancestor;
            }
        }
        
        if (foundParentDepth !== -1) {
             return foundParentDepth + 1;
        }

        return 0; // fallback to root if no valid parent found
    }

    function getMinDepth({ nextItem }: { nextItem?: FlattenedBlock }) {
        if (nextItem) {
            return nextItem.depth;
        }
        return 0;
    }

    function getParentId() {
        if (depth === 0 || !previousItem) {
            return null;
        }

        if (depth === previousItem.depth) {
            return previousItem.parentId;
        }

        if (depth > previousItem.depth) {
            return previousItem.id;
        }

        const newParent = newItems
            .slice(0, overItemIndex)
            .reverse()
            .find((item) => item.depth === depth)?.parentId;

        return newParent ?? null;
    }
}
