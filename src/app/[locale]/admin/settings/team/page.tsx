"use client";

import { useState, useEffect, useCallback } from 'react';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredSettingsTabs } from '@/config/tabs';
import { useTenant } from '@/context/TenantContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSession } from 'next-auth/react';
import {
    Users, UserPlus, Shield, Eye, Edit3, Trash2,
    Check, X, Loader2, Mail, Crown, Briefcase, HardHat,
    ChevronDown,
} from 'lucide-react';

// Roles that can manage team (must match WORKSPACE_OWNER_ROLES in src/lib/roles.ts)
const OWNER_ROLES = ['APP_MANAGER', 'TENANT_PRO_OWNER', 'TENANT_ENTERPRISE_OWNER', 'TENANT_ENTERPRISE_MANAGER'];

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
    CRM: 'CRM & Contacts',
    PROJECTS: 'Projects',
    CALENDAR: 'Calendar',
    DATABASES: 'Databases',
    HR: 'HR & Workforce',
    TASKS: 'Tasks',
};

const ACCESS_LABELS: Record<AccessLevel, { label: string; desc: string; icon: typeof Eye }> = {
    ALL:              { label: 'All',               desc: 'See all records',                         icon: Eye },
    OWN:              { label: 'Own',               desc: 'Only records they created',               icon: Shield },
    ASSIGNED_AND_OWN: { label: 'Assigned & Own',    desc: 'Assigned records + their own',            icon: Edit3 },
    NONE:             { label: 'No Access',         desc: 'Module hidden',                           icon: X },
};

const ROLE_OPTIONS = [
    { value: 'TENANT_PRO_EMPLOYEE',          label: 'Employee',  icon: Briefcase,  desc: 'Standard user with configurable access' },
    { value: 'TENANT_ENTERPRISE_MANAGER',    label: 'Manager',   icon: Crown,      desc: 'Management-level access, can manage team' },
    { value: 'TENANT_ENTERPRISE_EMPLOYEE',   label: 'Employee',  icon: Briefcase,  desc: 'Standard user with configurable access' },
    { value: 'TENANT_ENTERPRISE_WORKFORCE',  label: 'Workforce', icon: HardHat,    desc: 'Field/labour — tasks todo, time tracker only' },
];

// ── Main Component ─────────────────────────────────────────────────────────
export default function TeamSettingsPage() {
    usePageTitle('Team');
    const { activeModules, planType, isPro } = useTenant();
    const { data: session } = useSession();
    const currentRole = (session?.user as { role?: string } | undefined)?.role ?? '';
    const isWorkspaceOwner = OWNER_ROLES.includes(currentRole);
    const filteredSettingsTabs = getFilteredSettingsTabs(activeModules);

    const [users, setUsers] = useState<WorkspaceUser[]>([]);
    const [maxUsers, setMaxUsers] = useState(1);
    const [loading, setLoading] = useState(true);
    const [showInvite, setShowInvite] = useState(false);
    const [editingUser, setEditingUser] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Invite form state
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteName, setInviteName] = useState('');
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

    // Filter role options based on plan
    const availableRoles = ROLE_OPTIONS.filter(r => {
        if (planType === 'PRO' || planType === 'FOUNDER') return r.value === 'TENANT_PRO_EMPLOYEE';
        return r.value.startsWith('TENANT_ENTERPRISE_');
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
        if (role.includes('OWNER') || role === 'APP_MANAGER' || role === 'TENANT_ADMIN') return Crown;
        if (role.includes('MANAGER')) return Crown;
        if (role.includes('WORKFORCE')) return HardHat;
        return Briefcase;
    };

    const getRoleLabel = (role: string) => {
        if (role.includes('OWNER') || role === 'APP_MANAGER' || role === 'TENANT_ADMIN') return 'Owner';
        if (role.includes('MANAGER')) return 'Manager';
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
                            {users.length} / {maxUsers === Infinity ? '∞' : maxUsers} seats
                        </span>
                        {isPro && isWorkspaceOwner && (
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

                                        {/* Actions — only workspace owners can edit/remove */}
                                        {!isOwner && isWorkspaceOwner && (
                                            <div className="flex items-center gap-1 shrink-0">
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
                                    {isEditing && !isOwner && (
                                        <AccessEditor
                                            moduleAccess={(u.moduleAccess || {}) as Record<string, string>}
                                            activeModules={activeModules}
                                            onSave={(access) => handleUpdateAccess(u.id, access)}
                                            onCancel={() => setEditingUser(null)}
                                            saving={saving}
                                        />
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
                                {inviteRole !== 'TENANT_ENTERPRISE_WORKFORCE' && (
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
                            <div className="relative">
                                <select
                                    value={current}
                                    onChange={e => setAccess(mod, e.target.value as AccessLevel)}
                                    className="appearance-none text-xs font-bold px-3 py-1.5 pr-7 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30"
                                >
                                    {Object.entries(ACCESS_LABELS).map(([val, { label }]) => (
                                        <option key={val} value={val}>{label}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400 pointer-events-none" />
                            </div>
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
