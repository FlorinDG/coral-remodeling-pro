"use client";

import React, { useState } from 'react';
import { useDatabaseStore } from '../store';
import { X, Maximize2 } from 'lucide-react';
import BlockEditor from './BlockEditor';
import FileManager from '@/components/admin/file-manager/FileManager';
import { useFileManagerStore } from '@/components/admin/file-manager/store';

interface PageModalProps {
    databaseId: string;
    pageId: string;
    onClose: () => void;
}

export default function PageModal({ databaseId, pageId, onClose }: PageModalProps) {
    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);
    const database = useDatabaseStore(state => state.databases.find(db => db.id === databaseId));
    const page = database?.pages.find(p => p.id === pageId);

    // We get the specific action initialized previously
    const initializeContextFolder = useFileManagerStore(state => state.initializeContextFolder);

    // Auto-create a Google Drive folder if this page doesn't have one yet
    React.useEffect(() => {
        const createDriveFolder = async () => {
            if (page && !page.driveFolderId && page.properties['title']) {
                const folderName = String(page.properties['title']);

                // We use 'project' arbitrarily here, but ideally we'd pass a more specific contextType if needed
                const driveId = await initializeContextFolder(folderName, 'project', page.id);

                if (driveId) {
                    // Save the new folder ID back into the Database Page record
                    updatePageProperty(databaseId, page.id, 'driveFolderId', driveId);
                }
            }
        };

        createDriveFolder();
    }, [page?.id, page?.driveFolderId, page?.properties, databaseId, initializeContextFolder, updatePageProperty]);

    if (!database || !page) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-[800px] h-full bg-white dark:bg-[#191919] shadow-2xl flex flex-col overflow-y-auto animate-in slide-in-from-right duration-300">
                {/* Header Actions */}
                <div className="sticky top-0 z-10 flex items-center justify-between p-3 bg-white/80 dark:bg-[#191919]/80 backdrop-blur-md">
                    <div className="flex items-center gap-1">
                        <button className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors">
                            <Maximize2 className="w-4 h-4" />
                        </button>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Page Content */}
                <div className="flex-1 p-12 max-w-[700px] mx-auto w-full">
                    {/* Title */}
                    <input
                        className="w-full text-4xl font-bold mb-8 text-neutral-900 dark:text-white outline-none bg-transparent placeholder:text-neutral-300 dark:placeholder:text-neutral-700"
                        value={(page.properties['title'] as string) || ''}
                        onChange={(e) => updatePageProperty(databaseId, pageId, 'title', e.target.value)}
                        placeholder="Untitled"
                    />

                    {/* Properties List */}
                    <div className="flex flex-col gap-2 py-4 border-b border-neutral-100 dark:border-white/5 mb-8">
                        {database.properties.filter(p => p.id !== 'title').map(prop => (
                            <div key={prop.id} className="grid grid-cols-[160px_1fr] items-center text-sm hover:bg-neutral-50 dark:hover:bg-white/5 py-1 px-2 rounded -mx-2">
                                <span className="text-neutral-500 font-medium">{prop.name}</span>
                                <div className="text-neutral-900 dark:text-neutral-200">
                                    {prop.type === 'text' ? (
                                        <input
                                            className="w-full bg-transparent outline-none"
                                            value={(page.properties[prop.id] as string) || ''}
                                            onChange={(e) => updatePageProperty(databaseId, pageId, prop.id, e.target.value)}
                                            placeholder="Empty"
                                        />
                                    ) : prop.type === 'date' ? (
                                        <input
                                            type="date"
                                            className="w-auto bg-transparent outline-none"
                                            value={(page.properties[prop.id] as string) || ''}
                                            onChange={(e) => updatePageProperty(databaseId, pageId, prop.id, e.target.value)}
                                        />
                                    ) : prop.type === 'checkbox' ? (
                                        <input
                                            type="checkbox"
                                            checked={(page.properties[prop.id] as boolean) || false}
                                            onChange={(e) => updatePageProperty(databaseId, pageId, prop.id, e.target.checked)}
                                        />
                                    ) : (
                                        <span className="text-neutral-400 italic">Editing for {prop.type} coming soon</span>
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
