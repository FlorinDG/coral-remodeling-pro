"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
    Settings, Calendar as CalendarIcon, RefreshCw, Check, AlertCircle, Trash2,
    HardDrive, Building2, Save, Shield, Database as DbIcon, Users, Layers,
    Globe, CreditCard, Palette, Server, Workflow, ChevronRight, Lock,
    Zap, Bell, Key, FileText, BarChart2, UserCog
} from 'lucide-react';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

type SettingsTier = 'superadmin' | 'erp' | 'tenant';

interface NavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    tier: SettingsTier;
    description?: string;
}

// ─── Navigation Schema ──────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
    // ── Superadmin (platform-level) ──
    { id: 'platform-overview', label: 'Platform Overview', icon: <Shield className="w-4 h-4" />, tier: 'superadmin', description: 'Global platform health & tenant management' },
    { id: 'all-tenants',       label: 'All Tenants',       icon: <Users className="w-4 h-4" />, tier: 'superadmin', description: 'View and manage all tenant accounts' },
    { id: 'feature-flags',     label: 'Feature Flags',     icon: <Zap className="w-4 h-4" />, tier: 'superadmin', description: 'Toggle experimental features globally' },
    { id: 'platform-billing',  label: 'Platform Billing',  icon: <CreditCard className="w-4 h-4" />, tier: 'superadmin', description: 'Subscription plans, quotas, Peppol billing' },
    { id: 'api-keys',          label: 'API Keys & Secrets', icon: <Key className="w-4 h-4" />, tier: 'superadmin', description: 'External API credentials (Peppol, Google, Stripe)' },
    { id: 'audit-log',         label: 'Audit Log',         icon: <FileText className="w-4 h-4" />, tier: 'superadmin', description: 'System-wide event log' },

    // ── ERP Configuration (admin-level, locked from regular users) ──
    { id: 'database-schema',   label: 'Database Schema',   icon: <DbIcon className="w-4 h-4" />, tier: 'erp', description: 'Manage locked databases, properties, and relationships' },
    { id: 'module-config',     label: 'Active Modules',    icon: <Layers className="w-4 h-4" />, tier: 'erp', description: 'Enable/disable HR, CRM, Invoicing, etc.' },
    { id: 'workflow-rules',    label: 'Workflow Rules',    icon: <Workflow className="w-4 h-4" />, tier: 'erp', description: 'Approval chains, automation triggers' },
    { id: 'roles-permissions', label: 'Roles & Permissions', icon: <UserCog className="w-4 h-4" />, tier: 'erp', description: 'Define access levels and permission sets' },
    { id: 'integrations',      label: 'Integrations',      icon: <Server className="w-4 h-4" />, tier: 'erp', description: 'Google Calendar, Drive, Peppol, webhooks' },
    { id: 'templates',         label: 'Document Templates', icon: <FileText className="w-4 h-4" />, tier: 'erp', description: 'Invoice, quotation, and report templates' },

    // ── Tenant/User Settings (business-level, user-facing) ──
    { id: 'company-profile',   label: 'Company Profile',   icon: <Building2 className="w-4 h-4" />, tier: 'tenant', description: 'Business name, VAT, IBAN, logo' },
    { id: 'team-members',      label: 'Team Members',      icon: <Users className="w-4 h-4" />, tier: 'tenant', description: 'Invite users, assign roles' },
    { id: 'billing',           label: 'Plan & Billing',    icon: <CreditCard className="w-4 h-4" />, tier: 'tenant', description: 'Current plan, usage, upgrade' },
    { id: 'ui-preferences',    label: 'UI & Appearance',   icon: <Palette className="w-4 h-4" />, tier: 'tenant', description: 'Theme, brand color, layout density' },
    { id: 'notifications',     label: 'Notifications',     icon: <Bell className="w-4 h-4" />, tier: 'tenant', description: 'Email digests, in-app alerts, webhooks' },
    { id: 'calendar-sync',     label: 'Calendar Sync',     icon: <CalendarIcon className="w-4 h-4" />, tier: 'tenant', description: 'Google Calendar integration' },
    { id: 'file-storage',      label: 'File Storage',      icon: <HardDrive className="w-4 h-4" />, tier: 'tenant', description: 'Google Drive authorization' },
    { id: 'peppol',            label: 'Peppol E-Invoicing', icon: <Globe className="w-4 h-4" />, tier: 'tenant', description: 'Connect to the Peppol network' },
];

