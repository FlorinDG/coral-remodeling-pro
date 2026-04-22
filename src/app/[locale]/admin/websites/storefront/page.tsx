"use client";

import React, { useState, useEffect } from 'react';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { frontendTabs } from "@/config/tabs";
import { usePageTitle } from '@/hooks/usePageTitle';
import { Save, Globe, RefreshCw, CheckCircle2, AlertCircle, Zap, ExternalLink } from 'lucide-react';

// ── Storefront content groups ─────────────────────────────────────────────────
const CONTENT_GROUPS = {
    "Hero Section": {
        description: "The main hero banner on the CoralOS storefront landing page.",
        fields: [
            { key: "hero.tagline",    label: "Tagline badge" },
            { key: "hero.title1",     label: "Title part 1 (before gradient)" },
            { key: "hero.gradient",   label: "Gradient word (highlighted)" },
            { key: "hero.title2",     label: "Title part 2 (after gradient)" },
            { key: "hero.subtitle",   label: "Hero subtitle / description", multiline: true },
            { key: "hero.ctaPrimary", label: "Primary CTA button text" },
            { key: "hero.ctaSub",     label: "Secondary CTA text" },
        ]
    },
    "Trust Badges": {
        description: "Trust indicators shown below the hero.",
        fields: [
            { key: "trust.items", label: "Trust items (comma-separated)", multiline: true },
            { key: "trust.trustedBy", label: "'Trusted by' heading" },
            { key: "trust.sectors", label: "Sector names (comma-separated)", multiline: true },
        ]
    },
    "Features Section": {
        description: "Feature cards on the storefront.",
        fields: [
            { key: "features.title",    label: "Section title" },
            { key: "features.titleSub", label: "Title suffix (grayed out)" },
            { key: "features.subtitle", label: "Section subtitle", multiline: true },
        ]
    },
    "Peppol Section": {
        description: "The Peppol e-invoicing highlight block.",
        fields: [
            { key: "peppol.badge", label: "Badge text" },
            { key: "peppol.title", label: "Section title" },
            { key: "peppol.description", label: "Description", multiline: true },
            { key: "peppol.points", label: "Bullet points (one per line)", multiline: true },
            { key: "peppol.cta", label: "CTA button text" },
        ]
    },
    "Pricing Section": {
        description: "Pricing table content.",
        fields: [
            { key: "pricing.title", label: "Section title" },
            { key: "pricing.subtitle", label: "Subtitle" },
            { key: "pricing.founderNote", label: "Founder program title" },
            { key: "pricing.founderSub", label: "Founder program description", multiline: true },
            { key: "pricing.founderCta", label: "Founder CTA text" },
        ]
    },
    "FAQ Section": {
        description: "Frequently asked questions.",
        fields: [
            { key: "faq.title", label: "Section title" },
        ]
    },
    "Bottom CTA": {
        description: "The call-to-action block at the bottom of the page.",
        fields: [
            { key: "cta.title", label: "CTA title" },
            { key: "cta.subtitle", label: "CTA subtitle" },
            { key: "cta.button", label: "CTA button text" },
        ]
    },
    "Footer & Navigation": {
        description: "Footer links and navigation labels.",
        fields: [
            { key: "nav.features", label: "Features nav label" },
            { key: "nav.pricing", label: "Pricing nav label" },
            { key: "nav.faq", label: "FAQ nav label" },
            { key: "nav.login", label: "Login button text" },
            { key: "footer.help", label: "Help link text" },
            { key: "footer.terms", label: "Terms link text" },
            { key: "footer.website", label: "Website link text" },
        ]
    },
};

const LOCALES = ['nl', 'fr', 'en'] as const;

type ContentData = Record<string, Record<string, string>>;

