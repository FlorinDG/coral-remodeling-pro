"use client";

import { useState, useEffect } from 'react';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredSettingsTabs } from '@/config/tabs';
import { useTenant } from '@/context/TenantContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { HardHat, Save, Loader2, Check } from 'lucide-react';

export default function HRSettingsPage() {
    usePageTitle('HR Settings');
    const { activeModules } = useTenant();
    const filteredSettingsTabs = getFilteredSettingsTabs(activeModules);

    const [workHoursPerDay, setWorkHoursPerDay] = useState(8.0);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/tenant/profile')
            .then(r => r.json())
            .then(data => {
                if (data.workHoursPerDay != null) setWorkHoursPerDay(data.workHoursPerDay);
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        await fetch('/api/tenant/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workHoursPerDay }),
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
                        <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/15 flex items-center justify-center">
                            <HardHat className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">HR Settings</h1>
                            <p className="text-xs text-neutral-500">Workforce management and time tracking configuration.</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Work Hours Per Day */}
                        <div className="bg-white dark:bg-white/5 rounded-2xl border border-neutral-200 dark:border-white/10 p-5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block">Standard Work Hours Per Day</label>
                            <div className="flex gap-2">
                                {[4, 6, 7.5, 8, 9, 10].map(hrs => (
                                    <button
                                        key={hrs}
                                        onClick={() => setWorkHoursPerDay(hrs)}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                            workHoursPerDay === hrs
                                                ? 'bg-[var(--brand-color,#d35400)] text-white shadow-md'
                                                : 'bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'
                                        }`}
                                    >
                                        {hrs}h
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-neutral-400 mt-2">Used for overtime calculations and attendance tracking.</p>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--brand-color,#d35400)] text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-all"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                            {saved ? 'Saved' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
