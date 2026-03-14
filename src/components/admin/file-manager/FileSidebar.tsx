import React, { useState, useEffect } from 'react';
import { Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';
import { FileNode } from './types';
import { cn } from '@/components/time-tracker/lib/utils';

interface TreeItemProps {
    node: FileNode;
    allNodes: FileNode[];
    level: number;
    currentFolderId: string | null;
    onNavigate: (id: string) => void;
}

const TreeItem = ({ node, allNodes, level, currentFolderId, onNavigate }: TreeItemProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const childFolders = allNodes.filter(n => n.parentId === node.id && n.type === 'folder');
    const hasChildren = childFolders.length > 0;
    const isSelected = currentFolderId === node.id;

    // Auto-expand if a child is selected
    useEffect(() => {
        let current = currentFolderId;
        while (current) {
            if (current === node.id) {
                setIsExpanded(true);
                break;
            }
            const parent = allNodes.find(n => n.id === current);
            current = parent ? parent.parentId : null;
        }
    }, [currentFolderId, node.id, allNodes]);

    return (
        <div>
            <div
                className={cn(
                    "flex items-center group cursor-pointer hover:bg-neutral-100 dark:hover:bg-white/5 py-1.5 pr-3 text-sm transition-colors",
                    isSelected ? "bg-primary/5 text-primary font-medium" : "text-neutral-600 dark:text-neutral-400"
                )}
                style={{ paddingLeft: `${level * 16 + 12}px` }}
                onClick={() => {
                    onNavigate(node.id);
                    if (hasChildren) setIsExpanded(true);
                }}
            >
                <div
                    className="w-5 h-5 flex flex-shrink-0 items-center justify-center mr-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (hasChildren) setIsExpanded(!isExpanded);
                    }}
                >
                    {hasChildren && (
                        isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
                    )}
                </div>
                {isExpanded && hasChildren ? (
                    <FolderOpen className={cn("w-4 h-4 mr-2 flex-shrink-0 transition-colors", isSelected ? "text-primary/70" : "text-blue-400/70")} />
                ) : (
                    <Folder className={cn("w-4 h-4 mr-2 flex-shrink-0 transition-colors", isSelected ? "text-primary/70" : "text-blue-400/70")} />
                )}
                <span className="truncate select-none">{node.name}</span>
            </div>

            {isExpanded && hasChildren && (
                <div className="flex flex-col">
                    {childFolders.map(child => (
                        <TreeItem
                            key={child.id}
                            node={child}
                            allNodes={allNodes}
                            level={level + 1}
                            currentFolderId={currentFolderId}
                            onNavigate={onNavigate}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

interface FileSidebarProps {
    nodes: FileNode[];
    currentFolderId: string | null;
    onNavigate: (id: string | null) => void;
}

export default function FileSidebar({ nodes, currentFolderId, onNavigate }: FileSidebarProps) {
    const allFolders = nodes.filter(n => n.type === 'folder');
    const rootFolders = allFolders.filter(n => !n.parentId);

    return (
        <div className="hidden md:flex flex-col w-64 bg-card/30 border-r border-border/50 h-full overflow-y-auto no-scrollbar shrink-0">
            <div className="p-4 border-b border-border/50 sticky top-0 bg-card/95 backdrop-blur z-10">
                <h3 className="font-semibold text-sm text-foreground">Global Library</h3>
            </div>
            <div className="py-2 flex-1 relative">
                <div
                    className={cn(
                        "flex items-center cursor-pointer hover:bg-neutral-100 dark:hover:bg-white/5 py-1.5 px-3 mb-1 text-sm transition-colors",
                        currentFolderId === null ? "bg-primary/5 text-primary font-medium" : "text-neutral-600 dark:text-neutral-400"
                    )}
                    onClick={() => onNavigate(null)}
                >
                    <div className="w-5 h-5 flex flex-shrink-0 items-center justify-center mr-1" />
                    <Folder className={cn("w-4 h-4 mr-2 flex-shrink-0", currentFolderId === null ? "text-primary/70" : "text-blue-400/70")} />
                    <span className="truncate select-none">Drive Root</span>
                </div>
                {rootFolders.map(folder => (
                    <TreeItem
                        key={folder.id}
                        node={folder}
                        allNodes={allFolders}
                        level={0}
                        currentFolderId={currentFolderId}
                        onNavigate={onNavigate}
                    />
                ))}
            </div>
        </div>
    );
}
