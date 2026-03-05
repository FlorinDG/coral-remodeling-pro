"use client";

import { notFound } from 'next/navigation';
import TaskManager from '@/components/portal/TaskManager';
import DocumentManager from '@/components/portal/DocumentManager';
import MediaManager from '@/components/portal/MediaManager';
import ChatBox from '@/components/portal/ChatBox';
import Logo from '@/components/Logo';
import PortalLogin from '@/components/portal/PortalLogin';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';

export default function PortalPage({ params: paramsPromise }: { params: Promise<{ slug: string, locale: string }> }) {
    const t = useTranslations('Portal');
    const [portal, setPortal] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loginError, setLoginError] = useState('');

    useEffect(() => {
        const loadPortal = async () => {
            const { slug } = await paramsPromise;
            const res = await fetch(`/api/portals/slug/${slug}`);
            if (!res.ok) {
                setLoading(false);
                return;
            }
            const data = await res.json();
            setPortal(data);
            if (!data.hasPassword) {
                setIsAuthenticated(true);
            } else {
                // Check if already authenticated in session
                const sessionAuth = sessionStorage.getItem(`portal_auth_${data.id}`);
                if (sessionAuth) setIsAuthenticated(true);
            }
            setLoading(false);
        };
        loadPortal();
    }, [paramsPromise]);

    const handleLogin = async (password: string) => {
        const res = await fetch('/api/portals/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: portal.id, password })
        });
        const result = await res.json();
        if (result.success) {
            setIsAuthenticated(true);
            sessionStorage.setItem(`portal_auth_${portal.id}`, 'true');
        } else {
            setLoginError('Invalid password');
        }
    };

    if (loading) return <div className="h-screen bg-black flex items-center justify-center"><div className="animate-pulse text-white">Loading...</div></div>;
    if (!portal) notFound();

    if (!isAuthenticated) {
        return <PortalLogin onLogin={handleLogin} error={loginError} />;
    }

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-black text-neutral-900 dark:text-white selection:bg-[#d35400] selection:text-white pb-20">
            <header className="fixed w-full z-50 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-neutral-200 dark:border-white/5 h-20 flex items-center px-8 justify-between">
                <div className="flex items-center gap-2">
                    <Logo className="w-8 h-8" />
                    <span className="font-bold tracking-tighter text-lg text-neutral-900 dark:text-white uppercase">CORAL ENTERPRISES CLIENT PORTAL</span>
                </div>
                <div className="text-sm font-bold text-neutral-500 dark:text-white/60">{t('header')}</div>
            </header>

            <main className="container mx-auto px-4 md:px-8 pt-32">
                <div className="mb-12">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-12">
                        <div>
                            <span className="text-[#d35400] font-bold tracking-[0.3em] text-[10px] uppercase mb-2 block tracking-widest">{t('navTitle')}</span>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-neutral-900 dark:text-white mb-4">
                                {portal.clientName}
                            </h1>
                            <p className="text-neutral-500 dark:text-neutral-400 font-medium max-w-lg">
                                {t('welcome')} {portal.projectTitle || t('yourProject')}. {t('tracking')}
                            </p>
                        </div>
                        {(portal.budget ?? 0) > 0 && (
                            <div className="w-full md:w-80 glass-morphism p-6 rounded-[2rem] border border-neutral-200 dark:border-white/5 shadow-xl shadow-[#d35400]/5 bg-white dark:bg-black/40">
                                <div className="flex justify-between items-end mb-3">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Payment Progress</span>
                                    <span className="text-sm font-black text-[#d35400]">{Math.round(((portal.paidAmount ?? 0) / (portal.budget ?? 1)) * 100)}%</span>
                                </div>
                                <div className="h-2.5 bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[#d35400] transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(211,84,0,0.5)]"
                                        style={{ width: `${Math.min(100, ((portal.paidAmount ?? 0) / (portal.budget ?? 1)) * 100)}%` }}
                                    />
                                </div>
                                <div className="flex justify-between mt-3 px-1">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">Received</span>
                                        <span className="text-sm font-bold text-neutral-900 dark:text-white">€{(portal.paidAmount ?? 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">Total Budget</span>
                                        <span className="text-sm font-bold text-neutral-500">€{(portal.budget ?? 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Tasks - Main Area */}
                    <div className="lg:col-span-1 h-[500px]">
                        <TaskManager portalId={portal.id} initialTasks={portal.tasks} readOnly />
                    </div>

                    {/* Timeline & Messaging */}
                    <div className="lg:col-span-1 space-y-8">
                        <div className="bg-neutral-50 dark:bg-white/5 rounded-[2.5rem] border border-neutral-200 dark:border-white/5 p-8">
                            <h3 className="text-2xl font-bold mb-8 text-neutral-900 dark:text-white">Recent Updates</h3>
                            <div className="space-y-8 max-h-[400px] overflow-y-auto custom-scrollbar pr-4">
                                {portal.updates.length === 0 && <p className="text-neutral-500 italic text-sm">{t('noUpdates')}</p>}
                                {portal.updates.map((update: any) => (
                                    <div key={update.id} className="relative pl-6 border-l border-[#d35400]/20 pb-8 last:pb-0 overflow-hidden group">
                                        <div className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 bg-[#d35400] rounded-full ring-4 ring-[#d35400]/10 transition-transform group-hover:scale-125" />
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-neutral-900 dark:text-white group-hover:text-[#d35400] transition-colors">{update.title}</h4>
                                            <span className="text-[10px] font-mono text-neutral-400 uppercase">{new Date(update.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed break-words">{update.content}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <ChatBox
                            portalId={portal.id}
                            initialMessages={portal.messages.map((msg: any) => ({
                                ...msg,
                                createdAt: new Date(msg.createdAt).toISOString()
                            }))}
                            currentUserType="CLIENT"
                        />
                    </div>

                    {/* Media & Documents */}
                    <div className="lg:col-span-1 space-y-8">
                        <MediaManager
                            portalId={portal.id}
                            initialMedia={portal.media}
                            readOnly
                        />
                        <div className="h-[400px]">
                            <DocumentManager portalId={portal.id} initialDocs={portal.documents} readOnly />
                        </div>

                        {/* Contact Card */}
                        <div className="glass-morphism p-6 rounded-3xl border border-neutral-200 dark:border-white/5 bg-white dark:bg-white/5 shadow-sm">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-4">Project Manager</h3>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-[#d35400] text-white rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg shadow-[#d35400]/20">
                                    FM
                                </div>
                                <div>
                                    <p className="font-bold text-neutral-900 dark:text-white text-lg">Florin M</p>
                                    <a href="mailto:info@coral-group.be" className="text-sm text-[#d35400] font-bold hover:underline transition-all">info@coral-group.be</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
