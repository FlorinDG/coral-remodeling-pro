"use client";

import React, { useState } from "react";
import { Link } from "@/i18n/routing";
import {
    Crown, Zap, Shield, Check, X, ArrowUpRight, Clock,
    Users, FileText, TrendingUp, AlertTriangle, CreditCard,
    Sparkles, Building2, MessageSquare
} from "lucide-react";

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

const PLAN_BADGE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    FREE:       { bg: "bg-neutral-100", text: "text-neutral-700", icon: <Zap className="w-4 h-4" /> },
    PRO:        { bg: "bg-blue-100", text: "text-blue-700", icon: <Crown className="w-4 h-4" /> },
    ENTERPRISE: { bg: "bg-violet-100", text: "text-violet-700", icon: <Shield className="w-4 h-4" /> },
    FOUNDER:    { bg: "bg-amber-100", text: "text-amber-700", icon: <Sparkles className="w-4 h-4" /> },
    CUSTOM:     { bg: "bg-pink-100", text: "text-pink-700", icon: <Shield className="w-4 h-4" /> },
};

// ── Plan feature matrix ──────────────────────────────────────────────

const PLANS = [
    {
        id: "FREE",
        name: "Free",
        price: 0,
        period: "/mo",
        includedUsers: 1,
        extraUserPrice: null,
        workforcePrice: null,
        highlight: false,
        features: [
            { text: "Quotations & Invoicing", included: true },
            { text: "Peppol e-invoicing (5 sent/mo)", included: true },
            { text: "Expense tracking", included: true },
            { text: "30 OCR scans/month", included: true },
            { text: "1 user", included: true },
            { text: "CRM Pipeline", included: false },
            { text: "Projects & Portals", included: false },
            { text: "Calendar", included: false },
            { text: "Custom Databases", included: false },
            { text: "HR & Time Tracking", included: false },
        ],
    },
    {
        id: "PRO",
        name: "Pro",
        price: 29,
        period: "/mo",
        includedUsers: 1,
        extraUserPrice: 20,
        workforcePrice: 4.99,
        highlight: true,
        trial: "1 month free trial",
        features: [
            { text: "Everything in Free", included: true },
            { text: "Peppol e-invoicing (20 sent/mo)", included: true },
            { text: "300 OCR scans/month", included: true },
            { text: "CRM Sales Pipeline", included: true },
            { text: "Projects, Portals & Files", included: true },
            { text: "Basic Calendar (1 Google)", included: true },
            { text: "Custom Databases & Formulas", included: true },
            { text: "Basic Task Management", included: true },
            { text: "Article Library & PDF Import", included: true },
            { text: "Up to 3 users", included: true },
            { text: "HR & Time Tracking", included: false },
            { text: "Website CMS", included: false },
            { text: "Email Integration", included: false },
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
        highlight: false,
        trial: "2 months free trial",
        features: [
            { text: "Everything in Pro", included: true },
            { text: "Unlimited Peppol e-invoicing", included: true },
            { text: "Unlimited OCR scans", included: true },
            { text: "Multi-provider Calendar", included: true },
            { text: "Advanced Task Management", included: true },
            { text: "HR, Time Tracking & Scheduling", included: true },
            { text: "Website CMS & Storefront", included: true },
            { text: "Email Integration", included: true },
            { text: "White-label documents", included: true },
            { text: "Budget tracking & analytics", included: true },
            { text: "Unlimited users", included: true },
        ],
    },
];

export default function BillingPageClient({ data }: { data: BillingData }) {
    const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "QUARTERLY" | "ANNUAL">(
        data.billingCycle === "QUARTERLY" ? "QUARTERLY" : "MONTHLY"
    );

    const badge = PLAN_BADGE[data.planType] || PLAN_BADGE.FREE;
    const isFounder = data.planType === "FOUNDER" || data.planType === "CUSTOM";

    const getPrice = (basePrice: number) => {
        if (billingCycle === "QUARTERLY") {
            const discounted = basePrice * (1 - data.quarterlyDiscount);
            return { price: discounted, period: "/mo", billing: `€${(discounted * 3).toFixed(0)} billed quarterly` };
        }
        return { price: basePrice, period: "/mo", billing: "billed monthly" };
    };

    const handleUpgrade = async (planId: string) => {
        // Will wire to Stripe Checkout when keys are available
        try {
            const res = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planType: planId, billingCycle }),
            });
            const result = await res.json();
            if (result.url) {
                globalThis.location.assign(result.url);
            }
        } catch (e) {
            console.error("[Billing] Checkout failed:", e);
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
            console.error("[Billing] Portal failed:", e);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12">
            {/* ── Header ──────────────────────────────────────────────── */}
            <div>
                <h1 className="text-3xl font-extrabold tracking-tight">Plan & Billing</h1>
                <p className="text-neutral-500 mt-1">Manage your subscription, usage, and billing preferences.</p>
            </div>

            {/* ── Current Plan Card ───────────────────────────────────── */}
            <div className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-6">
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${badge.bg} ${badge.text}`}>
                                {badge.icon} {data.planType}
                            </span>
                            {data.isTrialing && (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                    data.trialDaysLeft <= 7
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-blue-100 text-blue-700"
                                }`}>
                                    <Clock className="w-3 h-3" />
                                    Trial: {data.trialDaysLeft} days left
                                </span>
                            )}
                            {data.isCancelling && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                    <AlertTriangle className="w-3 h-3" />
                                    Cancelling {data.cancellationEffectiveAt
                                        ? `on ${new Date(data.cancellationEffectiveAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                        : ''}
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-neutral-500">
                            {isFounder
                                ? "Founding member — unlimited access, all modules included."
                                : data.planType === "FREE"
                                    ? "You're on the free plan. Upgrade to unlock more modules and features."
                                    : `Your ${data.planType} plan is ${data.subscriptionStatus.toLowerCase()}.`
                            }
                        </p>
                    </div>
                    {data.hasSubscription && (
                        <button
                            onClick={handleManageBilling}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-200 dark:border-white/10 text-sm font-bold hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                        >
                            <CreditCard className="w-4 h-4" />
                            Manage Billing
                        </button>
                    )}
                </div>

                {/* ── Usage Meters ─────────────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    {[
                        {
                            label: "Peppol Sent",
                            value: data.peppolSent,
                            limit: data.peppolSentLimit,
                            icon: FileText,
                        },
                        {
                            label: "Peppol Received",
                            value: data.peppolReceived,
                            limit: data.peppolReceivedLimit,
                            icon: FileText,
                        },
                        {
                            label: "OCR Scans",
                            value: data.scanCount,
                            limit: data.scanQuota === -1 ? null : data.scanQuota,
                            icon: Zap,
                        },
                        {
                            label: "Users",
                            value: data.userCount,
                            limit: data.planType === "ENTERPRISE" || isFounder ? null : data.planType === "PRO" ? 3 : 1,
                            icon: Users,
                        },
                    ].map(({ label, value, limit, icon: Icon }) => {
                        const pct = limit ? Math.min(100, Math.round((value / limit) * 100)) : 0;
                        const isWarning = limit && pct >= 80;
                        const isOver = limit && value >= limit;
                        return (
                            <div key={label} className="bg-neutral-50 dark:bg-white/[0.03] rounded-xl p-4 border border-neutral-100 dark:border-white/5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{label}</span>
                                    <Icon className="w-3.5 h-3.5 text-neutral-400" />
                                </div>
                                <p className="text-xl font-extrabold tabular-nums">
                                    {value}
                                    {limit !== null && <span className="text-sm font-normal text-neutral-400"> / {limit}</span>}
                                    {limit === null && <span className="text-sm font-normal text-neutral-400"> / ∞</span>}
                                </p>
                                {limit !== null && (
                                    <div className="mt-2 h-1.5 bg-neutral-200 dark:bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${
                                                isOver ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-emerald-500"
                                            }`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                )}
                                {isOver && (
                                    <p className="text-[10px] text-red-500 font-bold mt-1">
                                        Overage: €{data.overagePrice}/doc beyond limit
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Plan Selection (non-FOUNDER only) ───────────────────── */}
            {!isFounder && (
                <>
                    {/* Billing cycle toggle */}
                    <div className="flex items-center justify-center gap-1 bg-neutral-100 dark:bg-white/5 rounded-full p-1 w-fit mx-auto">
                        {(["MONTHLY", "QUARTERLY", "ANNUAL"] as const).map((cycle) => (
                            <button
                                key={cycle}
                                onClick={() => {
                                    if (cycle === "ANNUAL") return; // Contact Us
                                    setBillingCycle(cycle);
                                }}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                                    cycle === "ANNUAL"
                                        ? "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-default"
                                        : billingCycle === cycle
                                            ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                                            : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                                }`}
                            >
                                {cycle === "ANNUAL" ? (
                                    <span className="flex items-center gap-1">
                                        Annually
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold normal-case">
                                            Contact Us
                                        </span>
                                    </span>
                                ) : (
                                    cycle
                                )}
                            </button>
                        ))}
                    </div>

                    {billingCycle === "QUARTERLY" && (
                        <p className="text-center text-xs text-neutral-500">
                            {data.quarterlyDiscount === 0.10
                                ? "🎉 Fidelity bonus — 10% off quarterly billing"
                                : "5% off quarterly billing · 10% fidelity bonus after your first year"
                            }
                        </p>
                    )}

                    {/* Plan cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {PLANS.map((plan) => {
                            const isCurrent = plan.id === data.planType;
                            const isDowngrade =
                                (data.planType === "PRO" && plan.id === "FREE") ||
                                (data.planType === "ENTERPRISE" && ["FREE", "PRO"].includes(plan.id));
                            const isUpgrade = !isCurrent && !isDowngrade;
                            const { price, billing } = getPrice(plan.price);

                            return (
                                <div
                                    key={plan.id}
                                    className={`relative bg-white dark:bg-white/5 rounded-2xl border-2 p-6 flex flex-col transition-all ${
                                        plan.highlight
                                            ? "border-blue-400 dark:border-blue-500/50 shadow-lg shadow-blue-500/10"
                                            : isCurrent
                                                ? "border-neutral-900 dark:border-white/30"
                                                : "border-neutral-200 dark:border-white/10"
                                    }`}
                                >
                                    {plan.highlight && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest">
                                            Most Popular
                                        </div>
                                    )}

                                    <div className="mb-4">
                                        <h3 className="text-lg font-extrabold">{plan.name}</h3>
                                        <div className="flex items-baseline gap-1 mt-2">
                                            <span className="text-4xl font-black tabular-nums">€{price.toFixed(0)}</span>
                                            <span className="text-sm text-neutral-500">{plan.period}</span>
                                        </div>
                                        <p className="text-[11px] text-neutral-400 mt-1">{billing}</p>
                                        {plan.trial && <p className="text-xs font-bold text-emerald-600 mt-1">{plan.trial}</p>}
                                    </div>

                                    {/* Seat pricing */}
                                    {plan.includedUsers && (
                                        <div className="text-xs text-neutral-500 space-y-0.5 mb-4 pb-4 border-b border-neutral-100 dark:border-white/5">
                                            <p>{plan.includedUsers} user{plan.includedUsers > 1 ? "s" : ""} included</p>
                                            {plan.extraUserPrice && <p>+ €{plan.extraUserPrice}/mo per extra user</p>}
                                            {plan.workforcePrice && <p>+ €{plan.workforcePrice}/mo per workforce member</p>}
                                        </div>
                                    )}

                                    {/* Features */}
                                    <ul className="space-y-2 flex-1">
                                        {plan.features.map(({ text, included }) => (
                                            <li key={text} className={`flex items-start gap-2 text-sm ${included ? "" : "text-neutral-400"}`}>
                                                {included
                                                    ? <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                                                    : <X className="w-4 h-4 text-neutral-300 flex-shrink-0 mt-0.5" />
                                                }
                                                <span className={included ? "font-medium" : ""}>{text}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    {/* CTA */}
                                    <div className="mt-6">
                                        {isCurrent ? (
                                            <div className="w-full text-center py-2.5 rounded-xl bg-neutral-100 dark:bg-white/5 text-sm font-bold text-neutral-500">
                                                Current Plan
                                            </div>
                                        ) : isUpgrade ? (
                                            <button
                                                onClick={() => handleUpgrade(plan.id)}
                                                className="w-full py-2.5 rounded-xl text-white text-sm font-bold shadow-md hover:opacity-90 active:scale-[0.98] transition-all"
                                                style={{ backgroundColor: "var(--brand-color, #d35400)" }}
                                            >
                                                {plan.trial ? `Start Free Trial` : `Upgrade to ${plan.name}`}
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Annual contact CTA */}
                    {billingCycle === "ANNUAL" || true ? (
                        <div className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-500/5 dark:to-blue-500/5 rounded-2xl border border-violet-200 dark:border-violet-500/20 p-6 flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center">
                                    <MessageSquare className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-neutral-900 dark:text-white">Looking for an annual plan?</h3>
                                    <p className="text-sm text-neutral-500 mt-0.5">
                                        We&apos;ll assess your needs and offer a personalised proposal with tailored value — no blanket discounts.
                                    </p>
                                </div>
                            </div>
                            <a
                                href="mailto:info@coral-group.be?subject=CoralOS Annual Plan Inquiry"
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors shadow-md"
                            >
                                <Building2 className="w-4 h-4" />
                                Contact Sales
                                <ArrowUpRight className="w-3.5 h-3.5" />
                            </a>
                        </div>
                    ) : null}
                </>
            )}

            {/* ── Overage Info ────────────────────────────────────────── */}
            {!isFounder && data.planType !== "ENTERPRISE" && (
                <div className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-6">
                    <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-neutral-400" />
                        Peppol Overage Pricing
                    </h3>
                    <p className="text-sm text-neutral-500 leading-relaxed">
                        When you exceed your monthly Peppol quota, additional documents are charged at{" "}
                        <span className="font-bold text-neutral-900 dark:text-white">€{data.overagePrice}/document</span>{" "}
                        (sent or received). Received invoices are never blocked — bookkeeping continuity is guaranteed.
                        Overage charges appear on your next invoice.
                    </p>
                </div>
            )}

            {/* ── Cancellation ────────────────────────────────────────── */}
            {data.hasSubscription && !data.isCancelling && (
                <div className="border border-neutral-200 dark:border-white/10 rounded-2xl p-6">
                    <h3 className="text-sm font-bold mb-2">Cancel Subscription</h3>
                    <p className="text-sm text-neutral-500 mb-4 leading-relaxed">
                        {data.planType === "PRO"
                            ? "PRO plans require 1 month notice. Cancellation takes effect at the start of the next billing cycle after the notice period."
                            : "Enterprise plans require 2 months notice. Cancellation takes effect at the start of the next billing cycle after the notice period."
                        }
                        {" "}Your data will be preserved — modules become locked but nothing is deleted.
                    </p>
                    <button
                        onClick={handleManageBilling}
                        className="text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
                    >
                        Cancel via Billing Portal →
                    </button>
                </div>
            )}
        </div>
    );
}
