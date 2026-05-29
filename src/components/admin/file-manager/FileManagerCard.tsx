"use client";

import React from 'react';
import { FileText } from 'lucide-react';
import dynamic from 'next/dynamic';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { FileContextType } from './types';

const FileManager = dynamic(() => import('./FileManager'), { ssr: false });

interface FileManagerCardProps {
    contextType: FileContextType;
    contextId?: string;
    driveFolderId?: string;
    minHeight?: string;
}

export default function FileManagerCard({
    contextType,
    contextId,
    driveFolderId,
    minHeight = '360px'
}: FileManagerCardProps) {
    return (
        <div 
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-sm"
            style={{ minHeight }}
        >
            <div className="px-5 py-3 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/80 dark:bg-white/5 flex items-center gap-2 font-bold text-[11px] uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
                <FileText className="w-4 h-4 text-orange-500" /> Files
            </div>
            <div className="flex-1 overflow-hidden relative">
                <ErrorBoundary componentName="FileManager">
                    <FileManager 
                        contextType={contextType} 
                        contextId={contextId} 
                        driveFolderId={driveFolderId} 
                    />
                </ErrorBoundary>
            </div>
        </div>
    );
}
