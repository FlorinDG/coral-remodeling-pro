"use client";

import { useState, useEffect } from 'react';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredSettingsTabs } from '@/config/tabs';
import { useTenant } from '@/context/TenantContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { CalendarDays, Save, Loader2, Check } from 'lucide-react';

export default function CalendarSettingsPage() {
    usePageTitle('Calendar Settings');
    const { activeModules } = useTenant();
    const filteredSettingsTabs = getFilteredSettingsTabs(activeModules);

    const [defaultEventDuration, setDefaultEventDuration] = useState(60);
    const [defaultCalendarView, setDefaultCalendarView] = useState('month');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/tenant/profile')
            .then(r => r.json())
            .then(data => {
                if (data.defaultEventDuration != null) setDefaultEventDuration(data.defaultEventDuration);
                if (data.defaultCalendarView) setDefaultCalendarView(data.defaultCalendarView);
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        await fetch('/api/tenant/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ defaultEventDuration, defaultCalendarView }),
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
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center">
                            <CalendarDays className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Calendar Settings</h1>
                            <p className="text-xs text-neutral-500">Default behavior for calendar events and views.</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Default Event Duration */}
                        <div className="bg-white dark:bg-white/5 rounded-2xl border border-neutral-200 dark:border-white/10 p-5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block">Default Event Duration</label>
                            <div className="flex gap-2">
                                {[15, 30, 45, 60, 90, 120].map(mins => (
                                    <button
                                        key={mins}
                                        onClick={() => setDefaultEventDuration(mins)}
                                        className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                                            defaultEventDuration === mins
                                                ? 'bg-[var(--brand-color,#d35400)] text-white shadow-md'
                                                : 'bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'
                                        }`}
                                    >
                                        {mins}m
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Default View */}
                        <div className="bg-white dark:bg-white/5 rounded-2xl border border-neutral-200 dark:border-white/10 p-5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block">Default Calendar View</label>
                            <div className="flex gap-2">
                                {[
                                    { value: 'month', label: 'Month' },
                                    { value: 'week', label: 'Week' },
                                    { value: 'day', label: 'Day' },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setDefaultCalendarView(opt.value)}
                                        className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all border ${
                                            defaultCalendarView === opt.value
                                                ? 'border-[var(--brand-color,#d35400)] bg-[var(--brand-color,#d35400)]/5 text-[var(--brand-color,#d35400)]'
                                                : 'border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
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
