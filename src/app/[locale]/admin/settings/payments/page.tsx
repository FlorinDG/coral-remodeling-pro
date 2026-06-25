/* eslint-disable @typescript-eslint/no-explicit-any */
// Payment settings page supporting Stripe and manual bank transfer onboarding options.
"use client";
import React, { useState, useEffect } from "react";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredSettingsTabs } from "@/config/tabs";
import { useTenant } from "@/context/TenantContext";
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import { CreditCard, Save, RefreshCw, Key, Shield, HelpCircle, ExternalLink } from "lucide-react";
import { canAccess } from '@/lib/feature-flags';

export default function PaymentsSettings() {
    const { tenant, activeModules, planType, refreshTenant } = useTenant();
    const [provider, setProvider] = useState<'bank_transfer' | 'stripe'>('bank_transfer');
    const [stripeSecretKey, setStripeSecretKey] = useState('');
    const [stripePublishableKey, setStripePublishableKey] = useState('');
    const [hasStripeAccount, setHasStripeAccount] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (tenant) {
            setProvider((tenant.paymentProvider as any) || 'bank_transfer');
            setStripeSecretKey(tenant.stripeSecretKey || '');
            setStripePublishableKey(tenant.stripePublishableKey || '');
            if (tenant.stripePublishableKey || tenant.stripeSecretKey) {
                setHasStripeAccount(true);
            }
            setLoading(false);
        }
    }, [tenant]);

    const handleSave = async () => {
        if (!tenant) return;
        setSaving(true);
        try {
            const res = await fetch('/api/tenant/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentProvider: provider,
                    stripeSecretKey,
                    stripePublishableKey
                })
            });
            if (res.ok) {
                toast.success('Payment settings saved successfully!');
                await refreshTenant();
            } else {
                throw new Error('Failed to save payment settings');
            }
        } catch (e) {
            console.error(e);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const hasStripeAccess = canAccess('STRIPE_PAYMENTS', planType);
    const filteredSettingsTabs = getFilteredSettingsTabs(activeModules);

    if (loading) {
        return (
            <div className="flex flex-col w-full h-full">
                <ModuleTabs tabs={filteredSettingsTabs} groupId="settings" />
                <div className="flex-1 flex items-center justify-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-neutral-400" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={filteredSettingsTabs} groupId="settings" />
            <div className="w-full flex-1 overflow-y-auto p-6 pb-16 max-w-4xl space-y-8">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-neutral-200 dark:border-white/10 pb-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Payment Settings</h1>
                        <p className="text-sm text-neutral-500 mt-1">Configure client invoice payment methods and integrations.</p>
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={saving || !tenant}
                        className="gap-2 text-white disabled:opacity-50"
                        style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                    >
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Saving...' : 'Save Settings'}
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    
                    {/* Method Selector */}
                    <div className="md:col-span-1 space-y-4">
                        <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-widest border-b border-neutral-200 dark:border-white/10 pb-2 flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-orange-500" />
                            Provider
                        </h3>
                        <p className="text-xs text-neutral-500 leading-relaxed">
                            Select the default method for invoice settlement. This controls the QR code and payment guidelines shown on client documents.
                        </p>
                        <div className="space-y-2 mt-4">
                            <label className="flex items-center gap-3 p-4 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-black/20 hover:bg-neutral-50 dark:hover:bg-white/5 cursor-pointer transition-all">
                                <input
                                    type="radio"
                                    name="provider"
                                    value="bank_transfer"
                                    checked={provider === 'bank_transfer'}
                                    onChange={() => setProvider('bank_transfer')}
                                    className="text-orange-500 focus:ring-orange-500 h-4 w-4"
                                />
                                <div>
                                    <span className="block text-sm font-bold">Bank Transfer (Default)</span>
                                    <span className="block text-xs text-neutral-500">SEPA QR and payment references on document.</span>
                                </div>
                            </label>

                            <label 
                                className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                                    !hasStripeAccess 
                                        ? 'opacity-60 bg-neutral-100 dark:bg-neutral-900/40 border-neutral-200 dark:border-white/5 cursor-not-allowed' 
                                        : 'bg-white dark:bg-black/20 hover:bg-neutral-50 dark:hover:bg-white/5 border-neutral-200 dark:border-white/10'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="provider"
                                    value="stripe"
                                    checked={provider === 'stripe'}
                                    disabled={!hasStripeAccess}
                                    onChange={() => {
                                        setProvider('stripe');
                                        if (hasStripeAccount === null) setHasStripeAccount(true);
                                    }}
                                    className="text-orange-500 focus:ring-orange-500 h-4 w-4 disabled:opacity-50"
                                />
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold">Stripe Online Payments</span>
                                        {!hasStripeAccess && (
                                            <span className="text-[9px] bg-neutral-200 dark:bg-white/10 px-1.5 py-0.5 rounded font-black text-neutral-600 dark:text-neutral-300">PRO</span>
                                        )}
                                    </div>
                                    <span className="block text-xs text-neutral-500">Accept credit cards instantly via direct checkout links.</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Stripe Configuration details / Wizard */}
                    <div className="md:col-span-2 space-y-6">
                        {provider === 'stripe' ? (
                            <div className="space-y-6">
                                {/* Onboarding prompt */}
                                <div className="bg-neutral-50 dark:bg-neutral-900/30 border border-neutral-200 dark:border-white/10 rounded-2xl p-6">
                                    <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-2">
                                        Do you have a Stripe account?
                                    </h3>
                                    <div className="flex gap-4 mt-3">
                                        <button
                                            type="button"
                                            onClick={() => setHasStripeAccount(true)}
                                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                                                hasStripeAccount === true 
                                                    ? 'bg-orange-500 border-orange-500 text-white' 
                                                    : 'bg-white dark:bg-black/20 border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/5'
                                            }`}
                                        >
                                            Yes, I have an account
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHasStripeAccount(false)}
                                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                                                hasStripeAccount === false 
                                                    ? 'bg-orange-500 border-orange-500 text-white' 
                                                    : 'bg-white dark:bg-black/20 border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/5'
                                            }`}
                                        >
                                            No, I need to create one
                                        </button>
                                    </div>
                                </div>

                                {hasStripeAccount === true && (
                                    <div className="space-y-6 bg-neutral-50 dark:bg-neutral-900/30 border border-neutral-200 dark:border-white/10 rounded-2xl p-6">
                                        <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                                            <Key className="w-4 h-4 text-orange-500" />
                                            Stripe API Credentials
                                        </h3>
                                        <p className="text-xs text-neutral-500 leading-relaxed -mt-2">
                                            Enter your Stripe Account API keys to enable inline credit card checkouts. Find these keys in your Stripe Dashboard under Developers &gt; API keys.
                                        </p>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block">Stripe Publishable Key (pk_live_...)</label>
                                                <input
                                                    type="text"
                                                    value={stripePublishableKey}
                                                    onChange={e => setStripePublishableKey(e.target.value)}
                                                    placeholder="pk_live_..."
                                                    className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-orange-500 transition-colors"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block">Stripe Secret Key (sk_live_...)</label>
                                                <input
                                                    type="password"
                                                    value={stripeSecretKey}
                                                    onChange={e => setStripeSecretKey(e.target.value)}
                                                    placeholder={stripeSecretKey ? "********" : "sk_live_..."}
                                                    className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-orange-500 transition-colors"
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-xl p-4 flex gap-3 text-xs text-blue-800 dark:text-blue-300">
                                            <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-bold block mb-1">Encrypted & Secure</span>
                                                Stripe secret keys are encrypted before storage in our database using standard AES-256 encryption. They are never sent back to the browser.
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {hasStripeAccount === false && (
                                    <div className="bg-neutral-50 dark:bg-neutral-900/30 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 space-y-4">
                                        <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">Get Started with Stripe</h4>
                                        <p className="text-xs text-neutral-500 leading-relaxed">
                                            Stripe allows you to accept credit cards from clients immediately. Signing up is fast and easy.
                                        </p>
                                        <div className="flex gap-3">
                                            <a 
                                                href="https://dashboard.stripe.com/register" 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 text-xs font-bold rounded-lg transition-colors"
                                            >
                                                Create Stripe Account <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => { setProvider('bank_transfer'); setHasStripeAccount(null); }}
                                                className="px-4 py-2 border border-neutral-200 dark:border-white/10 hover:bg-neutral-50 text-xs font-bold rounded-lg transition-all"
                                            >
                                                Use Bank Transfer Instead
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4 bg-neutral-50 dark:bg-neutral-900/30 border border-neutral-200 dark:border-white/10 rounded-2xl p-6">
                                <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                                    <HelpCircle className="w-4 h-4 text-neutral-500" />
                                    Bank Transfer Integration
                                </h3>
                                <p className="text-xs text-neutral-500 leading-relaxed">
                                    No credentials needed. The app automatically outputs:
                                </p>
                                <ul className="list-disc list-inside text-xs text-neutral-600 dark:text-neutral-400 space-y-1.5 pl-2">
                                    <li>Beneficiary Name (from Company settings)</li>
                                    <li>Company IBAN & BIC</li>
                                    <li>Total Amount Due</li>
                                    <li>Structured OGM Reference (e.g. +++000/0000/00000+++)</li>
                                    <li>EPC/SEPA Credit Transfer QR code</li>
                                </ul>
                                <p className="text-xs text-neutral-500 leading-relaxed pt-2">
                                    Make sure your bank details are completed in the <strong>Company Info</strong> tab.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
