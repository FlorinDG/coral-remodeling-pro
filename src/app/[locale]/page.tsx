import { Link } from "@/i18n/routing";
import { getTranslations } from 'next-intl/server';
import { Metadata } from 'next';
import { ArrowRight, Box, Shield, Zap, Users, FileText, BarChart3 } from "lucide-react";

export const dynamic = 'force-dynamic';

const HEADER_HEIGHT = '5rem'; // 80px — keep in sync with header className h-20

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    return {
        title: "Coral SaaS | Advanced Construction & Trade ERP",
        description: "The complete platform for modern contractors to manage projects, invoices, and clients in one unified workspace.",
        alternates: {
            canonical: `https://app.coral-group.be/${locale}`,
        },
    };
}

export default async function SaasLandingPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;

    return (
        <div className="min-h-screen bg-white dark:bg-black text-neutral-900 dark:text-white flex flex-col font-sans">
            {/* ─── SaaS Header ─── */}
            <header className="h-20 shrink-0 sticky top-0 z-50 bg-neutral-950 border-b border-neutral-800 shadow-lg shadow-black/20">
                <div className="h-full flex items-center justify-between px-6 md:px-8 max-w-7xl mx-auto w-full">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold text-xl">
                            C
                        </div>
                        <span className="font-extrabold tracking-tight text-xl text-white">Coral SaaS</span>
                    </div>
                    <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-neutral-400">
                        <a href="#features" className="hover:text-white transition-colors">Features</a>
                        <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
                        <Link href="/login" className="text-red-500 hover:text-red-400 transition-colors">Client Login</Link>
                    </nav>
                    {/* Mobile hamburger placeholder — just the login CTA for now */}
                    <div className="flex md:hidden">
                        <Link href="/login" className="text-sm font-bold text-red-500">Login</Link>
                    </div>
                </div>
            </header>

            {/* ─── Hero Section ─── */}
            {/* On desktop the hero fills the remaining viewport height below the header.
                Vertical padding uses calc() so the whitespace adapts to the screen. */}
            <main
                className="flex flex-col items-center justify-center text-center px-6 max-w-5xl mx-auto w-full"
                style={{
                    minHeight: `calc(100vh - ${HEADER_HEIGHT})`,
                    paddingTop: `calc((100vh - ${HEADER_HEIGHT}) * 0.08)`,
                    paddingBottom: `calc((100vh - ${HEADER_HEIGHT}) * 0.06)`,
                }}
            >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold tracking-widest uppercase mb-6 md:mb-8 border border-red-100 dark:border-red-500/20">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                    BETA Access Available
                </div>

                <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tighter leading-[1.1] mb-6 md:mb-8">
                    The Operating System for <br className="hidden sm:block" />
                    <span className="text-red-600">Modern Contractors.</span>
                </h1>

                <p className="text-base sm:text-lg md:text-xl text-neutral-500 max-w-2xl mb-8 md:mb-12 leading-relaxed">
                    Unify your lead generation, project management, invoicing, and client communications into one seamlessly isolated workspace.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
                    <Link href="/login" className="h-12 sm:h-14 px-8 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity w-full sm:w-auto shadow-xl shadow-black/10 dark:shadow-white/10">
                        Access Workspace <ArrowRight className="w-5 h-5" />
                    </Link>
                    <button className="h-12 sm:h-14 px-8 rounded-xl border-2 border-neutral-200 dark:border-white/10 font-bold flex items-center justify-center hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors w-full sm:w-auto">
                        Book Demo
                    </button>
                </div>
            </main>

            {/* ─── Features Grid ─── */}
            <section id="features" className="py-16 md:py-24 bg-neutral-50 dark:bg-white/5 border-t border-neutral-100 dark:border-white/10">
                <div className="max-w-7xl mx-auto px-6 md:px-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                        <div className="bg-white dark:bg-black p-6 md:p-8 rounded-2xl border border-neutral-200 dark:border-white/10 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6">
                                <Box className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg md:text-xl font-bold mb-3">Multi-Tenant Architecture</h3>
                            <p className="text-neutral-500 leading-relaxed text-sm md:text-base">Strict data isolation ensures your client portals, invoices, and drive uploads are cryptographically bound to your specific workspace.</p>
                        </div>

                        <div className="bg-white dark:bg-black p-6 md:p-8 rounded-2xl border border-neutral-200 dark:border-white/10 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 flex items-center justify-center text-green-600 dark:text-green-400 mb-6">
                                <Shield className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg md:text-xl font-bold mb-3">Enterprise Grade Security</h3>
                            <p className="text-neutral-500 leading-relaxed text-sm md:text-base">Protected by advanced Edge middleware routing, session validation, and native Google Cloud Identity integration.</p>
                        </div>

                        <div className="bg-white dark:bg-black p-6 md:p-8 rounded-2xl border border-neutral-200 dark:border-white/10 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 mb-6">
                                <Zap className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg md:text-xl font-bold mb-3">Automated Workflows</h3>
                            <p className="text-neutral-500 leading-relaxed text-sm md:text-base">Transform public website leads directly into bound Client Portals and emit localized Peppol UBL invoices instantly.</p>
                        </div>

                        <div className="bg-white dark:bg-black p-6 md:p-8 rounded-2xl border border-neutral-200 dark:border-white/10 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 mb-6">
                                <Users className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg md:text-xl font-bold mb-3">Client Portals</h3>
                            <p className="text-neutral-500 leading-relaxed text-sm md:text-base">Give every client a branded, self-service portal where they can view progress photos, approve quotations, and download invoices in real time.</p>
                        </div>

                        <div className="bg-white dark:bg-black p-6 md:p-8 rounded-2xl border border-neutral-200 dark:border-white/10 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-100 dark:border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400 mb-6">
                                <FileText className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg md:text-xl font-bold mb-3">Smart Invoicing</h3>
                            <p className="text-neutral-500 leading-relaxed text-sm md:text-base">Generate compliant Peppol UBL e-invoices, track payments, and automate reminders — all from one unified financial dashboard.</p>
                        </div>

                        <div className="bg-white dark:bg-black p-6 md:p-8 rounded-2xl border border-neutral-200 dark:border-white/10 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-6">
                                <BarChart3 className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg md:text-xl font-bold mb-3">Real-time Analytics</h3>
                            <p className="text-neutral-500 leading-relaxed text-sm md:text-base">Monitor project profitability, team utilisation, and revenue forecasts with dashboards that update the moment your data changes.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Footer ─── */}
            <footer className="bg-neutral-950 text-neutral-400 border-t border-neutral-800">
                <div className="max-w-7xl mx-auto px-6 md:px-8 py-16 md:py-20">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 md:gap-8 mb-14">
                        {/* Brand */}
                        <div className="sm:col-span-2 md:col-span-1">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold text-xl">
                                    C
                                </div>
                                <span className="font-extrabold tracking-tight text-lg text-white">Coral SaaS</span>
                            </div>
                            <p className="text-sm leading-relaxed max-w-xs">
                                The complete operating system for modern contractors. Manage projects, invoices, and clients in one unified workspace.
                            </p>
                        </div>

                        {/* Product */}
                        <div>
                            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">Product</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Changelog</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                            </ul>
                        </div>

                        {/* Company */}
                        <div>
                            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">Company</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                            </ul>
                        </div>

                        {/* Legal */}
                        <div>
                            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">Legal</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Cookie Policy</a></li>
                            </ul>
                        </div>
                    </div>

                    {/* SEO Description */}
                    <div className="mb-14 text-center max-w-3xl mx-auto">
                        <p className="text-sm leading-relaxed text-neutral-500">
                            Coral SaaS is a cloud-native construction management platform built for contractors, renovation firms, and trade professionals across Belgium and Europe. From automated Peppol UBL e-invoicing and real-time project Gantt timelines to secure multi-tenant client portals, Coral replaces fragmented spreadsheets and legacy tools with a single, audit-ready workspace — so you can focus on building, not on administration.
                        </p>
                    </div>

                    {/* Bottom bar */}
                    <div className="pt-8 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-xs text-neutral-500">
                            &copy; {new Date().getFullYear()} Coral Enterprises. All Rights Reserved.
                        </p>
                        <div className="flex items-center gap-6 text-xs text-neutral-500">
                            <span>BE 1234.567.890</span>
                            <span className="hidden sm:inline">•</span>
                            <span>info@coral-group.be</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
