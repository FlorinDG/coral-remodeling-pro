"use client";
import React, { useState, useEffect } from "react";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredSettingsTabs } from "@/config/tabs";
import { Building2, Save, MapPin, Globe, CreditCard, AlertCircle, RefreshCw, Hash, FileText, Palette, CheckCircle2, Wifi } from "lucide-react";
import { Button } from "@/components/time-tracker/components/ui/button";
import { toast } from 'sonner';
import DocumentTemplatesModule from '@/components/admin/settings/DocumentTemplatesModule';
import { useTranslations, useLocale } from 'next-intl';
import { useSession } from 'next-auth/react';
import { useTenant } from '@/context/TenantContext';

// ── Peppol Connection Banner ──────────────────────────────────────────────────
function PeppolBanner({ onFetchRegistry, fetchingRegistry, t }: {
    onFetchRegistry: () => void;
    fetchingRegistry: boolean;
    t: (key: string) => string;
}) {
    const [status, setStatus] = useState<{
        connected: boolean;
        peppolRegistered: boolean;
        peppolId?: string;
        companyName?: string;
        loading: boolean;
    }>({ connected: false, peppolRegistered: false, loading: true });

    useEffect(() => {
        fetch('/api/peppol/onboard')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data) {
                    setStatus({
                        connected: data.connected,
                        peppolRegistered: data.peppolRegistered,
                        peppolId: data.peppolId,
                        companyName: data.companyName,
                        loading: false,
                    });
                } else {
                    setStatus(s => ({ ...s, loading: false }));
                }
            })
            .catch(() => setStatus(s => ({ ...s, loading: false })));
    }, []);

    if (status.loading) {
        return (
            <div className="bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 flex items-center gap-4">
                <RefreshCw className="w-5 h-5 animate-spin text-neutral-400" />
                <span className="text-sm text-neutral-500">{t('nav.settings.peppolChecking')}</span>
            </div>
        );
    }

    // ✅ Connected state
    if (status.connected && status.peppolRegistered) {
        return (
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-6 flex items-start gap-4 shadow-sm">
                <div className="bg-emerald-100 dark:bg-emerald-500/20 p-3 rounded-xl mt-0.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-300">{t('nav.settings.peppolConnected')}</h3>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                            <Wifi className="w-3 h-3" /> {t('nav.settings.peppolActive')}
                        </span>
                    </div>
                    <div className="text-sm text-emerald-700 dark:text-emerald-400/80 space-y-1">
                        {status.companyName && (
                            <p><span className="font-semibold">{t('nav.settings.peppolCompany')}:</span> {status.companyName}</p>
                        )}
                        {status.peppolId && (
                            <p><span className="font-semibold">{t('nav.settings.peppolAddress')}:</span> <code className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 font-mono text-xs font-bold">{status.peppolId}</code></p>
                        )}
                    </div>
                    <p className="text-xs text-emerald-600/60 dark:text-emerald-500/40 mt-3">
                        {t('nav.settings.peppolConnectedDesc')}
                    </p>
                </div>
            </div>
        );
    }

    // ⚠️ Not connected state (original orange banner)
    return (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-6 flex items-start gap-4 shadow-sm">
            <div className="bg-amber-100 dark:bg-amber-500/20 p-3 rounded-xl mt-1 text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-6 h-6" />
            </div>
            <div className="flex-1">
                <h3 className="text-lg font-bold text-amber-900 dark:text-amber-300">{t('nav.settings.peppolTitle')}</h3>
                <p className="text-sm text-amber-700 dark:text-amber-600/80 mt-1 mb-4 leading-relaxed">
                    {t('nav.settings.peppolDesc')}
                </p>
                <div className="flex gap-3">
                    <Button
                        onClick={onFetchRegistry}
                        disabled={fetchingRegistry}
                        className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm border-0 font-bold disabled:opacity-50"
                    >
                        {fetchingRegistry ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {fetchingRegistry ? t('nav.settings.searching') : t('nav.settings.searchRegistry')}
                    </Button>
                    <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">
                        {t('nav.settings.enterManually')}
                    </Button>
                </div>
            </div>
        </div>
    );
}


