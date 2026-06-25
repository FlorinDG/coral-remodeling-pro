"use client";
import React, { useState, useEffect } from "react";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredSettingsTabs } from "@/config/tabs";
import { Building2, Save, MapPin, Globe, CreditCard, AlertCircle, RefreshCw, Hash, FileText, Palette, CheckCircle2, Wifi } from "lucide-react";
import SearchableSelect from '@/components/ui/SearchableSelect';
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import DocumentTemplatesModule from '@/components/admin/settings/DocumentTemplatesModule';
import { useTranslations, useLocale } from 'next-intl';
import { useSession } from 'next-auth/react';
import { useTenant } from '@/context/TenantContext';
import { useRouter } from 'next/navigation';

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
    const router = useRouter();
    const { data: session, update: updateSession } = useSession();

    // PROFILE-2: Initialize persisted fields to null ("not loaded" sentinel), NOT to fake
    // defaults like 'INV'/1/'#d35400'. This prevents unconditional PUTs from overwriting
    // real DB values with hardcoded defaults if save fires before hydration.
    // Display defaults are applied ONLY at render time via ?? operators.
    const [profile, setProfile] = useState<{
        companyName: string;
        vatNumber: string;
        email: string;
        street: string;
        postalCode: string;
        city: string;
        iban: string;
        peppolId: string;
        peppolRegistered: boolean;
        peppolOptOut: boolean;
        commercialName: string;
        bic: string;
        deliveryStreet: string;
        deliveryPostalCode: string;
        deliveryCity: string;
        headquartersStreet: string;
        headquartersPostalCode: string;
        headquartersCity: string;
        directorFirstName: string;
        directorLastName: string;
        documentLanguage: string;
        // Document numbering — null = not yet loaded from DB
        invoicePrefix: string | null;
        invoiceConnector: string | null;
        invoiceDateFormat: string | null;
        invoiceNumberWidth: number | null;
        invoiceNextNumber: number | null;
        quotationPrefix: string | null;
        quotationConnector: string | null;
        quotationDateFormat: string | null;
        quotationNumberWidth: number | null;
        quotationNextNumber: number | null;
        creditnotePrefix: string | null;
        creditnoteConnector: string | null;
        creditnoteDateFormat: string | null;
        creditnoteNumberWidth: number | null;
        creditnoteNextNumber: number | null;
    }>({
        companyName: '',
        vatNumber: '',
        email: '',
        street: '',
        postalCode: '',
        city: '',
        iban: '',
        peppolId: '',
        peppolRegistered: false,
        peppolOptOut: false,
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
        // Document numbering — null sentinels (not loaded yet)
        invoicePrefix: null,
        invoiceConnector: null,
        invoiceDateFormat: null,
        invoiceNumberWidth: null,
        invoiceNextNumber: null,
        quotationPrefix: null,
        quotationConnector: null,
        quotationDateFormat: null,
        quotationNumberWidth: null,
        quotationNextNumber: null,
        creditnotePrefix: null,
        creditnoteConnector: null,
        creditnoteDateFormat: null,
        creditnoteNumberWidth: null,
        creditnoteNextNumber: null,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const { tenant, activeModules, refreshTenant } = useTenant();

    useEffect(() => {
        if (tenant) {
            setProfile({
                companyName: tenant.companyName || '',
                vatNumber: tenant.vatNumber || '',
                email: tenant.email || '',
                street: tenant.street || '',
                postalCode: tenant.postalCode || '',
                city: tenant.city || '',
                iban: tenant.iban || '',
                peppolId: tenant.peppolId || '',
                peppolRegistered: tenant.peppolRegistered || false,
                peppolOptOut: tenant.peppolOptOut || false,
                commercialName: tenant.commercialName || '',
                bic: tenant.bic || '',
                deliveryStreet: tenant.deliveryStreet || '',
                deliveryPostalCode: tenant.deliveryPostalCode || '',
                deliveryCity: tenant.deliveryCity || '',
                headquartersStreet: tenant.headquartersStreet || '',
                headquartersPostalCode: tenant.headquartersPostalCode || '',
                headquartersCity: tenant.headquartersCity || '',
                directorFirstName: tenant.directorFirstName || '',
                directorLastName: tenant.directorLastName || '',
                documentLanguage: tenant.documentLanguage || '',
                // PROFILE-2: Store the ACTUAL DB values (including null/undefined).
                // Display defaults (INV, 1, etc.) are applied at render via ?? operators.
                invoicePrefix: tenant.invoicePrefix ?? null,
                invoiceConnector: tenant.invoiceConnector ?? null,
                invoiceDateFormat: tenant.invoiceDateFormat ?? null,
                invoiceNumberWidth: tenant.invoiceNumberWidth ?? null,
                invoiceNextNumber: tenant.invoiceNextNumber ?? null,
                quotationPrefix: tenant.quotationPrefix ?? null,
                quotationConnector: tenant.quotationConnector ?? null,
                quotationDateFormat: tenant.quotationDateFormat ?? null,
                quotationNumberWidth: tenant.quotationNumberWidth ?? null,
                quotationNextNumber: tenant.quotationNextNumber ?? null,
                creditnotePrefix: tenant.creditnotePrefix ?? null,
                creditnoteConnector: tenant.creditnoteConnector ?? null,
                creditnoteDateFormat: tenant.creditnoteDateFormat ?? null,
                creditnoteNumberWidth: tenant.creditnoteNumberWidth ?? null,
                creditnoteNextNumber: tenant.creditnoteNextNumber ?? null,
            });
            setLoading(false);
        }
    }, [tenant]);

    const [showPeppolModal, setShowPeppolModal] = useState(false);

    const handleSave = async () => {
        // If they have a VAT number, haven't registered for Peppol, and haven't opted out yet
        if (profile.vatNumber?.trim() && !profile.peppolRegistered && !profile.peppolOptOut) {
            setShowPeppolModal(true);
            return;
        }
        await proceedWithSave(profile);
    };

    const proceedWithSave = async (dataToSave: typeof profile) => {
        // PROFILE-2: Gate save on hydration — never persist un-hydrated state
        if (!tenant) {
            toast.error('Profile not loaded yet. Please wait and try again.');
            return;
        }
        setSaving(true);
        try {
            // PROFILE-2: Send only fields this page OWNS and that were actually loaded.
            // Skip null fields (not-loaded sentinels) and drop documentTemplate
            // (owned by DocumentTemplatesModule — overlapping writers caused resets).
            const ownedFields: Record<string, any> = {};
            for (const [key, value] of Object.entries(dataToSave)) {
                if (key === 'documentTemplate') continue; // not our field
                if (value === null) continue; // not loaded — don't overwrite DB
                ownedFields[key] = value;
            }
            const res = await fetch('/api/tenant/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ownedFields)
            });
            if (res.ok) {
                toast.success('Company profile saved securely!');
                // PROFILE-2: refreshTenant() fetches the FULL tenant from the API.
                // Do NOT call router.refresh() — it triggers a server re-render
                // that overwrites the full tenant (with branding/numbering) with
                // the minimal server-side select (without those fields), causing
                // a visible flash to defaults.
                await refreshTenant();
            } else {
                throw new Error('Failed to save');
            }
        } catch (e) {
            console.error('Failed to save profile', e);
            toast.error('Failed to save profile. Please try again.');
        } finally {
            setSaving(false);
            setShowPeppolModal(false);
        }
    };

    const handlePeppolOptIn = async () => {
        const updatedProfile = { ...profile, peppolOptOut: false };
        setProfile(updatedProfile);
        
        // Save the profile first
        await proceedWithSave(updatedProfile);

        // Then trigger Peppol onboarding
        toast.loading('Activating Peppol Network...', { id: 'peppol-activate' });
        try {
            const res = await fetch('/api/peppol/onboard', { method: 'POST' });
            if (res.ok) {
                toast.success('Peppol activated successfully!', { id: 'peppol-activate' });
                // Force a reload to show the connected banner
                window.location.reload();
            } else {
                const data = await res.json();
                throw new Error(data.error || 'Failed to activate Peppol');
            }
        } catch (e: any) {
            toast.error(e.message || 'Failed to activate Peppol', { id: 'peppol-activate' });
        }
    };

    const handlePeppolOptOut = async () => {
        const updatedProfile = { ...profile, peppolOptOut: true };
        setProfile(updatedProfile);
        await proceedWithSave(updatedProfile);
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
                        disabled={saving || loading || !tenant}
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
                            <SearchableSelect
                                value={session?.user?.environmentLanguage ?? currentLocale}
                                onChange={async (lang) => {
                                    const supported = ['en', 'fr', 'nl', 'ro', 'ru'];
                                    if (!supported.includes(lang)) return;
                                    await updateSession({ environmentLanguage: lang });
                                    // PROFILE-1: Sync NEXT_LOCALE cookie immediately — don't rely on middleware round-trip
                                    document.cookie = `NEXT_LOCALE=${lang};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
                                    const currentPath = window.location.pathname;
                                    const localeRegex = /^\/(en|fr|nl|ro|ru)(\/|$)/;
                                    const newPath = localeRegex.test(currentPath)
                                        ? currentPath.replace(localeRegex, `/${lang}$2`)
                                        : `/${lang}${currentPath}`;
                                    window.location.href = newPath;
                                }}
                                options={[
                                    { value: 'nl', label: 'Nederlands' },
                                    { value: 'fr', label: 'Français' },
                                    { value: 'en', label: 'English' },
                                    { value: 'ro', label: 'Română' },
                                    { value: 'ru', label: 'Русский' },
                                ]}
                                placeholder="Select language"
                            />
                            <p className="text-xs text-neutral-500 mt-2">
                                Changes the language of the admin interface immediately. Applies only to this workspace.
                            </p>
                        </div>

                        {/* Document Language — controls PDF/email output language */}
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block">{t('nav.settings.documentLanguage')}</label>
                            <SearchableSelect
                                value={profile.documentLanguage}
                                onChange={(val) => setProfile({ ...profile, documentLanguage: val })}
                                options={[
                                    { value: '', label: t('nav.settings.fallbackOption') },
                                    { value: 'en', label: 'English' },
                                    { value: 'fr', label: 'Français' },
                                    { value: 'nl', label: 'Nederlands' },
                                    { value: 'ro', label: 'Română' },
                                    { value: 'ru', label: 'Русский' },
                                ]}
                                placeholder={t('nav.settings.fallbackOption')}
                            />
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

                    {(['invoice', 'quotation', 'creditnote'] as const).map((docType) => {
                        // PROFILE-2: Apply display defaults at render \u2014 null = not loaded yet
                        const prefix = (profile[`${docType}Prefix` as keyof typeof profile] as string | null) ?? (docType === 'invoice' ? 'INV' : docType === 'quotation' ? 'OFF' : 'CN');
                        const connector = (profile[`${docType}Connector` as keyof typeof profile] as string | null) ?? '-';
                        const dateFormat = (profile[`${docType}DateFormat` as keyof typeof profile] as string | null) ?? 'YYYY';
                        const numberWidth = (profile[`${docType}NumberWidth` as keyof typeof profile] as number | null) ?? 3;
                        const nextNumber = (profile[`${docType}NextNumber` as keyof typeof profile] as number | null) ?? 1;

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
                                    <h4 className="text-sm font-bold capitalize">{docType === 'invoice' ? t('nav.settings.invoiceNumbering') : docType === 'quotation' ? t('nav.settings.quotationNumbering') : t('nav.settings.creditnoteNumbering')}</h4>
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
                                        <SearchableSelect
                                            value={connector}
                                            onChange={(val) => setProfile({ ...profile, [`${docType}Connector`]: val })}
                                            options={[
                                                { value: 'none', label: 'None' },
                                                { value: '-', label: 'Hyphen ( - )' },
                                                { value: '.', label: 'Dot ( . )' },
                                                { value: ' ', label: 'Space ( )' },
                                            ]}
                                            placeholder="Connector"
                                        />
                                    </div>

                                    {/* Date Format */}
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">{t('nav.settings.dateFormat')}</label>
                                        <SearchableSelect
                                            value={dateFormat}
                                            onChange={(val) => setProfile({ ...profile, [`${docType}DateFormat`]: val })}
                                            options={[
                                                { value: 'none', label: 'None' },
                                                { value: 'YYYY', label: 'YYYY (2026)' },
                                                { value: 'YY', label: 'YY (26)' },
                                                { value: 'YYMM', label: 'YYMM (2604)' },
                                                { value: 'YYYYMM', label: 'YYYYMM (202604)' },
                                                { value: 'YYYYMMDD', label: 'YYYYMMDD (20260405)' },
                                                { value: 'DDMMYYYY', label: 'DDMMYYYY (05042026)' },
                                                { value: 'MMYYYY', label: 'MMYYYY (042026)' },
                                            ]}
                                            placeholder="Date format"
                                        />
                                    </div>

                                    {/* Number Width */}
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">{t('nav.settings.numberWidth')}</label>
                                        <SearchableSelect
                                            value={String(numberWidth)}
                                            onChange={(val) => setProfile({ ...profile, [`${docType}NumberWidth`]: parseInt(val) })}
                                            options={[
                                                { value: '0', label: '— (no padding)' },
                                                { value: '1', label: 'x (1)' },
                                                { value: '2', label: 'xx (01)' },
                                                { value: '3', label: 'xxx (001)' },
                                                { value: '4', label: 'xxxx (0001)' },
                                                { value: '5', label: 'xxxxx (00001)' },
                                            ]}
                                            placeholder="Width"
                                        />
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

            {/* Peppol Opt-In Modal */}
            {showPeppolModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-4">
                                <Globe className="w-6 h-6" />
                            </div>
                            <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
                                Activate Peppol E-Invoicing?
                            </h2>
                            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed mb-6">
                                Sending and receiving invoices via the European Peppol network becomes <strong>mandatory for all B2B transactions in Belgium starting in 2026</strong>.
                                <br /><br />
                                Since you provided a valid VAT number, we can securely register your business on the Peppol network right now for free.
                            </p>
                            
                            <div className="flex flex-col gap-3">
                                <Button
                                    onClick={handlePeppolOptIn}
                                    disabled={saving}
                                    className="w-full font-bold bg-orange-600 hover:bg-orange-700 text-white"
                                >
                                    {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                    Yes, activate Peppol automatically
                                </Button>
                                <Button
                                    onClick={handlePeppolOptOut}
                                    disabled={saving}
                                    variant="outline"
                                    className="w-full text-neutral-500"
                                >
                                    No, I'll do this later (Opt-out)
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
