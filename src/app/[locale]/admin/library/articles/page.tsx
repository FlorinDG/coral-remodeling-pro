"use client";

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { libraryTabs } from "@/config/tabs";
import { useDatabaseStore } from '@/components/admin/database/store';
import { mockDatabases } from '@/components/admin/database/mockData';
import { AlertCircle, ArrowRight, Check, Database } from 'lucide-react';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Library...</div> }
);

export default function ArticlesPage() {
    const [isMigrating, setIsMigrating] = useState(false);
    const [migrated, setMigrated] = useState(false);

    const handleRunMigration = () => {
        setIsMigrating(true);
        try {
            const store = useDatabaseStore.getState();
            const db = store.getDatabase('db-articles');
            if (!db) throw new Error("Database not found");

            const newProperties = mockDatabases.find(d => d.id === 'db-articles')?.properties;
            if (!newProperties) throw new Error("Mock schema not found");

            const counters: Record<string, number> = {};

            const newPages = db.pages.map(page => {
                const oldP = { ...page.properties };
                const mappedP: Record<string, any> = { ...oldP }; // Rescue all user properties

                // Find old IDs dynamically by matching names
                const findPropId = (search: string) => db.properties.find(p => p.name.toLowerCase().includes(search.toLowerCase()))?.id;
                const oldNaamId = findPropId('naam') || 'title';
                const oldDescId = findPropId('omschrijving') || findPropId('desc');
                const oldBrutoId = findPropId('bruto');
                const oldRemiseId = findPropId('korting') || findPropId('discount');
                const oldVerkoopId = findPropId('verkoop');
                const oldEehId = findPropId('eeh');
                const oldMargeId = findPropId('marge standard');

                // 1. Move Title
                if (oldNaamId && oldP[oldNaamId]) {
                    mappedP['title'] = String(oldP[oldNaamId]);
                }

                if (oldDescId && oldP[oldDescId]) {
                    mappedP['prop-art-desc'] = String(oldP[oldDescId]);
                }

                // 2. Numeric Mapping
                if (oldBrutoId) mappedP['prop-art-bruto'] = parseFloat(String(oldP[oldBrutoId] || 0));
                if (oldRemiseId) mappedP['prop-art-remise'] = parseFloat(String(oldP[oldRemiseId] || 0));
                if (oldVerkoopId) mappedP['prop-art-verkoop'] = parseFloat(String(oldP[oldVerkoopId] || 0));

                // 3. Margin Default Migration
                if (oldMargeId && oldP[oldMargeId] !== undefined && oldP[oldMargeId] !== null) {
                    mappedP['prop-art-margin'] = parseFloat(String(oldP[oldMargeId]));
                } else {
                    mappedP['prop-art-margin'] = 65; // User default request
                }

                // 4. Eeh Unit Select Mapping
                if (oldEehId && oldP[oldEehId]) {
                    const unitRaw = String(oldP[oldEehId]).toLowerCase().trim();
                    if (unitRaw.includes('stk') || unitRaw.includes('stuk')) mappedP['prop-art-unit'] = 'u-stk';
                    else if (unitRaw === 'm') mappedP['prop-art-unit'] = 'u-m';
                    else if (unitRaw.includes('m2')) mappedP['prop-art-unit'] = 'u-m2';
                    else if (unitRaw.includes('m3')) mappedP['prop-art-unit'] = 'u-m3';
                    else if (unitRaw === 'l' || unitRaw.includes('liter')) mappedP['prop-art-unit'] = 'u-l';
                    else if (unitRaw === 'uur') mappedP['prop-art-unit'] = 'u-uur';
                    else if (unitRaw === 'set') mappedP['prop-art-unit'] = 'u-set';
                    else if (unitRaw.includes('kg')) mappedP['prop-art-unit'] = 'u-kg';
                    else mappedP['prop-art-unit'] = 'u-stk';
                }

                // 5. ART-XX-XXX Sequence Generator
                let groupCode = '00';
                const groupVal = mappedP['prop-art-group'];
                if (groupVal === 'opt-ruwbouw') groupCode = '01';
                else if (groupVal === 'opt-afwerking') groupCode = '02';
                else if (groupVal === 'opt-elektriciteit') groupCode = '03';
                else if (groupVal === 'opt-sanitaire') groupCode = '04';
                else if (groupVal === 'opt-ventilatie') groupCode = '05';
                else if (groupVal === 'opt-verwarming') groupCode = '06';

                if (!counters[groupCode]) counters[groupCode] = 0;
                counters[groupCode]++;
                mappedP['prop-art-id'] = `ART-${groupCode}-${String(counters[groupCode]).padStart(4, '0')}`;

                // Retain variants if present (PLURAL, do not confuse with singular 'variant' which is deleted)
                const oldVariantsId = findPropId('variants');
                if (oldVariantsId && oldP[oldVariantsId]) {
                    mappedP['prop-art-variants'] = oldP[oldVariantsId];
                }

                // Delete deprecated mapping sources to clean up the row
                const toDeleteIds = [
                    findPropId('brutoprijs variant'), findPropId('calculus'), findPropId('docs'),
                    findPropId('marge reno-k'), findPropId('marge reno active'), findPropId('photos'),
                    findPropId('variant'), oldNaamId, oldDescId, oldBrutoId, oldRemiseId, oldVerkoopId, oldEehId, oldMargeId
                ].filter(Boolean);

                toDeleteIds.forEach(id => {
                    if (id && id !== 'title' && id !== 'prop-art-variants') delete mappedP[id as string];
                });

                return { ...page, properties: mappedP };
            });

            // Reconstruct the definition properties without destroying user custom properties
            const toDeleteNames = ['brutoprijs variant', 'calculus', 'docs', 'marge reno-k', 'marge reno active', 'photos', 'variant', 'naam'];

            const mergedProperties = [...db.properties].filter(p => !toDeleteNames.includes(p.name.toLowerCase()));

            newProperties.forEach(np => {
                const existingIdx = mergedProperties.findIndex(p => p.id === np.id);
                if (existingIdx === -1) {
                    mergedProperties.push(np);
                } else {
                    mergedProperties[existingIdx] = { ...mergedProperties[existingIdx], ...np };
                }
            });

            // Commit overwrite to Zustand and force Postgres synchronization
            useDatabaseStore.getState().updateDatabase('db-articles', {
                properties: mergedProperties,
                pages: newPages
            });

            setMigrated(true);
        } catch (e) {
            console.error(e);
            alert("Migration failed: " + e);
            setIsMigrating(false);
        }
    };

    const forceResetSchema = () => {
        const articleDb = useDatabaseStore.getState().getDatabase('db-articles');
        if (!articleDb) return;
        const confirm = window.confirm("Are you sure you want to FORCE RESTORE the Master Schema? This will overwrite the exact columns defined in the codebase, wiping custom columns but guaranteeing perfect system sync.");
        if (!confirm) return;

        try {
            const newProperties = mockDatabases.find(d => d.id === 'db-articles')?.properties;
            if (!newProperties) throw new Error("Mock schema not found");

            useDatabaseStore.getState().updateDatabase('db-articles', {
                properties: newProperties
            });
            alert("Master schema successfully restored and synced to PostgreSQL. Please refresh the page.");
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    return (
        <div className="flex flex-col w-full h-full relative">
            <ModuleTabs tabs={libraryTabs} groupId="library" />

            {!migrated && (
                <div className="mx-6 mt-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 rounded-lg p-4 flex items-start justify-between">
                    <div className="flex gap-4">
                        <Database className="w-8 h-8 text-orange-500 shrink-0 mt-1" />
                        <div>
                            <h3 className="font-bold text-orange-800 dark:text-orange-400 text-lg">Database Schema Update Required</h3>
                            <p className="text-orange-700 dark:text-orange-300 text-sm mt-1 max-w-2xl">
                                You requested a massive database structure overhaul (deleting unused metrics, migrating Naam to Title, adding auto-calculated Net Pricing, merging variants, and setting Marge to 65%). Run the script below to automatically apply these changes to your existing local database. This is a one-way action.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleRunMigration}
                        disabled={isMigrating}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-6 rounded-md shadow-sm transition-all focus:ring-2 ring-orange-400 flex items-center gap-2 whitespace-nowrap"
                    >
                        {isMigrating ? 'Migrating...' : 'Run Migration Protocol'} <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            {migrated && (
                <div className="mx-6 mt-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-lg p-3 flex items-center gap-3 text-green-700 dark:text-green-400">
                    <Check className="w-5 h-5 shrink-0" />
                    <span className="font-bold text-sm">Migration Successful. You may now use the new schema.</span>
                </div>
            )}

            {/* Failsafe Schema Recovery Button */}
            <div className="mx-6 mt-4 flex justify-end">
                <button
                    onClick={forceResetSchema}
                    className="text-xs font-bold text-neutral-400 hover:text-red-500 transition-colors uppercase tracking-widest border border-neutral-200 dark:border-white/10 px-4 py-2 rounded-lg"
                >
                    Failsafe: Force Overwrite Master Schema
                </button>
            </div>

            <div className="w-full h-full flex flex-col pt-4 min-h-0">
                <DatabaseCloneDynamic databaseId="db-articles" />
            </div>
        </div>
    );
}
