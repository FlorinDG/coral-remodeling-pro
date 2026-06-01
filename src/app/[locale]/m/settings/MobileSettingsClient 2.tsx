"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
    Building2, CreditCard, Save, RefreshCw, AlertCircle,
    CheckCircle2, Wifi, ArrowLeft, Paintbrush, FileText, Check, X, Shield, Crown, Zap, Sparkles
} from "lucide-react";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { Button } from "@/components/time-tracker/components/ui/button";

interface BillingData {
    planType: string;
    subscriptionStatus: string;
    billingCycle: string;
    hasStripe: boolean;
    hasSubscription: boolean;
    trialDaysLeft: number;
    isTrialing: boolean;
    isCancelling: boolean;
    cancellationEffectiveAt: string | null;
    peppolSent: number;
    peppolReceived: number;
    peppolSentLimit: number | null;
    peppolReceivedLimit: number | null;
    scanCount: number;
    scanQuota: number;
    userCount: number;
    extraUserCount: number;
    workforceUserCount: number;
    quarterlyDiscount: number;
    overagePrice: number;
}

interface ProfileData {
    companyName: string;
    vatNumber: string;
    email: string;
    street: string;
    postalCode: string;
    city: string;
    iban: string;
    bic: string;
    commercialName: string;
    deliveryStreet: string;
    deliveryPostalCode: string;
    deliveryCity: string;
    headquartersStreet: string;
    headquartersPostalCode: string;
    headquartersCity: string;
    directorFirstName: string;
    directorLastName: string;
    documentLanguage: string;
    invoicePrefix: string;
    invoiceConnector: string;
    invoiceDateFormat: string;
    invoiceNumberWidth: number;
    invoiceNextNumber: number;
    quotationPrefix: string;
    quotationConnector: string;
    quotationDateFormat: string;
    quotationNumberWidth: number;
    quotationNextNumber: number;
    documentTemplate: string;
    brandColor: string;
}

const PLAN_BADGE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    FREE:       { bg: "bg-neutral-200 dark:bg-neutral-800", text: "text-neutral-900 dark:text-neutral-100", icon: <Zap className="w-4 h-4" /> },
    PRO:        { bg: "bg-orange-100 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-400", icon: <Crown className="w-4 h-4" /> },
    ENTERPRISE: { bg: "bg-violet-100 dark:bg-violet-950/40", text: "text-violet-700 dark:text-violet-400", icon: <Shield className="w-4 h-4" /> },
    FOUNDER:    { bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-400", icon: <Sparkles className="w-4 h-4" /> },
    CUSTOM:     { bg: "bg-pink-100 dark:bg-pink-950/40", text: "text-pink-700 dark:text-pink-400", icon: <Shield className="w-4 h-4" /> },
};

const PLANS = [
    {
        id: "FREE",
        name: "Free",
        price: 0,
        period: "/mo",
        includedUsers: 1,
        features: [
            { text: "Quotations & Invoicing", included: true },
            { text: "Peppol (5 sent/mo)", included: true },
            { text: "Expense tracking", included: true },
            { text: "30 OCR scans/month", included: true },
            { text: "1 user", included: true },
            { text: "CRM Pipeline", included: false },
            { text: "Projects & Portals", included: false },
        ],
    },
    {
        id: "PRO",
        name: "Pro",
        price: 29,
        period: "/mo",
        includedUsers: 1,
        extraUserPrice: 19,
        workforcePrice: 4.99,
        features: [
            { text: "Everything in Free", included: true },
            { text: "Peppol (20 sent/mo)", included: true },
            { text: "300 OCR scans/month", included: true },
            { text: "CRM Sales Pipeline", included: true },
            { text: "Projects & Portals", included: true },
            { text: "Custom Databases", included: true },
            { text: "Unlimited users", included: true },
        ],
    },
    {
        id: "ENTERPRISE",
        name: "Enterprise",
        price: 99,
        period: "/mo",
        includedUsers: 2,
        extraUserPrice: 79,
        workforcePrice: 1.99,
        features: [
            { text: "Everything in Pro", included: true },
            { text: "Unlimited Peppol e-invoicing", included: true },
            { text: "Unlimited OCR scans", included: true },
            { text: "HR & Scheduling", included: true },
            { text: "Website CMS", included: true },
            { text: "White-label documents", included: true },
            { text: "Unlimited users", included: true },
        ],
    },
];