const TIER_META: Record<SettingsTier, { label: string; color: string; bgClass: string; icon: React.ReactNode; description: string }> = {
    superadmin: {
        label: 'Superadmin Environment',
        color: '#dc2626',
        bgClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/40',
        icon: <Shield className="w-4 h-4" />,
        description: 'Full platform control. All settings, all tenants.',
    },
    erp: {
        label: 'ERP Configuration',
        color: '#7c3aed',
        bgClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800/40',
        icon: <Server className="w-4 h-4" />,
        description: 'Database schema and application config. Users are locked out.',
    },
    tenant: {
        label: 'Workspace Settings',
        color: 'var(--brand-color, #d35400)',
        bgClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/40',
        icon: <Settings className="w-4 h-4" />,
        description: 'Your business settings and preferences.',
    },
};

// ─── Section Components ──────────────────────────────────────────────────────

function SectionShell({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="mb-6">
                <h2 className="text-xl font-black tracking-tight text-neutral-900 dark:text-white">{title}</h2>
                {description && <p className="text-sm text-neutral-500 mt-1">{description}</p>}
            </div>
            <div className="space-y-6">{children}</div>
        </div>
    );
}

function SettingsCard({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={`p-6 border border-neutral-200 dark:border-white/10 rounded-xl bg-neutral-50/50 dark:bg-neutral-900/20 ${className}`}>
            {title && (
                <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-4 uppercase tracking-wider">{title}</h3>
            )}
            {children}
        </div>
    );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">{label}</label>
            {children}
        </div>
    );
}

