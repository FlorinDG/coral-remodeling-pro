"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Logo from '@/components/Logo';
import {
    FileText, Users, Send, Database, Calendar, Shield,
    Check, ArrowRight, Zap, Building2, Mail, ChevronDown,
    BarChart3, Package, Clock, Star, Globe, Lock
} from 'lucide-react';

// ── Translations ───────────────────────────────────────────────────────────────

const T = {
    nl: {
        tagline: 'Belgische e-facturatie · Klaar voor 2026',
        heroTitle1: 'Het',
        heroGradient: 'alles-in-één',
        heroTitle2: 'platform voor aannemers',
        heroSub: 'Facturatie, Peppol e-invoicing, CRM, projectbeheer en databases — alles in één werkruimte. Gebouwd voor Belgische bouwbedrijven en aannemers.',
        ctaPrimary: 'Gratis starten',
        ctaSub: 'Bekijk prijzen',
        trust: ['EU-dataopslag', 'Geen creditcard nodig', 'Peppol-gecertificeerd', 'GDPR-compliant', 'SOC2-ready'],
        trustedBy: 'Vertrouwd door Belgische aannemers',
        sectors: ['Renovatie', 'Architectuur', 'Interieur', 'Elektriciteit', 'Sanitair', 'Schrijnwerk'],
        featuresTitle: 'Alles wat je nodig hebt,',
        featuresSub2: 'niets wat je niet nodig hebt',
        featuresSub: 'CoralOS combineert krachtige modules in één samenhangend platform — zonder complexiteit.',
        peppolBadge: 'Peppol · Verplicht vanaf 2026',
        peppolTitle: 'Klaar voor Belgische e-facturatieplicht',
        peppolSub: 'Vanaf 1 januari 2026 is e-facturatie via Peppol verplicht voor alle B2B-transacties in België. CoralOS genereert automatisch UBL-conforme facturen en verstuurt ze via het officiële netwerk — zodat jij er geen seconde aan hoeft te denken.',
        peppolPoints: ['Automatische UBL 2.1 generatie', 'Verzenden én ontvangen via Peppol', 'Belgische BTW-validatie inbegrepen', 'Conform e-invoicing.be standaarden'],
        peppolCta: 'Start nu gratis',
        testimonials: 'Wat onze klanten zeggen',
        pricingTitle: 'Eenvoudige, transparante prijzen',
        pricingSub: 'Geen verborgen kosten. Upgrade of downgrade op elk moment.',
        founderNote: '🏆 FOUNDER Programma — Nog beschikbaar',
        founderSub: 'De eerste 20 gebruikers krijgen een gratis FOUNDER-account met volledige toegang, zonder Peppol-limieten — voor altijd.',
        founderCta: 'Registreer nu',
        faqTitle: 'Veelgestelde vragen',
        ctaBottomTitle: 'Klaar om te starten?',
        ctaBottomSub: 'Maak vandaag je gratis account aan. Geen creditcard, geen commitment.',
        ctaBottomBtn: 'Gratis account aanmaken',
        login: 'Inloggen',
        nav: { features: 'Functies', pricing: 'Prijzen', faq: 'FAQ' },
        footer: { help: 'Help', terms: 'Voorwaarden', website: 'Website' },
        plans: [
            { id: 'free', name: 'Free', price: '€0', period: '/maand', tagline: 'Gratis voor altijd', badge: null, highlight: false, cta: 'Gratis starten', features: ['5 klanten', '5 verzonden Peppol-facturen/maand', '10 ontvangen Peppol-facturen/maand', 'PDF-facturen & offertes', 'CRM basis', 'Community support'] },
            { id: 'pro', name: 'Pro', price: '€29', period: '/maand', tagline: 'Meest gekozen', badge: 'POPULAIR', highlight: true, cta: 'Pro starten', features: ['Onbeperkte klanten', '20 verzonden Peppol-facturen/maand', '30 ontvangen Peppol-facturen/maand', 'Alle Free functies', 'Projectbeheer & agenda', 'Databases & workflows', 'E-mail integratie', 'Prioriteitssupport'] },
            { id: 'enterprise', name: 'Enterprise', price: 'Op maat', period: '', tagline: 'Voor grotere teams', badge: null, highlight: false, cta: 'Contact opnemen', features: ['Onbeperkt alles', 'Multi-gebruiker workspace', 'Aangepaste modules', 'SLA-garantie', 'Dedicated onboarding', 'API-toegang'] },
        ],
        faq: [
            { q: 'Is CoralOS gratis?', a: 'Ja! Het Free-plan is volledig gratis en bevat alle basisfuncties inclusief Peppol e-facturatie. Geen creditcard nodig om te starten.' },
            { q: 'Wat is Peppol en waarom is het verplicht?', a: 'Peppol is het Europese netwerk voor gestructureerde elektronische facturatie. Vanaf 1 januari 2026 is dit verplicht voor alle B2B-transacties in België.' },
            { q: 'Wat is een FOUNDER-account?', a: 'De eerste 20 gebruikers krijgen een FOUNDER-account: gratis, volledige toegang, geen Peppol-limieten — voor altijd.' },
            { q: 'Waar wordt mijn data opgeslagen?', a: 'Al je data wordt opgeslagen in de EU (Duitsland). Elke workspace is strikt geïsoleerd en GDPR-compliant.' },
            { q: 'Hoe neem ik contact op?', a: 'Stuur een e-mail naar info@coral-group.be. We reageren binnen 24 uur op werkdagen.' },
        ],
        testimonials_data: [
            { name: 'Marc V.', role: 'Zaakvoerder renovatiebedrijf', text: 'CoralOS heeft onze facturatie compleet vereenvoudigd. Peppol-integratie is goud waard.', stars: 5 },
            { name: 'Sophie D.', role: 'Binnenhuis architect', text: 'Eindelijk een platform dat alles combineert: offertes, facturen én klantbeheer. Top!', stars: 5 },
            { name: 'Thomas B.', role: 'Aannemer Antwerpen', text: 'De FOUNDER-deal was een stap die ik geen seconde betreur. Uitstekend product.', stars: 5 },
        ],
    },
    fr: {
        tagline: 'E-facturation belge · Prêt pour 2026',
        heroTitle1: 'La plateforme',
        heroGradient: 'tout-en-un',
        heroTitle2: 'pour entrepreneurs',
        heroSub: 'Facturation, e-invoicing Peppol, CRM, gestion de projets et bases de données — tout dans un seul espace de travail. Conçu pour les entreprises de construction belges.',
        ctaPrimary: 'Commencer gratuitement',
        ctaSub: 'Voir les tarifs',
        trust: ['Données en UE', 'Sans carte de crédit', 'Certifié Peppol', 'Conforme RGPD', 'SOC2-ready'],
        trustedBy: 'Fait confiance par des entrepreneurs belges',
        sectors: ['Rénovation', 'Architecture', 'Intérieur', 'Électricité', 'Sanitaire', 'Menuiserie'],
        featuresTitle: 'Tout ce dont vous avez besoin,',
        featuresSub2: 'rien de superflu',
        featuresSub: 'CoralOS combine des modules puissants dans une plateforme cohérente — sans complexité.',
        peppolBadge: 'Peppol · Obligatoire dès 2026',
        peppolTitle: 'Prêt pour l\'obligation belge de e-facturation',
        peppolSub: 'À partir du 1er janvier 2026, la facture électronique via Peppol sera obligatoire pour toutes les transactions B2B en Belgique. CoralOS génère automatiquement des factures conformes UBL et les envoie via le réseau officiel.',
        peppolPoints: ['Génération automatique UBL 2.1', 'Envoi et réception via Peppol', 'Validation TVA belge incluse', 'Conforme aux normes e-invoicing.be'],
        peppolCta: 'Démarrer gratuitement',
        testimonials: 'Ce que disent nos clients',
        pricingTitle: 'Des tarifs simples et transparents',
        pricingSub: 'Pas de frais cachés. Changez de plan à tout moment.',
        founderNote: '🏆 Programme FOUNDER — Encore disponible',
        founderSub: 'Les 20 premiers utilisateurs bénéficient d\'un compte FOUNDER gratuit avec accès complet, sans limite Peppol — pour toujours.',
        founderCta: 'S\'inscrire maintenant',
        faqTitle: 'Questions fréquentes',
        ctaBottomTitle: 'Prêt à commencer?',
        ctaBottomSub: 'Créez votre compte gratuit aujourd\'hui. Sans carte de crédit, sans engagement.',
        ctaBottomBtn: 'Créer un compte gratuit',
        login: 'Connexion',
        nav: { features: 'Fonctionnalités', pricing: 'Tarifs', faq: 'FAQ' },
        footer: { help: 'Aide', terms: 'Conditions', website: 'Site web' },
        plans: [
            { id: 'free', name: 'Gratuit', price: '€0', period: '/mois', tagline: 'Gratuit pour toujours', badge: null, highlight: false, cta: 'Commencer gratuitement', features: ['5 clients', '5 factures Peppol envoyées/mois', '10 factures Peppol reçues/mois', 'Factures & devis PDF', 'CRM de base', 'Support communauté'] },
            { id: 'pro', name: 'Pro', price: '€29', period: '/mois', tagline: 'Le plus populaire', badge: 'POPULAIRE', highlight: true, cta: 'Démarrer Pro', features: ['Clients illimités', '20 factures Peppol envoyées/mois', '30 factures Peppol reçues/mois', 'Tout du plan Gratuit', 'Gestion de projets & agenda', 'Bases de données & workflows', 'Intégration e-mail', 'Support prioritaire'] },
            { id: 'enterprise', name: 'Enterprise', price: 'Sur mesure', period: '', tagline: 'Pour les grandes équipes', badge: null, highlight: false, cta: 'Nous contacter', features: ['Tout illimité', 'Workspace multi-utilisateurs', 'Modules personnalisés', 'Garantie SLA', 'Onboarding dédié', 'Accès API'] },
        ],
        faq: [
            { q: 'CoralOS est-il gratuit?', a: 'Oui ! Le plan Gratuit est entièrement gratuit et inclut toutes les fonctions de base, y compris la e-facturation Peppol. Aucune carte de crédit requise.' },
            { q: 'Qu\'est-ce que Peppol et pourquoi est-ce obligatoire?', a: 'Peppol est le réseau européen pour la facturation électronique structurée. À partir du 1er janvier 2026, cela sera obligatoire pour toutes les transactions B2B en Belgique.' },
            { q: 'Qu\'est-ce qu\'un compte FOUNDER?', a: 'Les 20 premiers utilisateurs reçoivent un compte FOUNDER : gratuit, accès complet, sans limites Peppol — pour toujours.' },
            { q: 'Où mes données sont-elles stockées?', a: 'Toutes vos données sont stockées dans l\'UE (Allemagne). Chaque espace de travail est strictement isolé et conforme au RGPD.' },
            { q: 'Comment contacter le support?', a: 'Envoyez un e-mail à info@coral-group.be. Nous répondons dans les 24 heures les jours ouvrables.' },
        ],
        testimonials_data: [
            { name: 'Marc V.', role: 'Gérant entreprise de rénovation', text: 'CoralOS a complètement simplifié notre facturation. L\'intégration Peppol est précieuse.', stars: 5 },
            { name: 'Sophie D.', role: 'Architecte d\'intérieur', text: 'Enfin une plateforme qui combine tout : devis, factures et gestion clients. Excellent!', stars: 5 },
            { name: 'Thomas B.', role: 'Entrepreneur Anvers', text: 'L\'offre FOUNDER était une décision que je ne regrette pas une seconde. Produit excellent.', stars: 5 },
        ],
    },
    en: {
        tagline: 'Belgian e-invoicing · Ready for 2026',
        heroTitle1: 'The',
        heroGradient: 'all-in-one',
        heroTitle2: 'platform for contractors',
        heroSub: 'Invoicing, Peppol e-invoicing, CRM, project management and databases — all in one workspace. Built for Belgian construction companies and contractors.',
        ctaPrimary: 'Start for free',
        ctaSub: 'View pricing',
        trust: ['EU data storage', 'No credit card', 'Peppol certified', 'GDPR compliant', 'SOC2-ready'],
        trustedBy: 'Trusted by Belgian contractors',
        sectors: ['Renovation', 'Architecture', 'Interior', 'Electricity', 'Plumbing', 'Carpentry'],
        featuresTitle: 'Everything you need,',
        featuresSub2: 'nothing you don\'t',
        featuresSub: 'CoralOS combines powerful modules in one cohesive platform — without complexity.',
        peppolBadge: 'Peppol · Mandatory from 2026',
        peppolTitle: 'Ready for Belgian e-invoicing mandate',
        peppolSub: 'From January 1, 2026, e-invoicing via Peppol will be mandatory for all B2B transactions in Belgium. CoralOS automatically generates UBL-compliant invoices and sends them via the official network.',
        peppolPoints: ['Automatic UBL 2.1 generation', 'Send and receive via Peppol', 'Belgian VAT validation included', 'Compliant with e-invoicing.be standards'],
        peppolCta: 'Start for free',
        testimonials: 'What our customers say',
        pricingTitle: 'Simple, transparent pricing',
        pricingSub: 'No hidden costs. Upgrade or downgrade at any time.',
        founderNote: '🏆 FOUNDER Program — Still available',
        founderSub: 'The first 20 users get a free FOUNDER account with full access, no Peppol limits — forever.',
        founderCta: 'Register now',
        faqTitle: 'Frequently asked questions',
        ctaBottomTitle: 'Ready to get started?',
        ctaBottomSub: 'Create your free account today. No credit card, no commitment.',
        ctaBottomBtn: 'Create free account',
        login: 'Log in',
        nav: { features: 'Features', pricing: 'Pricing', faq: 'FAQ' },
        footer: { help: 'Help', terms: 'Terms', website: 'Website' },
        plans: [
            { id: 'free', name: 'Free', price: '€0', period: '/month', tagline: 'Free forever', badge: null, highlight: false, cta: 'Start for free', features: ['5 clients', '5 sent Peppol invoices/month', '10 received Peppol invoices/month', 'PDF invoices & quotes', 'Basic CRM', 'Community support'] },
            { id: 'pro', name: 'Pro', price: '€29', period: '/month', tagline: 'Most popular', badge: 'POPULAR', highlight: true, cta: 'Start Pro', features: ['Unlimited clients', '20 sent Peppol invoices/month', '30 received Peppol invoices/month', 'Everything in Free', 'Project management & calendar', 'Databases & workflows', 'Email integration', 'Priority support'] },
            { id: 'enterprise', name: 'Enterprise', price: 'Custom', period: '', tagline: 'For larger teams', badge: null, highlight: false, cta: 'Contact us', features: ['Everything unlimited', 'Multi-user workspace', 'Custom modules', 'SLA guarantee', 'Dedicated onboarding', 'API access'] },
        ],
        faq: [
            { q: 'Is CoralOS free?', a: 'Yes! The Free plan is completely free and includes all basic features including Peppol e-invoicing. No credit card needed to get started.' },
            { q: 'What is Peppol and why is it mandatory?', a: 'Peppol is the European network for structured electronic invoicing. From January 1, 2026, it will be mandatory for all B2B transactions in Belgium.' },
            { q: 'What is a FOUNDER account?', a: 'The first 20 users get a FOUNDER account: free, full access, no Peppol limits — forever.' },
            { q: 'Where is my data stored?', a: 'All your data is stored in the EU (Germany). Each workspace is strictly isolated and GDPR compliant.' },
            { q: 'How do I contact support?', a: 'Send an email to info@coral-group.be. We respond within 24 hours on business days.' },
        ],
        testimonials_data: [
            { name: 'Marc V.', role: 'Renovation company director', text: 'CoralOS has completely simplified our invoicing. The Peppol integration is invaluable.', stars: 5 },
            { name: 'Sophie D.', role: 'Interior architect', text: 'Finally a platform that combines everything: quotes, invoices and client management. Excellent!', stars: 5 },
            { name: 'Thomas B.', role: 'Contractor Antwerp', text: 'The FOUNDER deal was a decision I don\'t regret for a second. Excellent product.', stars: 5 },
        ],
    },
};

