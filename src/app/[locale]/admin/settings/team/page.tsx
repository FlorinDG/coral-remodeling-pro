"use client";

import { useState, useEffect, useCallback } from 'react';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredSettingsTabs } from '@/config/tabs';
import { useTenant } from '@/context/TenantContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSession } from 'next-auth/react';
import { WORKSPACE_OWNER_ROLES } from '@/lib/roles';
import {
    Users, UserPlus, Shield, Eye, EyeOff, Edit3, Trash2,
    Check, X, Loader2, Mail, Crown, Briefcase, HardHat,
    ChevronDown, KeyRound, Calculator, Phone,
} from 'lucide-react';
import SearchableSelect from '@/components/ui/SearchableSelect';

// Roles that can manage team (must match WORKSPACE_OWNER_ROLES in src/lib/roles.ts)
const OWNER_ROLES = WORKSPACE_OWNER_ROLES;

// ── Types ──────────────────────────────────────────────────────────────────
type AccessLevel = 'ALL' | 'OWN' | 'ASSIGNED_AND_OWN' | 'NONE';
interface WorkspaceUser {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
    moduleAccess: Record<string, string>;
    inviteAccepted: boolean;
    invitedAt: string | null;
}

const MODULES = ['INVOICING', 'CRM', 'PROJECTS', 'CALENDAR', 'DATABASES', 'HR', 'TASKS'] as const;

const MODULE_LABELS: Record<string, string> = {
    INVOICING: 'Financials',
    CRM:       'Contacts',
    PROJECTS:  'Projects',
    CALENDAR:  'Calendar',
    DATABASES: 'Databases',
    HR:        'HR & Workforce',
    TASKS:     'Tasks',
};

const ACCESS_LABELS: Record<AccessLevel, { label: string; desc: string; icon: typeof Eye }> = {
    ALL:              { label: 'All',               desc: 'See all records',                         icon: Eye },
    OWN:              { label: 'Own',               desc: 'Only records they created',               icon: Shield },
    ASSIGNED_AND_OWN: { label: 'Assigned & Own',    desc: 'Assigned records + their own',            icon: Edit3 },
    NONE:             { label: 'No Access',         desc: 'Module hidden',                           icon: X },
};

const ROLE_OPTIONS = [
    { value: 'ACCOUNTANT',                   label: 'Accountant',          icon: Calculator, desc: 'Read-only financial access for your bookkeeper', tier: 'ALL' },
    { value: 'TENANT_PRO_EMPLOYEE',          label: 'Employee',            icon: Briefcase,  desc: 'Standard user with configurable access', tier: 'PRO' },
    { value: 'TENANT_ENTERPRISE_MANAGER',    label: 'Manager',             icon: Crown,      desc: 'Management-level access, can manage team', tier: 'ENTERPRISE' },
    { value: 'TENANT_ENTERPRISE_EMPLOYEE',   label: 'Employee',            icon: Briefcase,  desc: 'Standard user with configurable access', tier: 'ENTERPRISE' },
    { value: 'TENANT_ENTERPRISE_WORKFORCE',  label: 'Workforce',           icon: HardHat,    desc: 'Field/labour — tasks todo, time tracker only', tier: 'ENTERPRISE' },
    { value: 'BOOKKEEPING',                  label: 'Bookkeeping',         icon: Calculator, desc: 'Financials access only, no projects or HR', tier: 'PRO' },
    { value: 'TEAMLEAD',                     label: 'Team Lead',           icon: Crown,      desc: 'Projects, Tasks, HR team view — no financials', tier: 'PRO' },
    { value: 'PROJECT_MANAGER',              label: 'Project Manager',     icon: Briefcase,  desc: 'Full Projects + Tasks + Contacts access', tier: 'PRO' },
    { value: 'HR_OFFICER',                   label: 'HR Officer',          icon: HardHat,    desc: 'HR module only — no financials or projects', tier: 'ENTERPRISE' },
    { value: 'OFFERTES',                     label: 'Offertes Specialist', icon: Briefcase,  desc: 'Quotations, Contacts, Library & assigned Projects only', tier: 'ENTERPRISE' },
];

