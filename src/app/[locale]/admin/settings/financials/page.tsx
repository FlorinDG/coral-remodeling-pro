"use client";

import { useState, useEffect } from 'react';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredSettingsTabs } from '@/config/tabs';
import { useTenant } from '@/context/TenantContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Receipt, Save, Loader2, Check } from 'lucide-react';

export default function FinancialsSettingsPage() {
    usePageTitle('Financials Settings');
    const { activeModules } = useTenant();
    const filteredSettingsTabs = getFilteredSettingsTabs(activeModules);

    const [defaultVatRate, setDefaultVatRate] = useState(21);
    const [vatCalcMode, setVatCalcMode] = useState('lines');
    const [defaultPaymentTermDays, setDefaultPaymentTermDays] = useState(30);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/tenant/profile')
            .then(r => r.json())
            .then(data => {
                if (data.defaultVatRate != null) setDefaultVatRate(data.defaultVatRate);
                if (data.vatCalcMode) setVatCalcMode(data.vatCalcMode);
                if (data.defaultPaymentTermDays != null) setDefaultPaymentTermDays(data.defaultPaymentTermDays);
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        await fetch('/api/tenant/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ defaultVatRate, vatCalcMode, defaultPaymentTermDays }),
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
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
                            <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Financials Settings</h1>
                            <p className="text-xs text-neutral-500">Default values for invoices, quotations, and financial documents.</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Default VAT Rate */}
                        <div className="bg-white dark:bg-white/5 rounded-2xl border border-neutral-200 dark:border-white/10 p-5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block">Default VAT Rate</label>
                            <div className="flex gap-2">
                                {[0, 6, 12, 21].map(rate => (
                                    <button
                                        key={rate}
                                        onClick={() => setDefaultVatRate(rate)}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                            defaultVatRate === rate
                                                ? 'bg-[var(--brand-color,#d35400)] text-white shadow-md'
                                                : 'bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10'
                                        }`}
                                    >
                                        {rate}%
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-neutral-400 mt-2">Applied when adding new line items. Can be overridden per line.</p>
                        </div>

                        {/* VAT Calculation Mode */}
                        <div className="bg-white dark:bg-white/5 rounded-2xl border border-neutral-200 dark:border-white/10 p-5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block">VAT Calculation Mode</label>
                            <div className="flex gap-2">
                                {[
                                    { value: 'lines', label: 'Per Line', desc: 'VAT calculated per line item' },
                                    { value: 'total', label: 'On Total', desc: 'VAT applied on subtotal' },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setVatCalcMode(opt.value)}
                                        className={`flex-1 p-3 rounded-xl text-left transition-all border ${
                                            vatCalcMode === opt.value
                                                ? 'border-[var(--brand-color,#d35400)] bg-[var(--brand-color,#d35400)]/5'
                                                : 'border-neutral-200 dark:border-white/10 hover:border-neutral-300'
                                        }`}
                                    >
                                        <p className="text-sm font-bold text-neutral-900 dark:text-white">{opt.label}</p>
                                        <p className="text-xs text-neutral-500 mt-0.5">{opt.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Payment Terms */}
                        <div className="bg-white dark:bg-white/5 rounded-2xl border border-neutral-200 dark:border-white/10 p-5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block">Default Payment Terms (days)</label>
                            <input
                                type="number" min={0} max={120}
                                value={defaultPaymentTermDays}
                                onChange={e => setDefaultPaymentTermDays(parseInt(e.target.value) || 0)}
                                className="w-32 px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30"
                            />
                            <p className="text-xs text-neutral-400 mt-2">Shown on invoice PDFs as &quot;Payment due within X days&quot;.</p>
                        </div>

                        {/* Save */}
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
