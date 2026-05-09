"use client";

import Logo from '@/components/Logo';
import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';

export default function EULAPage() {
    return (
        <div className="min-h-screen bg-[#f9fafb] dark:bg-neutral-950">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-200 dark:border-white/10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8"><Logo /></div>
                        <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">CoralOS</span>
                    </div>
                    <Link href="/login" className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Login
                    </Link>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-12">
                <div className="flex items-center gap-3 mb-2">
                    <FileText className="w-7 h-7 text-blue-600" />
                    <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">End User License Agreement</h1>
                </div>
                <p className="text-sm text-neutral-500 mb-10">Last updated: 15 April 2026</p>

                <div className="space-y-8 text-neutral-700 dark:text-neutral-300 text-[15px] leading-relaxed">

                    <section className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-2xl p-6">
                        <p className="font-bold text-blue-900 dark:text-blue-300">
                            IMPORTANT — READ CAREFULLY: By creating an account or using the CoralOS platform, you agree to be bound by this End User License Agreement (&quot;EULA&quot;). If you do not agree, you may not use the platform.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">1. License Grant</h2>
                        <p>Subject to the terms of this Agreement, Coral Group BV grants you a limited, non-exclusive, non-transferable, revocable license to access and use the CoralOS platform (&quot;Software&quot;) for your internal business operations during the term of your active subscription.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">2. Restrictions</h2>
                        <p className="mb-2">You may NOT:</p>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>Copy, modify, distribute, or create derivative works of the Software</li>
                            <li>Reverse engineer, decompile, or disassemble any part of the Software</li>
                            <li>Sublicense, rent, lease, or lend access to the Software</li>
                            <li>Use the Software for illegal purposes or to process illegal content</li>
                            <li>Circumvent any technical limitations or security measures</li>
                            <li>Use automated tools to scrape data or overload the platform</li>
                            <li>Share your account credentials with unauthorized users</li>
                            <li>Resell the Software or offer it as a service to third parties</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">3. Ownership</h2>
                        <p>The Software, including all code, design, trademarks, and documentation, remains the exclusive intellectual property of Coral Group BV. This EULA does not grant you any ownership rights. Your business data within your workspace remains your property.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">4. Account Responsibilities</h2>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>You are responsible for all activity under your account</li>
                            <li>You must maintain the confidentiality of your login credentials</li>
                            <li>You must provide accurate and complete registration information</li>
                            <li>Workspace owners are responsible for managing team member access</li>
                            <li>You must notify us immediately of any unauthorized use of your account</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">5. Service Availability</h2>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>The platform is provided &quot;as-is&quot; without guarantee of 100% uptime</li>
                            <li>We target 99.9% availability but planned maintenance may cause brief interruptions</li>
                            <li>We reserve the right to modify, suspend, or discontinue features with reasonable notice</li>
                            <li>Critical security updates may be applied without prior notice</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">6. Termination</h2>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>You may terminate your account at any time via Settings → Billing</li>
                            <li>We may suspend or terminate your account for breach of this EULA</li>
                            <li>Upon termination, your data is retained for 30 days for export, then permanently deleted</li>
                            <li>Sections 2, 3, 7, and 8 survive termination</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">7. Limitation of Liability</h2>
                        <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, CORAL GROUP BV SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT PAID BY YOU IN THE PRECEDING 3 MONTHS.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">8. Governing Law</h2>
                        <p>This EULA is governed by Belgian law. Any disputes shall be submitted to the exclusive jurisdiction of the courts of Brussels, Belgium.</p>
                    </section>

                    <section className="bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-white/10 rounded-2xl p-6">
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">Contact</h2>
                        <p>For questions about this EULA:</p>
                        <ul className="mt-2 space-y-1">
                            <li><strong>Email:</strong> legal@coral-group.be</li>
                            <li><strong>Website:</strong> www.coral-group.be</li>
                        </ul>
                    </section>
                </div>
            </main>
        </div>
    );
}
