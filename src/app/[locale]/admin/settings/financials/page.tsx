"use client";

import { useState, useEffect, useCallback } from 'react';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredSettingsTabs } from '@/config/tabs';
import { useTenant } from '@/context/TenantContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Receipt, Save, Loader2, Check, Calculator, UserPlus, Trash2, Mail, ShieldCheck, Download } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface AccountantUser {
    id: string;
    name: string | null;
    email: string | null;
    inviteAccepted: boolean;
    invitedAt: string | null;
}

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

    // ── Accountant state ────────────────────────────────────────────────
    const [accountant, setAccountant] = useState<AccountantUser | null>(null);
    const [acctEmail, setAcctEmail] = useState('');
    const [acctName, setAcctName] = useState('');
    const [acctSaving, setAcctSaving] = useState(false);
    const [acctError, setAcctError] = useState('');
    const [acctLoading, setAcctLoading] = useState(true);

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

    const fetchAccountant = useCallback(async () => {
        try {
            const res = await fetch('/api/tenant/accountant');
            if (res.ok) {
                const data = await res.json();
                setAccountant(data.accountant || null);
            }
        } catch { /* silent */ }
        finally { setAcctLoading(false); }
    }, []);

    useEffect(() => { fetchAccountant(); }, [fetchAccountant]);

    const handleInviteAccountant = async () => {
        if (!acctEmail) { setAcctError('Email is required'); return; }
        setAcctSaving(true);
        setAcctError('');
        try {
            const res = await fetch('/api/tenant/accountant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: acctEmail, name: acctName }),
            });
            const data = await res.json();
            if (!res.ok) {
                setAcctError(data.error || 'Failed to invite');
                return;
            }
            setAccountant(data.accountant);
            setAcctEmail('');
            setAcctName('');
        } catch {
            setAcctError('Network error');
        } finally {
            setAcctSaving(false);
        }
    };

    const handleRevokeAccountant = async () => {
        if (!confirm('Remove accountant access? They will no longer be able to view your financial data.')) return;
        try {
            await fetch('/api/tenant/accountant', { method: 'DELETE' });
            setAccountant(null);
        } catch { /* silent */ }
    };

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

                        {/* ── Divider ─────────────────────────────────────── */}
                        <div className="border-t border-neutral-200 dark:border-white/10 pt-2 mt-8" />

                        {/* ── Accountant Access ──────────────────────────── */}
                        <div className="bg-white dark:bg-white/5 rounded-2xl border border-orange-200 dark:border-orange-500/20 p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/15 flex items-center justify-center">
                                    <Calculator className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Accountant Access</h2>
                                    <p className="text-xs text-neutral-500">Give your bookkeeper read-only access to your financial data.</p>
                                </div>
                            </div>

                            {/* What the accountant can do */}
                            <div className="bg-orange-50 dark:bg-orange-500/5 rounded-xl p-4 mb-5 space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400 mb-2">What your accountant can do</p>
                                <div className="flex items-center gap-2 text-xs text-orange-700 dark:text-orange-300">
                                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                                    <span>View invoices, expenses, and expense tickets</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-orange-700 dark:text-orange-300">
                                    <Download className="w-3.5 h-3.5 shrink-0" />
                                    <span>Export data to CSV for import into accounting software</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-orange-700 dark:text-orange-300">
                                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                                    <span>Filter by date range (month, trimester, semester, year)</span>
                                </div>
                                <p className="text-[10px] text-orange-500 dark:text-orange-400/60 mt-1">
                                    Read-only — your accountant cannot edit, delete, or create records.
                                    Exported records are automatically locked from further editing.
                                </p>
                            </div>

                            {acctLoading ? (
                                <div className="flex items-center justify-center h-16">
                                    <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
                                </div>
                            ) : accountant ? (
                                /* ── Current accountant ────────────────────── */
                                <div className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10">
                                    <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/15 flex items-center justify-center text-sm font-bold text-orange-600 dark:text-orange-400">
                                        {(accountant.name || accountant.email || '?')[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-neutral-900 dark:text-white truncate">
                                                {accountant.name || accountant.email}
                                            </span>
                                            {accountant.inviteAccepted ? (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                                                    ACTIVE
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                                                    PENDING
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <Mail className="w-3 h-3 text-neutral-400" />
                                            <span className="text-xs text-neutral-500 truncate">{accountant.email}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleRevokeAccountant}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Revoke
                                    </button>
                                </div>
                            ) : (
                                /* ── Invite form ───────────────────────────── */
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">Accountant Email *</label>
                                            <input
                                                type="email"
                                                value={acctEmail}
                                                onChange={e => setAcctEmail(e.target.value)}
                                                placeholder="accountant@firm.be"
                                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">Name (optional)</label>
                                            <input
                                                type="text"
                                                value={acctName}
                                                onChange={e => setAcctName(e.target.value)}
                                                placeholder="John Doe"
                                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                                            />
                                        </div>
                                    </div>

                                    {acctError && (
                                        <p className="text-xs text-red-600 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg">{acctError}</p>
                                    )}

                                    <button
                                        onClick={handleInviteAccountant}
                                        disabled={acctSaving || !acctEmail}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-50 transition-all"
                                    >
                                        {acctSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                        Send Invite
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
