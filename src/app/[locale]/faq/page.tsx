"use client";

import Logo from '@/components/Logo';
import { ArrowLeft, HelpCircle, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

const FAQ_SECTIONS = [
    {
        title: "Getting Started",
        items: [
            {
                q: "What is CoralOS?",
                a: "CoralOS is an all-in-one cloud ERP platform built for construction, renovation, and field-service businesses. It combines invoicing (with Peppol e-invoicing), CRM, project management, HR & workforce scheduling, file management, and more into a single workspace.",
            },
            {
                q: "How do I create an account?",
                a: "Visit app.coral-group.be and click 'Create Account'. You can sign up with your email and password or use Google OAuth. A workspace is automatically created for you upon registration.",
            },
            {
                q: "Is CoralOS free to use?",
                a: "Yes! The FREE plan gives you access to basic invoicing with 5 outgoing and 10 incoming Peppol e-invoices per month, plus 1 user seat. Upgrade to PRO (€29/month) or ENTERPRISE (€79/month) for more features and users.",
            },
            {
                q: "What is the FOUNDER plan?",
                a: "The FOUNDER plan was available to the first 20 beta users. Founders receive a permanent upgrade to PRO-level features at no cost as a thank-you for early adoption.",
            },
        ],
    },
    {
        title: "Invoicing & Peppol",
        items: [
            {
                q: "What is Peppol e-invoicing?",
                a: "Peppol is the European standard for electronic invoicing. It allows you to send and receive legally-compliant e-invoices directly to/from other businesses and government agencies through a secure network. CoralOS supports this natively via e-invoice.be.",
            },
            {
                q: "What are the Peppol limits?",
                a: "FREE: 5 sent / 10 received per month. PRO: 20 sent / 30 received. ENTERPRISE: Unlimited. Additional invoices beyond your limit are billed in packs of 10 at €4.90 per pack.",
            },
            {
                q: "Can I import existing invoices?",
                a: "Yes. CoralOS includes OCR-powered invoice scanning (powered by GPT-4o) that can extract data from uploaded PDF or image files. Your monthly scan quota depends on your plan.",
            },
        ],
    },
    {
        title: "Team & Access",
        items: [
            {
                q: "How many users can I add?",
                a: "FREE: 1 user. PRO: 3 users (1 owner + 2 employees). ENTERPRISE: Unlimited users with full role management (Owner, Manager, Employee, Workforce).",
            },
            {
                q: "What roles are available?",
                a: "Owner — Full workspace control and billing. Manager — Management-level access, can manage team. Employee — Standard access with configurable module permissions. Workforce — Field workers with limited access (time tracker and tasks only).",
            },
            {
                q: "Can I control what each team member sees?",
                a: "Yes! PRO and ENTERPRISE plans include per-module access control. For each user, you can set access to All, Own (only their records), Assigned & Own, or No Access for each module.",
            },
            {
                q: "How do I reset a team member's password?",
                a: "Go to Settings → Team, find the user, and click the key icon. Enter a new password and confirm. The user will need to use the new password on their next login.",
            },
        ],
    },
    {
        title: "Billing & Subscriptions",
        items: [
            {
                q: "How do I upgrade my plan?",
                a: "Go to Settings → Billing and click 'Upgrade'. You'll be redirected to our secure Stripe checkout. Your upgrade takes effect immediately.",
            },
            {
                q: "Can I cancel my subscription?",
                a: "Yes. Go to Settings → Billing and click 'Cancel Subscription'. Your workspace and data remain accessible until the end of your current billing period, then data is retained for 30 days for export.",
            },
            {
                q: "What payment methods do you accept?",
                a: "We accept all major credit/debit cards (Visa, Mastercard, Amex) and SEPA Direct Debit through Stripe. All payments are processed securely — we never store your card details.",
            },
            {
                q: "Is there a free trial?",
                a: "New PRO subscribers get a 3-month free trial. You can cancel anytime during the trial at no cost.",
            },
        ],
    },
    {
        title: "Security & Privacy",
        items: [
            {
                q: "Where is my data stored?",
                a: "All data is stored in the European Union using Neon PostgreSQL (database) and Vercel (hosting). We comply fully with GDPR.",
            },
            {
                q: "Is my data secure?",
                a: "Yes. We use TLS 1.3 encryption for all connections, bcrypt password hashing, strict tenant isolation (your data is never accessible to other users), and automatic session expiry after 30 minutes of inactivity.",
            },
            {
                q: "Can I export my data?",
                a: "PRO and Enterprise plan users can export contacts, invoices, expenses, and other database records to CSV directly from the platform. Free plan users can request a CSV or Excel export by contacting support@coral-group.be — we'll prepare the file for you, usually within one business day.",
            },
            {
                q: "Can I import data from CSV or Excel?",
                a: "PRO and Enterprise plans include a built-in spreadsheet import tool. If you're on the Free plan, email your CSV or Excel file to support@coral-group.be and our team will import it into your workspace for you.",
            },
        ],
    },
    {
        title: "Support",
        items: [
            {
                q: "How do I contact support?",
                a: "Email us at support@coral-group.be. Enterprise plan customers receive priority support with guaranteed response times.",
            },
            {
                q: "Do you offer onboarding assistance?",
                a: "Enterprise plan customers receive dedicated onboarding support. For all plans, our documentation and this FAQ cover common setup tasks.",
            },
            {
                q: "I found a bug. How do I report it?",
                a: "Email bugs@coral-group.be with a description of the issue, the steps to reproduce it, and any screenshots. We aim to acknowledge all bug reports within 24 hours.",
            },
        ],
    },
];

function FAQItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden transition-all">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-neutral-50 dark:hover:bg-white/[0.03] transition-colors"
            >
                <span className="text-sm font-bold text-neutral-900 dark:text-white">{q}</span>
                <ChevronDown className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="px-5 pb-4 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed border-t border-neutral-100 dark:border-white/5 pt-3">
                    {a}
                </div>
            )}
        </div>
    );
}

export default function FAQPage() {
    return (
        <div className="min-h-screen bg-[#f9fafb] dark:bg-neutral-950">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-200 dark:border-white/10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8"><Logo /></div>
                        <span className="text-lg font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">CoralOS</span>
                    </div>
                    <Link href="/login" className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Login
                    </Link>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-12">
                <div className="flex items-center gap-3 mb-2">
                    <HelpCircle className="w-7 h-7 text-orange-600" />
                    <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Frequently Asked Questions</h1>
                </div>
                <p className="text-sm text-neutral-500 mb-10">Everything you need to know about CoralOS</p>

                <div className="space-y-10">
                    {FAQ_SECTIONS.map((section) => (
                        <div key={section.title}>
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">{section.title}</h2>
                            <div className="space-y-2">
                                {section.items.map((item) => (
                                    <FAQItem key={item.q} q={item.q} a={item.a} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-12 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 text-center">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Still have questions?</h2>
                    <p className="text-sm text-neutral-500 mb-4">Our team is ready to help.</p>
                    <a
                        href="mailto:support@coral-group.be"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-colors text-sm shadow-lg shadow-orange-600/20"
                    >
                        Contact Support
                    </a>
                </div>
            </main>
        </div>
    );
}
