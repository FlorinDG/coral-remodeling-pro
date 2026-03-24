"use client";

import React, { useState } from 'react';
import { useDatabaseStore } from '../store';
import { X, Maximize2, Minimize2, MoreHorizontal, Edit3, Trash2, Plus } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/time-tracker/components/ui/dropdown-menu';
import BlockEditor from './BlockEditor';
import FileManager from '@/components/admin/file-manager/FileManager';
import { useFileManagerStore } from '@/components/admin/file-manager/store';
import VariantsPropertyEditor from './VariantsPropertyEditor';
import { VariantsConfig } from '../types';

interface PageModalProps {
    databaseId: string;
    pageId: string;
    onClose: () => void;
}

export default function PageModal({ databaseId, pageId, onClose }: PageModalProps) {
    const [isMaximized, setIsMaximized] = useState(false);
    const [width, setWidth] = useState(1200);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.pageX;
        const startWidth = width;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = startX - moveEvent.pageX;
            setWidth(Math.max(600, Math.min(window.innerWidth, startWidth + deltaX)));
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);
    const database = useDatabaseStore(state => state.databases.find(db => db.id === databaseId));
    const deleteProperty = useDatabaseStore(state => state.deleteProperty);
    const page = database?.pages.find(p => p.id === pageId);

    // We get the specific action initialized previously
    const initializeContextFolder = useFileManagerStore(state => state.initializeContextFolder);

    // Auto-create a Google Drive folder if this page doesn't have one yet
    React.useEffect(() => {
        const createDriveFolder = async () => {
            if (page && !page.properties['driveFolderId'] && page.properties['title']) {
                const folderName = String(page.properties['title']);

                // We use 'project' arbitrarily here, but ideally we'd pass a more specific contextType if needed
                const driveId = await initializeContextFolder(folderName, 'project', page.id);

                if (driveId) {
                    // Save the new folder ID back into the Database Page record properly
                    updatePageProperty(databaseId, page.id, 'driveFolderId', driveId);
                }
            }
        };

        createDriveFolder();
    }, [page?.id, page?.properties, databaseId, initializeContextFolder, updatePageProperty]);

    // Garbage collection script to prune the mass-cloned Google Drive folders created by the previous infinite loop bug
    const { nodes, deleteNode } = useFileManagerStore();
    React.useEffect(() => {
        if (!database || !page) return;

        // Start async sweep to respect Google API rate limits
        const startGarbageCollection = async () => {
            // Find all project folders generated for this specific page
            const duplicateFolders = nodes.filter(n => n.contextType === 'project' && n.contextId === page.id && n.type === 'folder');

            // If we have clones
            if (duplicateFolders.length > 1) {
                // Determine the "True" folder ID. Either the one actively bound to the page, or the newest one if none bound.
                const boundDriveId = page.driveFolderId || page.properties['driveFolderId'] || duplicateFolders[duplicateFolders.length - 1].id;

                // Identify all orphans
                const orphans = duplicateFolders.filter(f => f.id !== boundDriveId);

                console.log(`[Garbage Collector] Commencing purge of ${orphans.length} cloned Drive folders for ${page.id}...`);
                for (const orphan of orphans) {
                    try {
                        console.log(`[Garbage Collector] Purging node ${orphan.id}...`);
                        await deleteNode(orphan.id);
                        // Mandatory 500ms sleep to prevent Google Drive API HTTP 429 Rate Limiting crashes
                        await new Promise(r => setTimeout(r, 500));
                    } catch (e) {
                        console.error(`[Garbage Collector] Failed to delete ${orphan.id}:`, e);
                    }
                }
                console.log(`[Garbage Collector] Purge complete!`);
            }
        };

        startGarbageCollection();
    }, [database, page, nodes, deleteNode]);

    if (!database || !page) return null;

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div
                className={`relative h-full bg-white dark:bg-[#191919] shadow-2xl flex flex-col overflow-y-auto animate-in slide-in-from-right duration-300 flex-shrink-0 ${isMaximized ? 'w-full' : ''}`}
                style={isMaximized ? {} : { width: `${width}px` }}
            >
                {!isMaximized && (
                    <div
                        className="absolute top-0 left-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 transition-colors z-[110]"
                        onMouseDown={handleMouseDown}
                    />
                )}

                {/* Header Actions */}
                <div className="sticky top-0 z-10 flex items-center justify-between p-3 bg-white/80 dark:bg-[#191919]/80 backdrop-blur-md">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsMaximized(!isMaximized)}
                            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                        >
                            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Page Content */}
                <div className="flex-1 px-8 pt-2 pb-6 max-w-[900px] mx-auto w-full">
                    {/* Title */}
                    <input
                        className="w-full text-4xl font-bold mb-4 text-neutral-900 dark:text-white outline-none bg-transparent placeholder:text-neutral-300 dark:placeholder:text-neutral-700"
                        value={(page.properties['title'] as string) || ''}
                        onChange={(e) => updatePageProperty(databaseId, pageId, 'title', e.target.value)}
                        placeholder="Untitled"
                    />

                    {/* Properties Grid */}
                    {/* Properties Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 py-4 border-b border-neutral-100 dark:border-white/5 mb-6">
                        {database.properties.filter(p => p.id !== 'title').map(prop => (
                            <div key={prop.id} className="flex flex-col justify-center gap-1 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-black/40 shadow-sm hover:shadow-md dark:hover:border-neutral-700 transition-all group relative">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-neutral-500 dark:text-neutral-500 font-bold uppercase tracking-wider">{prop.name}</span>

                                    {(prop.type === 'select' || prop.type === 'multi_select') && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className="p-0.5 -mr-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MoreHorizontal className="w-3 h-3" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48 z-[110] shadow-xl">
                                                <DropdownMenuItem onClick={() => {
                                                    const newName = prompt('Enter new property name:', prop.name);
                                                    if (newName) {
                                                        useDatabaseStore.getState().updateProperty(databaseId, prop.id, { name: newName });
                                                    }
                                                }} className="cursor-pointer">
                                                    <Edit3 className="w-4 h-4 mr-2" />
                                                    Rename Property
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => {
                                                    const optName = prompt('Add new option:');
                                                    if (optName) {
                                                        const newOpt = { id: Math.random().toString(36).substring(7), name: optName, color: 'blue' };
                                                        const newOptions = [...(prop.config?.options || []), newOpt];
                                                        useDatabaseStore.getState().updateProperty(databaseId, prop.id, { config: { ...prop.config, options: newOptions } });
                                                    }
                                                }} className="cursor-pointer">
                                                    <Plus className="w-4 h-4 mr-2" />
                                                    Add Option
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => {
                                                    if (confirm(`Are you sure you want to delete property "${prop.name}"?`)) {
                                                        useDatabaseStore.getState().deleteProperty(databaseId, prop.id);
                                                    }
                                                }} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20">
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Delete Property
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 h-7 flex items-center w-full">
                                    {prop.type === 'text' ? (
                                        <input
                                            className="w-full h-full bg-transparent outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-700 font-medium"
                                            value={(page.properties[prop.id] as string) || ''}
                                            onChange={(e) => updatePageProperty(databaseId, pageId, prop.id, e.target.value)}
                                            placeholder="Empty"
                                        />
                                    ) : prop.type === 'number' ? (
                                        <input
                                            type="number"
                                            className="w-full h-full bg-transparent outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-700 font-medium"
                                            value={(page.properties[prop.id] as number) || ''}
                                            onChange={(e) => updatePageProperty(databaseId, pageId, prop.id, parseFloat(e.target.value))}
                                            placeholder="0"
                                        />
                                    ) : prop.type === 'date' ? (
                                        <input
                                            type="date"
                                            className="w-full h-full bg-transparent outline-none cursor-pointer text-neutral-700 dark:text-neutral-300 font-medium"
                                            value={(page.properties[prop.id] as string) || ''}
                                            onChange={(e) => updatePageProperty(databaseId, pageId, prop.id, e.target.value)}
                                        />
                                    ) : prop.type === 'checkbox' ? (
                                        <label className="flex items-center gap-2 w-full h-full cursor-pointer group/label">
                                            <input
                                                type="checkbox"
                                                checked={(page.properties[prop.id] as boolean) || false}
                                                onChange={(e) => updatePageProperty(databaseId, pageId, prop.id, e.target.checked)}
                                                className="w-4 h-4 cursor-pointer accent-blue-600 rounded"
                                            />
                                            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 select-none group-hover/label:text-neutral-900 dark:group-hover/label:text-neutral-200 transition-colors">
                                                {page.properties[prop.id] ? "Done" : "Pending"}
                                            </span>
                                        </label>
                                    ) : prop.type === 'select' ? (
                                        <select
                                            className="w-full h-full bg-transparent outline-none cursor-pointer text-neutral-700 dark:text-neutral-200 font-medium appearance-none"
                                            value={(page.properties[prop.id] as string) || ''}
                                            onChange={(e) => updatePageProperty(databaseId, pageId, prop.id, e.target.value)}
                                        >
                                            <option value="" className="text-neutral-400">Empty</option>
                                            {prop.config?.options?.map((opt: any) => (
                                                <option key={opt.id} value={opt.id}>{opt.name}</option>
                                            ))}
                                        </select>
                                    ) : prop.type === 'multi_select' ? (
                                        <input
                                            className="w-full h-full bg-transparent outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-700 font-medium"
                                            value={Array.isArray(page.properties[prop.id]) ? (page.properties[prop.id] as string[]).join(', ') : ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const arr = val ? val.split(',').map(s => s.trim()).filter(Boolean) : [];
                                                updatePageProperty(databaseId, pageId, prop.id, arr);
                                            }}
                                            placeholder="Comma separated..."
                                        />
                                    ) : prop.type === 'variants' ? (
                                        <VariantsPropertyEditor
                                            databaseId={databaseId}
                                            pageId={pageId}
                                            propertyId={prop.id}
                                            initialConfig={(page.properties[prop.id] as VariantsConfig) || []}
                                        />
                                    ) : (
                                        <input
                                            className="w-full h-full bg-transparent outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-700 font-medium"
                                            value={page.properties[prop.id] !== undefined ? String(page.properties[prop.id]) : ''}
                                            onChange={(e) => updatePageProperty(databaseId, pageId, prop.id, e.target.value)}
                                            placeholder={`Empty (${prop.type})`}
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Block Editor */}
                    <div className="mt-8 mb-12">
                        <h2 className="text-xl font-bold text-foreground mb-4">Content</h2>
                        <BlockEditor databaseId={databaseId} pageId={pageId} />
                    </div>

                    {/* Appended File Manager (Scoped Context) */}
                    <div className="mt-8 pb-12">
                        <h2 className="text-xl font-bold text-foreground mb-4">Attached Files</h2>
                        <div className="h-[500px] border border-border/50 rounded-xl overflow-hidden shadow-sm">
                            <FileManager
                                contextType="project"
                                contextId={pageId}
                                // Pass the actual Google Drive folder ID mapped to this specific database page record.
                                // If undefined, the FileManager falls back to the Global Root defined in env vars.
                                driveFolderId={page.driveFolderId}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
