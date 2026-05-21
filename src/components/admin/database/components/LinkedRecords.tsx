"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Loader2, Plus, Link2, Search, X, Check } from 'lucide-react';
import { useDatabaseStore } from '@/components/admin/database/store';
import { Database, Page, Property, PropertyValue } from '@/components/admin/database/types';
import { useTenant } from '@/context/TenantContext';
import { useRouter, useParams } from 'next/navigation';

interface LinkedRecordsProps {
    databaseId: string;
    pageId: string;
    isModal?: boolean;
}

export default function LinkedRecords({ databaseId, pageId, isModal = false }: LinkedRecordsProps) {
    const [isCreating, setIsCreating] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedPropId, setSelectedPropId] = useState<string | null>(null);
    const [universalMode, setUniversalMode] = useState(false);
    const [selectedUniversalDbId, setSelectedUniversalDbId] = useState<string | null>(null);
    
    const dropdownRef = useRef<HTMLDivElement>(null);

    const { resolveDbId } = useTenant();
    const router = useRouter();
    const params = useParams();
    const locale = (params.locale as string) || 'nl';

    const allDatabases = useDatabaseStore((state) => state.databases);
    const updatePageProperty = useDatabaseStore((state) => state.updatePageProperty);
    const createPage = useDatabaseStore((state) => state.createPage);
    const addProperty = useDatabaseStore((state) => state.addProperty);

    const database = allDatabases.find((d: Database) => d.id === databaseId);
    const page = database?.pages.find((p: Page) => p.id === pageId);

    const relationProps = database ? database.properties.filter((p: Property) => p.type === 'relation') : [];

    // Set default selected property if not set
    useEffect(() => {
        if (relationProps.length > 0 && !selectedPropId) {
            setSelectedPropId(relationProps[0].id);
        }
    }, [relationProps, selectedPropId]);

    // Handle clicking outside the dropdown popover
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    if (!database || !page) return null;

    const selectedProp = relationProps.find(p => p.id === selectedPropId);

    const handleCreateAndLink = async (prop: Property) => {
        const targetDbId = prop.config?.relationDatabaseId;
        if (!targetDbId) return;

        setIsCreating(prop.id);
        const resolvedTargetDbId = resolveDbId(targetDbId);
        const targetDb = allDatabases.find(d => d.id === resolvedTargetDbId);
        
        const clientName = String(page.properties['title'] || page.properties['name'] || 'Item');
        
        // Prepare initial properties for the new page
        const initialProps: Record<string, PropertyValue> = {
            title: `New ${targetDb?.name || 'Item'} for ${clientName}`,
        };

        // If the target DB has a relation back to this DB, try to auto-link it
        const targetRelationToCurrent = targetDb?.properties.find(p => 
            p.type === 'relation' && p.config?.relationDatabaseId === databaseId
        );
        if (targetRelationToCurrent) {
            initialProps[targetRelationToCurrent.id] = [pageId];
        }

        // Create the page in the store
        const newPage = createPage(resolvedTargetDbId, initialProps);

        // Link it to the current page
        const currentRelations = (page.properties[prop.id] as string[]) || [];
        updatePageProperty(databaseId, pageId, prop.id, [...currentRelations, newPage.id]);

        // Navigate to the new page
        router.push(`/${locale}/admin/database/${resolvedTargetDbId}/${newPage.id}`);
        setIsCreating(null);
        setIsOpen(false);
    };

    const handleLinkExisting = (prop: Property, targetPageId: string) => {
        const targetDbId = prop.config?.relationDatabaseId;
        if (!targetDbId) return;

        const resolvedTargetDbId = resolveDbId(targetDbId);
        const targetDb = allDatabases.find(d => d.id === resolvedTargetDbId);

        // 1. Update current page's relation to include the targetPageId
        const currentRelations = (page.properties[prop.id] as string[]) || [];
        if (!currentRelations.includes(targetPageId)) {
            updatePageProperty(databaseId, pageId, prop.id, [...currentRelations, targetPageId]);
        }

        // 2. Establish backlink if target database has a relation field back to this database
        const targetRelationToCurrent = targetDb?.properties.find(p => 
            p.type === 'relation' && p.config?.relationDatabaseId === databaseId
        );
        if (targetRelationToCurrent) {
            const targetPage = targetDb?.pages.find(p => p.id === targetPageId);
            if (targetPage) {
                const targetRelations = (targetPage.properties[targetRelationToCurrent.id] as string[]) || [];
                if (!targetRelations.includes(pageId)) {
                    updatePageProperty(resolvedTargetDbId, targetPageId, targetRelationToCurrent.id, [...targetRelations, pageId]);
                }
            }
        }

        setIsOpen(false);
    };

    const handleUnlink = (prop: Property, targetPageId: string) => {
        const targetDbId = prop.config?.relationDatabaseId;
        if (!targetDbId) return;

        const resolvedTargetDbId = resolveDbId(targetDbId);
        const targetDb = allDatabases.find(d => d.id === resolvedTargetDbId);

        // 1. Remove targetPageId from current page's relations
        const currentRelations = (page.properties[prop.id] as string[]) || [];
        updatePageProperty(databaseId, pageId, prop.id, currentRelations.filter(id => id !== targetPageId));

        // 2. Remove pageId from the target page's relations (backlink)
        const targetRelationToCurrent = targetDb?.properties.find(p => 
            p.type === 'relation' && p.config?.relationDatabaseId === databaseId
        );
        if (targetRelationToCurrent) {
            const targetPage = targetDb?.pages.find(p => p.id === targetPageId);
            if (targetPage) {
                const targetRelations = (targetPage.properties[targetRelationToCurrent.id] as string[]) || [];
                updatePageProperty(resolvedTargetDbId, targetPageId, targetRelationToCurrent.id, targetRelations.filter(id => id !== pageId));
            }
        }
    };

    // Gather existing pages for the search dropdown of the selected target database
    const getTargetDbOptions = () => {
        if (!selectedProp) return [];
        const targetDbId = selectedProp.config?.relationDatabaseId;
        if (!targetDbId) return [];

        const resolvedTargetDbId = resolveDbId(targetDbId);
        const targetDb = allDatabases.find(d => d.id === resolvedTargetDbId);
        if (!targetDb) return [];

        const currentRelations = (page.properties[selectedProp.id] as string[]) || [];

        return targetDb.pages
            .filter(p => !currentRelations.includes(p.id)) // exclude already connected ones
            .filter(p => {
                if (!search.trim()) return true;
                const title = String(p.properties['title'] || p.properties['name'] || 'Untitled').toLowerCase();
                return title.includes(search.toLowerCase());
            });
    };

    const targetOptions = getTargetDbOptions();

    // ── Bidirectional backlink discovery ──────────────────────────────────
    // Scan ALL databases for pages that reference this pageId through ANY relation property
    const backlinks: { db: Database; page: Page; propName: string }[] = [];
    for (const otherDb of allDatabases) {
        if (otherDb.id === databaseId) continue; // skip self (handled via forward relations)
        const otherRelProps = otherDb.properties.filter(p => p.type === 'relation');
        for (const relProp of otherRelProps) {
            for (const otherPage of otherDb.pages) {
                const val = otherPage.properties[relProp.id];
                const ids = Array.isArray(val) ? val : (typeof val === 'string' && val ? [val] : []);
                if (ids.includes(pageId)) {
                    // Avoid duplicates (a page might reference us through multiple props)
                    if (!backlinks.some(bl => bl.page.id === otherPage.id && bl.db.id === otherDb.id)) {
                        backlinks.push({ db: otherDb, page: otherPage, propName: relProp.name });
                    }
                }
            }
        }
    }

    // ── Universal connector: link from ANY database ──────────────────────
    const universalDbs = allDatabases.filter(d => d.id !== databaseId);
    const selectedUniversalDb = universalDbs.find(d => d.id === selectedUniversalDbId);

    const universalOptions = selectedUniversalDb
        ? selectedUniversalDb.pages.filter(p => {
            if (!search.trim()) return true;
            const title = String(p.properties['title'] || p.properties['name'] || 'Untitled').toLowerCase();
            return title.includes(search.toLowerCase());
        })
        : [];

    const handleUniversalLink = (targetPageId: string) => {
        if (!selectedUniversalDb) return;
        // Check if there's already a relation property from current DB → target DB
        let relProp = relationProps.find(p => {
            const targetDbId = p.config?.relationDatabaseId;
            return targetDbId && (resolveDbId(targetDbId) === selectedUniversalDb.id || targetDbId === selectedUniversalDb.id);
        });

        // Auto-create a relation property if none exists
        if (!relProp) {
            addProperty(databaseId, `Related ${selectedUniversalDb.name}`, 'relation', { relationDatabaseId: selectedUniversalDb.id });
            // Re-fetch the database to get the newly created property
            const freshDb = useDatabaseStore.getState().databases.find(d => d.id === databaseId);
            relProp = freshDb?.properties.find(p => p.type === 'relation' && p.config?.relationDatabaseId === selectedUniversalDb.id) || undefined;
            if (!relProp) return;
        }

        // Link using the existing handler logic
        const currentRelations = (page!.properties[relProp.id] as string[]) || [];
        if (!currentRelations.includes(targetPageId)) {
            updatePageProperty(databaseId, pageId, relProp.id, [...currentRelations, targetPageId]);
        }

        // Backlink from target
        const targetRelationToCurrent = selectedUniversalDb.properties.find(p =>
            p.type === 'relation' && p.config?.relationDatabaseId === databaseId
        );
        if (targetRelationToCurrent) {
            const targetPage = selectedUniversalDb.pages.find(p => p.id === targetPageId);
            if (targetPage) {
                const targetRelations = (targetPage.properties[targetRelationToCurrent.id] as string[]) || [];
                if (!targetRelations.includes(pageId)) {
                    updatePageProperty(selectedUniversalDb.id, targetPageId, targetRelationToCurrent.id, [...targetRelations, pageId]);
                }
            }
        }

        setIsOpen(false);
        setUniversalMode(false);
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Cardinal Button - absolutely placed inside the card header */}
            {relationProps.length > 0 && (
                <div
                    className={`absolute z-20 ${
                        isModal 
                            ? 'top-8 right-6' 
                            : 'top-2.5 right-4'
                    }`}
                    ref={dropdownRef}
                >
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 shadow-sm"
                    >
                        <Plus className="w-3 h-3" />
                        Connect New
                    </button>

                    {/* Popover Dropdown */}
                    {isOpen && (
                        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl shadow-xl z-50 p-3 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-100 max-h-[400px] overflow-hidden">
                            {/* Mode Tabs: Relation / Any Database */}
                            <div className="flex gap-1 bg-neutral-100 dark:bg-white/5 p-0.5 rounded-xl">
                                <button
                                    onClick={() => { setUniversalMode(false); setSearch(''); }}
                                    className={`flex-1 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${!universalMode ? 'bg-white dark:bg-neutral-800 text-orange-500 shadow-sm' : 'text-neutral-500'}`}
                                >
                                    Relations
                                </button>
                                <button
                                    onClick={() => { setUniversalMode(true); setSearch(''); setSelectedUniversalDbId(universalDbs[0]?.id || null); }}
                                    className={`flex-1 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${universalMode ? 'bg-white dark:bg-neutral-800 text-orange-500 shadow-sm' : 'text-neutral-500'}`}
                                >
                                    Any Database
                                </button>
                            </div>

                            {!universalMode ? (
                                /* ── Relation-based connector ── */
                                <>
                                    {/* Header / Relation Switcher (if multiple relation fields exist) */}
                                    {relationProps.length > 1 ? (
                                        <div className="flex flex-col gap-1 border-b border-neutral-100 dark:border-white/5 pb-2">
                                            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Relation Property</span>
                                            <div className="flex flex-wrap gap-1">
                                                {relationProps.map(p => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => { setSelectedPropId(p.id); setSearch(''); }}
                                                        className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
                                                            selectedPropId === p.id
                                                                ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                                                                : 'bg-neutral-50 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/10'
                                                        }`}
                                                    >
                                                        {p.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : relationProps.length === 1 ? (
                                        <div className="text-[10px] font-extrabold text-neutral-700 dark:text-neutral-300 uppercase tracking-widest border-b border-neutral-100 dark:border-white/5 pb-1.5">
                                            Link {selectedProp?.name || 'Record'}
                                        </div>
                                    ) : null}

                                    {/* Create New Action */}
                                    {selectedProp && (
                                        <button
                                            disabled={!!isCreating}
                                            onClick={() => handleCreateAndLink(selectedProp)}
                                            className="w-full flex items-center justify-center gap-1.5 py-2 bg-neutral-50 hover:bg-neutral-100 dark:bg-white/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-white/10 rounded-xl text-xs font-bold transition-all active:scale-98 disabled:opacity-50"
                                        >
                                            {isCreating === selectedProp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" /> : <Plus className="w-3.5 h-3.5 text-orange-500" />}
                                            Create New {selectedProp.name}
                                        </button>
                                    )}

                                    {/* Search & Link Existing Record */}
                                    {selectedProp && (
                                        <div className="flex flex-col gap-1.5">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-neutral-400" />
                                                <input
                                                    type="text"
                                                    placeholder={`Search existing...`}
                                                    value={search}
                                                    onChange={e => setSearch(e.target.value)}
                                                    className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 outline-none text-xs pl-9 pr-3 py-2 rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400"
                                                />
                                            </div>

                                            {/* Existing Records List */}
                                            <div className="max-h-40 overflow-y-auto flex flex-col gap-1 no-scrollbar pr-0.5">
                                                {targetOptions.length > 0 ? (
                                                    targetOptions.map(opt => (
                                                        <button
                                                            key={opt.id}
                                                            onClick={() => handleLinkExisting(selectedProp, opt.id)}
                                                            className="w-full flex items-center justify-between p-2 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-xl transition-all text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 group"
                                                        >
                                                            <span className="truncate pr-2">{String(opt.properties['title'] || opt.properties['name'] || 'Untitled')}</span>
                                                            <span className="text-[9px] font-bold uppercase tracking-wider text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity">Link</span>
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="py-4 text-center text-[10px] italic text-neutral-400">
                                                        No unlinked records found
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {relationProps.length === 0 && (
                                        <p className="text-xs text-neutral-400 italic text-center py-4">
                                            No relation properties. Use &quot;Any Database&quot; tab.
                                        </p>
                                    )}
                                </>
                            ) : (
                                /* ── Universal Database connector ── */
                                <>
                                    <div className="flex flex-col gap-1 border-b border-neutral-100 dark:border-white/5 pb-2">
                                        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Target Database</span>
                                        <select
                                            value={selectedUniversalDbId || ''}
                                            onChange={e => { setSelectedUniversalDbId(e.target.value); setSearch(''); }}
                                            className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-xs font-bold rounded-xl px-3 py-2 outline-none text-neutral-800 dark:text-neutral-200"
                                        >
                                            {universalDbs.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-neutral-400" />
                                        <input
                                            type="text"
                                            placeholder="Search pages..."
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                            className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 outline-none text-xs pl-9 pr-3 py-2 rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400"
                                        />
                                    </div>

                                    <div className="max-h-40 overflow-y-auto flex flex-col gap-1 no-scrollbar pr-0.5">
                                        {universalOptions.length > 0 ? (
                                            universalOptions.map(opt => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => handleUniversalLink(opt.id)}
                                                    className="w-full flex items-center justify-between p-2 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-xl transition-all text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 group"
                                                >
                                                    <span className="truncate pr-2">{String(opt.properties['title'] || opt.properties['name'] || 'Untitled')}</span>
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity">Link</span>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="py-4 text-center text-[10px] italic text-neutral-400">
                                                {selectedUniversalDb ? 'No pages found' : 'Select a database'}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {relationProps.length === 0 && !universalMode && backlinks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-neutral-400 border-2 border-dashed border-neutral-100 dark:border-white/5 rounded-2xl">
                    <ExternalLink className="w-8 h-8 opacity-20 mb-3" />
                    <p className="text-xs italic">No relationship fields defined for this database.</p>
                    <p className="text-[10px] mt-1 text-neutral-300 dark:text-neutral-600">Use &quot;Connect New → Any Database&quot; to create connections.</p>
                </div>
            )}

            {/* Compact Cardless List Layout */}
            <div className="flex flex-col gap-4">
                {relationProps.map(prop => {
                    const rawVal = page.properties[prop.id];
                    const ids: string[] = Array.isArray(rawVal)
                        ? rawVal
                        : (typeof rawVal === 'string' && rawVal ? [rawVal] : []);
                    const targetDbId = prop.config?.relationDatabaseId;
                    const resolvedTargetDbId = targetDbId ? resolveDbId(targetDbId) : null;
                    const targetDb = allDatabases.find(d => d.id === resolvedTargetDbId);
                    
                    const linkedPages = ids.map(id => {
                        const p = targetDb?.pages.find((pg: Page) => pg.id === id);
                        if (!p) {
                            // Fallback search across all DBs
                            for (const d of allDatabases) {
                                const found = d.pages.find((pg: Page) => pg.id === id);
                                if (found) return { db: d, page: found };
                            }
                            return null;
                        }
                        return { db: targetDb as Database, page: p };
                    }).filter(Boolean) as { db: Database, page: Page }[];

                    return (
                        <div key={prop.id} className="flex flex-col">
                            {/* Section Label */}
                            <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mb-1.5 flex items-center gap-1.5">
                                <Link2 className="w-3.5 h-3.5 opacity-60 text-orange-500" />
                                {prop.name}
                            </h3>

                            {/* Clean List */}
                            <div className="space-y-1">
                                {linkedPages.length > 0 ? (
                                    linkedPages.map((lp) => (
                                        <div
                                            key={lp.page.id}
                                            className="w-full flex items-center justify-between p-2 hover:bg-neutral-50 dark:hover:bg-white/[0.02] border border-neutral-100 dark:border-white/5 hover:border-neutral-200 dark:hover:border-white/10 rounded-xl transition-all group"
                                        >
                                            <button
                                                onClick={() => router.push(`/${locale}/admin/database/${lp.db.id}/${lp.page.id}`)}
                                                className="flex-1 flex items-center gap-2 min-w-0 text-left"
                                            >
                                                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-orange-500 transition-colors truncate">
                                                    {String(lp.page.properties['title'] || lp.page.properties['name'] || 'Untitled')}
                                                </span>
                                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-neutral-100 dark:bg-white/5 text-neutral-500 rounded uppercase tracking-wider shrink-0">
                                                    {lp.db.name}
                                                </span>
                                            </button>
                                            
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => router.push(`/${locale}/admin/database/${lp.db.id}/${lp.page.id}`)}
                                                    className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                                                    title="View Detail"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleUnlink(prop, lp.page.id)}
                                                    className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                                                    title="Unlink"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-xs italic text-neutral-400 dark:text-neutral-500 pl-5">
                                        —
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Backlinks (incoming references from other databases) ── */}
            {backlinks.length > 0 && (
                <div className="flex flex-col mt-2">
                    <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mb-1.5 flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5 opacity-60 text-orange-500" />
                        Backlinks
                        <span className="text-[9px] bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded-full font-bold">{backlinks.length}</span>
                    </h3>
                    <div className="space-y-1">
                        {backlinks.map((bl) => (
                            <div
                                key={`${bl.db.id}-${bl.page.id}`}
                                className="w-full flex items-center justify-between p-2 hover:bg-orange-50/50 dark:hover:bg-orange-950/10 border border-neutral-100 dark:border-white/5 hover:border-orange-200 dark:hover:border-orange-800/30 rounded-xl transition-all group"
                            >
                                <button
                                    onClick={() => router.push(`/${locale}/admin/database/${bl.db.id}/${bl.page.id}`)}
                                    className="flex-1 flex items-center gap-2 min-w-0 text-left"
                                >
                                    <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-orange-500 transition-colors truncate">
                                        {String(bl.page.properties['title'] || bl.page.properties['name'] || 'Untitled')}
                                    </span>
                                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-orange-50 dark:bg-orange-950/20 text-orange-500 rounded uppercase tracking-wider shrink-0">
                                        {bl.db.name}
                                    </span>
                                </button>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => router.push(`/${locale}/admin/database/${bl.db.id}/${bl.page.id}`)}
                                        className="p-1 text-neutral-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20 rounded-lg transition-colors"
                                        title="View"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