const FEATURES = (t: typeof T.nl) => [
    { icon: FileText,   title: 'Facturatie / Facturation / Invoicing',         color: 'blue'    },
    { icon: Send,       title: 'Peppol E-facturatie',                          color: 'indigo'  },
    { icon: Users,      title: 'CRM & Contacten',                              color: 'violet'  },
    { icon: Database,   title: 'Databases',                                    color: 'purple'  },
    { icon: BarChart3,  title: 'Projectbeheer / Gestion de projets',           color: 'fuchsia' },
    { icon: Package,    title: 'Artikelbibliotheek / Bibliothèque d\'articles', color: 'pink'    },
    { icon: Clock,      title: 'Tijdregistratie / Suivi du temps',             color: 'rose'    },
    { icon: Shield,     title: 'Beveiliging / Sécurité / Security',            color: 'emerald' },
];

const FEATURE_DESCS: Record<string, Record<string, string>> = {
    nl: {
        'Facturatie / Facturation / Invoicing':         'Automatische BTW-berekening, PDF-generatie, multi-taal en meerdere tarieven.',
        'Peppol E-facturatie':                          'UBL-conforme facturen via het Peppol-netwerk. Belgische regelgeving-compliant.',
        'CRM & Contacten':                              'B2B & B2C klantenbeheer, leveranciers en prospects in één overzicht.',
        'Databases':                                    'Notion-achtige databases met aanpasbare kolommen, filters en weergaven.',
        'Projectbeheer / Gestion de projets':           'Budgetten, planning, uitvoeringstoestand en bouwbestek-integratie.',
        'Artikelbibliotheek / Bibliothèque d\'articles':'Centraal materiaalbeheer met prijsberekening, varianten en leverancierskoppeling.',
        'Tijdregistratie / Suivi du temps':             'Eenvoudige urenregistratie per project of taak, met exportmogelijkheden.',
        'Beveiliging / Sécurité / Security':            'EU-dataopslag, geïsoleerde workspaces, versleuteling en sessiebeheer.',
    },
    fr: {
        'Facturatie / Facturation / Invoicing':         'Calcul automatique de TVA, génération PDF, multi-langue et plusieurs taux.',
        'Peppol E-facturatie':                          'Factures conformes UBL via le réseau Peppol. Conforme à la réglementation belge.',
        'CRM & Contacten':                              'Gestion clients B2B & B2C, fournisseurs et prospects en un seul endroit.',
        'Databases':                                    'Bases de données style Notion avec colonnes personnalisables, filtres et vues.',
        'Projectbeheer / Gestion de projets':           'Budgets, planification, état d\'avancement et intégration métré.',
        'Artikelbibliotheek / Bibliothèque d\'articles':'Gestion centralisée des matériaux avec calcul de prix et liaison fournisseurs.',
        'Tijdregistratie / Suivi du temps':             'Suivi simple des heures par projet ou tâche, avec options d\'export.',
        'Beveiliging / Sécurité / Security':            'Données en UE, espaces de travail isolés, chiffrement et gestion de sessions.',
    },
    en: {
        'Facturatie / Facturation / Invoicing':         'Automatic VAT calculation, PDF generation, multi-language and multiple rates.',
        'Peppol E-facturatie':                          'UBL-compliant invoices via the Peppol network. Belgian regulation compliant.',
        'CRM & Contacten':                              'B2B & B2C client management, suppliers and prospects in one overview.',
        'Databases':                                    'Notion-style databases with customizable columns, filters and views.',
        'Projectbeheer / Gestion de projets':           'Budgets, planning, progress tracking and bill of quantities integration.',
        'Artikelbibliotheek / Bibliothèque d\'articles':'Central material management with price calculation, variants and supplier links.',
        'Tijdregistratie / Suivi du temps':             'Simple time tracking per project or task, with export options.',
        'Beveiliging / Sécurité / Security':            'EU data storage, isolated workspaces, encryption and session management.',
    },
};