export default function CompanyInfoSettings() {
    const t = useTranslations('Admin');
    const currentLocale = useLocale();
    const { data: session, update: updateSession } = useSession();

    const [profile, setProfile] = useState({
        companyName: '',
        vatNumber: '',
        email: '',
        street: '',
        postalCode: '',
        city: '',
        iban: '',
        peppolId: '',
        commercialName: '',
        bic: '',
        deliveryStreet: '',
        deliveryPostalCode: '',
        deliveryCity: '',
        headquartersStreet: '',
        headquartersPostalCode: '',
        headquartersCity: '',
        directorFirstName: '',
        directorLastName: '',
        documentLanguage: '',
        // Document numbering
        invoicePrefix: 'INV',
        invoiceConnector: '-',
        invoiceDateFormat: 'YYYY',
        invoiceNumberWidth: 3,
        invoiceNextNumber: 1,
        quotationPrefix: 'OFF',
        quotationConnector: '-',
        quotationDateFormat: 'YYYY',
        quotationNumberWidth: 3,
        quotationNextNumber: 1,
        documentTemplate: 't1',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch('/api/tenant/profile').then(res => res.json()).then(data => {
            if (data && !data.error) {
                setProfile({
                    companyName: data.companyName || '',
                    vatNumber: data.vatNumber || '',
                    email: data.email || '',
                    street: data.street || '',
                    postalCode: data.postalCode || '',
                    city: data.city || '',
                    iban: data.iban || '',
                    peppolId: data.peppolId || '',
                    commercialName: data.commercialName || '',
                    bic: data.bic || '',
                    deliveryStreet: data.deliveryStreet || '',
                    deliveryPostalCode: data.deliveryPostalCode || '',
                    deliveryCity: data.deliveryCity || '',
                    headquartersStreet: data.headquartersStreet || '',
                    headquartersPostalCode: data.headquartersPostalCode || '',
                    headquartersCity: data.headquartersCity || '',
                    directorFirstName: data.directorFirstName || '',
                    directorLastName: data.directorLastName || '',
                    documentLanguage: data.documentLanguage || '',
                    invoicePrefix: data.invoicePrefix || 'INV',
                    invoiceConnector: data.invoiceConnector || '-',
                    invoiceDateFormat: data.invoiceDateFormat || 'YYYY',
                    invoiceNumberWidth: data.invoiceNumberWidth ?? 3,
                    invoiceNextNumber: data.invoiceNextNumber ?? 1,
                    quotationPrefix: data.quotationPrefix || 'OFF',
                    quotationConnector: data.quotationConnector || '-',
                    quotationDateFormat: data.quotationDateFormat || 'YYYY',
                    quotationNumberWidth: data.quotationNumberWidth ?? 3,
                    quotationNextNumber: data.quotationNextNumber ?? 1,
                    documentTemplate: data.documentTemplate || 't1',
                });
            }
            setLoading(false);
        });
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/tenant/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profile)
            });
            if (res.ok) {
                toast.success('Company profile saved securely!');

                // Patch the JWT immediately so middleware locale correction uses the new language
                const newLang = profile.documentLanguage;
                const supportedLocales = ['en', 'fr', 'nl', 'ro', 'ru'];
                if (newLang && supportedLocales.includes(newLang)) {
                    await updateSession({ environmentLanguage: newLang });

                    const currentPath = window.location.pathname;
                    const localeRegex = /^\/(en|fr|nl|ro|ru)(\/|$)/;
                    if (localeRegex.test(currentPath)) {
                        const newPath = currentPath.replace(localeRegex, `/${newLang}$2`);
                        if (newPath !== currentPath) {
                            window.location.href = newPath;
                            return;
                        }
                    }
                }
            } else {
                throw new Error('Failed to save');
            }
        } catch (e) {
            console.error('Failed to save profile', e);
            toast.error('Failed to save profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const [fetchingRegistry, setFetchingRegistry] = useState(false);

    const handleFetchRegistry = async () => {
        if (!profile.vatNumber || profile.vatNumber.trim() === '') {
            toast.error('Please enter your VAT Number (KBO) first.');
            return;
        }

        setFetchingRegistry(true);
        toast.loading('Searching official registry...', { id: 'vat-lookup' });

        try {
            const response = await fetch(`/api/company/lookup?vat=${encodeURIComponent(profile.vatNumber)}`);
            if (!response.ok) throw new Error('API error');

            const data = await response.json();

            if (data.isValid) {
                setProfile(prev => ({
                    ...prev,
                    companyName: data.name !== '---' ? data.name : prev.companyName,
                    street: data.address !== '---' ? data.address.replace(/\n/g, ', ') : prev.street,
                }));
                toast.success('Company registry data imported successfully!', { id: 'vat-lookup' });
            } else {
                toast.error('The provided VAT Number is invalid or not found.', { id: 'vat-lookup' });
            }
        } catch (e) {
            console.error('Failed to fetch registry data:', e);
            toast.error('Failed to communicate with official registry services.', { id: 'vat-lookup' });
        } finally {
            setFetchingRegistry(false);
        }
    };

    const { activeModules } = useTenant();
    const filteredSettingsTabs = getFilteredSettingsTabs(activeModules);

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={filteredSettingsTabs} groupId="settings" />
            <div className="w-full flex-1 overflow-y-auto p-6 pb-16 max-w-4xl space-y-12">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-neutral-200 dark:border-white/10 pb-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">{t('nav.settings.pageTitle')}</h1>
                        <p className="text-sm text-neutral-500 mt-1">{t('nav.settings.pageSubtitle')}</p>
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="gap-2 text-white disabled:opacity-50"
                        style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                    >
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? t('nav.settings.saving') : t('nav.settings.save')}
                    </Button>
                </div>

                {/* Integration Callout: Peppol */}
                <PeppolBanner
                    onFetchRegistry={handleFetchRegistry}
                    fetchingRegistry={fetchingRegistry}
                    t={t}
                />

                {/* Company Details Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                    {/* Basic Info */}
                    <div className="space-y-6">
                        <h3 className="text-sm font-bold flex items-center gap-2 text-neutral-800 dark:text-neutral-200 uppercase tracking-widest border-b border-neutral-200 dark:border-white/10 pb-2">
                            <Building2 className="w-4 h-4" style={{ color: 'var(--brand-color, #d35400)' }} />
                            {t('nav.settings.businessIdentity')}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block">{t('nav.settings.companyNameLegal')}</label>
                                <input
                                    type="text"
                                    value={profile.companyName}
                                    onChange={e => setProfile({ ...profile, companyName: e.target.value })}
                                    placeholder="Coral Group BV"
                                    className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-color)] transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block">{t('nav.settings.commercialName')}</label>
                                <input
                                    type="text"
                                    value={profile.commercialName}
                                    onChange={e => setProfile({ ...profile, commercialName: e.target.value })}
                                    placeholder="Coral Remodeling"
                                    className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-color)] transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block">{t('nav.settings.vatNumber')}</label>
                                <input
                                    type="text"
                                    value={profile.vatNumber}
                                    onChange={e => setProfile({ ...profile, vatNumber: e.target.value })}
                                    placeholder="BE 1234 567 890"
                                    className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-color)] transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block">{t('nav.settings.defaultEmail')}</label>
                                <input
                                    type="email"
                                    value={profile.email}
                                    onChange={e => setProfile({ ...profile, email: e.target.value })}
                                    placeholder="finance@coral-group.be"
                                    className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-color)] transition-colors"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block">{t('nav.settings.directorFirstName')}</label>
                                    <input
                                        type="text"
                                        value={profile.directorFirstName}
                                        onChange={e => setProfile({ ...profile, directorFirstName: e.target.value })}
                                        placeholder="John"
                                        className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-color)] transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block">{t('nav.settings.directorLastName')}</label>
                                    <input
                                        type="text"
                                        value={profile.directorLastName}
                                        onChange={e => setProfile({ ...profile, directorLastName: e.target.value })}
                                        placeholder="Doe"
                                        className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-color)] transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block flex items-center gap-1.5">
                                    <CreditCard className="w-3 h-3" /> {t('nav.settings.ibanAccount')}
                                </label>
                                <input
                                    type="text"
                                    value={profile.iban}
                                    onChange={e => setProfile({ ...profile, iban: e.target.value })}
                                    placeholder="BE00 0000 0000 0000"
                                    className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-color)] transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block flex items-center gap-1.5">
                                    <CreditCard className="w-3 h-3" /> {t('nav.settings.bicCode')}
                                </label>
                                <input
                                    type="text"
                                    value={profile.bic}
                                    onChange={e => setProfile({ ...profile, bic: e.target.value })}
                                    placeholder="GEBABEB1XXX"
                                    className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-color)] transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Geography */}
                    <div className="space-y-6">
                        <h3 className="text-sm font-bold flex items-center gap-2 text-neutral-800 dark:text-neutral-200 uppercase tracking-widest border-b border-neutral-200 dark:border-white/10 pb-2">
                            <MapPin className="w-4 h-4" style={{ color: 'var(--brand-color, #d35400)' }} />
                            {t('nav.settings.addressesLocations')}
                        </h3>

                        <div className="space-y-4">
                            {/* Invoicing Address */}
                            <div className="bg-neutral-50 dark:bg-white/5 p-4 rounded-xl border border-neutral-200 dark:border-white/10">
                                <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-3 uppercase tracking-wider">{t('nav.settings.invoicingAddress')}</h4>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={profile.street}
                                        onChange={e => setProfile({ ...profile, street: e.target.value })}
                                        placeholder={t('nav.settings.streetNumber')}
                                        className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--brand-color)]"
                                    />
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            type="text"
                                            value={profile.postalCode}
                                            onChange={e => setProfile({ ...profile, postalCode: e.target.value })}
                                            placeholder={t('nav.settings.postalCode')}
                                            className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--brand-color)]"
                                        />
                                        <input
                                            type="text"
                                            value={profile.city}
                                            onChange={e => setProfile({ ...profile, city: e.target.value })}
                                            placeholder={t('nav.settings.city')}
                                            className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--brand-color)]"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Delivery Address */}
                            <div className="bg-neutral-50 dark:bg-white/5 p-4 rounded-xl border border-neutral-200 dark:border-white/10">
                                <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-3 uppercase tracking-wider">{t('nav.settings.deliveryAddress')}</h4>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={profile.deliveryStreet}
                                        onChange={e => setProfile({ ...profile, deliveryStreet: e.target.value })}
                                        placeholder={t('nav.settings.streetNumber')}
                                        className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--brand-color)]"
                                    />
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            type="text"
                                            value={profile.deliveryPostalCode}
                                            onChange={e => setProfile({ ...profile, deliveryPostalCode: e.target.value })}
                                            placeholder={t('nav.settings.postalCode')}
                                            className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--brand-color)]"
                                        />
                                        <input
                                            type="text"
                                            value={profile.deliveryCity}
                                            onChange={e => setProfile({ ...profile, deliveryCity: e.target.value })}
                                            placeholder={t('nav.settings.city')}
                                            className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--brand-color)]"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Headquarters Address (Hofdzetel) */}
                            <div className="bg-neutral-50 dark:bg-white/5 p-4 rounded-xl border border-neutral-200 dark:border-white/10">
                                <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-3 uppercase tracking-wider">{t('nav.settings.headquarters')}</h4>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={profile.headquartersStreet}
                                        onChange={e => setProfile({ ...profile, headquartersStreet: e.target.value })}
                                        placeholder={t('nav.settings.streetNumber')}
                                        className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--brand-color)]"
                                    />
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            type="text"
                                            value={profile.headquartersPostalCode}
                                            onChange={e => setProfile({ ...profile, headquartersPostalCode: e.target.value })}
                                            placeholder={t('nav.settings.postalCode')}
                                            className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--brand-color)]"
                                        />
                                        <input
                                            type="text"
                                            value={profile.headquartersCity}
                                            onChange={e => setProfile({ ...profile, headquartersCity: e.target.value })}
                                            placeholder={t('nav.settings.city')}
                                            className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--brand-color)]"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* App & Document Preferences */}
                <div className="mt-8 space-y-6">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-neutral-800 dark:text-neutral-200 uppercase tracking-widest border-b border-neutral-200 dark:border-white/10 pb-2">
                        <Globe className="w-4 h-4" style={{ color: 'var(--brand-color, #d35400)' }} />
                        {t('nav.settings.appPreferences')}
                    </h3>
                    <div className="max-w-md space-y-6">

                        {/* Interface Language — changes admin UI locale immediately */}
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block">
                                Interface Language
                            </label>
                            <select
                                value={session?.user ? (session.user as Record<string, string>).environmentLanguage ?? currentLocale : currentLocale}
                                onChange={async (e) => {
                                    const lang = e.target.value;
                                    const supported = ['en', 'fr', 'nl', 'ro', 'ru'];
                                    if (!supported.includes(lang)) return;
                                    await updateSession({ environmentLanguage: lang });
                                    const currentPath = window.location.pathname;
                                    const localeRegex = /^\/(en|fr|nl|ro|ru)(\/|$)/;
                                    const newPath = localeRegex.test(currentPath)
                                        ? currentPath.replace(localeRegex, `/${lang}$2`)
                                        : `/${lang}${currentPath}`;
                                    window.location.href = newPath;
                                }}
                                className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-color)] transition-colors"
                            >
                                <option value="nl">Nederlands</option>
                                <option value="fr">Français</option>
                                <option value="en">English</option>
                                <option value="ro">Română</option>
                                <option value="ru">Русский</option>
                            </select>
                            <p className="text-xs text-neutral-500 mt-2">
                                Changes the language of the admin interface immediately. Applies only to this workspace.
                            </p>
                        </div>

                        {/* Document Language — controls PDF/email output language */}
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block">{t('nav.settings.documentLanguage')}</label>
                            <select
                                value={profile.documentLanguage}
                                onChange={e => setProfile({ ...profile, documentLanguage: e.target.value })}
                                className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-color)] transition-colors"
                            >
                                <option value="">{t('nav.settings.fallbackOption')}</option>
                                <option value="en">English</option>
                                <option value="fr">Français</option>
                                <option value="nl">Nederlands</option>
                                <option value="ro">Română</option>
                                <option value="ru">Русский</option>
                            </select>
                            <p className="text-xs text-neutral-500 mt-2">{t('nav.settings.documentLanguageDesc')}</p>
                        </div>

                    </div>
                </div>

                {/* Document Numbering Patterns */}
                <div className="mt-8 space-y-8">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-neutral-800 dark:text-neutral-200 uppercase tracking-widest border-b border-neutral-200 dark:border-white/10 pb-2">
                        <Hash className="w-4 h-4" style={{ color: 'var(--brand-color, #d35400)' }} />
                        {t('nav.settings.documentNumbering')}
                    </h3>
                    <p className="text-xs text-neutral-500 -mt-4">{t('nav.settings.documentNumberingDesc')}</p>

                    {(['invoice', 'quotation'] as const).map((docType) => {
                        const prefix = profile[`${docType}Prefix` as keyof typeof profile] as string;
                        const connector = profile[`${docType}Connector` as keyof typeof profile] as string;
                        const dateFormat = profile[`${docType}DateFormat` as keyof typeof profile] as string;
                        const numberWidth = profile[`${docType}NumberWidth` as keyof typeof profile] as number;
                        const nextNumber = profile[`${docType}NextNumber` as keyof typeof profile] as number;

                        // Live preview
                        const datePart = (() => {
                            const now = new Date();
                            const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0'), d = String(now.getDate()).padStart(2, '0');
                            switch (dateFormat) {
                                case 'YYYY': return String(y);
                                case 'YY': return String(y).slice(-2);
                                case 'YYMM': return `${String(y).slice(-2)}${m}`;
                                case 'YYYYMM': return `${y}${m}`;
                                case 'YYYYMMDD': return `${y}${m}${d}`;
                                case 'DDMMYYYY': return `${d}${m}${y}`;
                                case 'MMYYYY': return `${m}${y}`;
                                default: return '';
                            }
                        })();
                        const joiner = connector === 'none' ? '' : connector;
                        const parts: string[] = [];
                        if (prefix) parts.push(prefix);
                        if (datePart) parts.push(datePart);
                        parts.push(numberWidth === 0 ? String(nextNumber) : String(nextNumber).padStart(numberWidth, '0'));
                        const preview = parts.join(joiner);

                        return (
                            <div key={docType} className="bg-white dark:bg-white/[0.02] border border-neutral-200 dark:border-white/10 rounded-2xl p-6 space-y-5">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold capitalize">{docType === 'invoice' ? t('nav.settings.invoiceNumbering') : t('nav.settings.quotationNumbering')}</h4>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{t('nav.settings.preview')}</span>
                                        <span className="font-mono text-sm font-black tracking-wider px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5" style={{ color: 'var(--brand-color, #d35400)' }}>{preview}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    {/* Prefix */}
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">{t('nav.settings.prefix')}</label>
                                        <input
                                            type="text"
                                            maxLength={5}
                                            value={prefix}
                                            onChange={e => setProfile({ ...profile, [`${docType}Prefix`]: e.target.value.toUpperCase().slice(0, 5) })}
                                            className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm font-mono font-bold outline-none focus:border-[var(--brand-color)] transition-colors"
                                        />
                                    </div>

                                    {/* Connector */}
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">{t('nav.settings.connector')}</label>
                                        <select
                                            value={connector}
                                            onChange={e => setProfile({ ...profile, [`${docType}Connector`]: e.target.value })}
                                            className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-[var(--brand-color)] transition-colors"
                                        >
                                        <option value="none">None</option>
                                            <option value="-">Hyphen ( - )</option>
                                            <option value=".">Dot ( . )</option>
                                            <option value=" ">Space ( )</option>
                                        </select>
                                    </div>

                                    {/* Date Format */}
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">{t('nav.settings.dateFormat')}</label>
                                        <select
                                            value={dateFormat}
                                            onChange={e => setProfile({ ...profile, [`${docType}DateFormat`]: e.target.value })}
                                            className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--brand-color)] transition-colors"
                                        >
                                            <option value="none">None</option>
                                            <option value="YYYY">YYYY (2026)</option>
                                            <option value="YY">YY (26)</option>
                                            <option value="YYMM">YYMM (2604)</option>
                                            <option value="YYYYMM">YYYYMM (202604)</option>
                                            <option value="YYYYMMDD">YYYYMMDD (20260405)</option>
                                            <option value="DDMMYYYY">DDMMYYYY (05042026)</option>
                                            <option value="MMYYYY">MMYYYY (042026)</option>
                                        </select>
                                    </div>

                                    {/* Number Width */}
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">{t('nav.settings.numberWidth')}</label>
                                        <select
                                            value={numberWidth}
                                            onChange={e => setProfile({ ...profile, [`${docType}NumberWidth`]: parseInt(e.target.value) })}
                                            className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-[var(--brand-color)] transition-colors"
                                        >
                                            <option value={0}>— (no padding)</option>
                                            <option value={1}>x (1)</option>
                                            <option value={2}>xx (01)</option>
                                            <option value={3}>xxx (001)</option>
                                            <option value={4}>xxxx (0001)</option>
                                            <option value={5}>xxxxx (00001)</option>
                                        </select>
                                    </div>

                                    {/* Next Number */}
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">{t('nav.settings.nextNumber')}</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={nextNumber}
                                            onChange={e => setProfile({ ...profile, [`${docType}NextNumber`]: Math.max(1, parseInt(e.target.value) || 1) })}
                                            className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm font-mono font-bold outline-none focus:border-[var(--brand-color)] transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Document Branding & Templates */}
                <div className="mt-8 space-y-6">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-neutral-800 dark:text-neutral-200 uppercase tracking-widest border-b border-neutral-200 dark:border-white/10 pb-2">
                        <Palette className="w-4 h-4" style={{ color: 'var(--brand-color, #d35400)' }} />
                        {t('nav.settings.branding')}
                    </h3>
                    <p className="text-xs text-neutral-500 -mt-4">{t('nav.settings.brandingDesc')}</p>
                    <DocumentTemplatesModule />
                </div>

            </div>
        </div>
    );
}