export default function MobileSettingsClient({
    locale,
    activeModules,
    planType,
    billingData,
    initialProfile,
}: {
    locale: string;
    activeModules: string[];
    planType: string;
    billingData: BillingData;
    initialProfile: ProfileData;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session, update: updateSession } = useSession();
    const [isPending, startTransition] = useTransition();

    // Determine current tab from query param, default to company-info
    const initialTab = searchParams.get("tab") || "company-info";
    const [activeTab, setActiveTab] = useState(initialTab);

    useEffect(() => {
        const tab = searchParams.get("tab");
        if (tab) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    const [profile, setProfile] = useState<ProfileData>(initialProfile);
    const [saving, setSaving] = useState(false);
    const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "QUARTERLY">(
        billingData.billingCycle === "QUARTERLY" ? "QUARTERLY" : "MONTHLY"
    );

    // Peppol onboarding states
    const [fetchingRegistry, setFetchingRegistry] = useState(false);
    const [peppolStatus, setPeppolStatus] = useState<{
        connected: boolean;
        peppolRegistered: boolean;
        peppolId?: string;
        companyName?: string;
        loading: boolean;
    }>({ connected: false, peppolRegistered: false, loading: true });

    useEffect(() => {
        fetch("/api/peppol/onboard")
            .then(r => (r.ok ? r.json() : null))
            .then(data => {
                if (data) {
                    setPeppolStatus({
                        connected: data.connected,
                        peppolRegistered: data.peppolRegistered,
                        peppolId: data.peppolId,
                        companyName: data.companyName,
                        loading: false,
                    });
                } else {
                    setPeppolStatus(s => ({ ...s, loading: false }));
                }
            })
            .catch(() => setPeppolStatus(s => ({ ...s, loading: false })));
    }, []);

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/tenant/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(profile),
            });
            if (res.ok) {
                toast.success("Profile changes saved successfully!");
                
                // If language changed, reload & update NextAuth session
                const newLang = profile.documentLanguage;
                const supportedLocales = ["en", "fr", "nl", "ro", "ru"];
                if (newLang && supportedLocales.includes(newLang)) {
                    await updateSession({ environmentLanguage: newLang });
                    router.refresh();
                }
            } else {
                throw new Error("Failed to save settings");
            }
        } catch (e) {
            console.error(e);
            toast.error("Error saving settings. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleUpgrade = async (planId: string) => {
        try {
            const res = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planType: planId, billingCycle }),
            });
            const result = await res.json();
            if (result.url) {
                globalThis.location.assign(result.url);
            } else {
                toast.error(result.error || "Could not launch checkout.");
            }
        } catch (e) {
            console.error(e);
            toast.error("Billing connection error. Please try again.");
        }
    };

    const handleManageBilling = async () => {
        try {
            const res = await fetch("/api/stripe/portal", { method: "POST" });
            const result = await res.json();
            if (result.url) {
                globalThis.location.assign(result.url);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleFetchRegistry = async () => {
        if (!profile.vatNumber || profile.vatNumber.trim() === "") {
            toast.error("Please enter a VAT Number first.");
            return;
        }

        setFetchingRegistry(true);
        toast.loading("Fetching registry info...", { id: "vat-lookup" });

        try {
            const response = await fetch(`/api/company/lookup?vat=${encodeURIComponent(profile.vatNumber)}`);
            if (!response.ok) throw new Error("API lookup error");

            const data = await response.json();
            if (data.isValid) {
                setProfile(prev => ({
                    ...prev,
                    companyName: data.name !== "---" ? data.name : prev.companyName,
                    street: data.address !== "---" ? data.address.replace(/\n/g, ", ") : prev.street,
                }));
                toast.success("Imported corporate profile details!", { id: "vat-lookup" });
            } else {
                toast.error("VAT Number not found in directory.", { id: "vat-lookup" });
            }
        } catch (e) {
            console.error(e);
            toast.error("Registry lookup failed.", { id: "vat-lookup" });
        } finally {
            setFetchingRegistry(false);
        }
    };

    const getPrice = (basePrice: number) => {
        if (billingCycle === "QUARTERLY") {
            const discounted = basePrice * (1 - billingData.quarterlyDiscount);
            return { price: discounted, period: "/mo", billing: `€${(discounted * 3).toFixed(0)} billed quarterly` };
        }
        return { price: basePrice, period: "/mo", billing: "billed monthly" };
    };

    const badge = PLAN_BADGE[billingData.planType] || PLAN_BADGE.FREE;
    const isFounder = billingData.planType === "FOUNDER" || billingData.planType === "CUSTOM";

    // Dynamic numbering live preview
    const getNumberingPreview = (type: "invoice" | "quotation") => {
        const prefix = profile[`${type}Prefix` as keyof ProfileData] as string;
        const connector = profile[`${type}Connector` as keyof ProfileData] as string;
        const dateFormat = profile[`${type}DateFormat` as keyof ProfileData] as string;
        const numberWidth = profile[`${type}NumberWidth` as keyof ProfileData] as number;
        const nextNumber = profile[`${type}NextNumber` as keyof ProfileData] as number;

        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");

        let datePart = "";
        switch (dateFormat) {
            case "YYYY": datePart = String(y); break;
            case "YY": datePart = String(y).slice(-2); break;
            case "YYMM": datePart = `${String(y).slice(-2)}${m}`; break;
            case "YYYYMM": datePart = `${y}${m}`; break;
            case "YYYYMMDD": datePart = `${y}${m}${d}`; break;
            case "DDMMYYYY": datePart = `${d}${m}${y}`; break;
            case "MMYYYY": datePart = `${m}${y}`; break;
        }

        const joiner = connector === "none" ? "" : connector;
        const parts = [];
        if (prefix) parts.push(prefix);
        if (datePart) parts.push(datePart);
        parts.push(numberWidth === 0 ? String(nextNumber) : String(nextNumber).padStart(numberWidth, "0"));
        return parts.join(joiner);
    };

    return (
        <div className="max-w-lg mx-auto flex flex-col min-h-[calc(100vh-8rem)] bg-neutral-50 dark:bg-black pb-10">
            {/* Header with Back button */}
            <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-neutral-200 dark:border-white/10">
                <div className="flex items-center gap-2">
                    <Link
                        href="/m"
                        className="p-2 -ml-2 rounded-xl hover:bg-neutral-200 dark:hover:bg-white/5 text-neutral-900 dark:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h2 className="text-lg font-black tracking-tight text-neutral-950 dark:text-white">Settings</h2>
                </div>
                <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--brand-color,#d35400)] text-white text-xs font-black shadow-md hover:opacity-90 disabled:opacity-50 transition-all"
                >
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save
                </button>
            </div>

            {/* Horizontal Scroll Tab Selector */}
            <div className="flex overflow-x-auto gap-1.5 px-4 py-3 border-b border-neutral-200 dark:border-white/10 scrollbar-none shrink-0 bg-white dark:bg-neutral-950">
                {[
                    { id: "company-info", label: "Identity", icon: <Building2 className="w-4 h-4" /> },
                    { id: "billing", label: "Billing", icon: <CreditCard className="w-4 h-4" /> },
                    { id: "ui", label: "Branding", icon: <Paintbrush className="w-4 h-4" /> },
                    { id: "opt-peppol", label: "Peppol", icon: <Wifi className="w-4 h-4" /> },
                    { id: "opt-templates", label: "Stationery", icon: <FileText className="w-4 h-4" /> },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setActiveTab(tab.id);
                            router.replace(`/m/settings?tab=${tab.id}`);
                        }}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-black whitespace-nowrap transition-all border ${
                            activeTab === tab.id
                                ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 border-neutral-900 dark:border-white shadow-sm"
                                : "bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-250 dark:border-white/5"
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Main Tabs Area */}
            <div className="flex-1 px-4 py-4 space-y-6">
                
                {/* ── 1. Company Info Tab ── */}
                {activeTab === "company-info" && (
                    <div className="space-y-5 animate-in fade-in-50 duration-200">
                        {/* Business identity */}
                        <div className="space-y-4 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-white/10 rounded-2xl p-4 shadow-sm">
                            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 mb-2">
                                <Building2 className="w-4 h-4" style={{ color: "var(--brand-color)" }} />
                                Business Identity
                            </h3>

                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-300 mb-1 block">Legal Company Name</label>
                                    <input
                                        type="text"
                                        value={profile.companyName}
                                        onChange={e => setProfile({ ...profile, companyName: e.target.value })}
                                        placeholder="Company legal entity"
                                        className="w-full bg-neutral-50 dark:bg-black border border-neutral-350 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-bold text-neutral-900 dark:text-white outline-none focus:border-[var(--brand-color)] focus:ring-1 focus:ring-[var(--brand-color)] transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-300 mb-1 block">Commercial Name</label>
                                    <input
                                        type="text"
                                        value={profile.commercialName}
                                        onChange={e => setProfile({ ...profile, commercialName: e.target.value })}
                                        placeholder="DBA / Brand name"
                                        className="w-full bg-neutral-50 dark:bg-black border border-neutral-350 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-bold text-neutral-900 dark:text-white outline-none focus:border-[var(--brand-color)] focus:ring-1 focus:ring-[var(--brand-color)] transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-300 mb-1 block">VAT Number (KBO)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={profile.vatNumber}
                                            onChange={e => setProfile({ ...profile, vatNumber: e.target.value })}
                                            placeholder="BE 0123.456.789"
                                            className="flex-1 bg-neutral-50 dark:bg-black border border-neutral-350 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-bold text-neutral-900 dark:text-white outline-none focus:border-[var(--brand-color)] transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleFetchRegistry}
                                            disabled={fetchingRegistry}
                                            className="px-3.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 font-black text-xs hover:opacity-95 active:scale-95 transition-all flex items-center justify-center border border-transparent disabled:opacity-50"
                                        >
                                            {fetchingRegistry ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Fetch"}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-300 mb-1 block">Billing Email</label>
                                    <input
                                        type="email"
                                        value={profile.email}
                                        onChange={e => setProfile({ ...profile, email: e.target.value })}
                                        placeholder="accounting@mycompany.be"
                                        className="w-full bg-neutral-50 dark:bg-black border border-neutral-350 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-bold text-neutral-900 dark:text-white outline-none focus:border-[var(--brand-color)] focus:ring-1 focus:ring-[var(--brand-color)] transition-all"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-300 mb-1 block">Director First Name</label>
                                        <input
                                            type="text"
                                            value={profile.directorFirstName}
                                            onChange={e => setProfile({ ...profile, directorFirstName: e.target.value })}
                                            className="w-full bg-neutral-50 dark:bg-black border border-neutral-350 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-bold text-neutral-900 dark:text-white outline-none focus:border-[var(--brand-color)] focus:ring-1 focus:ring-[var(--brand-color)] transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-300 mb-1 block">Director Last Name</label>
                                        <input
                                            type="text"
                                            value={profile.directorLastName}
                                            onChange={e => setProfile({ ...profile, directorLastName: e.target.value })}
                                            className="w-full bg-neutral-50 dark:bg-black border border-neutral-350 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-bold text-neutral-900 dark:text-white outline-none focus:border-[var(--brand-color)] focus:ring-1 focus:ring-[var(--brand-color)] transition-all"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-300 mb-1 block">IBAN</label>
                                    <input
                                        type="text"
                                        value={profile.iban}
                                        onChange={e => setProfile({ ...profile, iban: e.target.value })}
                                        placeholder="BE00 0000 0000 0000"
                                        className="w-full bg-neutral-50 dark:bg-black border border-neutral-350 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-bold text-neutral-900 dark:text-white outline-none focus:border-[var(--brand-color)] focus:ring-1 focus:ring-[var(--brand-color)] transition-all animate-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-300 mb-1 block">BIC</label>
                                    <input
                                        type="text"
                                        value={profile.bic}
                                        onChange={e => setProfile({ ...profile, bic: e.target.value })}
                                        placeholder="GEBA BE B1 XXX"
                                        className="w-full bg-neutral-50 dark:bg-black border border-neutral-350 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-bold text-neutral-900 dark:text-white outline-none focus:border-[var(--brand-color)] focus:ring-1 focus:ring-[var(--brand-color)] transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Invoicing Address */}
                        <div className="space-y-4 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-white/10 rounded-2xl p-4 shadow-sm">
                            <h4 className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">Invoicing Address</h4>
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={profile.street}
                                    onChange={e => setProfile({ ...profile, street: e.target.value })}
                                    placeholder="Street & number"
                                    className="w-full bg-neutral-50 dark:bg-black border border-neutral-350 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-bold outline-none focus:border-[var(--brand-color)]"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        value={profile.postalCode}
                                        onChange={e => setProfile({ ...profile, postalCode: e.target.value })}
                                        placeholder="Postal code"
                                        className="w-full bg-neutral-50 dark:bg-black border border-neutral-350 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-bold outline-none focus:border-[var(--brand-color)]"
                                    />
                                    <input
                                        type="text"
                                        value={profile.city}
                                        onChange={e => setProfile({ ...profile, city: e.target.value })}
                                        placeholder="City"
                                        className="w-full bg-neutral-50 dark:bg-black border border-neutral-350 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-bold outline-none focus:border-[var(--brand-color)]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Preferences */}
                        <div className="space-y-4 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-white/10 rounded-2xl p-4 shadow-sm">
                            <h4 className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">Language Preferences</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-300 mb-1.5 block">Interface Language</label>
                                    <SearchableSelect
                                        value={session?.user?.environmentLanguage ?? locale}
                                        onChange={async (lang) => {
                                            const supported = ["en", "fr", "nl", "ro", "ru"];
                                            if (!supported.includes(lang)) return;
                                            await updateSession({ environmentLanguage: lang });
                                            router.refresh();
                                        }}
                                        options={[
                                            { value: "nl", label: "Nederlands" },
                                            { value: "fr", label: "Français" },
                                            { value: "en", label: "English" },
                                            { value: "ro", label: "Română" },
                                            { value: "ru", label: "Русский" },
                                        ]}
                                        placeholder="Select language"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-300 mb-1.5 block">Document Language (PDFs)</label>
                                    <SearchableSelect
                                        value={profile.documentLanguage}
                                        onChange={(val) => setProfile({ ...profile, documentLanguage: val })}
                                        options={[
                                            { value: "", label: "Fallback to Client Language" },
                                            { value: "en", label: "English" },
                                            { value: "fr", label: "Français" },
                                            { value: "nl", label: "Nederlands" },
                                            { value: "ro", label: "Română" },
                                            { value: "ru", label: "Русский" },
                                        ]}
                                        placeholder="Document language fallback"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Document Numbering */}
                        <div className="space-y-4 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-white/10 rounded-2xl p-4 shadow-sm">
                            <h4 className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">Document Numbering</h4>
                            
                            {(["invoice", "quotation"] as const).map(type => (
                                <div key={type} className="border-b border-neutral-100 dark:border-white/5 pb-4 last:border-b-0 last:pb-0 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h5 className="text-xs font-black capitalize text-neutral-700 dark:text-neutral-300">{type} Numbering</h5>
                                        <span className="font-mono text-xs font-black px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-[var(--brand-color)] rounded border border-neutral-300 dark:border-white/10">
                                            {getNumberingPreview(type)}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[9px] font-black text-neutral-500 block mb-1">Prefix</label>
                                            <input
                                                type="text"
                                                value={profile[`${type}Prefix` as keyof ProfileData] as string}
                                                onChange={e => setProfile({ ...profile, [`${type}Prefix`]: e.target.value.toUpperCase().slice(0, 5) })}
                                                className="w-full bg-neutral-50 dark:bg-black border border-neutral-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-neutral-500 block mb-1">Next Number</label>
                                            <input
                                                type="number"
                                                value={profile[`${type}NextNumber` as keyof ProfileData] as number}
                                                onChange={e => setProfile({ ...profile, [`${type}NextNumber`]: Math.max(1, parseInt(e.target.value) || 1) })}
                                                className="w-full bg-neutral-50 dark:bg-black border border-neutral-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── 2. Plan & Billing Tab ── */}
                {activeTab === "billing" && (
                    <div className="space-y-6 animate-in fade-in-50 duration-200">
                        {/* Current Plan Overview */}
                        <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-white/10 rounded-2xl p-4 shadow-sm space-y-4">
                            <div className="flex items-start justify-between flex-wrap gap-2">
                                <div>
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${badge.bg} ${badge.text}`}>
                                            {badge.icon} {billingData.planType}
                                        </span>
                                        {billingData.isCancelling && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                                                Cancelling
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                                        {isFounder
                                            ? "Founding Member — all capabilities unlocked."
                                            : billingData.planType === "FREE"
                                                ? "Downgraded to FREE. Upgrade to activate tools."
                                                : `Subscription status is currently ${billingData.subscriptionStatus.toLowerCase()}.`}
                                    </p>
                                </div>
                                {billingData.hasSubscription && (
                                    <button
                                        onClick={handleManageBilling}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-350 dark:border-white/15 text-xs font-black hover:bg-neutral-150 transition-colors"
                                    >
                                        <CreditCard className="w-3.5 h-3.5" />
                                        Manage
                                    </button>
                                )}
                            </div>

                            {/* Usage Meters */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                {[
                                    { label: "Peppol Sent", value: billingData.peppolSent, limit: billingData.peppolSentLimit },
                                    { label: "OCR Scans", value: billingData.scanCount, limit: billingData.scanQuota === -1 ? null : billingData.scanQuota },
                                ].map(meter => (
                                    <div key={meter.label} className="bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5 rounded-xl p-3">
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 block mb-1">{meter.label}</span>
                                        <p className="text-lg font-black tracking-tight">
                                            {meter.value}
                                            <span className="text-xs font-normal text-neutral-450">
                                                {" "}/ {meter.limit !== null ? meter.limit : "∞"}
                                            </span>
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Plan Toggle */}
                        {!isFounder && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-center gap-1 bg-neutral-100 dark:bg-white/5 rounded-full p-1 w-fit mx-auto border border-neutral-350 dark:border-white/5">
                                    {(["MONTHLY", "QUARTERLY"] as const).map(cycle => (
                                        <button
                                            key={cycle}
                                            onClick={() => setBillingCycle(cycle)}
                                            className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                                                billingCycle === cycle
                                                    ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                                                    : "text-neutral-500"
                                            }`}
                                        >
                                            {cycle}
                                        </button>
                                    ))}
                                </div>

                                {/* Plan Cards */}
                                <div className="space-y-4">
                                    {PLANS.map(plan => {
                                        const isCurrent = plan.id === billingData.planType;
                                        const { price, billing } = getPrice(plan.price);

                                        return (
                                            <div
                                                key={plan.id}
                                                className={`bg-white dark:bg-neutral-900 border-2 rounded-2xl p-4 shadow-sm transition-all flex flex-col justify-between ${
                                                    isCurrent
                                                        ? "border-neutral-950 dark:border-white"
                                                        : "border-neutral-250 dark:border-white/5"
                                                }`}
                                            >
                                                <div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h4 className="text-sm font-black">{plan.name}</h4>
                                                        <div className="flex items-baseline gap-0.5">
                                                            <span className="text-lg font-black">€{price.toFixed(0)}</span>
                                                            <span className="text-[10px] text-neutral-505">/mo</span>
                                                        </div>
                                                    </div>
                                                    <p className="text-[9.5px] text-neutral-500">{billing}</p>
                                                    <ul className="mt-3 grid grid-cols-2 gap-y-1.5 gap-x-2 text-[11px] text-neutral-700 dark:text-neutral-300 font-medium">
                                                        {plan.features.slice(0, 4).map(f => (
                                                            <li key={f.text} className="flex items-center gap-1 truncate">
                                                                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                                {f.text}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                <div className="mt-4 border-t border-neutral-100 dark:border-white/5 pt-3">
                                                    {isCurrent ? (
                                                        <div className="w-full text-center py-2.5 rounded-xl bg-neutral-100 dark:bg-white/5 text-xs font-black text-neutral-500">
                                                            Current Plan
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleUpgrade(plan.id)}
                                                            className="w-full py-2.5 rounded-xl text-white text-xs font-black shadow-md transition-all"
                                                            style={{ backgroundColor: "var(--brand-color)" }}
                                                        >
                                                            {`Upgrade to ${plan.name}`}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── 3. Branding & Colors ── */}
                {activeTab === "ui" && (
                    <div className="space-y-5 animate-in fade-in-50 duration-200 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-white/10 rounded-2xl p-4 shadow-sm">
                        <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">Brand Color</h3>
                        <p className="text-xs text-neutral-500">Choose the signature brand accent color used throughout the platform and invoice stationery templates.</p>
                        
                        <div className="flex flex-wrap gap-3 py-2">
                            {[
                                "#d35400", // Orange
                                "#c0392b", // Red
                                "#1abc9c", // Teal
                                "#27ae60", // Green
                                "#2980b9", // Blue
                                "#8e44ad", // Purple
                                "#2c3e50", // Navy
                                "#111111", // Pure Dark
                            ].map(color => (
                                <button
                                    key={color}
                                    onClick={() => {
                                        setProfile({ ...profile, brandColor: color });
                                        document.documentElement.style.setProperty("--brand-color", color);
                                    }}
                                    className="w-9 h-9 rounded-xl border border-neutral-300 shadow-sm transition-transform active:scale-90 flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: color }}
                                >
                                    {profile.brandColor === color && (
                                        <Check className="w-4 h-4 text-white" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── 4. Peppol Integration ── */}
                {activeTab === "opt-peppol" && (
                    <div className="space-y-4 animate-in fade-in-50 duration-200">
                        {peppolStatus.loading ? (
                            <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-white/10 rounded-2xl p-4 flex items-center gap-3">
                                <RefreshCw className="w-5 h-5 animate-spin text-[var(--brand-color)]" />
                                <span className="text-xs font-bold text-neutral-500">Checking Peppol network...</span>
                            </div>
                        ) : peppolStatus.connected && peppolStatus.peppolRegistered ? (
                            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-250 dark:border-emerald-900/30 rounded-2xl p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-sm font-black text-emerald-900 dark:text-emerald-300">Peppol Connected</span>
                                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
                                        <Wifi className="w-2.5 h-2.5" /> Active
                                    </span>
                                </div>
                                <div className="text-xs text-emerald-800 dark:text-emerald-400 font-bold space-y-1">
                                    <p>Company: {peppolStatus.companyName}</p>
                                    <p>ID: <code className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/35 font-mono text-[10px]">{peppolStatus.peppolId}</code></p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-250 dark:border-amber-900/30 rounded-2xl p-4 space-y-3">
                                <div className="flex items-start gap-2.5">
                                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-black text-amber-900 dark:text-amber-300">European e-Invoicing</h4>
                                        <p className="text-xs text-amber-800 dark:text-amber-450 font-bold leading-relaxed mt-1">
                                            Register on the official Peppol B2B network to securely exchange digital invoices with companies and governments across the EU.
                                        </p>
                                    </div>
                                </div>
                                <div className="pt-2">
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            toast.loading("Onboarding on Peppol...", { id: "peppol-onboard" });
                                            try {
                                                const res = await fetch("/api/peppol/onboard", { method: "POST" });
                                                if (res.ok) {
                                                    toast.success("Peppol e-invoicing integrated successfully!", { id: "peppol-onboard" });
                                                    globalThis.location.reload();
                                                } else {
                                                    throw new Error("Failed to activate Peppol");
                                                }
                                            } catch (e) {
                                                toast.error("Peppol network activation failed.", { id: "peppol-onboard" });
                                            }
                                        }}
                                        className="w-full py-2.5 rounded-xl bg-amber-600 text-white text-xs font-black shadow-md hover:bg-amber-700 transition-colors"
                                    >
                                        Register Company on Peppol
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── 5. Templates & Stationery ── */}
                {activeTab === "opt-templates" && (
                    <div className="space-y-4 animate-in fade-in-50 duration-200 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-white/10 rounded-2xl p-4 shadow-sm">
                        <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">Stationery Layout</h3>
                        <p className="text-xs text-neutral-500">Select your default layout style template for estimates, credit notes, and generated invoice PDFs.</p>
                        
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            {[
                                { id: "t1", label: "Classic Premium" },
                                { id: "t2", label: "Elegant Minimalist" },
                                { id: "t3", label: "Modern Industrial" },
                                { id: "t4", label: "Compact Clean" },
                            ].map(tmpl => (
                                <button
                                    key={tmpl.id}
                                    onClick={() => setProfile({ ...profile, documentTemplate: tmpl.id })}
                                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                                        profile.documentTemplate === tmpl.id
                                            ? "border-[var(--brand-color,#d35400)] bg-[color-mix(in_srgb,_var(--brand-color)_8%,_transparent)]"
                                            : "border-neutral-200 dark:border-white/5 bg-neutral-50 dark:bg-black"
                                    }`}
                                >
                                    <span className="text-xs font-black block text-neutral-900 dark:text-white">{tmpl.label}</span>
                                    <span className="text-[10px] text-neutral-450 block mt-0.5">Template {tmpl.id.toUpperCase()}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