const colorMap: Record<string, string> = {
    blue:    'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    indigo:  'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    violet:  'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    purple:  'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    fuchsia: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400',
    pink:    'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    rose:    'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

function FAQItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
            >
                <span className="font-medium text-neutral-900 dark:text-white text-sm">{q}</span>
                <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform shrink-0 ml-4 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="px-5 pb-4 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed border-t border-neutral-100 dark:border-white/5 pt-3">
                    {a}
                </div>
            )}
        </div>
    );
}

export default function StorePage() {
    const params = useParams();
    const locale = (params?.locale as string) || 'nl';
    const t = T[locale as keyof typeof T] || T.nl;
    const featureDescs = FEATURE_DESCS[locale as keyof typeof FEATURE_DESCS] || FEATURE_DESCS.nl;
    const features = FEATURES(t);

    return (
        <div className="min-h-screen bg-white dark:bg-[#0a0a12] text-neutral-900 dark:text-white overflow-x-hidden transition-colors duration-300">

            {/* ── Nav ─────────────────────────────────────────────────────── */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-[#0a0a12]/80 backdrop-blur-xl border-b border-neutral-200 dark:border-white/[0.06]">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8"><Logo /></div>
                        <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            CoralOS
                        </span>
                    </div>
                    <div className="hidden md:flex items-center gap-6 text-sm text-neutral-500 dark:text-neutral-400">
                        <a href="#features" className="hover:text-neutral-900 dark:hover:text-white transition-colors">{t.nav.features}</a>
                        <a href="#pricing"  className="hover:text-neutral-900 dark:hover:text-white transition-colors">{t.nav.pricing}</a>
                        <a href="#faq"      className="hover:text-neutral-900 dark:hover:text-white transition-colors">{t.nav.faq}</a>
                        <a href="https://www.coral-group.be" className="hover:text-neutral-900 dark:hover:text-white transition-colors flex items-center gap-1">
                            <Globe className="w-3.5 h-3.5" />coral-group.be
                        </a>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/login" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors px-4 py-2">
                            {t.login}
                        </Link>
                        <Link href="/login" className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-lg transition-all shadow-lg shadow-blue-600/20">
                            {t.ctaPrimary}
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ── Hero ────────────────────────────────────────────────────── */}
            <section className="relative pt-32 pb-24 px-6 text-center overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-blue-500/10 dark:from-blue-600/20 to-transparent rounded-full blur-3xl" />
                </div>
                <div className="relative max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-8">
                        <Zap className="w-3.5 h-3.5" />
                        {t.tagline}
                    </div>
                    <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6">
                        {t.heroTitle1}{' '}
                        <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
                            {t.heroGradient}
                        </span>
                        {' '}{t.heroTitle2}
                    </h1>
                    <p className="text-xl text-neutral-500 dark:text-neutral-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                        {t.heroSub}
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link href="/login" className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-8 py-4 rounded-xl transition-all shadow-2xl shadow-blue-600/20 text-base">
                            {t.ctaPrimary} <ArrowRight className="w-5 h-5" />
                        </Link>
                        <a href="#pricing" className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors text-base font-medium px-6 py-4">
                            {t.ctaSub}
                        </a>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-xs text-neutral-400 dark:text-neutral-500">
                        {t.trust.map(item => (
                            <span key={item} className="flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5 text-emerald-500" />{item}
                            </span>
                        ))}
                        <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-emerald-500" />SOC2-ready</span>
                    </div>
                </div>
            </section>

            {/* ── Social proof ────────────────────────────────────────────── */}
            <section className="py-12 px-6 border-y border-neutral-100 dark:border-white/[0.06] bg-neutral-50 dark:bg-white/[0.02]">
                <div className="max-w-5xl mx-auto">
                    <p className="text-center text-xs text-neutral-400 uppercase tracking-widest mb-8">{t.trustedBy}</p>
                    <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-4">
                        {t.sectors.map(sector => (
                            <div key={sector} className="flex items-center gap-2 text-neutral-400 dark:text-neutral-600 text-sm">
                                <Building2 className="w-4 h-4" /><span>{sector}</span>
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
                            {t.featuresTitle}{' '}
                            <span className="text-neutral-400 dark:text-neutral-500">{t.featuresSub2}</span>
                        </h2>
                        <p className="text-neutral-500 max-w-xl mx-auto">{t.featuresSub}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {features.map(f => (
                            <div key={f.title} className="bg-neutral-50 dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.07] rounded-2xl p-5 hover:bg-neutral-100 dark:hover:bg-white/[0.06] hover:border-neutral-300 dark:hover:border-white/10 transition-all">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${colorMap[f.color]}`}>
                                    <f.icon className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-neutral-900 dark:text-white text-sm mb-2 leading-tight">{f.title}</h3>
                                <p className="text-xs text-neutral-500 leading-relaxed">{featureDescs[f.title]}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Peppol highlight ────────────────────────────────────────── */}
            <section className="py-20 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-600/10 dark:to-indigo-600/10 border border-blue-200 dark:border-blue-500/20 rounded-3xl p-10 md:p-14 overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-100 dark:from-blue-600/20 to-transparent blur-3xl pointer-events-none" />
                        <div className="relative max-w-2xl">
                            <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-6">
                                <Send className="w-3 h-3" />{t.peppolBadge}
                            </div>
                            <h2 className="text-3xl font-bold mb-4 text-neutral-900 dark:text-white">{t.peppolTitle}</h2>
                            <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed mb-6">{t.peppolSub}</p>
                            <ul className="space-y-3 mb-8">
                                {t.peppolPoints.map(item => (
                                    <li key={item} className="flex items-center gap-3 text-sm text-neutral-700 dark:text-neutral-300">
                                        <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />{item}
                                    </li>
                                ))}
                            </ul>
                            <Link href="/login" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 text-sm">
                                {t.peppolCta} <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Testimonials ────────────────────────────────────────────── */}
            <section className="py-20 px-6 bg-neutral-50 dark:bg-white/[0.015]">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-2xl font-bold text-center mb-12 text-neutral-900 dark:text-white">{t.testimonials}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {t.testimonials_data.map((item) => (
                            <div key={item.name} className="bg-white dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.07] rounded-2xl p-6 shadow-sm dark:shadow-none">
                                <div className="flex gap-0.5 mb-4">
                                    {Array.from({ length: item.stars }).map((_, i) => (
                                        <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                                    ))}
                                </div>
                                <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mb-5">"{item.text}"</p>
                                <div>
                                    <p className="text-sm font-semibold text-neutral-900 dark:text-white">{item.name}</p>
                                    <p className="text-xs text-neutral-400">{item.role}</p>
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
                        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-neutral-900 dark:text-white">{t.pricingTitle}</h2>
                        <p className="text-neutral-500">{t.pricingSub}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {t.plans.map(plan => (
                            <div key={plan.id} className={`relative rounded-2xl p-7 flex flex-col ${plan.highlight
                                ? 'bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-blue-600/20 dark:to-indigo-600/10 border-2 border-blue-400 dark:border-blue-500/40 shadow-xl shadow-blue-100 dark:shadow-blue-600/10'
                                : 'bg-white dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.07] shadow-sm dark:shadow-none'
                            }`}>
                                {plan.badge && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                                        {plan.badge}
                                    </div>
                                )}
                                <div className="mb-6">
                                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">{plan.name}</h3>
                                    <p className="text-xs text-neutral-400 mb-4">{plan.tagline}</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-extrabold text-neutral-900 dark:text-white">{plan.price}</span>
                                        <span className="text-neutral-400 text-sm">{plan.period}</span>
                                    </div>
                                </div>
                                <ul className="space-y-3 mb-8 flex-1">
                                    {plan.features.map(f => (
                                        <li key={f} className="flex items-start gap-2.5 text-sm text-neutral-600 dark:text-neutral-300">
                                            <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlight ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-500'}`} />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                <Link href="/login" className={`w-full text-center font-bold py-3 rounded-xl transition-all text-sm ${plan.highlight
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                                    : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-white/10 dark:hover:bg-white/15 text-neutral-900 dark:text-white'
                                }`}>
                                    {plan.cta}
                                </Link>
                            </div>
                        ))}
                    </div>
                    <div className="mt-8 bg-amber-50 dark:bg-gradient-to-r dark:from-amber-500/10 dark:to-orange-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-6 text-center">
                        <p className="text-amber-600 dark:text-amber-400 font-bold text-sm mb-1">{t.founderNote}</p>
                        <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                            {t.founderSub}{' '}
                            <Link href="/login" className="text-amber-600 dark:text-amber-400 hover:underline font-semibold">{t.founderCta}</Link>.
                        </p>
                    </div>
                </div>
            </section>

            {/* ── FAQ ─────────────────────────────────────────────────────── */}
            <section id="faq" className="py-20 px-6 bg-neutral-50 dark:bg-white/[0.015]">
                <div className="max-w-2xl mx-auto">
                    <h2 className="text-2xl font-bold text-center mb-10 text-neutral-900 dark:text-white">{t.faqTitle}</h2>
                    <div className="space-y-2">
                        {t.faq.map(item => <FAQItem key={item.q} q={item.q} a={item.a} />)}
                    </div>
                </div>
            </section>

            {/* ── CTA Bottom ──────────────────────────────────────────────── */}
            <section className="py-24 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-600/15 dark:to-indigo-600/15 border border-blue-200 dark:border-blue-500/15 rounded-3xl p-12 overflow-hidden shadow-xl shadow-blue-100/50 dark:shadow-none">
                        <div className="relative">
                            <h2 className="text-3xl font-bold mb-4 text-neutral-900 dark:text-white">{t.ctaBottomTitle}</h2>
                            <p className="text-neutral-500 mb-8">{t.ctaBottomSub}</p>
                            <Link href="/login" className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-8 py-4 rounded-xl transition-all shadow-2xl shadow-blue-600/20 text-base">
                                {t.ctaBottomBtn} <ArrowRight className="w-5 h-5" />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Footer ──────────────────────────────────────────────────── */}
            <footer className="border-t border-neutral-200 dark:border-white/[0.06] py-10 px-6">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-neutral-400">
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6"><Logo /></div>
                        <span className="font-semibold text-neutral-500 dark:text-neutral-400">CoralOS by Coral Group BV</span>
                    </div>
                    <div className="flex gap-6">
                        <Link href="/help"  className="hover:text-neutral-900 dark:hover:text-white transition-colors">{t.footer.help}</Link>
                        <Link href="/terms" className="hover:text-neutral-900 dark:hover:text-white transition-colors">{t.footer.terms}</Link>
                        <a href="mailto:info@coral-group.be" className="hover:text-neutral-900 dark:hover:text-white transition-colors flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 inline" />info@coral-group.be
                        </a>
                        <a href="https://www.coral-group.be" className="hover:text-neutral-900 dark:hover:text-white transition-colors flex items-center gap-1">
                            <Globe className="w-3.5 h-3.5" />coral-group.be
                        </a>
                    </div>
                    <span>© {new Date().getFullYear()} Coral Group BV</span>
                </div>
            </footer>
        </div>
    );
}
