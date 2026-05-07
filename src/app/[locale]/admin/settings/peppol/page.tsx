"use client";

import { useState, useEffect } from 'react';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredSettingsTabs } from '@/config/tabs';
import { useTenant } from '@/context/TenantContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Globe, ShieldCheck, Mail, Building, Check, Loader2, AlertCircle, ExternalLink, Info } from 'lucide-react';

export default function PeppolSettingsPage() {
    usePageTitle('Peppol Production Registration');
    const { activeModules } = useTenant();
    const filteredSettingsTabs = getFilteredSettingsTabs(activeModules);

    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState(false);
    const [status, setStatus] = useState<{
        peppolRegistered: boolean;
        vatNumber: string;
        peppolId: string;
        companyName: string;
        email: string;
    } | null>(null);

    const [agreed, setAgreed] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        fetch('/api/tenant/profile')
            .then(r => r.json())
            .then(data => {
                setStatus({
                    peppolRegistered: data.peppolRegistered || false,
                    vatNumber: data.vatNumber || '',
                    peppolId: data.peppolId || `0190:${data.vatNumber?.replace(/[^0-9]/g, '')}`,
                    companyName: data.companyName || '',
                    email: data.email || '',
                });
            })
            .finally(() => setLoading(false));
    }, []);

    const handleRegister = async () => {
        if (!agreed) {
            setError('You must agree to the Peppol Network terms.');
            return;
        }

        setRegistering(true);
        setError(null);

        try {
            const res = await fetch('/api/peppol/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agree: true }),
            });

            const data = await res.json();
            if (data.success) {
                setSuccess(true);
                setStatus(prev => prev ? { ...prev, peppolRegistered: true } : null);
            } else {
                setError(data.error || 'Registration failed. Please verify your VAT number and company info.');
            }
        } catch (err) {
            setError('A network error occurred. Please try again.');
        } finally {
            setRegistering(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={filteredSettingsTabs} groupId="settings" />
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
        </div>
    );

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={filteredSettingsTabs} groupId="settings" />
            <div className="flex-1 overflow-y-auto p-6 pb-16 bg-neutral-50/50 dark:bg-[#0a0a0a]">
                <div className="max-w-3xl">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Globe className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">Peppol Production Network</h1>
                            <p className="text-sm text-neutral-500">Secure B2G and B2B e-invoicing registration via e-invoice.be.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {/* Status Card */}
                        <div className="md:col-span-2 space-y-6">
                            <div className="bg-white dark:bg-white/5 rounded-3xl border border-neutral-200 dark:border-white/10 p-8 relative overflow-hidden">
                                {status?.peppolRegistered && (
                                    <div className="absolute top-0 right-0 p-4">
                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                                            <ShieldCheck className="w-3 h-3" />
                                            Active on Network
                                        </div>
                                    </div>
                                )}

                                <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-6">Production Identity</h2>
                                
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block">Company Name</label>
                                            <div className="flex items-center gap-2 p-3 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/5">
                                                <Building className="w-4 h-4 text-neutral-400" />
                                                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate">{status?.companyName}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block">Peppol ID (EAS:VAT)</label>
                                            <div className="flex items-center gap-2 p-3 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/5">
                                                <Globe className="w-4 h-4 text-neutral-400" />
                                                <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400">{status?.peppolId}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block">Registration Email</label>
                                        <div className="flex items-center gap-2 p-3 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/5">
                                            <Mail className="w-4 h-4 text-neutral-400" />
                                            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{status?.email}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {!status?.peppolRegistered && (
                                <div className="bg-white dark:bg-white/5 rounded-3xl border border-neutral-200 dark:border-white/10 p-8">
                                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">Onboarding Terms</h2>
                                    <p className="text-sm text-neutral-500 leading-relaxed mb-6">
                                        By joining the Peppol network, your company will be reachable by all government entities (B2G) and participating businesses (B2B) worldwide. 
                                        Invoices sent through Coral will be legally valid e-documents.
                                    </p>

                                    <label className="flex items-start gap-3 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 cursor-pointer transition-all hover:bg-blue-500/10">
                                        <input 
                                            type="checkbox" 
                                            className="mt-1 w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                                            checked={agreed}
                                            onChange={e => setAgreed(e.target.checked)}
                                        />
                                        <span className="text-xs text-neutral-600 dark:text-neutral-400 leading-tight">
                                            I authorize Coral Remodeling Pro to register my company on the Peppol network via the e-invoice.be SMP provider and declare that all company information provided is accurate.
                                        </span>
                                    </label>

                                    {error && (
                                        <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-600 dark:text-red-400 text-sm">
                                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                            {error}
                                        </div>
                                    )}

                                    {success && (
                                        <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-600 dark:text-emerald-400 text-sm">
                                            <Check className="w-4 h-4 flex-shrink-0" />
                                            Registration successful! Your account is now production-ready.
                                        </div>
                                    )}

                                    <button
                                        onClick={handleRegister}
                                        disabled={registering || status?.peppolRegistered}
                                        className="mt-8 w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-600/20"
                                    >
                                        {registering ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : status?.peppolRegistered ? (
                                            <>
                                                <Check className="w-5 h-5" />
                                                Successfully Registered
                                            </>
                                        ) : (
                                            <>
                                                <Globe className="w-5 h-5" />
                                                Activate Production Network
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Sidebar Info */}
                        <div className="space-y-6">
                            <div className="bg-amber-50 dark:bg-amber-500/10 rounded-3xl p-6 border border-amber-200 dark:border-amber-500/20">
                                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm mb-3">
                                    <Info className="w-4 h-4" />
                                    Why register?
                                </div>
                                <ul className="space-y-3 text-xs text-amber-800/70 dark:text-amber-400/60 leading-relaxed">
                                    <li className="flex gap-2">
                                        <span className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                                        Mandatory for B2G (Government) contracts in many EU countries.
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                                        Faster payments with automated invoice ingestion.
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                                        Reduced errors and manual data entry for your clients.
                                    </li>
                                </ul>
                            </div>

                            <div className="bg-white dark:bg-white/5 rounded-3xl p-6 border border-neutral-200 dark:border-white/10">
                                <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-4">Useful Links</h3>
                                <div className="space-y-2">
                                    <a href="https://peppol.org" target="_blank" className="flex items-center justify-between p-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-white/5 group transition-colors">
                                        <span className="text-xs text-neutral-600 dark:text-neutral-400">Peppol.org</span>
                                        <ExternalLink className="w-3 h-3 text-neutral-400 group-hover:text-blue-500" />
                                    </a>
                                    <a href="https://e-invoice.be" target="_blank" className="flex items-center justify-between p-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-white/5 group transition-colors">
                                        <span className="text-xs text-neutral-600 dark:text-neutral-400">E-Invoice.be Portal</span>
                                        <ExternalLink className="w-3 h-3 text-neutral-400 group-hover:text-blue-500" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