function InputField({ label, value, onChange, type = 'text', placeholder, disabled }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; disabled?: boolean;
}) {
    return (
        <FieldRow label={label}>
            <input
                type={type} value={value} disabled={disabled}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2.5 outline-none focus:border-[var(--brand-color,#d35400)] transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder={placeholder}
            />
        </FieldRow>
    );
}

// ─── Superadmin Panels ───────────────────────────────────────────────────────

function PlatformOverviewPanel() {
    return (
        <SectionShell title="Platform Overview" description="Global system status and metrics.">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Active Tenants', value: '—', icon: <Users className="w-5 h-5 text-blue-500" /> },
                    { label: 'Total Users', value: '—', icon: <UserCog className="w-5 h-5 text-green-500" /> },
                    { label: 'System Health', value: 'OK', icon: <BarChart2 className="w-5 h-5 text-emerald-500" /> },
                ].map(stat => (
                    <div key={stat.label} className="flex items-center gap-4 p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl">
                        <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center">{stat.icon}</div>
                        <div>
                            <p className="text-xl font-black text-neutral-900 dark:text-white">{stat.value}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>
            <SettingsCard title="Environment Info">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-neutral-400 text-xs font-bold uppercase">App Version</span><p className="font-mono mt-1">v2.4.0-beta</p></div>
                    <div><span className="text-neutral-400 text-xs font-bold uppercase">Node Env</span><p className="font-mono mt-1">{process.env.NODE_ENV || 'development'}</p></div>
                    <div><span className="text-neutral-400 text-xs font-bold uppercase">Database</span><p className="font-mono mt-1">PostgreSQL (Prisma)</p></div>
                    <div><span className="text-neutral-400 text-xs font-bold uppercase">Auth</span><p className="font-mono mt-1">NextAuth.js</p></div>
                </div>
            </SettingsCard>
        </SectionShell>
    );
}

function AllTenantsPanel() {
    return (
        <SectionShell title="All Tenants" description="Manage all tenant organizations from one place.">
            <SettingsCard>
                <p className="text-sm text-neutral-500 italic">Tenant management is available via the Superadmin Dashboard at <code className="text-xs bg-neutral-100 dark:bg-white/5 px-1.5 py-0.5 rounded">/superadmin</code>.</p>
            </SettingsCard>
        </SectionShell>
    );
}

function FeatureFlagsPanel() {
    const flags = [
        { id: 'ff-peppol-v2', label: 'Peppol V2 Gateway', enabled: false, description: 'Use new Storecove V2 API for e-invoicing' },
        { id: 'ff-ai-assist', label: 'AI Task Assistant', enabled: false, description: 'Enable AI-powered task suggestions and auto-scheduling' },
        { id: 'ff-multi-currency', label: 'Multi-Currency', enabled: false, description: 'Support for EUR, USD, GBP in invoicing' },
        { id: 'ff-mobile-workforce', label: 'Mobile Workforce App', enabled: true, description: 'Enable the standalone mobile workforce experience' },
    ];

    return (
        <SectionShell title="Feature Flags" description="Toggle experimental features across all tenants.">
            <div className="space-y-2">
                {flags.map(flag => (
                    <div key={flag.id} className="flex items-center justify-between p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl group hover:border-neutral-300 dark:hover:border-white/20 transition-colors">
                        <div>
                            <p className="text-sm font-bold text-neutral-900 dark:text-white">{flag.label}</p>
                            <p className="text-xs text-neutral-500 mt-0.5">{flag.description}</p>
                        </div>
                        <button className={`w-10 h-5 rounded-full transition-colors relative ${flag.enabled ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-600'}`}>
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${flag.enabled ? 'left-[22px]' : 'left-0.5'}`} />
                        </button>
                    </div>
                ))}
            </div>
        </SectionShell>
    );
}

function PlatformBillingPanel() {
    return (
        <SectionShell title="Platform Billing" description="Manage subscription tiers, quotas, and revenue.">
            <SettingsCard title="Billing Configuration">
                <p className="text-sm text-neutral-500 italic">Stripe integration and subscription management will appear here.</p>
            </SettingsCard>
        </SectionShell>
    );
}

function ApiKeysPanel() {
    const secrets = [
        { key: 'STORECOVE_API_KEY', masked: '••••••••••ab3f', label: 'Storecove (Peppol)' },
        { key: 'GOOGLE_CLIENT_ID', masked: '••••••••••.apps.googleusercontent.com', label: 'Google OAuth' },
        { key: 'STRIPE_SECRET_KEY', masked: '••••••••••_test_key', label: 'Stripe' },
        { key: 'NEXTAUTH_SECRET', masked: '••••••••••••••', label: 'NextAuth' },
    ];

    return (
        <SectionShell title="API Keys & Secrets" description="Manage external service credentials.">
            <div className="space-y-2">
                {secrets.map(s => (
                    <div key={s.key} className="flex items-center justify-between p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl">
                        <div>
                            <p className="text-sm font-bold text-neutral-900 dark:text-white">{s.label}</p>
                            <p className="text-xs font-mono text-neutral-400 mt-0.5">{s.key}</p>
                        </div>
                        <span className="text-xs font-mono text-neutral-400 bg-neutral-100 dark:bg-white/5 px-3 py-1.5 rounded-lg">{s.masked}</span>
                    </div>
                ))}
            </div>
        </SectionShell>
    );
}

function AuditLogPanel() {
    return (
        <SectionShell title="Audit Log" description="System-wide event history.">
            <SettingsCard>
                <p className="text-sm text-neutral-500 italic">Audit log entries will appear here when event tracking is enabled.</p>
            </SettingsCard>
        </SectionShell>
    );
}

// ─── ERP Configuration Panels ────────────────────────────────────────────────

function DatabaseSchemaPanel() {
    return (
        <SectionShell title="Database Schema" description="Manage locked databases, properties, and relationships between them.">
            <SettingsCard>
                <p className="text-sm text-neutral-500 mb-4">Navigate to the dedicated Database Schema editor for full control.</p>
                <a href="/admin/settings/databases" className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-bold transition-colors">
                    <DbIcon className="w-4 h-4" /> Open Schema Editor
                </a>
            </SettingsCard>
        </SectionShell>
    );
}

function ModuleConfigPanel() {
    const modules = [
        { id: 'INVOICING', label: 'Invoicing & Expenses', enabled: true },
        { id: 'CRM', label: 'CRM / Relations', enabled: true },
        { id: 'PROJECTS', label: 'Projects', enabled: true },
        { id: 'TASKS', label: 'Task Manager', enabled: true },
        { id: 'HR', label: 'HR & Workforce', enabled: true },
        { id: 'CALENDAR', label: 'Calendar', enabled: true },
        { id: 'WEBSITES', label: 'Website Builder', enabled: false },
        { id: 'INBOX', label: 'Inbox / Email', enabled: false },
    ];

    return (
        <SectionShell title="Active Modules" description="Enable or disable ERP modules for this tenant environment.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {modules.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl">
                        <div>
                            <p className="text-sm font-bold text-neutral-900 dark:text-white">{m.label}</p>
                            <p className="text-[10px] font-mono text-neutral-400 uppercase">{m.id}</p>
                        </div>
                        <button className={`w-10 h-5 rounded-full transition-colors relative ${m.enabled ? 'bg-violet-500' : 'bg-neutral-300 dark:bg-neutral-600'}`}>
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${m.enabled ? 'left-[22px]' : 'left-0.5'}`} />
                        </button>
                    </div>
                ))}
            </div>
        </SectionShell>
    );
}

function WorkflowRulesPanel() {
    return (
        <SectionShell title="Workflow Rules" description="Configure approval chains and automation triggers.">
            <SettingsCard title="Approval Workflows">
                <div className="space-y-3">
                    {[
                        { name: 'Purchase Invoice Approval', status: 'Active', route: 'Manager → Finance → CEO' },
                        { name: 'Leave Request', status: 'Active', route: 'Manager → HR' },
                        { name: 'Expense Ticket', status: 'Draft', route: 'Manager → Finance' },
                    ].map(wf => (
                        <div key={wf.name} className="flex items-center justify-between p-3 bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-white/5 rounded-lg">
                            <div>
                                <p className="text-sm font-semibold text-neutral-900 dark:text-white">{wf.name}</p>
                                <p className="text-xs text-neutral-400 mt-0.5 font-mono">{wf.route}</p>
                            </div>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${wf.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-neutral-100 text-neutral-500 dark:bg-white/5'}`}>{wf.status}</span>
                        </div>
                    ))}
                </div>
            </SettingsCard>
        </SectionShell>
    );
}

function RolesPermissionsPanel() {
    const roles = [
        { name: 'Admin', count: 1, color: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
        { name: 'Manager', count: 2, color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' },
        { name: 'Employee', count: 8, color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' },
        { name: 'Viewer', count: 0, color: 'bg-neutral-100 text-neutral-600 dark:bg-white/5 dark:text-neutral-400' },
    ];

    return (
        <SectionShell title="Roles & Permissions" description="Define access levels for team members.">
            <div className="space-y-2">
                {roles.map(r => (
                    <div key={r.name} className="flex items-center justify-between p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl hover:border-neutral-300 dark:hover:border-white/20 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${r.color}`}>{r.name}</span>
                            <span className="text-xs text-neutral-400">{r.count} member{r.count !== 1 ? 's' : ''}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-500 transition-colors" />
                    </div>
                ))}
            </div>
        </SectionShell>
    );
}

// ─── Tenant Setting Panels (re-use existing logic) ───────────────────────────

function CompanyProfilePanel() {
    const [profile, setProfile] = useState({ companyName: '', vatNumber: '', iban: '', logoUrl: '', peppolId: '' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch('/api/tenant/profile').then(res => res.json()).then(data => {
            if (data && !data.error) {
                setProfile({
                    companyName: data.companyName || '',
                    vatNumber: data.vatNumber || '',
                    iban: data.iban || '',
                    logoUrl: data.logoUrl || '',
                    peppolId: data.peppolId || '',
                });
            }
            setLoading(false);
        });
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch('/api/tenant/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profile)
            });
            toast.success('Company profile saved!');
        } catch (e) {
            console.error('Failed to save profile', e);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center p-12 text-neutral-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading identity...</div>;
    }

    return (
        <SectionShell title="Company Profile" description="Configure your brand identity and billing details.">
            <SettingsCard>
                <div className="space-y-5">
                    <InputField label="Company Name" value={profile.companyName} onChange={v => setProfile(p => ({ ...p, companyName: v }))} placeholder="e.g. Coral Enterprises LLC" />
                    <div className="grid grid-cols-2 gap-5">
                        <InputField label="VAT Number" value={profile.vatNumber} onChange={v => setProfile(p => ({ ...p, vatNumber: v }))} placeholder="e.g. BE0123456789" />
                        <InputField label="IBAN Account" value={profile.iban} onChange={v => setProfile(p => ({ ...p, iban: v }))} placeholder="e.g. BE68 1234 5678 9012" />
                    </div>
                    <InputField label="Workspace Logo URL" value={profile.logoUrl} onChange={v => setProfile(p => ({ ...p, logoUrl: v }))} type="url" placeholder="https://example.com/logo.png" />
                    <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                        <button
                            onClick={handleSave} disabled={saving}
                            className="w-full flex items-center justify-center gap-2 text-white py-3 rounded-lg font-bold transition-all shadow-md active:scale-[0.98] disabled:opacity-50 hover:opacity-90"
                            style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                        >
                            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saving ? 'Saving...' : 'Save Company Profile'}
                        </button>
                    </div>
                </div>
            </SettingsCard>
        </SectionShell>
    );
}

function IntegrationsPanel() {
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
    const [accounts, setAccounts] = useState<any[]>([]);

    const fetchAccounts = async () => {
        setIsLoadingAccounts(true);
        try {
            const res = await fetch('/api/calendar/accounts');
            if (res.ok) { const data = await res.json(); setAccounts(data.accounts || []); }
        } catch (e) { console.error("Failed to fetch accounts:", e); }
        finally { setIsLoadingAccounts(false); }
    };

    useEffect(() => { fetchAccounts(); }, []);

    return (
        <SectionShell title="Integrations" description="Connect external services to your ERP.">
            {/* Google Calendar */}
            <SettingsCard title="Google Calendar">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-neutral-500">Sync your Google Calendar events.</p>
                    <button
                        onClick={() => signIn("google", { callbackUrl: window.location.href })}
                        className="px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm font-bold hover:border-neutral-300 transition-all shadow-sm flex items-center gap-2"
                    >
                        <CalendarIcon className="w-4 h-4 text-neutral-500" /> Link Account
                    </button>
                </div>
                {isLoadingAccounts ? (
                    <div className="text-sm text-neutral-500 flex items-center gap-2 py-2"><RefreshCw className="w-4 h-4 animate-spin" /> Loading...</div>
                ) : accounts.length === 0 ? (
                    <div className="text-sm text-neutral-500 flex items-center gap-2 py-2"><AlertCircle className="w-4 h-4" /> No accounts linked.</div>
                ) : (
                    <div className="space-y-2">
                        {accounts.map((acc, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold">{acc.email.charAt(0).toUpperCase()}</div>
                                    <div>
                                        <p className="text-sm font-bold">{acc.email}</p>
                                        <p className="text-[10px] text-neutral-500">{acc.calendars?.length || 0} calendars synced</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-600 text-[10px] font-bold uppercase"><Check className="w-3 h-3" /> Active</span>
                                    <button
                                        onClick={async () => { if (confirm("Disconnect?")) { await fetch(`/api/calendar/accounts?accountId=${acc.accountId}`, { method: 'DELETE' }); fetchAccounts(); } }}
                                        className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors"
                                    ><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </SettingsCard>

            {/* Google Drive */}
            <SettingsCard title="Google Drive Storage">
                <div className="flex items-center justify-between">
                    <p className="text-sm text-neutral-500 max-w-md">Authorize file storage via Google Drive.</p>
                    <a href="/api/drive/auth" className="px-4 py-2 bg-[#4285F4] text-white rounded-lg text-sm font-bold hover:bg-[#3367d6] transition-all shadow-sm flex items-center gap-2">
                        <HardDrive className="w-4 h-4" /> Authorize Drive
                    </a>
                </div>
            </SettingsCard>
        </SectionShell>
    );
}

function PeppolPanel() {
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);

    useEffect(() => { fetchStatus(); }, []);

    const fetchStatus = async () => {
        try { const res = await fetch('/api/peppol/onboard'); if (res.ok) setStatus(await res.json()); }
        catch (e) { console.error('Peppol fetch failed:', e); }
        finally { setLoading(false); }
    };

    const handleConnect = async () => {
        setConnecting(true);
        try {
            const res = await fetch('/api/peppol/onboard', { method: 'POST' });
            const data = await res.json();
            if (data.success) { toast.success(data.message || 'Peppol connected!'); fetchStatus(); }
            else { toast.error(data.error || 'Onboarding failed'); }
        } catch (e: any) { toast.error('Connection failed: ' + (e.message || 'Unknown error')); }
        finally { setConnecting(false); }
    };

    const isConnected = status?.connected || status?.alreadyConnected;

    return (
        <SectionShell title="Peppol E-Invoicing" description="Connect to the Peppol network for UBL e-invoice exchange.">
            <SettingsCard>
                {loading ? (
                    <div className="text-sm text-neutral-500 flex items-center gap-2 py-2"><RefreshCw className="w-4 h-4 animate-spin" /> Checking status...</div>
                ) : isConnected ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${status?.peppolRegistered ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                                <div>
                                    <p className="text-sm font-bold">{status?.peppolRegistered ? 'Peppol Active' : 'E-Invoice Connected'}</p>
                                    <p className="text-[10px] text-neutral-500">{status?.peppolRegistered ? 'Ready to send e-invoices' : 'Awaiting Peppol registration'}</p>
                                </div>
                            </div>
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 text-[10px] font-bold uppercase"><Check className="w-3 h-3" /> Connected</span>
                        </div>
                        {status?.peppolId && (
                            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800">
                                <span className="text-[10px] font-bold uppercase text-neutral-400">Peppol ID</span>
                                <p className="font-mono text-sm mt-1">{status.peppolId}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-neutral-500">{!status?.hasVatNumber ? 'Add VAT number in Company Profile first.' : 'Not yet connected.'}</p>
                        <button onClick={handleConnect} disabled={connecting || !status?.hasVatNumber}
                            className="px-4 py-2 text-white rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                            style={{ backgroundColor: 'var(--brand-color, #10B981)' }}
                        >
                            {connecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                            {connecting ? 'Connecting...' : 'Activate Peppol'}
                        </button>
                    </div>
                )}
            </SettingsCard>
        </SectionShell>
    );
}

function NotificationsPanel() {
    return (
        <SectionShell title="Notifications" description="Configure email digests and in-app alerts.">
            <SettingsCard title="Email Notifications">
                <div className="space-y-3">
                    {[
                        { label: 'Daily task summary', enabled: true },
                        { label: 'New invoice received', enabled: true },
                        { label: 'Leave request updates', enabled: false },
                        { label: 'Weekly project digest', enabled: false },
                    ].map(n => (
                        <div key={n.label} className="flex items-center justify-between py-2">
                            <span className="text-sm text-neutral-700 dark:text-neutral-300">{n.label}</span>
                            <button className={`w-10 h-5 rounded-full transition-colors relative ${n.enabled ? 'bg-orange-500' : 'bg-neutral-300 dark:bg-neutral-600'}`}>
                                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${n.enabled ? 'left-[22px]' : 'left-0.5'}`} />
                            </button>
                        </div>
                    ))}
                </div>
            </SettingsCard>
        </SectionShell>
    );
}

function UiPreferencesPanel() {
    return (
        <SectionShell title="UI & Appearance" description="Theme, brand color, and layout density.">
            <SettingsCard>
                <p className="text-sm text-neutral-500 mb-4">Navigate to the dedicated UI settings page for full control.</p>
                <a href="/admin/settings/ui" className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg text-sm font-bold transition-colors hover:opacity-90">
                    <Palette className="w-4 h-4" /> Open UI Settings
                </a>
            </SettingsCard>
        </SectionShell>
    );
}

function TeamMembersPanel() {
    return (
        <SectionShell title="Team Members" description="Invite users and assign roles.">
            <SettingsCard>
                <p className="text-sm text-neutral-500 mb-4">Navigate to the Team management page.</p>
                <a href="/admin/settings/team" className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg text-sm font-bold transition-colors hover:opacity-90">
                    <Users className="w-4 h-4" /> Manage Team
                </a>
            </SettingsCard>
        </SectionShell>
    );
}

function BillingPanel() {
    return (
        <SectionShell title="Plan & Billing" description="Your current subscription and usage.">
            <SettingsCard>
                <p className="text-sm text-neutral-500 mb-4">Navigate to the billing management page.</p>
                <a href="/admin/settings/billing" className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg text-sm font-bold transition-colors hover:opacity-90">
                    <CreditCard className="w-4 h-4" /> Manage Billing
                </a>
            </SettingsCard>
        </SectionShell>
    );
}

function TemplatesPanel() {
    return (
        <SectionShell title="Document Templates" description="Manage invoice, quotation, and report templates.">
            <SettingsCard>
                <p className="text-sm text-neutral-500 mb-4">Navigate to the templates editor.</p>
                <a href="/admin/settings/templates" className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-bold transition-colors">
                    <FileText className="w-4 h-4" /> Open Template Editor
                </a>
            </SettingsCard>
        </SectionShell>
    );
}

// ─── Panel Router ────────────────────────────────────────────────────────────

function PanelContent({ id }: { id: string }) {
    switch (id) {
        // Superadmin
        case 'platform-overview': return <PlatformOverviewPanel />;
        case 'all-tenants': return <AllTenantsPanel />;
        case 'feature-flags': return <FeatureFlagsPanel />;
        case 'platform-billing': return <PlatformBillingPanel />;
        case 'api-keys': return <ApiKeysPanel />;
        case 'audit-log': return <AuditLogPanel />;
        // ERP
        case 'database-schema': return <DatabaseSchemaPanel />;
        case 'module-config': return <ModuleConfigPanel />;
        case 'workflow-rules': return <WorkflowRulesPanel />;
        case 'roles-permissions': return <RolesPermissionsPanel />;
        case 'integrations': return <IntegrationsPanel />;
        case 'templates': return <TemplatesPanel />;
        // Tenant
        case 'company-profile': return <CompanyProfilePanel />;
        case 'team-members': return <TeamMembersPanel />;
        case 'billing': return <BillingPanel />;
        case 'ui-preferences': return <UiPreferencesPanel />;
        case 'notifications': return <NotificationsPanel />;
        case 'calendar-sync': return <IntegrationsPanel />;
        case 'file-storage': return <IntegrationsPanel />;
        case 'peppol': return <PeppolPanel />;
        default: return <div className="text-neutral-400 italic text-sm">Select a section from the sidebar.</div>;
    }
}

// ─── Main Module ─────────────────────────────────────────────────────────────

export default function SettingsModule() {
    const { data: session } = useSession();
    const userRole = (session?.user as any)?.role || '';
    const isSuperAdmin = ['SUPERADMIN', 'PLATFORM_ADMIN'].includes(userRole);
    const isAdmin = isSuperAdmin || ['ADMIN', 'OWNER'].includes(userRole);

    // Determine which tiers are visible
    const visibleTiers: SettingsTier[] = isSuperAdmin
        ? ['superadmin', 'erp', 'tenant']
        : isAdmin
            ? ['erp', 'tenant']
            : ['tenant'];

    const visibleItems = NAV_ITEMS.filter(item => visibleTiers.includes(item.tier));
    const [activeId, setActiveId] = useState(visibleItems[0]?.id || 'company-profile');

    return (
        <div className="flex-1 bg-white dark:bg-black w-full border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm flex flex-col md:flex-row min-h-[600px]">

            {/* ── Sidebar ── */}
            <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-neutral-900/20 overflow-y-auto hide-scrollbar flex-shrink-0">
                <div className="p-3 space-y-4">
                    {visibleTiers.map(tier => {
                        const meta = TIER_META[tier];
                        const tierItems = visibleItems.filter(item => item.tier === tier);

                        return (
                            <div key={tier}>
                                {/* Tier Header */}
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest mb-1.5 ${meta.bgClass}`}>
                                    {meta.icon}
                                    {meta.label}
                                </div>

                                {/* Items */}
                                <div className="space-y-0.5">
                                    {tierItems.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => setActiveId(item.id)}
                                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                                                activeId === item.id
                                                    ? 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm'
                                                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-transparent'
                                            }`}
                                            style={activeId === item.id ? { color: meta.color } : undefined}
                                        >
                                            {item.icon}
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 p-6 lg:p-10 overflow-y-auto hide-scrollbar">
                {/* Tier badge */}
                {(() => {
                    const current = NAV_ITEMS.find(n => n.id === activeId);
                    if (!current) return null;
                    const meta = TIER_META[current.tier];
                    return (
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest mb-6 ${meta.bgClass}`}>
                            {current.tier === 'superadmin' && <Lock className="w-3 h-3" />}
                            {meta.label}
                        </div>
                    );
                })()}
                <div className="max-w-3xl">
                    <PanelContent id={activeId} />
                </div>
            </div>
        </div>
    );
}