// ── Default module access per role ─────────────────────────────────────────
// Applied automatically when an owner selects a role in the invite form.\n// The owner can override these before sending the invite.
const ROLE_ACCESS_DEFAULTS: Record<string, Record<string, AccessLevel>> = {
    ACCOUNTANT:                  { INVOICING: 'ALL',  CRM: 'ALL',              PROJECTS: 'NONE', CALENDAR: 'NONE', DATABASES: 'NONE', HR: 'NONE', TASKS: 'NONE' },
    BOOKKEEPING:                 { INVOICING: 'ALL',  CRM: 'NONE',             PROJECTS: 'NONE', CALENDAR: 'OWN',  DATABASES: 'NONE', HR: 'NONE', TASKS: 'NONE' },
    TEAMLEAD:                    { INVOICING: 'NONE', CRM: 'OWN',              PROJECTS: 'ALL',  CALENDAR: 'ALL',  DATABASES: 'OWN',  HR: 'OWN',  TASKS: 'ALL'  },
    PROJECT_MANAGER:             { INVOICING: 'NONE', CRM: 'ASSIGNED_AND_OWN', PROJECTS: 'ALL',  CALENDAR: 'ALL',  DATABASES: 'OWN',  HR: 'NONE', TASKS: 'ALL'  },
    HR_OFFICER:                  { INVOICING: 'NONE', CRM: 'NONE',             PROJECTS: 'NONE', CALENDAR: 'OWN',  DATABASES: 'NONE', HR: 'ALL',  TASKS: 'OWN'  },
    OFFERTES:                    { INVOICING: 'NONE', CRM: 'OWN',              PROJECTS: 'ASSIGNED_AND_OWN', CALENDAR: 'NONE', DATABASES: 'NONE', HR: 'NONE', TASKS: 'NONE' },
    TENANT_PRO_EMPLOYEE:         { INVOICING: 'OWN',  CRM: 'OWN',              PROJECTS: 'OWN',  CALENDAR: 'OWN',  DATABASES: 'OWN',  HR: 'NONE', TASKS: 'OWN'  },
    TENANT_ENTERPRISE_MANAGER:   { INVOICING: 'ALL',  CRM: 'ALL',              PROJECTS: 'ALL',  CALENDAR: 'ALL',  DATABASES: 'ALL',  HR: 'ALL',  TASKS: 'ALL'  },
    TENANT_ENTERPRISE_EMPLOYEE:  { INVOICING: 'OWN',  CRM: 'OWN',              PROJECTS: 'OWN',  CALENDAR: 'OWN',  DATABASES: 'OWN',  HR: 'NONE', TASKS: 'OWN'  },
    TENANT_ENTERPRISE_WORKFORCE: { INVOICING: 'NONE', CRM: 'NONE',             PROJECTS: 'NONE', CALENDAR: 'NONE', DATABASES: 'NONE', HR: 'NONE', TASKS: 'OWN'  },
};

