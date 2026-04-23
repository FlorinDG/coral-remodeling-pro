"use client";

import Logo from '@/components/Logo';
import { ArrowLeft, FileText, Users, Calculator, Send, Settings, Database, Calendar, Mail, HelpCircle, BookOpen, Shield, Zap, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

function FAQItem({ question, answer }: { question: string; answer: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
            >
                <span className="font-medium text-neutral-900 dark:text-white text-sm">{question}</span>
                <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="px-5 pb-4 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed border-t border-neutral-100 dark:border-white/5 pt-3">
                    {answer}
                </div>
            )}
        </div>
    );
}

function FeatureCard({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
    return (
        <div className="bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-white/10 rounded-xl p-5 hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-500/20 transition-all">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-bold text-neutral-900 dark:text-white text-sm mb-1">{title}</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">{description}</p>
        </div>
    );
}

export default function HelpPage() {
    return (
        <div className="min-h-screen bg-[#f9fafb] dark:bg-neutral-950">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-200 dark:border-white/10">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8"><Logo /></div>
                        <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">CoralOS Help</span>
                    </div>
                    <Link href="/login" className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        Terug
                    </Link>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-12">
                {/* Hero */}
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-3">Hoe kunnen we helpen?</h1>
                    <p className="text-neutral-500 max-w-xl mx-auto">CoralOS is jouw alles-in-één werkplatform voor facturatie, CRM, projectbeheer en meer. Hier vind je alles om snel aan de slag te gaan.</p>
                </div>

                {/* Quick Start */}
                <section className="mb-12">
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-500" />
                        Snel starten
                    </h2>
                    <div className="bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-white/10 rounded-2xl p-6">
                        <ol className="space-y-4">
                            <li className="flex gap-4">
                                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white font-bold text-sm flex items-center justify-center">1</span>
                                <div>
                                    <h3 className="font-bold text-neutral-900 dark:text-white text-sm">Bedrijfsprofiel instellen</h3>
                                    <p className="text-xs text-neutral-500 mt-0.5">Ga naar <strong>Instellingen → Bedrijfsgegevens</strong> en vul je bedrijfsnaam, BTW-nummer, adres en IBAN in. Deze gegevens verschijnen op al je facturen en offertes.</p>
                                </div>
                            </li>
                            <li className="flex gap-4">
                                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white font-bold text-sm flex items-center justify-center">2</span>
                                <div>
                                    <h3 className="font-bold text-neutral-900 dark:text-white text-sm">Contacten toevoegen</h3>
                                    <p className="text-xs text-neutral-500 mt-0.5">Ga naar <strong>Contacten</strong> en voeg je klanten toe. Vul minstens naam, e-mailadres en eventueel BTW-nummer in voor B2B-facturatie.</p>
                                </div>
                            </li>
                            <li className="flex gap-4">
                                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white font-bold text-sm flex items-center justify-center">3</span>
                                <div>
                                    <h3 className="font-bold text-neutral-900 dark:text-white text-sm">Eerste factuur aanmaken</h3>
                                    <p className="text-xs text-neutral-500 mt-0.5">Ga naar <strong>Financieel → Inkomsten → Facturen</strong> en klik op &quot;Nieuwe factuur&quot;. Selecteer een klant, voeg artikellijnen toe, en CoralOS berekent automatisch BTW en totalen.</p>
                                </div>
                            </li>
                            <li className="flex gap-4">
                                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 text-white font-bold text-sm flex items-center justify-center">✓</span>
                                <div>
                                    <h3 className="font-bold text-neutral-900 dark:text-white text-sm">Versturen!</h3>
                                    <p className="text-xs text-neutral-500 mt-0.5">Verstuur je factuur als PDF per e-mail, of via het Peppol-netwerk voor gestructureerde e-facturatie. De PDF wordt automatisch gegenereerd met je bedrijfsbranding.</p>
                                </div>
                            </li>
                        </ol>
                    </div>
                </section>

                {/* Modules Overview */}
                <section className="mb-12">
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-blue-500" />
                        Modules
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <FeatureCard
                            icon={Calculator}
                            title="Facturatie"
                            description="Maak professionele facturen aan met automatische BTW-berekening, PDF-generatie en e-mailverzending. Ondersteuning voor meerdere BTW-tarieven (21%, 6%, 0%)."
                        />
                        <FeatureCard
                            icon={FileText}
                            title="Offertes"
                            description="Stel offertes op, verstuur ze per e-mail en laat klanten online tekenen. Drie handtekeningmodi: tekenen, typen of uploaden."
                        />
                        <FeatureCard
                            icon={Send}
                            title="Peppol E-facturatie"
                            description="Verstuur facturen via het Peppol-netwerk conform Belgische regelgeving. Automatische UBL-generatie en validatie."
                        />
                        <FeatureCard
                            icon={Users}
                            title="Contacten & CRM"
                            description="Beheer je klanten (B2B en B2C), leveranciers en prospects. Koppel contacten aan facturen, offertes en projecten."
                        />
                        <FeatureCard
                            icon={Database}
                            title="Databases"
                            description="Notion-achtige databases met aanpasbare kolommen, filters, sorteringen en weergaven. Ideaal voor maatwerk workflows."
                        />
                        <FeatureCard
                            icon={Calendar}
                            title="Agenda"
                            description="Geïntegreerde agenda met Google Calendar-synchronisatie. Plan afspraken en koppel ze aan taken en projecten."
                        />
                        <FeatureCard
                            icon={Mail}
                            title="E-mail"
                            description="Verbind je zakelijke e-mailaccount (IMAP/SMTP) voor directe communicatie vanuit het platform."
                        />
                        <FeatureCard
                            icon={Settings}
                            title="Instellingen"
                            description="Configureer je bedrijfsprofiel, documentsjablonen, nummeringspatronen, taalvoorkeuren en meer."
                        />
                        <FeatureCard
                            icon={Shield}
                            title="Beveiliging"
                            description="Automatische sessie-beëindiging, e-mailverificatie, versleutelde wachtwoorden en geïsoleerde workspaces."
                        />
                    </div>
                </section>

                {/* FAQ */}
                <section className="mb-12">
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-purple-500" />
                        Veelgestelde vragen
                    </h2>
                    <div className="space-y-2">
                        <FAQItem
                            question="Hoe wijzig ik mijn documenttaal?"
                            answer="Ga naar Instellingen → Bedrijfsgegevens en selecteer de gewenste documenttaal (Nederlands, Frans of Engels). Alle nieuwe facturen en offertes worden in die taal opgesteld."
                        />
                        <FAQItem
                            question="Wat is Peppol e-facturatie?"
                            answer="Peppol is het Europese netwerk voor gestructureerde elektronische facturatie. Sinds 1 januari 2026 is e-facturatie verplicht voor alle B2B-transacties in België. CoralOS genereert automatisch UBL-conforme facturen en verstuurt ze via het Peppol-netwerk."
                        />
                        <FAQItem
                            question="Hoeveel facturen kan ik per maand versturen?"
                            answer="Het FREE plan bevat 5 verzonden en 10 ontvangen Peppol-facturen per maand. Extra volumes zijn beschikbaar in pakketten van 10 (€4,90). Het PRO plan biedt 20 verzonden en 30 ontvangen facturen, en het ENTERPRISE plan is onbeperkt."
                        />
                        <FAQItem
                            question="Kan ik mijn eigen logo op facturen zetten?"
                            answer="Ja! Upload je logo in Instellingen → Bedrijfsgegevens. Het verschijnt automatisch op alle facturen, offertes en e-mails."
                        />
                        <FAQItem
                            question="Hoe stel ik de factuurnummering in?"
                            answer="Ga naar Instellingen → Financieel. Je kunt het prefix (bijv. INV), het datumformaat, de breedte en het volgnummer aanpassen. Dezelfde opties zijn beschikbaar voor offertes."
                        />
                        <FAQItem
                            question="Is mijn data veilig?"
                            answer="Ja. Alle data wordt opgeslagen in de EU. Elke workspace is strikt geïsoleerd — andere gebruikers kunnen jouw data niet zien. Wachtwoorden worden versleuteld opgeslagen en sessies worden automatisch beëindigd na inactiviteit."
                        />
                        <FAQItem
                            question="Wat is een FOUNDER-account?"
                            answer="De eerste 20 gebruikers van CoralOS krijgen een FOUNDER-account. Dit is een gratis account met volledige toegang, zonder Peppol-limiet. Bij lancering van het betalingssysteem worden FOUNDERs automatisch geüpgraded naar een gratis PRO-account."
                        />
                        <FAQItem
                            question="Hoe neem ik contact op met support?"
                            answer="Stuur een e-mail naar info@coral-group.be. We reageren binnen 24 uur op werkdagen."
                        />
                    </div>
                </section>

                {/* Contact */}
                <section className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5 border border-blue-200 dark:border-blue-500/20 rounded-2xl p-8 text-center">
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Nog vragen?</h2>
                    <p className="text-neutral-500 text-sm mb-4">Ons team staat klaar om je te helpen.</p>
                    <a
                        href="mailto:info@coral-group.be"
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 text-sm"
                    >
                        <Mail className="w-4 h-4" />
                        info@coral-group.be
                    </a>
                </section>
            </main>

            {/* Footer */}
            <footer className="max-w-5xl mx-auto px-6 py-6 border-t border-neutral-200 dark:border-white/10 mt-8">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400">
                    <span>© {new Date().getFullYear()} Coral Group BV — Alle rechten voorbehouden</span>
                    <div className="flex gap-4">
                        <Link href="/terms" className="hover:text-neutral-900 dark:hover:text-white transition-colors">Voorwaarden</Link>
                        <a href="https://www.coral-group.be" className="hover:text-neutral-900 dark:hover:text-white transition-colors">Website</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
