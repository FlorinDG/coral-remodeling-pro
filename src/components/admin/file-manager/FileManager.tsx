"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useFileManagerStore } from './store';
import { FileContextType, FileNode } from './types';
import { LayoutGrid, List, UploadCloud, Search, Folder, FileIcon, ImageIcon, FileText, ChevronRight, MoreVertical, Loader2, Download } from 'lucide-react';
import { cn } from '@/components/time-tracker/lib/utils';
import { format } from 'date-fns';
import FileViewerModal from './FileViewerModal';
import FileSidebar from './FileSidebar';

// -------------------------------------------------------------
// Sub-component: The Grid/List view to display nodes
// -------------------------------------------------------------
const FileDisplayArea = ({
    nodes,
    onNavigate,
    onFileView,
    viewMode
}: {
    nodes: FileNode[],
    onNavigate: (folderId: string) => void,
    onFileView: (file: FileNode) => void,
    viewMode: 'grid' | 'list'
}) => {
    const getIcon = (node: FileNode) => {
        if (node.type === 'folder') return <Folder className="w-10 h-10 text-blue-400 mb-2" />;
        if (node.mimeType?.includes('image')) return <ImageIcon className="w-10 h-10 text-emerald-400 mb-2" />;
        if (node.mimeType?.includes('pdf')) return <FileText className="w-10 h-10 text-red-400 mb-2" />;
        return <FileIcon className="w-10 h-10 text-neutral-400 mb-2" />;
    };

    const getSmallIcon = (node: FileNode) => {
        if (node.type === 'folder') return <Folder className="w-4 h-4 text-blue-400" />;
        if (node.mimeType?.includes('image')) return <ImageIcon className="w-4 h-4 text-emerald-400" />;
        if (node.mimeType?.includes('pdf')) return <FileText className="w-4 h-4 text-red-400" />;
        return <FileIcon className="w-4 h-4 text-neutral-400" />;
    };

    const formatSize = (bytes?: number) => {
        if (!bytes) return '--';
        const mb = bytes / (1024 * 1024);
        if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
        return `${mb.toFixed(1)} MB`;
    };

    if (nodes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
                <Folder className="w-12 h-12 mb-4 opacity-20" />
                <p>This folder is empty.</p>
                <p className="text-sm opacity-60">Upload files or create folders to get started.</p>
            </div>
        );
    }

    if (viewMode === 'list') {
        return (
            <div className="w-full">
                <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-border/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <div className="col-span-6">Name</div>
                    <div className="col-span-2 text-right">Size</div>
                    <div className="col-span-3">Last Modified</div>
                    <div className="col-span-1"></div>
                </div>
                <div className="divide-y divide-border/20">
                    {nodes.map(node => (
                        <div
                            key={node.id}
                            className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors"
                            onClick={() => {
                                if (node.type === 'folder') onNavigate(node.id);
                                else onFileView(node);
                            }}
                        >
                            <div className="col-span-6 flex items-center gap-3">
                                {getSmallIcon(node)}
                                <span className="font-medium text-sm text-foreground truncate">{node.name}</span>
                            </div>
                            <div className="col-span-2 text-right text-sm text-muted-foreground">{node.type === 'folder' ? '--' : formatSize(node.size)}</div>
                            <div className="col-span-3 text-sm text-muted-foreground">
                                {format(new Date(node.updatedAt), 'MMM d, yyyy')}
                            </div>
                            <div className="col-span-1 flex justify-end gap-1">
                                {node.type === 'file' && node.url && (
                                    <a
                                        href={node.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-md"
                                        title="Download / Open"
                                        onClick={(e) => e.stopPropagation()} // Prevent opening the viewer modal when clicking download
                                    >
                                        <Download className="w-4 h-4" />
                                    </a>
                                )}
                                <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-md">
                                    <MoreVertical className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
            {nodes.map(node => (
                <div
                    key={node.id}
                    onClick={() => {
                        if (node.type === 'folder') onNavigate(node.id);
                        else onFileView(node);
                    }}
                    className="group relative flex flex-col items-center justify-center p-6 bg-card border border-border/50 rounded-xl hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
                >
                    {getIcon(node)}
                    <span className="mt-2 text-sm font-medium text-center w-full truncate px-2 text-foreground">
                        {node.name}
                    </span>
                    {node.type === 'file' && (
                        <span className="text-xs text-muted-foreground mt-1">
                            {formatSize(node.size)}
                        </span>
                    )}

                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex items-center transition-all bg-card/80 backdrop-blur-sm rounded-md shadow-sm border border-border/50">
                        {node.type === 'file' && node.url && (
                            <a
                                href={node.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-all"
                                title="Download / Open"
                                onClick={(e) => e.stopPropagation()} // Prevent viewer opening
                            >
                                <Download className="w-4 h-4" />
                            </a>
                        )}
                        <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-all">
                            <MoreVertical className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

// -------------------------------------------------------------
// Main Component
// -------------------------------------------------------------
interface FileManagerProps {
    contextType?: FileContextType;
    contextId?: string;
    driveFolderId?: string; // Optional direct mapping to a Google Drive folder
}

export default function FileManager({ contextType, contextId }: FileManagerProps) {
    const nodes = useFileManagerStore(state => state.nodes);
    const isLoading = useFileManagerStore(state => state.isLoading);
    const error = useFileManagerStore(state => state.error);
    const fetchNodes = useFileManagerStore(state => state.fetchNodes);
    const uploadFile = useFileManagerStore(state => state.uploadFile);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewingFile, setViewingFile] = useState<FileNode | null>(null);
    const [tagFilter, setTagFilter] = useState<string | null>(null);

    const isGlobalMode = !contextType || contextType === 'global';

    useEffect(() => {
        fetchNodes(contextType || 'global', contextId);
    }, [contextType, contextId, fetchNodes]);

    // 1. Get the pool of relevant nodes based on scope
    const scopedNodes = useMemo(() => {
        if (isGlobalMode) return nodes.filter(n => n.contextType === 'global');
        return nodes.filter(n => n.contextType === contextType && n.contextId === contextId);
    }, [nodes, isGlobalMode, contextType, contextId]);

    // 2. Filter nodes based on Current Folder OR Search Query
    const displayedNodes = useMemo(() => {
        if (searchQuery.trim()) {
            return scopedNodes.filter(n => n.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return scopedNodes.filter(n => n.parentId === currentFolderId);
    }, [scopedNodes, searchQuery, currentFolderId]);

    // Handle building breadcrumbs
    const breadcrumbs = useMemo(() => {
        if (searchQuery) return [{ id: 'search', name: `Search results for "${searchQuery}"` }];
        if (tagFilter) return [{ id: 'filter', name: `Filtered by ${tagFilter}` }];

        const crumbs = [{ id: null, name: isGlobalMode ? 'Global Library' : 'Files' }];
        let current = nodes.find(n => n.id === currentFolderId);

        const path = [];
        while (current) {
            path.unshift({ id: current.id, name: current.name });
            const parentId = current.parentId;
            current = parentId ? nodes.find(n => n.id === parentId) : undefined;
        }

        return [...crumbs, ...path];
    }, [currentFolderId, isGlobalMode, nodes, searchQuery, tagFilter]);

    return (
        <div className="flex w-full h-full bg-background rounded-b-xl overflow-hidden">
            {isGlobalMode && (
                <FileSidebar
                    nodes={nodes}
                    currentFolderId={currentFolderId}
                    onNavigate={(id) => setCurrentFolderId(id)}
                />
            )}

            <div className="flex-1 flex flex-col min-w-0 bg-background border-l border-border/50">

                {/* Toolbar */}
                <div className="min-h-[3.25rem] py-1.5 flex flex-wrap items-center justify-between gap-2 px-3 border-b border-border/50 bg-card/50">

                    {/* Breadcrumbs & Tags */}
                    <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
                        <div className="flex flex-wrap items-center gap-0.5">
                            {breadcrumbs.map((crumb, idx) => (
                                <React.Fragment key={crumb.id || 'root'}>
                                    {idx > 0 && <ChevronRight className="w-3.5 h-3.5 mx-0.5 text-muted-foreground" />}
                                    <button
                                        onClick={() => {
                                            if (crumb.id === 'filter') {
                                                setTagFilter(null);
                                            } else {
                                                setSearchQuery('');
                                                setTagFilter(null);
                                                setCurrentFolderId(crumb.id as string | null);
                                            }
                                        }}
                                        className={cn(
                                            "hover:underline decoration-primary underline-offset-4 transition-colors whitespace-nowrap",
                                            idx === breadcrumbs.length - 1 ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {crumb.name}
                                    </button>
                                </React.Fragment>
                            ))}
                        </div>

                        {/* Topbar Tags for Global Mode */}
                        {isGlobalMode && (
                            <div className="hidden lg:flex items-center gap-1.5 border-l border-border/50 pl-3 h-5">
                                {['invoice', 'quotation', 'contract'].map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => {
                                            const newTag = tagFilter === tag ? null : tag;
                                            setTagFilter(newTag);
                                            if (newTag) {
                                                setCurrentFolderId(null);
                                                setSearchQuery('');
                                            }
                                        }}
                                        className={cn(
                                            "px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors border whitespace-nowrap",
                                            tagFilter === tag
                                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                                : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                                        )}
                                    >
                                        {tag.charAt(0).toUpperCase() + tag.slice(1)}s
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 md:gap-2 flex-wrap sm:flex-nowrap">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search files..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 pr-3 py-1 text-xs bg-background border border-border rounded-full w-20 focus:w-36 sm:w-28 sm:focus:w-44 lg:w-40 lg:focus:w-52 focus:outline-none focus:ring-1 focus:ring-primary transition-all duration-300"
                            />
                        </div>

                        <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-md p-0.5">
                            <button
                                onClick={() => setViewMode('list')}
                                className={cn("p-1 rounded-sm transition-colors", viewMode === 'list' ? 'bg-white dark:bg-neutral-700 shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
                            >
                                <List className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={cn("p-1 rounded-sm transition-colors", viewMode === 'grid' ? 'bg-white dark:bg-neutral-700 shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <label className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-md border border-transparent transition-colors shadow-sm cursor-pointer ml-1">
                            <UploadCloud className="w-4 h-4" />
                            <span className="hidden lg:inline">Upload</span>
                            <input
                                type="file"
                                className="hidden"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        await uploadFile(file, currentFolderId, contextType || 'global', contextId);
                                    }
                                    e.target.value = ''; // reset
                                }}
                            />
                        </label>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto no-scrollbar bg-neutral-50/30 dark:bg-black relative">
                    {isLoading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                            <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading files...</p>
                        </div>
                    ) : error && displayedNodes.length === 0 && !error.includes('not configured') && !error.includes('missing') ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 bg-red-50/50 p-6 z-10 text-center">
                            <p className="font-bold">Drive Sync Failed</p>
                            <p className="text-sm max-w-md">{error}</p>
                        </div>
                    ) : null}

                    <FileDisplayArea
                        nodes={displayedNodes}
                        onNavigate={(id) => setCurrentFolderId(id)}
                        onFileView={(file) => setViewingFile(file)}
                        viewMode={viewMode}
                    />
                </div>

                {viewingFile && (
                    <FileViewerModal
                        file={viewingFile}
                        onClose={() => setViewingFile(null)}
                    />
                )}

            </div>
        </div>
    );
}
