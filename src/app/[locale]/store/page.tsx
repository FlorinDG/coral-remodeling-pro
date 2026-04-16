"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import {
    FileText, Users, Send, Database, Calendar, Shield,
    Check, ArrowRight, Zap, Building2, Mail, ChevronDown,
    BarChart3, Package, Clock, Star, Globe, Lock
} from 'lucide-react';

// ── Pricing plans ──────────────────────────────────────────────────────────────

const PLANS = [
    {
        id: 'free',
        name: 'Free',
        price: '€0',
        period: '/maand',
        tagline: 'Gratis voor altijd',
        highlight: false,
        badge: null,
        features: [
            '5 klanten',
            '5 verzonden Peppol-facturen/maand',
            '10 ontvangen Peppol-facturen/maand',
            'PDF-facturen & offertes',
            'CRM basis',
            'Community support',
        ],
        cta: 'Gratis starten',
        ctaHref: '/login',
    },
    {
        id: 'pro',
        name: 'Pro',
        price: '€29',
        period: '/maand',
        tagline: 'Meest gekozen',
        highlight: true,
        badge: 'POPULAIR',
        features: [
            'Onbeperkte klanten',
            '20 verzonden Peppol-facturen/maand',
            '30 ontvangen Peppol-facturen/maand',
            'Alle Free functies',
            'Projectbeheer & agenda',
            'Databases & workflows',
            'E-mail integratie',
            'Prioriteitssupport',
        ],
        cta: 'Pro starten',
        ctaHref: '/login',
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        price: 'Op maat',
        period: '',
        tagline: 'Voor grotere teams',
        highlight: false,
        badge: null,
        features: [
            'Onbeperkt alles',
            'Multi-gebruiker workspace',
            'Aangepaste modules',
            'SLA-garantie',
            'Dedicated onboarding',
            'API-toegang',
        ],
        cta: 'Contact opnemen',
        ctaHref: 'mailto:info@coral-group.be',
    },
];

const FEATURES = [
    {
        icon: FileText,
        title: 'Professionele Facturatie',
        desc: 'Automatische BTW-berekening, PDF-generatie, multi-taal en meerdere tarieven (21%/6%/0%).',
        color: 'blue',
    },
    {
        icon: Send,
        title: 'Peppol E-facturatie',
        desc: 'Compliant met Belgische e-facturatieregelgeving. UBL-conforme facturen via het Peppol-netwerk.',
        color: 'indigo',
    },
    {
        icon: Users,
        title: 'CRM & Contacten',
        desc: 'B2B & B2C klantenbeheer, leveranciers, prospects en architect-partners onder één dak.',
        color: 'violet',
    },
    {
        icon: Database,
        title: 'Notion-achtige Databases',
        desc: 'Flexibele databases met aanpasbare kolommen, filters, bord- en kalenderweergaven.',
        color: 'purple',
    },
    {
        icon: BarChart3,
        title: 'Projectbeheer',
        desc: 'Budgetten, uitvoeringstoestand, Gantt-planning en bouwbestek-integratie.',
        color: 'fuchsia',
    },
    {
        icon: Package,
        title: 'Artikelbibliotheek',
        desc: 'Centraal materiaalbeheer met prijsberekening, varianten, marges en leverancierskoppeling.',
        color: 'pink',
    },
    {
        icon: Clock,
        title: 'Tijdregistratie',
        desc: 'Eenvoudige urenregistratie per project of taak, met exportmogelijkheden.',
        color: 'rose',
    },
    {
        icon: Shield,
        title: 'Enterprise Beveiliging',
        desc: 'EU-dataopslag, geïsoleerde workspaces, versleuteling en automatische sessie-timeout.',
        color: 'emerald',
    },
];

const TESTIMONIALS = [
    {
        name: 'Marc V.',
        role: 'Zaakvoerder renovatiebedrijf',
        text: 'CoralOS heeft onze facturatie compleet vereenvoudigd. Peppol-integratie is goud waard.',
        stars: 5,
    },
    {
        name: 'Sophie D.',
        role: 'Binnenhuis architect',
        text: 'Eindelijk een platform dat alles combineert: offertes, facturen én klantbeheer. Top!',
        stars: 5,
    },
    {
        name: 'Thomas B.',
        role: 'Aannemer Antwerpen',
        text: 'De FOUNDER-deal was een stap die ik geen seconde betreur. Uitstekend product.',
        stars: 5,
    },
];

function FAQItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border border-white/10 rounded-xl overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors"
            >
                <span className="font-medium text-white text-sm">{q}</span>
                <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform shrink-0 ml-4 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="px-5 pb-4 text-sm text-neutral-400 leading-relaxed border-t border-white/5 pt-3">
                    {a}
                </div>
            )}
        </div>
    );
}

const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400',
    indigo: 'bg-indigo-500/10 text-indigo-400',
    violet: 'bg-violet-500/10 text-violet-400',
    purple: 'bg-purple-500/10 text-purple-400',
    fuchsia: 'bg-fuchsia-500/10 text-fuchsia-400',
    pink: 'bg-pink-500/10 text-pink-400',
    rose: 'bg-rose-500/10 text-rose-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
};

export default function StorePage() {
    return (
        <div className="min-h-screen bg-[#0a0a12] text-white overflow-x-hidden">

            {/* ── Nav ─────────────────────────────────────────────────────── */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a12]/80 backdrop-blur-xl border-b border-white/[0.06]">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8"><Logo /></div>
                        <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                            CoralOS
                        </span>
                    </div>
                    <div className="hidden md:flex items-center gap-6 text-sm text-neutral-400">
                        <a href="#features" className="hover:text-white transition-colors">Functies</a>
                        <a href="#pricing" className="hover:text-white transition-colors">Prijzen</a>
                        <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
                        <a href="https://www.coral-group.be" className="hover:text-white transition-colors flex items-center gap-1">
                            <Globe className="w-3.5 h-3.5" />
                            coral-group.be
                        </a>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/login" className="text-sm text-neutral-400 hover:text-white transition-colors px-4 py-2">
                            Inloggen
                        </Link>
                        <Link
                            href="/login"
                            className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-lg transition-all shadow-lg shadow-blue-600/20"
                        >
                            Gratis starten
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ── Hero ────────────────────────────────────────────────────── */}
            <section className="relative pt-32 pb-24 px-6 text-center overflow-hidden">
                {/* Background glow */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-blue-600/20 to-transparent rounded-full blur-3xl" />
                </div>

                <div className="relative max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-8">
                        <Zap className="w-3.5 h-3.5" />
                        Belgische e-facturatie · Klaar voor 2026
                    </div>

                    <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6">
                        Het{' '}
                        <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
                            alles-in-één
                        </span>
                        {' '}platform voor aannemers
                    </h1>

                    <p className="text-xl text-neutral-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                        Facturatie, Peppol e-invoicing, CRM, projectbeheer en databases —
                        alles in één werkruimte. Gebouwd voor Belgische bouwbedrijven en aannemers.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link
                            href="/login"
                            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-8 py-4 rounded-xl transition-all shadow-2xl shadow-blue-600/30 text-base"
                        >
                            Gratis starten
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                        <a
                            href="#pricing"
                            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-base font-medium px-6 py-4"
                        >
                            Bekijk prijzen
                        </a>
                    </div>

                    {/* Trust indicators */}
                    <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-xs text-neutral-500">
                        <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" />EU-dataopslag</span>
                        <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" />Geen creditcard nodig</span>
                        <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" />Peppol-gecertificeerd</span>
                        <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" />GDPR-compliant</span>
                        <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-emerald-400" />SOC2-ready</span>
                    </div>
                </div>
            </section>

            {/* ── Social proof ────────────────────────────────────────────── */}
            <section className="py-12 px-6 border-y border-white/[0.06] bg-white/[0.02]">
                <div className="max-w-5xl mx-auto">
                    <p className="text-center text-xs text-neutral-500 uppercase tracking-widest mb-8">
                        Vertrouwd door Belgische aannemers
                    </p>
                    <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-4">
                        {['Renovatie', 'Architectuur', 'Interieur', 'Elektriciteit', 'Sanitair', 'Schrijnwerk'].map(sector => (
                            <div key={sector} className="flex items-center gap-2 text-neutral-600 text-sm">
                                <Building2 className="w-4 h-4" />
                                <span>{sector}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Features ────────────────────────────────────────────────── */}
            <section id="features" className="py-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            Alles wat je nodig hebt,{' '}
                            <span className="text-neutral-400">niets wat je niet nodig hebt</span>
                        </h2>
                        <p className="text-neutral-500 max-w-xl mx-auto">
                            CoralOS combineert krachtige modules in één samenhangend platform — zonder complexiteit.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {FEATURES.map(f => (
                            <div
                                key={f.title}
                                className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 hover:bg-white/[0.06] hover:border-white/10 transition-all group"
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${colorMap[f.color]}`}>
                                    <f.icon className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-white text-sm mb-2">{f.title}</h3>
                                <p className="text-xs text-neutral-500 leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Peppol highlight ────────────────────────────────────────── */}
            <section className="py-20 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="relative bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-3xl p-10 md:p-14 overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-600/20 to-transparent blur-3xl pointer-events-none" />
                        <div className="relative max-w-2xl">
                            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-6">
                                <Send className="w-3 h-3" />
                                Peppol · Verplicht vanaf 2026
                            </div>
                            <h2 className="text-3xl font-bold mb-4">
                                Klaar voor Belgische e-facturatieplicht
                            </h2>
                            <p className="text-neutral-400 leading-relaxed mb-6">
                                Vanaf 1 januari 2026 is e-facturatie via Peppol verplicht voor alle B2B-transacties in België.
                                CoralOS genereert automatisch UBL-conforme facturen en verstuurt ze via het officiële netwerk —
                                zodat jij er geen seconde aan hoeft te denken.
                            </p>
                            <ul className="space-y-3 mb-8">
                                {[
                                    'Automatische UBL 2.1 generatie',
                                    'Verzenden én ontvangen via Peppol',
                                    'Belgische BTW-validatie inbegrepen',
                                    'Conform e-invoicing.be standaarden',
                                ].map(item => (
                                    <li key={item} className="flex items-center gap-3 text-sm text-neutral-300">
                                        <Check className="w-4 h-4 text-blue-400 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 text-sm"
                            >
                                Start nu gratis
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Testimonials ────────────────────────────────────────────── */}
            <section className="py-20 px-6 bg-white/[0.015]">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-2xl font-bold text-center mb-12">Wat onze klanten zeggen</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {TESTIMONIALS.map(t => (
                            <div key={t.name} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
                                <div className="flex gap-0.5 mb-4">
                                    {Array.from({ length: t.stars }).map((_, i) => (
                                        <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                                    ))}
                                </div>
                                <p className="text-sm text-neutral-300 leading-relaxed mb-5">"{t.text}"</p>
                                <div>
                                    <p className="text-sm font-semibold text-white">{t.name}</p>
                                    <p className="text-xs text-neutral-500">{t.role}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Pricing ─────────────────────────────────────────────────── */}
            <section id="pricing" className="py-24 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Eenvoudige, transparante prijzen</h2>
                        <p className="text-neutral-500">Geen verborgen kosten. Upgrade of downgrade op elk moment.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {PLANS.map(plan => (
                            <div
                                key={plan.id}
                                className={`relative rounded-2xl p-7 flex flex-col ${plan.highlight
                                    ? 'bg-gradient-to-b from-blue-600/20 to-indigo-600/10 border-2 border-blue-500/40 shadow-2xl shadow-blue-600/10'
                                    : 'bg-white/[0.03] border border-white/[0.07]'
                                }`}
                            >
                                {plan.badge && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                                        {plan.badge}
                                    </div>
                                )}
                                <div className="mb-6">
                                    <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                                    <p className="text-xs text-neutral-500 mb-4">{plan.tagline}</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                                        <span className="text-neutral-400 text-sm">{plan.period}</span>
                                    </div>
                                </div>
                                <ul className="space-y-3 mb-8 flex-1">
                                    {plan.features.map(f => (
                                        <li key={f} className="flex items-start gap-2.5 text-sm text-neutral-300">
                                            <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlight ? 'text-blue-400' : 'text-emerald-400'}`} />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                <a
                                    href={plan.ctaHref}
                                    className={`w-full text-center font-bold py-3 rounded-xl transition-all text-sm ${plan.highlight
                                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                                        : 'bg-white/10 hover:bg-white/15 text-white'
                                    }`}
                                >
                                    {plan.cta}
                                </a>
                            </div>
                        ))}
                    </div>

                    {/* FOUNDER note */}
                    <div className="mt-8 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-6 text-center">
                        <p className="text-amber-400 font-bold text-sm mb-1">🏆 FOUNDER Programma — Nog beschikbaar</p>
                        <p className="text-neutral-400 text-sm">
                            De eerste 20 gebruikers krijgen een gratis FOUNDER-account met volledige toegang, zonder Peppol-limieten —
                            voor altijd. <Link href="/login" className="text-amber-400 hover:underline font-semibold">Registreer nu</Link>.
                        </p>
                    </div>
                </div>
            </section>

            {/* ── FAQ ─────────────────────────────────────────────────────── */}
            <section id="faq" className="py-20 px-6 bg-white/[0.015]">
                <div className="max-w-2xl mx-auto">
                    <h2 className="text-2xl font-bold text-center mb-10">Veelgestelde vragen</h2>
                    <div className="space-y-2">
                        <FAQItem q="Is CoralOS gratis?" a="Ja! Het Free-plan is volledig gratis en bevat alle basisfuncties inclusief Peppol e-facturatie. Geen creditcard nodig om te starten." />
                        <FAQItem q="Wat is Peppol en waarom is het verplicht?" a="Peppol is het Europese netwerk voor gestructureerde elektronische facturatie. Vanaf 1 januari 2026 is dit verplicht voor alle B2B-transacties in België. CoralOS is volledig Peppol-klaar." />
                        <FAQItem q="Wat is een FOUNDER-account?" a="De eerste 20 gebruikers van CoralOS krijgen een FOUNDER-account: gratis, volledige toegang, geen Peppol-limieten — voor altijd. Bij de lancering van betalende plannen worden FOUNDERs automatisch Pro." />
                        <FAQItem q="Kan ik mijn bestaande data importeren?" a="Ja, CoralOS ondersteunt import van klanten en factuurdata via CSV. Voor specifieke migraties neem je contact op met ons support-team." />
                        <FAQItem q="Waar wordt mijn data opgeslagen?" a="Al je data wordt opgeslagen in de EU (Duitsland). Elke workspace is strikt geïsoleerd en GDPR-compliant." />
                        <FAQItem q="Hoe neem ik contact op?" a="Stuur een e-mail naar info@coral-group.be. We reageren binnen 24 uur op werkdagen." />
                    </div>
                </div>
            </section>

            {/* ── CTA Bottom ──────────────────────────────────────────────── */}
            <section className="py-24 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <div className="relative bg-gradient-to-br from-blue-600/15 to-indigo-600/15 border border-blue-500/15 rounded-3xl p-12 overflow-hidden">
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-gradient-to-t from-blue-600/20 to-transparent blur-3xl" />
                        </div>
                        <div className="relative">
                            <h2 className="text-3xl font-bold mb-4">
                                Klaar om te starten?
                            </h2>
                            <p className="text-neutral-400 mb-8">
                                Maak vandaag je gratis account aan. Geen creditcard, geen commitment.
                            </p>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-8 py-4 rounded-xl transition-all shadow-2xl shadow-blue-600/30 text-base"
                            >
                                Gratis account aanmaken
                                <ArrowRight className="w-5 h-5" />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Footer ──────────────────────────────────────────────────── */}
            <footer className="border-t border-white/[0.06] py-10 px-6">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6"><Logo /></div>
                        <span className="font-semibold text-neutral-400">CoralOS by Coral Group BV</span>
                    </div>
                    <div className="flex gap-6">
                        <Link href="/help" className="hover:text-white transition-colors">Help</Link>
                        <Link href="/terms" className="hover:text-white transition-colors">Voorwaarden</Link>
                        <a href="mailto:info@coral-group.be" className="hover:text-white transition-colors">
                            <Mail className="w-4 h-4 inline mr-1" />info@coral-group.be
                        </a>
                        <a href="https://www.coral-group.be" className="hover:text-white transition-colors flex items-center gap-1">
                            <Globe className="w-3.5 h-3.5" />coral-group.be
                        </a>
                    </div>
                    <span>© {new Date().getFullYear()} Coral Group BV</span>
                </div>
            </footer>
        </div>
    );
}