export default function StorefrontCMSPage() {
    usePageTitle('Storefront CMS');
    const [activeLocale, setActiveLocale] = useState<typeof LOCALES[number]>('nl');
    const [content, setContent] = useState<ContentData>({});
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [loading, setLoading] = useState(true);

    // Fetch existing content
    useEffect(() => {
        fetch('/api/storefront-cms')
            .then(r => r.ok ? r.json() : {})
            .then(data => {
                setContent(data || {});
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const getValue = (key: string) => {
        return content?.[activeLocale]?.[key] || '';
    };

    const setValue = (key: string, value: string) => {
        setContent(prev => ({
            ...prev,
            [activeLocale]: {
                ...(prev[activeLocale] || {}),
                [key]: value,
            }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveStatus('idle');
        try {
            const res = await fetch('/api/storefront-cms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(content),
            });
            setSaveStatus(res.ok ? 'success' : 'error');
        } catch {
            setSaveStatus('error');
        } finally {
            setSaving(false);
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col w-full h-full">
                <ModuleTabs tabs={frontendTabs} groupId="frontend" />
                <div className="flex-1 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 animate-spin text-neutral-400" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={frontendTabs} groupId="frontend" />

            <div className="flex-1 overflow-y-auto">
                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="max-w-4xl mx-auto px-8 pt-8 pb-4">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Zap className="w-4 h-4 text-blue-500" />
                                <h1 className="text-xl font-bold tracking-tight">Storefront CMS</h1>
                            </div>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                Edit the content of the <a href="https://coral-sys.coral-group.be" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-1">CoralOS landing page <ExternalLink className="w-3 h-3" /></a>
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Locale switcher */}
                            <div className="flex items-center bg-neutral-100 dark:bg-white/[0.06] rounded-lg p-0.5 gap-0.5">
                                {LOCALES.map(loc => (
                                    <button
                                        key={loc}
                                        onClick={() => setActiveLocale(loc)}
                                        className={`text-[11px] font-bold px-3 py-1.5 rounded-md transition-all ${
                                            activeLocale === loc
                                                ? 'bg-white dark:bg-white/20 text-neutral-900 dark:text-white shadow-sm'
                                                : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                                        }`}
                                    >
                                        {loc.toUpperCase()}
                                    </button>
                                ))}
                            </div>

                            {/* Save button */}
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                    saveStatus === 'success'
                                        ? 'bg-green-500 text-white'
                                        : saveStatus === 'error'
                                            ? 'bg-red-500 text-white'
                                            : 'bg-neutral-900 dark:bg-white text-white dark:text-black hover:opacity-90'
                                } disabled:opacity-50`}
                            >
                                {saving ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : saveStatus === 'success' ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                ) : saveStatus === 'error' ? (
                                    <AlertCircle className="w-4 h-4" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {saving ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : saveStatus === 'error' ? 'Error' : 'Save Changes'}
                            </button>
                        </div>
                    </div>

                    {/* Active locale indicator */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg mb-6">
                        <Globe className="w-4 h-4 text-blue-500" />
                        <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                            Editing <strong>{activeLocale === 'nl' ? 'Dutch' : activeLocale === 'fr' ? 'French' : 'English'}</strong> content
                        </span>
                    </div>
                </div>

                {/* ── Content groups ──────────────────────────────────────── */}
                <div className="max-w-4xl mx-auto px-8 pb-20 space-y-8">
                    {Object.entries(CONTENT_GROUPS).map(([groupName, group]) => (
                        <section
                            key={groupName}
                            className="bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-white/10 rounded-2xl p-6"
                        >
                            <div className="mb-4">
                                <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                                    {groupName}
                                </h2>
                                <p className="text-xs text-neutral-400 mt-0.5">{group.description}</p>
                            </div>

                            <div className="space-y-4">
                                {group.fields.map(field => (
                                    <div key={field.key}>
                                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
                                            {field.label}
                                        </label>
                                        {(field as any).multiline ? (
                                            <textarea
                                                value={getValue(field.key)}
                                                onChange={e => setValue(field.key, e.target.value)}
                                                rows={3}
                                                className="w-full px-3 py-2.5 text-sm bg-neutral-50 dark:bg-black/30 border border-neutral-200 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all resize-none"
                                                placeholder={`${field.label} (${activeLocale.toUpperCase()})`}
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                value={getValue(field.key)}
                                                onChange={e => setValue(field.key, e.target.value)}
                                                className="w-full px-3 py-2.5 text-sm bg-neutral-50 dark:bg-black/30 border border-neutral-200 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                                                placeholder={`${field.label} (${activeLocale.toUpperCase()})`}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}
