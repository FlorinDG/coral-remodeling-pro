import React from 'react';
import FileManager from '@/components/admin/file-manager/FileManager';
import { useTranslations } from 'next-intl';

export default function LibraryPage() {
    const t = useTranslations('admin'); // Fallback translation if needed, though we'll hardcode some English for the prototype

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
            <div className="flex items-center justify-between px-8 py-4 border-b border-border bg-card">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Global Library</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage all your centralized assets, marketing materials, and project files.
                    </p>
                </div>
            </div>

            {/* 
        We pass NO context props here. 
        This tells the FileManager to mount in "Global / Standalone" mode,
        giving us the full sidebar directory tree and search capabilities.
      */}
            <div className="flex-1 w-full h-full overflow-hidden relative">
                <FileManager />
            </div>
        </div>
    );
}
