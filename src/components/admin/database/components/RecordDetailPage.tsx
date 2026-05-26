"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useDatabaseStore } from '@/components/admin/database/store';
import { useFileManagerStore } from '@/components/admin/file-manager/store';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { useTenant } from '@/context/TenantContext';
import DbPropertiesPanel from '@/components/admin/database/components/DbPropertiesPanel';
import {
    ArrowLeft, FileText, BarChart2,
    ChevronRight, ExternalLink
} from 'lucide-react';

import { Link } from '@/i18n/routing';
import { Lock } from 'lucide-react';
import { getBaseDbId } from '@/lib/systemDatabases';

const JournalCard       = dynamic(() => import('@/components/admin/database/components/JournalCard'),       { ssr: false });
const FileManager       = dynamic(() => import('@/components/admin/file-manager/FileManager'),              { ssr: false });
const PageFinancialAnalysis = dynamic(() => import('@/components/admin/database/components/PageFinancialAnalysis'), { ssr: false });
const LinkedRecords     = dynamic(() => import('@/components/admin/database/components/LinkedRecords'),     { ssr: false });
const ProjectDetailView = dynamic(() => import('@/components/admin/database/components/ProjectDetailView'), { ssr: false });



interface RecordDetailPageProps {
    databaseId: string;
    pageId: string;
    locale: string;
}

