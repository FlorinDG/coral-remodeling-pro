"use client";

import React, { useState, useEffect } from 'react';
import { Settings, Calendar as CalendarIcon, RefreshCw, Check, AlertCircle, Trash2, HardDrive, Building2, Save } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';

function CompanyProfileTab() {
    const [profile, setProfile] = useState({ companyName: '', vatNumber: '', iban: '', logoUrl: '', peppolId: '' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch('/api/tenant/profile').then(res => res.json()).then(data => {
            if (data && !data.error) {
                setProfile({
                    companyName: data.companyName || '',
                    vatNumber: data.vatNumber || '',
                    iban: data.iban || '',
                    logoUrl: data.logoUrl || '',
                    peppolId: data.peppolId || '',
                });
            }
            setLoading(false);
        });
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch('/api/tenant/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profile)
            });
            toast.success('Company profile saved securely!');
        } catch (e) {
            console.error('Failed to save profile', e);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 text-neutral-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading identity...
            </div>
        );
    }

    return (
        <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div>
                <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
                    Company Identity
                </h2>
                <p className="text-sm text-neutral-500">Configure your brand appearance and billing details for professional invoicing.</p>
            </div>

            <div className="space-y-5 p-6 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50/50 dark:bg-neutral-900/20">
                <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Company Name</label>
                    <input
                        type="text"
                        value={profile.companyName}
                        onChange={(e) => setProfile(p => ({ ...p, companyName: e.target.value }))}
                        className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2.5 outline-none focus:border-[var(--brand-color,#d35400)] transition-colors text-sm"
                        placeholder="e.g. Coral Enterprises LLC"
                    />
                </div>

                <div className="grid grid-cols-2 gap-5">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">VAT Number</label>
                        <input
                            type="text"
                            value={profile.vatNumber}
                            onChange={(e) => setProfile(p => ({ ...p, vatNumber: e.target.value }))}
                            className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2.5 outline-none focus:border-[var(--brand-color,#d35400)] transition-colors text-sm"
                            placeholder="e.g. BE0123456789"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">IBAN Account</label>
                        <input
                            type="text"
                            value={profile.iban}
                            onChange={(e) => setProfile(p => ({ ...p, iban: e.target.value }))}
                            className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2.5 outline-none focus:border-[var(--brand-color)] transition-colors text-sm"
                            placeholder="e.g. BE68 1234 5678 9012"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Workspace Logo URL</label>
                    <input
                        type="url"
                        value={profile.logoUrl}
                        onChange={(e) => setProfile(p => ({ ...p, logoUrl: e.target.value }))}
                        className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2.5 outline-none focus:border-[var(--brand-color)] transition-colors text-sm"
                        placeholder="https://example.com/logo.png"
                    />
                </div>

                <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 text-white py-3 rounded-lg font-bold transition-all shadow-md active:scale-[0.98] disabled:opacity-50 hover:opacity-90"
                        style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                    >
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Saving Profile...' : 'Save Company Integrity'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function PeppolIntegrationSection() {
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/peppol/onboard');
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
            }
        } catch (e) {
            console.error('Failed to fetch Peppol status:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async () => {
        setConnecting(true);
        try {
            const res = await fetch('/api/peppol/onboard', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || 'Peppol verbinding actief!');
                setStatus(data);
                fetchStatus(); // Refresh
            } else {
                toast.error(data.error || 'Onboarding mislukt');
            }
        } catch (e: any) {
            toast.error('Verbinding mislukt: ' + (e.message || 'Onbekende fout'));
        } finally {
            setConnecting(false);
        }
    };

    const isConnected = status?.connected || status?.alreadyConnected;
    const isPeppolActive = status?.peppolRegistered;

    return (
        <div className="mt-8 p-6 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50/50 dark:bg-neutral-900/20">
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Peppol E-Invoicing
                    </h3>
                    <p className="text-sm text-neutral-500 mt-1 max-w-xl">
                        Verbind met het Peppol netwerk om UBL e-facturen rechtstreeks naar klanten te verzenden via het Belgische e-invoicing systeem.
                    </p>
                </div>

                {!isConnected && (
                    <button
                        onClick={handleConnect}
                        disabled={connecting || loading}
                        className="px-4 py-2 text-white rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                        style={{ backgroundColor: 'var(--brand-color, #10B981)' }}
                    >
                        {connecting ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        )}
                        {connecting ? 'Verbinden...' : 'Activeer Peppol'}
                    </button>
                )}
            </div>

            <div className="bg-white dark:bg-black rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
                {loading ? (
                    <div className="text-sm text-neutral-500 flex items-center gap-2 py-2">
                        <RefreshCw className="w-4 h-4 animate-spin" /> Verbindingsstatus ophalen...
                    </div>
                ) : isConnected ? (
                    <div className="space-y-4">
                        {/* Connection status */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${isPeppolActive ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                                <div>
                                    <p className="text-sm font-bold">{isPeppolActive ? 'Peppol Actief' : 'E-Invoice Verbonden'}</p>
                                    <p className="text-[10px] text-neutral-500 uppercase tracking-wider">
                                        {isPeppolActive ? 'Klaar om e-facturen te verzenden' : 'Wacht op Peppol registratie'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400">
                                <Check className="w-3 h-3" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Verbonden</span>
                            </div>
                        </div>

                        {/* Details grid */}
                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                            {status.peppolId && (
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Peppol ID</p>
                                    <p className="text-sm font-mono font-medium text-neutral-700 dark:text-neutral-300">{status.peppolId}</p>
                                </div>
                            )}
                            {status.eInvoiceTenantId && (
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Tenant ID</p>
                                    <p className="text-sm font-mono font-medium text-neutral-700 dark:text-neutral-300">{status.eInvoiceTenantId}</p>
                                </div>
                            )}
                            {status.peppolStatus && (
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Netwerk Status</p>
                                    <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 capitalize">{status.peppolStatus}</p>
                                </div>
                            )}
                        </div>

                        {/* Info banner */}
                        <div className="mt-2 flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30">
                            <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                                Klik op <strong>"Peppol Verzenden"</strong> in een factuur om deze als UBL e-factuur via het Peppol netwerk te versturen.
                                {isPeppolActive ? ' Documenten worden direct verstuurd.' : ' In testmodus worden UBL-documenten per mail verzonden.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="text-sm text-neutral-500 flex items-center gap-2 py-2">
                        <AlertCircle className="w-4 h-4 text-neutral-400" />
                        {!status?.hasVatNumber
                            ? 'Vul eerst je BTW-nummer in bij Company Profile om Peppol te activeren.'
                            : 'Nog niet verbonden met het Peppol netwerk. Klik op "Activeer Peppol" om te starten.'
                        }
                    </div>
                )}
            </div>
        </div>
    );
}

export default function SettingsModule() {
    const [activeTab, setActiveTab] = useState<'profile' | 'integrations'>('profile');
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
    const [accounts, setAccounts] = useState<any[]>([]);

    useEffect(() => {
        fetchAccounts();

        // Check if coming back from a successful Drive OAuth redirect
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('drive_sync') === 'success') {
                alert("Google Drive authorized successfully! Please remember to copy the GOOGLE_REFRESH_TOKEN from your terminal into your .env file.");
            }
        }
    }, []);

    const fetchAccounts = async () => {
        setIsLoadingAccounts(true);
        try {
            const res = await fetch('/api/calendar/accounts');
            if (res.ok) {
                const data = await res.json();
                setAccounts(data.accounts || []);
            }
        } catch (e) {
            console.error("Failed to fetch accounts:", e);
        } finally {
            setIsLoadingAccounts(false);
        }
    };

    const handleConnectGoogle = () => {
        signIn("google", { callbackUrl: window.location.href });
    };

    return (
        <div className="flex-1 bg-white dark:bg-black w-full border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm flex flex-col md:flex-row">

            {/* Sidebar with Settings Navigation */}
            <div className={`w-full md:w-64 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-neutral-900/20 p-4`}>
                <div className="space-y-1">
                    <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 px-2">Workspaces</div>
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'profile' ? 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm text-[var(--brand-color,#d35400)]' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-transparent'}`}
                    >
                        <Building2 className="w-4 h-4" />
                        Company Profile
                    </button>

                    <button
                        onClick={() => setActiveTab('integrations')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'integrations' ? 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm text-[var(--brand-color,#d35400)]' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-transparent'}`}
                    >
                        <Settings className="w-4 h-4" />
                        Integrations
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-6 lg:p-10 hide-scrollbar overflow-y-auto">
                {activeTab === 'profile' && <CompanyProfileTab />}

                {activeTab === 'integrations' && (
                    <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            Platform Integrations
                        </h2>

                        {/* Google Calendar Section */}
                        <div className="p-6 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50/50 dark:bg-neutral-900/20">
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /><path d="M1 1h22v22H1z" fill="none" /></svg>
                                        Google Calendar
                                    </h3>
                                    <p className="text-sm text-neutral-500 mt-1">Connect your Google account to sync events directly into the Admin Calendar and track your scheduled meetings.</p>
                                </div>

                                <button
                                    onClick={handleConnectGoogle}
                                    className="px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm font-bold hover:border-neutral-300 dark:hover:border-neutral-600 transition-all shadow-sm flex items-center gap-2"
                                >
                                    <CalendarIcon className="w-4 h-4 text-neutral-500" />
                                    Link Account
                                </button>
                            </div>

                            <div className="bg-white dark:bg-black rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">Linked Accounts</h4>

                                {isLoadingAccounts ? (
                                    <div className="text-sm text-neutral-500 flex items-center gap-2 py-2">
                                        <RefreshCw className="w-4 h-4 animate-spin" /> Loading connections...
                                    </div>
                                ) : accounts.length === 0 ? (
                                    <div className="text-sm text-neutral-500 flex items-center gap-2 py-2">
                                        <AlertCircle className="w-4 h-4 text-neutral-400" /> No Google accounts currently linked.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {accounts.map((acc, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                                                        {acc.email.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold">{acc.email}</p>
                                                        <p className="text-[10px] text-neutral-500 uppercase flex flex-wrap gap-1 mt-1">
                                                            {acc.calendars?.length || 0} calendars synced
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400">
                                                        <Check className="w-3 h-3" />
                                                        <span className="text-[10px] font-bold uppercase tracking-wider">Active</span>
                                                    </div>
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm("Disconnect this Google account? Events will no longer sync.")) {
                                                                try {
                                                                    await fetch(`/api/calendar/accounts?accountId=${acc.accountId}`, { method: 'DELETE' });
                                                                    fetchAccounts();
                                                                } catch (e) {
                                                                    console.error("Failed to disconnect:", e);
                                                                }
                                                            }
                                                        }}
                                                        className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors"
                                                        title="Disconnect Account"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* End Google Calendar Section */}

                        {/* Google Drive Section */}
                        <div className="mt-8 p-6 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50/50 dark:bg-neutral-900/20">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /><path d="M1 1h22v22H1z" fill="none" /></svg>
                                        Google Drive Storage
                                    </h3>
                                    <p className="text-sm text-neutral-500 mt-1 max-w-xl">
                                        Authorize the Unified File Manager to store and retrieve assets directly from your company's Google Workspace securely.
                                    </p>
                                </div>

                                <a
                                    href="/api/drive/auth"
                                    className="px-4 py-2 bg-[#4285F4] text-white rounded-lg text-sm font-bold hover:bg-[#3367d6] transition-all shadow-sm flex items-center gap-2"
                                >
                                    <HardDrive className="w-4 h-4" />
                                    Authorize Drive
                                </a>
                            </div>
                        </div>
                        {/* End Google Drive Section */}

                        {/* Peppol E-Invoicing Section */}
                        <PeppolIntegrationSection />
                    </div>
                )}
            </div>

        </div>
    );
}
