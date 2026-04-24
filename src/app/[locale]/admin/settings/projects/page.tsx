"use client";

import { useState, useEffect } from 'react';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredSettingsTabs } from '@/config/tabs';
import { useTenant } from '@/context/TenantContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { FolderKanban, Save, Loader2, Check } from 'lucide-react';

export default function ProjectsSettingsPage() {
    usePageTitle('Projects Settings');
    const { activeModules } = useTenant();
    const filteredSettingsTabs = getFilteredSettingsTabs(activeModules);

    const [bordereauPrefix, setBordereauPrefix] = useState('BOR');
    const [poPrefix, setPoPrefix] = useState('PO');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/tenant/profile')
            .then(r => r.json())
            .then(data => {
                if (data.bordereauPrefix) setBordereauPrefix(data.bordereauPrefix);
                if (data.poPrefix) setPoPrefix(data.poPrefix);
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        await fetch('/api/tenant/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bordereauPrefix, poPrefix }),
        });
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    if (loading) return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={filteredSettingsTabs} groupId="settings" />
            <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>
        </div>
    );

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={filteredSettingsTabs} groupId="settings" />
            <div className="flex-1 overflow-y-auto p-6 pb-16 bg-neutral-50/50 dark:bg-[#0a0a0a]">
                <div className="max-w-2xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center">
                            <FolderKanban className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Projects Settings</h1>
                            <p className="text-xs text-neutral-500">Document numbering and project management configuration.</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white dark:bg-white/5 rounded-2xl border border-neutral-200 dark:border-white/10 p-5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block">Bordereau Prefix</label>
                            <input type="text" value={bordereauPrefix} onChange={e => setBordereauPrefix(e.target.value)}
                                className="w-32 px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30" />
                            <p className="text-xs text-neutral-400 mt-2">Prefix for bordereau document numbers (e.g. BOR-2026-001).</p>
                        </div>

                        <div className="bg-white dark:bg-white/5 rounded-2xl border border-neutral-200 dark:border-white/10 p-5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block">Purchase Order Prefix</label>
                            <input type="text" value={poPrefix} onChange={e => setPoPrefix(e.target.value)}
                                className="w-32 px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30" />
                            <p className="text-xs text-neutral-400 mt-2">Prefix for purchase order numbers (e.g. PO-2026-001).</p>
                        </div>

                        <button onClick={handleSave} disabled={saving}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--brand-color,#d35400)] text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-all">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                            {saved ? 'Saved' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
