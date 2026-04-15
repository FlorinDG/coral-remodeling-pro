"use client";

import Logo from '@/components/Logo';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function TermsPage() {
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
                        Terug naar login
                    </Link>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-12">
                <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">Algemene Voorwaarden</h1>
                <p className="text-sm text-neutral-500 mb-10">Laatst bijgewerkt: 15 april 2026</p>

                <div className="space-y-8 text-neutral-700 dark:text-neutral-300 text-[15px] leading-relaxed">

                    {/* 1 */}
                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">1. Definities</h2>
                        <ul className="list-disc pl-6 space-y-1">
                            <li><strong>&quot;Platform&quot;</strong> — het CoralOS SaaS-platform, bereikbaar via app.coral-group.be</li>
                            <li><strong>&quot;Dienstverlener&quot;</strong> — Coral Group BV, met maatschappelijke zetel in België</li>
                            <li><strong>&quot;Gebruiker&quot;</strong> — elke natuurlijke of rechtspersoon die een account aanmaakt op het Platform</li>
                            <li><strong>&quot;Workspace&quot;</strong> — de geïsoleerde werkomgeving die automatisch wordt aangemaakt bij registratie</li>
                            <li><strong>&quot;FOUNDER-account&quot;</strong> — een account aangemaakt tijdens de gesloten bèta (eerste 20 gebruikers)</li>
                        </ul>
                    </section>

                    {/* 2 */}
                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">2. Toepassingsgebied</h2>
                        <p>Deze algemene voorwaarden zijn van toepassing op elk gebruik van het Platform. Door een account aan te maken, gaat de Gebruiker akkoord met deze voorwaarden. Het Platform is uitsluitend bestemd voor professioneel gebruik (B2B).</p>
                    </section>

                    {/* 3 */}
                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">3. Accountregistratie</h2>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>Registratie is mogelijk via e-mail of Google OAuth</li>
                            <li>Elke Gebruiker krijgt een geïsoleerde Workspace</li>
                            <li>De Gebruiker is verantwoordelijk voor de vertrouwelijkheid van zijn inloggegevens</li>
                            <li>E-mailverificatie is vereist binnen 4 dagen na registratie</li>
                            <li>Tijdens de gesloten bèta is het aantal accounts beperkt</li>
                        </ul>
                    </section>

                    {/* 4 */}
                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">4. Abonnementen en Prijzen</h2>
                        <p className="mb-3">Het Platform biedt de volgende abonnementsformules:</p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden">
                                <thead>
                                    <tr className="bg-neutral-100 dark:bg-white/5">
                                        <th className="text-left px-4 py-3 font-bold">Plan</th>
                                        <th className="text-left px-4 py-3 font-bold">Prijs</th>
                                        <th className="text-left px-4 py-3 font-bold">Kenmerken</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-200 dark:divide-white/10">
                                    <tr>
                                        <td className="px-4 py-3 font-medium">FREE</td>
                                        <td className="px-4 py-3">€0/maand</td>
                                        <td className="px-4 py-3">Basis facturatie, 5 verzonden / 10 ontvangen Peppol-facturen per maand</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 font-medium">PRO</td>
                                        <td className="px-4 py-3">€29/maand</td>
                                        <td className="px-4 py-3">Uitgebreide modules, 20 verzonden / 30 ontvangen, artikelbibliotheek</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 font-medium">ENTERPRISE</td>
                                        <td className="px-4 py-3">€79/maand</td>
                                        <td className="px-4 py-3">Onbeperkt, HR, projectbeheer, Batiprix, API-toegang</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-3 text-sm text-neutral-500">FOUNDER-accounts ontvangen een gratis upgrade naar PRO bij lancering van het betalingssysteem.</p>
                    </section>

                    {/* 5 */}
                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">5. Peppol E-facturatie</h2>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>E-facturen worden verzonden via het Peppol-netwerk in samenwerking met e-invoice.be</li>
                            <li>Volumes boven het maandelijkse limiet worden gefactureerd in pakketten van 10 (€4,90 per pakket)</li>
                            <li>De Dienstverlener is niet aansprakelijk voor storingen in het Peppol-netwerk of bij e-invoice.be</li>
                            <li>In testmodus worden documenten per e-mail bezorgd in plaats van via het Peppol-netwerk</li>
                        </ul>
                    </section>

                    {/* 6 */}
                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">6. Gegevensverwerking en Privacy</h2>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>Alle gegevens worden opgeslagen in de EU (Neon PostgreSQL, Vercel)</li>
                            <li>De Dienstverlener verwerkt persoonsgegevens conform de AVG/GDPR</li>
                            <li>Elke Workspace is strikt geïsoleerd — gegevens zijn niet toegankelijk voor andere Gebruikers</li>
                            <li>Wachtwoorden worden gehasht opgeslagen (bcrypt)</li>
                            <li>Automatische sessie-beëindiging na 30 minuten inactiviteit of 8 uur absoluut</li>
                        </ul>
                    </section>

                    {/* 7 */}
                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">7. Intellectuele Eigendom</h2>
                        <p>Het Platform, inclusief alle software, ontwerpen en documentatie, is eigendom van Coral Group BV. De Gebruiker verkrijgt een niet-exclusief, niet-overdraagbaar gebruiksrecht voor de duur van het abonnement.</p>
                    </section>

                    {/* 8 */}
                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">8. Aansprakelijkheid</h2>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>Het Platform wordt aangeboden &quot;as is&quot; — de Dienstverlener garandeert geen 100% beschikbaarheid</li>
                            <li>De Dienstverlener is niet aansprakelijk voor indirecte schade, winstderving of gegevensverlies</li>
                            <li>De totale aansprakelijkheid is beperkt tot het bedrag van de laatste 3 maanden abonnementskosten</li>
                            <li>De Gebruiker is verantwoordelijk voor de juistheid van ingevoerde factuurgegevens</li>
                        </ul>
                    </section>

                    {/* 9 */}
                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">9. Beëindiging</h2>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>De Gebruiker kan zijn account op elk moment opzeggen via de instellingen</li>
                            <li>Bij opzegging blijven gegevens 30 dagen bewaard voor data-export</li>
                            <li>De Dienstverlener kan een account opschorten bij misbruik of niet-betaling</li>
                        </ul>
                    </section>

                    {/* 10 */}
                    <section>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">10. Toepasselijk Recht</h2>
                        <p>Deze voorwaarden worden beheerst door het Belgisch recht. Geschillen worden voorgelegd aan de bevoegde rechtbanken van Brussel.</p>
                    </section>

                    {/* Contact */}
                    <section className="bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-white/10 rounded-2xl p-6">
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">Contact</h2>
                        <p>Voor vragen over deze voorwaarden:</p>
                        <ul className="mt-2 space-y-1">
                            <li><strong>E-mail:</strong> info@coral-group.be</li>
                            <li><strong>Website:</strong> www.coral-group.be</li>
                        </ul>
                    </section>
                </div>
            </main>
        </div>
    );
}
