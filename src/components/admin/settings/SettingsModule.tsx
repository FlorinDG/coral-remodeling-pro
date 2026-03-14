"use client";

import React, { useState, useEffect } from 'react';
import { Settings, Calendar as CalendarIcon, RefreshCw, Check, AlertCircle, Trash2, HardDrive } from 'lucide-react';
import { signIn } from 'next-auth/react';

export default function SettingsModule() {
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

            {/* Sidebar with Settings Navigation (Future Proofing) */}
            <div className={`w-full md:w-64 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-neutral-900/20 p-4`}>
                <div className="space-y-1">
                    <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 px-2">Categories</div>
                    <button className="w-full flex items-center gap-3 px-3 py-2 bg-white dark:bg-neutral-800 rounded-lg text-sm font-medium border border-neutral-200 dark:border-neutral-700 shadow-sm transition-colors text-[#d35400]">
                        <Settings className="w-4 h-4" />
                        Integrations
                    </button>
                    {/* Add more categories here later */}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-6 lg:p-10 hide-scrollbar overflow-y-auto">
                <div className="max-w-3xl">
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

                </div>
            </div>

        </div>
    );
}
