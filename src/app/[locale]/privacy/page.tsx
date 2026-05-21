"use client";

import Logo from '@/components/Logo';
import { ArrowLeft, Shield } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
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
                    <Shield className="w-7 h-7 text-orange-600" />
                    <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Privacy Policy</h1>
                </div>
                <p className="text-sm text-neutral-500 mb-10">Last updated: 15 April 2026</p>

                <div className="space-y-8 text-neutral-700 dark:text-neutral-300 text-[15px] leading-relaxed">

                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">1. Data Controller</h2>
                        <p>Coral Group BV (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), with registered office in Belgium, is the data controller for all personal data processed through the CoralOS platform (app.coral-group.be).</p>
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            <li><strong>Email:</strong> privacy@coral-group.be</li>
                            <li><strong>Website:</strong> www.coral-group.be</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">2. Data We Collect</h2>
                        <p className="mb-3">We collect only data necessary to provide our services:</p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden">
                                <thead>
                                    <tr className="bg-neutral-100 dark:bg-white/5">
                                        <th className="text-left px-4 py-3 font-bold">Category</th>
                                        <th className="text-left px-4 py-3 font-bold">Data</th>
                                        <th className="text-left px-4 py-3 font-bold">Purpose</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-200 dark:divide-white/10">
                                    <tr>
                                        <td className="px-4 py-3 font-medium">Account</td>
                                        <td className="px-4 py-3">Name, email, password (hashed)</td>
                                        <td className="px-4 py-3">Authentication &amp; workspace access</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 font-medium">Business</td>
                                        <td className="px-4 py-3">Company name, VAT number, address</td>
                                        <td className="px-4 py-3">Invoicing &amp; Peppol e-invoicing</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 font-medium">Usage</td>
                                        <td className="px-4 py-3">Feature usage, session data</td>
                                        <td className="px-4 py-3">Service improvement &amp; support</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 font-medium">Payment</td>
                                        <td className="px-4 py-3">Stripe customer ID (no card data stored)</td>
                                        <td className="px-4 py-3">Subscription billing</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">3. Legal Basis (GDPR Art. 6)</h2>
                        <ul className="list-disc pl-6 space-y-1">
                            <li><strong>Contract performance</strong> — Processing necessary to provide the SaaS service</li>
                            <li><strong>Legitimate interest</strong> — Security, fraud prevention, service improvement</li>
                            <li><strong>Legal obligation</strong> — Tax and invoicing compliance (Belgian law)</li>
                            <li><strong>Consent</strong> — Marketing communications (opt-in only)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">4. Data Storage &amp; Security</h2>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>All data is stored in the EU (Neon PostgreSQL, Vercel Edge Network)</li>
                            <li>Passwords are hashed using bcrypt — never stored in plaintext</li>
                            <li>All connections use TLS 1.3 encryption</li>
                            <li>Each tenant workspace is strictly isolated — no cross-tenant data access</li>
                            <li>Sessions expire after 30 minutes of inactivity or 8 hours absolute maximum</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">5. Third-Party Processors</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden">
                                <thead>
                                    <tr className="bg-neutral-100 dark:bg-white/5">
                                        <th className="text-left px-4 py-3 font-bold">Provider</th>
                                        <th className="text-left px-4 py-3 font-bold">Purpose</th>
                                        <th className="text-left px-4 py-3 font-bold">Location</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-200 dark:divide-white/10">
                                    <tr><td className="px-4 py-3">Vercel</td><td className="px-4 py-3">Hosting &amp; CDN</td><td className="px-4 py-3">EU / US</td></tr>
                                    <tr><td className="px-4 py-3">Neon</td><td className="px-4 py-3">Database (PostgreSQL)</td><td className="px-4 py-3">EU</td></tr>
                                    <tr><td className="px-4 py-3">Stripe</td><td className="px-4 py-3">Payment processing</td><td className="px-4 py-3">EU / US</td></tr>
                                    <tr><td className="px-4 py-3">Resend</td><td className="px-4 py-3">Transactional emails</td><td className="px-4 py-3">US</td></tr>
                                    <tr><td className="px-4 py-3">e-invoice.be</td><td className="px-4 py-3">Peppol e-invoicing</td><td className="px-4 py-3">Belgium</td></tr>
                                    <tr><td className="px-4 py-3">Google</td><td className="px-4 py-3">OAuth (optional)</td><td className="px-4 py-3">US (SCCs)</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">6. Your Rights (GDPR)</h2>
                        <p className="mb-3">Under the General Data Protection Regulation, you have the right to:</p>
                        <ul className="list-disc pl-6 space-y-1">
                            <li><strong>Access</strong> — Request a copy of your personal data</li>
                            <li><strong>Rectification</strong> — Correct inaccurate or incomplete data</li>
                            <li><strong>Erasure</strong> — Request deletion of your data (&quot;right to be forgotten&quot;)</li>
                            <li><strong>Portability</strong> — Receive your data in a machine-readable format</li>
                            <li><strong>Restriction</strong> — Limit how we process your data</li>
                            <li><strong>Objection</strong> — Object to processing based on legitimate interest</li>
                        </ul>
                        <p className="mt-3">To exercise any of these rights, contact us at <strong>privacy@coral-group.be</strong>. We will respond within 30 days.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">7. Data Retention</h2>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>Active accounts: data retained for the duration of the subscription</li>
                            <li>Cancelled accounts: data retained for 30 days, then permanently deleted</li>
                            <li>Invoicing data: retained for 7 years (Belgian tax law requirement)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">8. Cookies</h2>
                        <p>We use essential cookies only for authentication and session management. We do not use advertising or tracking cookies. No third-party analytics scripts are loaded.</p>
                    </section>

                    <section className="bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-white/10 rounded-2xl p-6">
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">Contact &amp; Complaints</h2>
                        <p>For privacy-related inquiries or to file a complaint:</p>
                        <ul className="mt-2 space-y-1">
                            <li><strong>Email:</strong> privacy@coral-group.be</li>
                            <li><strong>Supervisory authority:</strong> Belgian Data Protection Authority (GBA/APD) — <a href="https://www.gegevensbeschermingsautoriteit.be" className="text-orange-500 hover:underline" target="_blank" rel="noopener">www.gegevensbeschermingsautoriteit.be</a></li>
                        </ul>
                    </section>
                </div>
            </main>
        </div>
    );
}
