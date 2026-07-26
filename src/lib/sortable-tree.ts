import { arrayMove } from '@dnd-kit/sortable';
import type { UniqueIdentifier } from '@dnd-kit/core';

export interface TreeItemComponent {
  id: string;
  children?: TreeItemComponent[];
  [key: string]: any;
}

export interface FlattenedItem extends TreeItemComponent {
  parentId: string | null;
  depth: number;
  index: number;
}

function flatten(
  items: TreeItemComponent[],
  parentId: string | null = null,
  depth: number = 0
): FlattenedItem[] {
  return items.reduce<FlattenedItem[]>((acc, item, index) => {
    return [
      ...acc,
      { ...item, parentId, depth, index },
      ...flatten(item.children || [], item.id, depth + 1),
    ];
  }, []);
}

export function flattenTree(items: TreeItemComponent[]): FlattenedItem[] {
  return flatten(items);
}

export function buildTree(flattenedItems: FlattenedItem[]): TreeItemComponent[] {
  const root: { id: string; children: TreeItemComponent[] } = { id: 'root', children: [] };
  const nodes: Record<string, { id: string; children: TreeItemComponent[]; [key: string]: any }> = {
    [root.id]: root,
  };
  const items = flattenedItems.map((item) => ({ ...item, children: [] }));

  for (const item of items) {
    const { id, children, depth, parentId, index, ...rest } = item;
    nodes[id] = { id, children, ...rest };
  }

  for (const item of items) {
    const node = nodes[item.id];
    if (item.parentId && nodes[item.parentId]) {
      nodes[item.parentId].children.push(node);
    } else {
      root.children.push(node);
    }
  }

  return root.children;
}

// ── Type-Aware Constraints ──────────────────────────────────────────────
// Define which types are allowed to be nested inside which types
const ALLOWED_CHILDREN: Record<string, string[]> = {
  'root': ['section', 'post', 'line', 'text', 'image', 'article', 'bestek', 'divider', 'space', 'page-break'],
  'section': ['subsection', 'post', 'line', 'text', 'image', 'article', 'bestek', 'divider', 'space', 'page-break'],
  'subsection': ['post', 'line', 'text', 'image', 'article', 'bestek', 'divider', 'space', 'page-break'],
  'post': ['line', 'text', 'image', 'article', 'bestek', 'divider', 'space', 'page-break'],
  // line and primitive blocks cannot have children
  'line': [],
  'text': [],
  'image': [],
  'article': [],
  'bestek': [],
  'divider': [],
  'space': [],
  'page-break': []
};

function canNest(parentType: string, childType: string): boolean {
  return (ALLOWED_CHILDREN[parentType] || []).includes(childType);
}

export function getProjection(
  items: FlattenedItem[],
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
  
  return {
    depth,
    maxDepth,
    minDepth,
    parentId: getParentId(),
  };

  function getMaxDepth({ previousItem }: { previousItem?: FlattenedItem }) {
    if (previousItem) {
      // For type-aware projection: max depth is previous + 1, ONLY IF previous can hold this item
      if (canNest(previousItem.type || 'line', activeItem.type || 'line')) {
        return previousItem.depth + 1;
      }
      return previousItem.depth;
    }
    return 0;
  }

  function getMinDepth({ nextItem }: { nextItem?: FlattenedItem }) {
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