// ── Main Component ─────────────────────────────────────────────────────────
export default function TeamSettingsPage() {
    usePageTitle('Team');
    const { activeModules, planType } = useTenant();
    const { data: session } = useSession();
    const currentRole = session?.user?.role ?? '';
    const isWorkspaceOwner = (OWNER_ROLES as string[]).includes(currentRole);
    const filteredSettingsTabs = getFilteredSettingsTabs(activeModules);

    const [users, setUsers] = useState<WorkspaceUser[]>([]);
    const [maxUsers, setMaxUsers] = useState(1);
    const [loading, setLoading] = useState(true);
    const [showInvite, setShowInvite] = useState(false);
    const [editingUser, setEditingUser] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Password reset state
    const [resetUserId, setResetUserId] = useState<string | null>(null);
    const [resetPassword, setResetPassword] = useState('');
    const [resetShowPw, setResetShowPw] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [resetSuccess, setResetSuccess] = useState<string | null>(null);

    // Invite form state
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [invitePhone, setInvitePhone] = useState('');
    const [inviteRole, setInviteRole] = useState('TENANT_PRO_EMPLOYEE');
    const [inviteAccess, setInviteAccess] = useState<Record<string, AccessLevel>>({});
    const [inviteError, setInviteError] = useState('');

    const fetchUsers = useCallback(async () => {
        try {
            const res = await fetch('/api/tenant/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data.users);
                setMaxUsers(data.maxUsers);
            }
        } catch {
            // silent fail
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    // Auto-populate module access when role changes (tenant admin can still override)
    useEffect(() => {
        const defaults = ROLE_ACCESS_DEFAULTS[inviteRole];
        if (defaults) setInviteAccess(defaults as Record<string, AccessLevel>);
        else setInviteAccess({});
    }, [inviteRole]);

    // Filter role options based on plan
    const availableRoles = ROLE_OPTIONS.filter(r => {
        if (r.tier === 'ALL') return true; // ACCOUNTANT always available
        if (r.tier === 'PRO') {
            return planType === 'PRO' || planType === 'ENTERPRISE' || planType === 'FOUNDER' || planType === 'CUSTOM';
        }
        // ENTERPRISE tier roles
        return planType === 'ENTERPRISE' || planType === 'FOUNDER' || planType === 'CUSTOM';
    });

    const handleInvite = async () => {
        if (!inviteEmail) { setInviteError('Email is required'); return; }
        setSaving(true);
        setInviteError('');
        try {
            const res = await fetch('/api/tenant/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: inviteEmail,
                    name: inviteName,
                    role: inviteRole,
                    moduleAccess: inviteAccess,
                    phone: invitePhone || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setInviteError(data.message || data.error || 'Failed to invite user');
                return;
            }
            // Success
            setShowInvite(false);
            setInviteEmail('');
            setInviteName('');
            setInvitePhone('');
            setInviteAccess({});
            fetchUsers();
        } catch {
            setInviteError('Network error');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateAccess = async (userId: string, access: Record<string, string>) => {
        setSaving(true);
        try {
            await fetch(`/api/tenant/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ moduleAccess: access }),
            });
            fetchUsers();
        } finally {
            setSaving(false);
            setEditingUser(null);
        }
    };

    const handleRemoveUser = async (userId: string) => {
        if (!confirm('Remove this user from your workspace? This cannot be undone.')) return;
        await fetch(`/api/tenant/users/${userId}`, { method: 'DELETE' });
        fetchUsers();
    };

    const getRoleIcon = (role: string) => {
        if (role === 'ACCOUNTANT' || role === 'BOOKKEEPING') return Calculator;
        if (role.includes('OWNER') || role === 'APP_MANAGER' || role === 'TENANT_ADMIN' || role === 'TEAMLEAD') return Crown;
        if (role.includes('MANAGER') || role === 'PROJECT_MANAGER') return Crown;
        if (role.includes('WORKFORCE') || role === 'HR_OFFICER') return HardHat;
        return Briefcase;
    };

    const getRoleLabel = (role: string) => {
        if (role === 'ACCOUNTANT')      return 'Accountant';
        if (role === 'BOOKKEEPING')     return 'Bookkeeping';
        if (role === 'TEAMLEAD')        return 'Team Lead';
        if (role === 'PROJECT_MANAGER') return 'Project Manager';
        if (role === 'HR_OFFICER')      return 'HR Officer';
        if (role === 'OFFERTES')        return 'Offertes';
        if (role.includes('OWNER') || role === 'APP_MANAGER' || role === 'TENANT_ADMIN') return 'Owner';
        if (role.includes('MANAGER'))   return 'Manager';
        if (role.includes('WORKFORCE')) return 'Workforce';
        return 'Employee';
    };

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={filteredSettingsTabs} groupId="settings" />

            <div className="flex-1 overflow-y-auto p-6 pb-16 bg-neutral-50/50 dark:bg-[#0a0a0a]">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
                            <Users className="w-6 h-6" /> Team Management
                        </h1>
                        <p className="text-sm text-neutral-500 mt-1">
                            Invite team members, assign roles, and control per-module data access.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-neutral-400 px-3 py-1.5 bg-neutral-100 dark:bg-white/5 rounded-lg">
                            {maxUsers === null || maxUsers === Infinity
                                ? `${users.length} member${users.length !== 1 ? 's' : ''}`
                                : `${users.length} / ${maxUsers} seats`}
                        </span>
                        {isWorkspaceOwner && (
                            <button
                                onClick={() => setShowInvite(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-color,#d35400)] text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                            >
                                <UserPlus className="w-4 h-4" /> Invite
                            </button>
                        )}
                    </div>
                </div>

                {/* User list */}
                {loading ? (
                    <div className="flex items-center justify-center h-40">
                        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                    </div>
                ) : (
                    <div className="space-y-3">
                        {users.map(u => {
                            const RoleIcon = getRoleIcon(u.role);
                            const isOwner = u.role.includes('OWNER') || u.role === 'APP_MANAGER' || u.role === 'TENANT_ADMIN';
                            const isEditing = editingUser === u.id;

                            return (
                                <div
                                    key={u.id}
                                    className="bg-white dark:bg-white/5 rounded-2xl border border-neutral-200 dark:border-white/10 p-4 transition-all hover:shadow-sm"
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Avatar */}
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-white/10 dark:to-white/5 flex items-center justify-center text-sm font-bold text-neutral-600 dark:text-neutral-300 shrink-0">
                                            {(u.name || u.email || '?')[0].toUpperCase()}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-neutral-900 dark:text-white text-sm truncate">
                                                    {u.name || u.email}
                                                </span>
                                                {!u.inviteAccepted && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                                                        PENDING
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Mail className="w-3 h-3 text-neutral-400" />
                                                <span className="text-xs text-neutral-500 truncate">{u.email}</span>
                                            </div>
                                        </div>

                                        {/* Role badge */}
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 dark:bg-white/5 rounded-lg shrink-0">
                                            <RoleIcon className="w-3.5 h-3.5 text-neutral-500" />
                                            <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300">{getRoleLabel(u.role)}</span>
                                        </div>

                                        {/* Actions — only workspace owners can edit/remove (Superadmin can manage any user except themselves) */}
                                        {((!isOwner && isWorkspaceOwner) || (currentRole === 'SUPERADMIN' && u.id !== session?.user?.id)) && (
                                            <div className="flex items-center gap-1 shrink-0">
                                                {/* Password reset */}
                                                {resetSuccess === u.id ? (
                                                    <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-0.5 px-2 py-1">
                                                        <Check className="w-3 h-3" /> Reset!
                                                    </span>
                                                ) : resetUserId === u.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <div className="relative">
                                                            <input
                                                                type={resetShowPw ? 'text' : 'password'}
                                                                value={resetPassword}
                                                                onChange={(e) => setResetPassword(e.target.value)}
                                                                placeholder="New password"
                                                                className="w-28 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-white/20 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-orange-500"
                                                            />
                                                            <button type="button" onClick={() => setResetShowPw(!resetShowPw)} className="absolute right-1 top-1 text-neutral-400">
                                                                {resetShowPw ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                            </button>
                                                        </div>
                                                        <button
                                                            disabled={resetLoading || resetPassword.length < 6}
                                                            onClick={async () => {
                                                                setResetLoading(true);
                                                                try {
                                                                    const res = await fetch('/api/auth/admin-reset-password', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ userId: u.id, newPassword: resetPassword }),
                                                                    });
                                                                    if (res.ok) {
                                                                        setResetSuccess(u.id);
                                                                        setResetUserId(null);
                                                                        setResetPassword('');
                                                                        setTimeout(() => setResetSuccess(null), 3000);
                                                                    } else {
                                                                        const data = await res.json();
                                                                        alert(data.error || 'Failed to reset password');
                                                                    }
                                                                } catch {
                                                                    alert('Network error');
                                                                } finally {
                                                                    setResetLoading(false);
                                                                }
                                                            }}
                                                            className="p-1 rounded bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
                                                            title="Confirm reset"
                                                        >
                                                            {resetLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                        </button>
                                                        <button
                                                            onClick={() => { setResetUserId(null); setResetPassword(''); }}
                                                            className="p-1 rounded text-neutral-400 hover:text-red-500 transition-colors text-[10px]"
                                                            title="Cancel"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => { setResetUserId(u.id); setResetPassword(''); setResetShowPw(false); }}
                                                        className="p-2 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-500/10 text-neutral-400 hover:text-orange-600 transition-colors"
                                                        title="Reset password"
                                                    >
                                                        <KeyRound className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setEditingUser(isEditing ? null : u.id)}
                                                    className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors"
                                                    title="Edit access"
                                                >
                                                    <Shield className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveUser(u.id)}
                                                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-neutral-400 hover:text-red-600 transition-colors"
                                                    title="Remove user"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Expanded access editor */}
                                    {isEditing && (!isOwner || currentRole === 'SUPERADMIN') && (
                                        <>
                                            <AccessEditor
                                                moduleAccess={(u.moduleAccess || {}) as Record<string, string>}
                                                activeModules={activeModules}
                                                onSave={(access) => handleUpdateAccess(u.id, access)}
                                                onCancel={() => setEditingUser(null)}
                                                saving={saving}
                                            />
                                            {/* Project assignment matrix — shown when user has any PROJECTS access */}
                                            {(() => {
                                                const projAccess = ((u.moduleAccess || {}) as Record<string, string>)['PROJECTS'] || 'OWN';
                                                return projAccess !== 'NONE' ? (
                                                    <ProjectAssignmentMatrix userId={u.id} />
                                                ) : null;
                                            })()}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Invite modal */}
                {showInvite && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowInvite(false)}>
                        <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                                <UserPlus className="w-5 h-5" /> Invite Team Member
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">Email *</label>
                                    <input
                                        type="email"
                                        value={inviteEmail}
                                        onChange={e => setInviteEmail(e.target.value)}
                                        placeholder="colleague@company.com"
                                        className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">Name</label>
                                    <input
                                        type="text"
                                        value={inviteName}
                                        onChange={e => setInviteName(e.target.value)}
                                        placeholder="John Doe"
                                        className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">Phone</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                        <input
                                            type="tel"
                                            value={invitePhone}
                                            onChange={e => setInvitePhone(e.target.value)}
                                            placeholder="+32 4XX XX XX XX"
                                            className="w-full pl-10 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">Role</label>
                                    <div className="grid gap-2">
                                        {availableRoles.map(r => {
                                            const Icon = r.icon;
                                            return (
                                                <button
                                                    key={r.value}
                                                    onClick={() => setInviteRole(r.value)}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                                                        inviteRole === r.value
                                                            ? 'border-[var(--brand-color,#d35400)] bg-[var(--brand-color,#d35400)]/5'
                                                            : 'border-neutral-200 dark:border-white/10 hover:border-neutral-300'
                                                    }`}
                                                >
                                                    <Icon className={`w-4 h-4 ${inviteRole === r.value ? 'text-[var(--brand-color,#d35400)]' : 'text-neutral-400'}`} />
                                                    <div>
                                                        <p className="text-sm font-bold text-neutral-900 dark:text-white">{r.label}</p>
                                                        <p className="text-xs text-neutral-500">{r.desc}</p>
                                                    </div>
                                                    {inviteRole === r.value && <Check className="w-4 h-4 ml-auto text-[var(--brand-color,#d35400)]" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Per-module access */}
                                {inviteRole !== 'TENANT_ENTERPRISE_WORKFORCE' && inviteRole !== 'ACCOUNTANT' && (
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block">Module Access (default: Own)</label>
                                        <AccessEditor
                                            moduleAccess={inviteAccess}
                                            activeModules={activeModules}
                                            onSave={(access) => { setInviteAccess(access as Record<string, AccessLevel>); }}
                                            inline
                                        />
                                    </div>
                                )}

                                {inviteError && (
                                    <p className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg">{inviteError}</p>
                                )}

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => setShowInvite(false)}
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 text-sm font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleInvite}
                                        disabled={saving || !inviteEmail}
                                        className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--brand-color,#d35400)] text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                        Send Invite
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Access Editor (reusable for invite + edit) ─────────────────────────────
function AccessEditor({
    moduleAccess,
    activeModules,
    onSave,
    onCancel,
    saving = false,
    inline = false,
}: {
    moduleAccess: Record<string, string>;
    activeModules: string[];
    onSave: (access: Record<string, string>) => void;
    onCancel?: () => void;
    saving?: boolean;
    inline?: boolean;
}) {
    const [local, setLocal] = useState<Record<string, string>>({ ...moduleAccess });

    const setAccess = (module: string, level: AccessLevel) => {
        const next = { ...local, [module]: level };
        setLocal(next);
        if (inline) onSave(next); // auto-save in inline mode
    };

    const visibleModules = MODULES.filter(m => activeModules.includes(m));

    return (
        <div className={inline ? '' : 'mt-4 pt-4 border-t border-neutral-100 dark:border-white/5'}>
            <div className="grid gap-2">
                {visibleModules.map(mod => {
                    const current = (local[mod] as AccessLevel) || 'OWN';
                    return (
                        <div key={mod} className="flex items-center justify-between gap-3 py-1.5">
                            <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 min-w-[100px]">
                                {MODULE_LABELS[mod] || mod}
                            </span>
                            <SearchableSelect
                                value={current}
                                onChange={(val) => setAccess(mod, val as AccessLevel)}
                                options={Object.entries(ACCESS_LABELS).map(([val, { label }]) => ({ value: val, label }))}
                                placeholder="Select access"
                                className="w-44"
                            />
                        </div>
                    );
                })}
            </div>

            {!inline && (
                <div className="flex gap-2 mt-3">
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        onClick={() => onSave(local)}
                        disabled={saving}
                        className="px-4 py-1.5 rounded-lg bg-[var(--brand-color,#d35400)] text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                    >
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Save Access
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Project Assignment Matrix ─────────────────────────────────────────────
// Displays for users with PROJECTS access != NONE.
// Owner can check/uncheck individual projects to grant explicit assignment.
function ProjectAssignmentMatrix({ userId }: { userId: string }) {
    const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
    const [assigned, setAssigned] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null); // projectId being toggled

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                // Fetch project list from the database store endpoint
                const [projRes, accessRes] = await Promise.all([
                    fetch('/api/tenant/projects-list'),
                    fetch(`/api/tenant/project-access?userId=${encodeURIComponent(userId)}`),
                ]);
                if (cancelled) return;
                const projData = projRes.ok ? await projRes.json() : { pages: [] };
                const accessData = accessRes.ok ? await accessRes.json() : { projectIds: [] };
                setProjects((projData.pages ?? []).map((p: { id: string; properties?: { Name?: string; title?: string } }) => ({
                    id: p.id,
                    name: (p.properties?.Name || p.properties?.title || 'Untitled Project') as string,
                })));
                setAssigned(new Set(accessData.projectIds ?? []));
            } catch {
                // silent fail — the matrix just stays empty
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [userId]);

    const toggle = async (projectId: string) => {
        const next = new Set(assigned);
        if (next.has(projectId)) next.delete(projectId);
        else next.add(projectId);
        setSaving(projectId);
        try {
            const res = await fetch('/api/tenant/project-access', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, projectIds: Array.from(next) }),
            });
            if (res.ok) setAssigned(next);
        } catch {
            // revert on error — assigned stays unchanged
        } finally {
            setSaving(null);
        }
    };

    if (loading) {
        return (
            <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-white/5 flex items-center gap-2 text-xs text-neutral-400">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading projects…
            </div>
        );
    }

    if (projects.length === 0) {
        return (
            <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-white/5 text-xs text-neutral-400 italic">
                No projects found. Create projects in the Projects module first.
            </div>
        );
    }

    return (
        <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-white/5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2">
                Assigned Projects
            </p>
            <div className="grid gap-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {projects.map(proj => {
                    const isAssigned = assigned.has(proj.id);
                    const isSaving  = saving === proj.id;
                    return (
                        <label
                            key={proj.id}
                            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 cursor-pointer transition-colors group"
                        >
                            <div className="relative flex-shrink-0">
                                {isSaving ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--brand-color,#d35400)]" />
                                ) : (
                                    <input
                                        type="checkbox"
                                        checked={isAssigned}
                                        onChange={() => toggle(proj.id)}
                                        className="w-3.5 h-3.5 rounded border-neutral-300 dark:border-white/20 accent-[var(--brand-color,#d35400)] cursor-pointer"
                                    />
                                )}
                            </div>
                            <span className="text-xs text-neutral-700 dark:text-neutral-300 truncate flex-1">
                                {proj.name}
                            </span>
                            {isAssigned && !isSaving && (
                                <Check className="w-3 h-3 text-[var(--brand-color,#d35400)] flex-shrink-0 opacity-70" />
                            )}
                        </label>
                    );
                })}
            </div>
        </div>
    );
}
