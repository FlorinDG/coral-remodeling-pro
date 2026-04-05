"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Folder, FileText, FileImage, FileBarChart, File as FileIcon, UploadCloud, ChevronRight, Loader2, FileArchive, Download, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    webViewLink: string;
    webContentLink?: string;
    iconLink?: string;
    createdTime: string;
    size?: string;
}

interface Breadcrumb {
    id: string;
    name: string;
}

interface DriveFileExplorerProps {
    rootFolderId: string;
    rootFolderName?: string;
}

export default function DriveFileExplorer({ rootFolderId, rootFolderName = 'Drive Workspace' }: DriveFileExplorerProps) {
    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: rootFolderId, name: rootFolderName }]);
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentFolderId = breadcrumbs[breadcrumbs.length - 1].id;

    useEffect(() => {
        fetchFiles(currentFolderId);
    }, [currentFolderId]);

    const fetchFiles = async (folderId: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/drive/list?folderId=${folderId}`);
            const data = await res.json();

            if (data.success) {
                setFiles(data.files || []);
            } else {
                setError(data.error || 'Failed to load files');
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleNavigate = (folderId: string, folderName: string) => {
        setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName }]);
    };

    const handleBreadcrumbClick = (index: number) => {
        setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles || selectedFiles.length === 0) return;

        setIsUploading(true);
        try {
            for (let i = 0; i < selectedFiles.length; i++) {
                const formData = new FormData();
                formData.append('file', selectedFiles[i]);
                formData.append('parentId', currentFolderId);

                await fetch('/api/drive/upload', {
                    method: 'POST',
                    body: formData,
                });
            }
            // Refresh current view
            await fetchFiles(currentFolderId);
        } catch (err) {
            console.error('Upload error', err);
            alert('Fout bij uploaden van bestand(en).');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const getFileIcon = (mimeType: string) => {
        if (mimeType === 'application/vnd.google-apps.folder') return <Folder className="w-5 h-5 text-blue-500 fill-blue-500/20" />;
        if (mimeType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
        if (mimeType.includes('image')) return <FileImage className="w-5 h-5 text-emerald-500" />;
        if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return <FileBarChart className="w-5 h-5 text-green-600" />;
        if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return <FileArchive className="w-5 h-5 text-amber-600" />;
        return <FileIcon className="w-5 h-5 text-neutral-500" />;
    };

    const formatBytes = (bytes?: string) => {
        if (!bytes) return '--';
        const b = parseInt(bytes, 10);
        if (b === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(b) / Math.log(k));
        return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div className="flex flex-col w-full h-full bg-white dark:bg-[#0p0p0p] rounded-lg border border-neutral-200 dark:border-white/10 shadow-sm overflow-hidden font-sans">

            {/* Header & Breadcrumbs */}
            <div className="flex items-center justify-between p-3 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-white/[0.02]">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mask-fade-right">
                    {breadcrumbs.map((crumb, index) => (
                        <React.Fragment key={crumb.id}>
                            <button
                                onClick={() => handleBreadcrumbClick(index)}
                                className={`text-sm tracking-tight px-2 py-1 rounded-md transition-colors whitespace-nowrap ${index === breadcrumbs.length - 1 ? 'font-bold text-neutral-900 dark:text-white bg-neutral-200/50 dark:bg-white/10' : 'font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5'}`}
                            >
                                {crumb.name}
                            </button>
                            {index < breadcrumbs.length - 1 && (
                                <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                <div className="flex items-center gap-2 pl-4 shrink-0">
                    <input
                        type="file"
                        multiple
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        disabled={isUploading}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading || isLoading}
                        className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black rounded-md text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                        {isUploading ? 'Uploading...' : 'Upload File'}
                    </button>
                </div>
            </div>

            {/* File List Canvas */}
            <div className="flex-1 overflow-y-auto relative min-h-[300px]">
                {isLoading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-neutral-400">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                        <span className="text-xs font-semibold tracking-widest uppercase">Syncing with Drive</span>
                    </div>
                ) : error ? (
                    <div className="absolute inset-0 flex items-center justify-center text-red-500 text-sm font-medium">
                        {error}
                    </div>
                ) : files.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400 gap-3">
                        <Folder className="w-12 h-12 text-neutral-200 dark:text-neutral-800" strokeWidth={1} />
                        <span className="text-sm font-medium">This folder is empty.</span>
                    </div>
                ) : (
                    <div className="w-full">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-white/80 dark:bg-[#0p0p0p]/80 backdrop-blur-md z-10 border-b border-neutral-100 dark:border-white/5">
                                <tr>
                                    <th className="px-4 py-2.5 text-xs font-bold tracking-widest uppercase text-neutral-400 w-full">Name</th>
                                    <th className="px-4 py-2.5 text-xs font-bold tracking-widest uppercase text-neutral-400 whitespace-nowrap">Size</th>
                                    <th className="px-4 py-2.5 text-xs font-bold tracking-widest uppercase text-neutral-400 whitespace-nowrap hidden sm:table-cell">Created</th>
                                    <th className="px-4 py-2.5 text-right w-12"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50 dark:divide-white/[0.02]">
                                {files.map(file => {
                                    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                                    const date = new Date(file.createdTime).toLocaleDateString('nl-BE', { day: '2-digit', month: 'short', year: 'numeric' });

                                    return (
                                        <tr
                                            key={file.id}
                                            className={`group hover:bg-neutral-50/80 dark:hover:bg-white/[0.02] transition-colors ${isFolder ? 'cursor-pointer' : ''}`}
                                            onClick={() => isFolder ? handleNavigate(file.id, file.name) : null}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    {file.iconLink && !isFolder ? (
                                                        <img src={file.iconLink} alt="" className="w-5 h-5 object-contain" />
                                                    ) : (
                                                        getFileIcon(file.mimeType)
                                                    )}
                                                    <span className={`text-sm truncate max-w-[200px] sm:max-w-md ${isFolder ? 'font-bold text-neutral-900 dark:text-white' : 'font-medium text-neutral-700 dark:text-neutral-300'}`}>
                                                        {file.name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-medium text-neutral-500 whitespace-nowrap">
                                                {isFolder ? '--' : formatBytes(file.size)}
                                            </td>
                                            <td className="px-4 py-3 text-xs font-medium text-neutral-500 whitespace-nowrap hidden sm:table-cell">
                                                {date}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {!isFolder && (
                                                    <a
                                                        href={file.webViewLink}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="inline-flex p-1.5 text-neutral-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                        title="Open in Drive"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </a>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