export default function RecordDetailPage({ databaseId, pageId, locale }: RecordDetailPageProps) {
    const router = useRouter();
    const { resolveDbId, planType } = useTenant();

    // Resolve tenant-scoped DB ID (handles bare 'db-x' and 'db-x-tenantSuffix')
    const resolvedDbId = resolveDbId(databaseId);

    const database = useDatabaseStore(state =>
        state.databases.find(db => db.id === resolvedDbId)
    );
    const page = useDatabaseStore(state =>
        state.databases.find(db => db.id === resolvedDbId)?.pages.find(p => p.id === pageId)
    );
    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);
    const updatePageDriveId = useDatabaseStore(state => state.updatePageDriveId);
    const initializeContextFolder = useFileManagerStore(state => state.initializeContextFolder);

    // Map database to contextType
    const baseDbId = getBaseDbId(databaseId);
    let fileContextType: 'project' | 'task' | 'client' | 'global' | 'invoice' | 'quotation' | 'contract' = 'project';
    if (baseDbId === 'db-crm') {
        fileContextType = 'client';
    } else if (baseDbId === 'db-tasks') {
        fileContextType = 'task';
    } else if (baseDbId === 'db-quotations') {
        fileContextType = 'quotation';
    } else if (baseDbId === 'db-invoices') {
        fileContextType = 'invoice';
    }

    const boundDriveId = page?.driveFolderId || (page?.properties['driveFolderId'] as string) || undefined;

    React.useEffect(() => {
        if (!page) return;
        const createDriveFolder = async () => {
            if (!boundDriveId && page.properties?.['title']) {
                const folderName = String(page.properties?.['title'] || page.properties?.['name'] || `Record ${pageId}`);
                const driveId = await initializeContextFolder(folderName, fileContextType, page.id);
                if (driveId) {
                    updatePageDriveId(resolvedDbId, page.id, driveId);
                }
            }
        };
        createDriveFolder();
    }, [page?.id, boundDriveId, resolvedDbId, fileContextType, initializeContextFolder, updatePageDriveId]);

    // ── FREE tier gate — record detail view is PRO+ only ──
    if (planType === 'FREE') {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl border flex items-center justify-center mb-6" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-color, #d35400) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--brand-color, #d35400) 25%, transparent)' }}>
                    <Lock className="w-8 h-8" style={{ color: 'var(--brand-color, #d35400)' }} />
                </div>
                <h2 className="text-2xl font-black tracking-tight mb-3">Record Detail View</h2>
                <p className="text-neutral-500 dark:text-neutral-400 max-w-md mb-8 leading-relaxed text-sm">
                    The full record view with properties, content editor, file management, and analysis is available on PRO and higher plans.
                </p>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="px-5 py-2.5 rounded-lg border border-neutral-200 dark:border-white/10 text-sm font-semibold hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                    >
                        Go Back
                    </button>
                    <Link
                        href="/admin/settings"
                        className="px-5 py-2.5 rounded-lg text-white text-sm font-bold hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                    >
                        Upgrade Plan
                    </Link>
                </div>
            </div>
        );
    }

    if (!database || !page) {
        return (
            <div className="flex h-full items-center justify-center flex-col gap-4 text-neutral-500 dark:text-neutral-400">
                <FileText className="w-10 h-10 opacity-30" />
                <p className="text-sm font-medium">Record not found</p>
                <button
                    onClick={() => router.back()}
                    className="text-xs text-orange-500 hover:underline"
                >
                    Go back
                </button>
            </div>
        );
    }

    const title = String(page.properties?.['title'] || page.properties?.['name'] || '');
    const isProjectDb = baseDbId === 'db-1';

    let displayName = database.name;
    if (baseDbId === 'db-bobex') {
        displayName = 'Bobex Pipeline';
    } else if (baseDbId === 'db-crm') {
        displayName = 'Main Pipeline';
    }

    return (
        <div className="flex flex-col w-full h-full bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white overflow-hidden">

            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-200 dark:border-white/10 flex-shrink-0 bg-white dark:bg-neutral-950">
                {/* Back */}
                <button
                    onClick={() => router.back()}
                    className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors text-neutral-500"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>

                {/* Breadcrumb */}
                <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 min-w-0">
                    <span className="font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500 text-[10px]">
                        {displayName}
                    </span>
                    <ChevronRight className="w-3 h-3 flex-shrink-0" />
                    <input
                        type="text"
                        value={title}
                        onChange={e => updatePageProperty(resolvedDbId, pageId, 'title', e.target.value)}
                        placeholder="Untitled"
                        className="font-semibold text-sm text-neutral-900 dark:text-white bg-transparent outline-none focus:ring-0 border-b border-transparent focus:border-neutral-300 dark:focus:border-white/20 truncate max-w-sm transition-colors"
                    />
                </div>

                <div className="flex-1" />

                {/* External link hint */}
                <span className="flex items-center gap-1 text-[10px] text-neutral-400 select-none">
                    <ExternalLink className="w-3 h-3" /> Full record
                </span>
            </div>

            {/* ── Content area (Two-column) ─────────────────────────────────── */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                
                {/* Left: Sidebar (Persistent) */}
                <div className="w-full lg:w-[400px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-neutral-200 dark:border-white/10 h-[40vh] lg:h-full overflow-hidden bg-white dark:bg-neutral-950">
                    <ErrorBoundary componentName="DbPropertiesPanel">
                        <DbPropertiesPanel
                            databaseId={resolvedDbId}
                            pageId={pageId}
                            title="All Properties"
                        />
                    </ErrorBoundary>
                </div>

                {/* Right: Dashboard Content */}
                {isProjectDb ? (
                    <ProjectDetailView databaseId={resolvedDbId} pageId={pageId} locale={locale} />
                ) : (
                <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-neutral-50 dark:bg-[#0a0a0a]">
                    <div className="flex flex-col gap-4 max-w-[1600px] mx-auto">
                        
                        {/* Row 1: Stats + Context (side by side on wide, stacked on narrow) */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {/* Stats */}
                            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-sm min-h-[280px]">
                                <div className="px-5 py-3 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/80 dark:bg-white/5 flex items-center gap-2 font-bold text-[11px] uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
                                    <BarChart2 className="w-4 h-4 text-orange-500" /> Stats
                                </div>
                                <div className="flex-1 overflow-y-auto p-5">
                                    <ErrorBoundary componentName="PageFinancialAnalysis">
                                        <PageFinancialAnalysis databaseId={resolvedDbId} pageId={pageId} />
                                    </ErrorBoundary>
                                </div>
                            </div>

                            {/* Context Card — Connected Properties */}
                            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-sm min-h-[280px] relative">
                                <div className="px-5 py-3 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/80 dark:bg-white/5 flex items-center gap-2 font-bold text-[11px] uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
                                    <ExternalLink className="w-4 h-4 text-orange-500" /> Connected Properties
                                </div>
                                <div className="flex-1 overflow-y-auto p-5">
                                    <ErrorBoundary componentName="LinkedRecords">
                                        <LinkedRecords databaseId={databaseId} pageId={pageId} />
                                    </ErrorBoundary>
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Journal + Files (side by side on wide, stacked on narrow) */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {/* Journal */}
                            <JournalCard databaseId={resolvedDbId} pageId={pageId} />

                            {/* Files */}
                            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-sm min-h-[360px]">
                                <div className="px-5 py-3 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/80 dark:bg-white/5 flex items-center gap-2 font-bold text-[11px] uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
                                    <FileText className="w-4 h-4 text-orange-500" /> Files
                                </div>
                                <div className="flex-1 overflow-hidden relative">
                                    <ErrorBoundary componentName="FileManager">
                                        <FileManager contextType={fileContextType} contextId={pageId} driveFolderId={boundDriveId} />
                                    </ErrorBoundary>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
                )}
            </div>
        </div>
    );
}
