"use client";

import { useState, useEffect, useCallback } from "react";
import SearchableSelect from '@/components/ui/SearchableSelect';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { hrTabs } from "@/config/tabs";
import {
    Users, Plus, Mail, Phone, Briefcase, X, Loader2, Pencil, Trash2, Search, Euro,
    CalendarIcon, MapPin, Clock, Award, ChevronRight, FileText, Building2,
    Shield, GraduationCap, MoreHorizontal, ArrowLeft, Save, User
} from "lucide-react";
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';

interface Employee {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    role: string;
    status: string;
    hourlyCost: number | null;
    hireDate: string | null;
}

// Extended profile fields (stored locally for now, will be API-backed)
interface EmployeeProfile extends Employee {
    department?: string;
    employmentType?: string;
    address?: string;
    birthDate?: string;
    certifications?: string[];
    notes?: string;
}

// Local profile storage helper
function loadProfile(empId: string): Partial<EmployeeProfile> {
    try {
        const raw = localStorage.getItem(`emp-profile-${empId}`);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}
function saveProfile(empId: string, data: Partial<EmployeeProfile>) {
    try {
        localStorage.setItem(`emp-profile-${empId}`, JSON.stringify(data));
    } catch { /* empty */ }
}

// Map display roles → system roles
const ROLE_OPTIONS = [
    { label: 'Employee', value: 'TENANT_ENTERPRISE_EMPLOYEE' },
    { label: 'Workforce', value: 'TENANT_ENTERPRISE_WORKFORCE' },
    { label: 'Manager', value: 'TENANT_ENTERPRISE_MANAGER' },
    { label: 'Project Manager', value: 'PROJECT_MANAGER' },
    { label: 'Foreman', value: 'TEAMLEAD' },
    { label: 'HR Officer', value: 'HR_OFFICER' },
    { label: 'Bookkeeping', value: 'BOOKKEEPING' },
    { label: 'Offertes', value: 'OFFERTES' },
    { label: 'Admin', value: 'APP_MANAGER' },
] as const;

// Reverse map for display
const ROLE_LABEL_MAP: Record<string, string> = Object.fromEntries(
    ROLE_OPTIONS.map(r => [r.value, r.label])
);
function getRoleLabel(systemRole: string) {
    return ROLE_LABEL_MAP[systemRole] || systemRole;
}
const DEPARTMENTS = ["Operations", "Construction", "Design", "Administration", "Finance", "HR", "Sales", "Marketing"];
const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contractor", "Intern", "Temporary"];

const emptyForm = {
    firstName: "", lastName: "", email: "", phone: "", role: "TENANT_ENTERPRISE_EMPLOYEE", status: "ACTIVE",
    hourlyCost: "", hireDate: "", department: "", employmentType: "Full-time",
    address: "", birthDate: "", notes: ""
};

// ── Stat helpers ──────────────────────────────────────────────────────
function getInitials(first: string, last: string) {
    return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase();
}

function getStatusConfig(status: string) {
    switch (status) {
        case 'ACTIVE': return { bg: 'bg-emerald-100 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/20', dot: 'bg-emerald-500' };
        case 'ON_LEAVE': return { bg: 'bg-amber-100 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-500/20', dot: 'bg-amber-500' };
        case 'INACTIVE': return { bg: 'bg-neutral-100 dark:bg-white/5', text: 'text-neutral-600 dark:text-neutral-400', border: 'border-neutral-200 dark:border-neutral-700', dot: 'bg-neutral-400' };
        default: return { bg: 'bg-neutral-100', text: 'text-neutral-600', border: 'border-neutral-200', dot: 'bg-neutral-400' };
    }
}

function getTenure(hireDate: string | null) {
    if (!hireDate) return null;
    const hire = new Date(hireDate);
    const now = new Date();
    const years = now.getFullYear() - hire.getFullYear();
    const months = now.getMonth() - hire.getMonth();
    const totalMonths = years * 12 + months;
    if (totalMonths < 1) return 'New hire';
    if (totalMonths < 12) return `${totalMonths}mo`;
    const y = Math.floor(totalMonths / 12);
    const m = totalMonths % 12;
    return m > 0 ? `${y}y ${m}mo` : `${y}y`;
}

const GRADIENT_COLORS = [
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-violet-500 to-purple-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-cyan-500 to-blue-600',
    'from-fuchsia-500 to-pink-600',
    'from-lime-500 to-green-600',
];

function getGradient(id: string) {
    const idx = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % GRADIENT_COLORS.length;
    return GRADIENT_COLORS[idx];
}

// ── Main Component ───────────────────────────────────────────────────
export default function EmployeesPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showDialog, setShowDialog] = useState(false);
    const [editing, setEditing] = useState<Employee | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [deleting, setDeleting] = useState<string | null>(null);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');

    const fetchEmployees = useCallback(async () => {
        try {
            const res = await fetch("/api/tenant/employees");
            const data = await res.json();
            setEmployees(data.employees || []);
        } catch { /* empty */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

    const openAdd = () => { setEditing(null); setForm(emptyForm); setError(""); setShowDialog(true); };
    const openEdit = (emp: Employee) => {
        setEditing(emp);
        const profile = loadProfile(emp.id);
        setForm({
            firstName: emp.firstName, lastName: emp.lastName, email: emp.email,
            phone: emp.phone || "", role: emp.role, status: emp.status,
            hourlyCost: emp.hourlyCost?.toString() || "", hireDate: emp.hireDate?.split("T")[0] || "",
            department: profile.department || "", employmentType: profile.employmentType || "Full-time",
            address: profile.address || "", birthDate: profile.birthDate || "", notes: profile.notes || ""
        });
        setError("");
        setShowDialog(true);
    };

    const handleSave = async () => {
        if (!form.firstName || !form.lastName || !form.email || !form.role) { setError("Fill in all required fields."); return; }
        setSaving(true); setError("");
        try {
            const url = editing ? `/api/tenant/employees/${editing.id}` : "/api/tenant/employees";
            const method = editing ? "PUT" : "POST";
            const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
            const data = await res.json();
            if (!res.ok) { setError(data.error || "Something went wrong"); setSaving(false); return; }

            // Save extended profile fields locally
            const empId = editing?.id || data.employee?.id;
            if (empId) {
                saveProfile(empId, {
                    department: form.department,
                    employmentType: form.employmentType,
                    address: form.address,
                    birthDate: form.birthDate,
                    notes: form.notes,
                });
            }

            setShowDialog(false);
            await fetchEmployees();

            // Refresh selectedEmployee with updated data if viewing detail
            if (selectedEmployee && editing) {
                setSelectedEmployee({
                    ...editing,
                    firstName: form.firstName,
                    lastName: form.lastName,
                    email: form.email,
                    phone: form.phone || null,
                    role: form.role,
                    status: form.status,
                    hourlyCost: form.hourlyCost ? parseFloat(form.hourlyCost) : null,
                    hireDate: form.hireDate || null,
                });
            }
        } catch { setError("Network error"); } finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this employee? This action cannot be undone.")) return;
        setDeleting(id);
        try {
            await fetch(`/api/tenant/employees/${id}`, { method: "DELETE" });
            fetchEmployees();
            if (selectedEmployee?.id === id) setSelectedEmployee(null);
        } catch { /* empty */ } finally { setDeleting(null); }
    };

    const filtered = employees.filter(e => {
        const matchesSearch = `${e.firstName} ${e.lastName} ${e.email} ${e.role}`.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || e.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // ── Employee Detail View ──────────────────────────────────────────
    if (selectedEmployee) {
        const emp = selectedEmployee;
        const statusCfg = getStatusConfig(emp.status);
        const tenure = getTenure(emp.hireDate);

        return (
            <div className="flex flex-col w-full h-full">
                <ModuleTabs tabs={hrTabs} groupId="hr" />
                <div className="w-full h-full flex flex-col hide-scrollbar overflow-y-auto">
                    {/* Profile Header */}
                    <div className={`relative bg-gradient-to-r ${getGradient(emp.id)} p-6 pb-20`}>
                        <button
                            onClick={() => setSelectedEmployee(null)}
                            className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium transition-colors mb-4"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back to Directory
                        </button>
                        <div className="absolute -bottom-12 left-6 flex items-end gap-4">
                            <div className="w-24 h-24 rounded-2xl bg-white dark:bg-neutral-900 border-4 border-white dark:border-neutral-900 shadow-xl flex items-center justify-center">
                                <span className={`text-2xl font-black bg-gradient-to-br ${getGradient(emp.id)} bg-clip-text text-transparent`}>
                                    {getInitials(emp.firstName, emp.lastName)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 pt-16 pb-8">
                        {/* Name & Actions */}
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
                                    {emp.firstName} {emp.lastName}
                                </h1>
                                <div className="flex items-center gap-3 mt-1.5">
                                    <span className="text-sm font-medium text-neutral-500">{getRoleLabel(emp.role)}</span>
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                                        {emp.status}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => openEdit(emp)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-200 dark:border-white/10 text-sm font-bold hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors">
                                    <Pencil className="w-3.5 h-3.5" /> Edit
                                </button>
                                <button onClick={() => handleDelete(emp.id)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 dark:border-red-500/20 text-red-600 text-sm font-bold hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" /> Delete
                                </button>
                            </div>
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
                            {/* Contact Card */}
                            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl p-5">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                                    <Mail className="w-3.5 h-3.5" /> Contact Information
                                </h3>
                                <div className="space-y-3">
                                    <DetailRow icon={<Mail className="w-4 h-4" />} label="Email" value={emp.email} />
                                    <DetailRow icon={<Phone className="w-4 h-4" />} label="Phone" value={emp.phone || '—'} />
                                    <DetailRow icon={<MapPin className="w-4 h-4" />} label="Address" value={loadProfile(emp.id).address || 'Not set'} />
                                </div>
                            </div>

                            {/* Employment Card */}
                            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl p-5">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                                    <Briefcase className="w-3.5 h-3.5" /> Employment Details
                                </h3>
                                <div className="space-y-3">
                                    <DetailRow icon={<Briefcase className="w-4 h-4" />} label="Role" value={getRoleLabel(emp.role)} />
                                    <DetailRow icon={<Building2 className="w-4 h-4" />} label="Department" value={loadProfile(emp.id).department || 'Not set'} />
                                    <DetailRow icon={<CalendarIcon className="w-4 h-4" />} label="Hire Date" value={emp.hireDate ? new Date(emp.hireDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
                                    {tenure && <DetailRow icon={<Clock className="w-4 h-4" />} label="Tenure" value={tenure} />}
                                </div>
                            </div>

                            {/* Compensation Card */}
                            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl p-5">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                                    <Euro className="w-3.5 h-3.5" /> Compensation
                                </h3>
                                <div className="space-y-3">
                                    <DetailRow icon={<Euro className="w-4 h-4" />} label="Hourly Rate" value={emp.hourlyCost != null ? `€${emp.hourlyCost.toFixed(2)}/h` : '—'} />
                                    <DetailRow icon={<FileText className="w-4 h-4" />} label="Contract" value={loadProfile(emp.id).employmentType || 'Full-time'} />
                                    <DetailRow icon={<Shield className="w-4 h-4" />} label="Benefits" value="Standard Package" />
                                </div>
                            </div>
                        </div>

                        {/* Bottom Row: Certifications + Quick Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                            {/* Certifications */}
                            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl p-5">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                                    <GraduationCap className="w-3.5 h-3.5" /> Certifications & Skills
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {['VCA Basic', 'First Aid'].map(cert => (
                                        <span key={cert} className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-white/5 text-xs font-semibold text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-white/10">
                                            {cert}
                                        </span>
                                    ))}
                                    <button className="px-2.5 py-1 rounded-lg border border-dashed border-neutral-300 dark:border-white/20 text-xs font-semibold text-neutral-400 hover:text-neutral-600 hover:border-neutral-400 transition-colors">
                                        + Add
                                    </button>
                                </div>
                            </div>

                            {/* Quick Stats */}
                            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl p-5">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                                    <Award className="w-3.5 h-3.5" /> Quick Stats
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-neutral-50 dark:bg-white/5 rounded-lg p-3 text-center">
                                        <p className="text-xl font-black text-neutral-900 dark:text-white">0h</p>
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 mt-0.5">This Week</p>
                                    </div>
                                    <div className="bg-neutral-50 dark:bg-white/5 rounded-lg p-3 text-center">
                                        <p className="text-xl font-black text-neutral-900 dark:text-white">0</p>
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 mt-0.5">Leave Days</p>
                                    </div>
                                    <div className="bg-neutral-50 dark:bg-white/5 rounded-lg p-3 text-center">
                                        <p className="text-xl font-black text-neutral-900 dark:text-white">0</p>
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 mt-0.5">Projects</p>
                                    </div>
                                    <div className="bg-neutral-50 dark:bg-white/5 rounded-lg p-3 text-center">
                                        <p className="text-xl font-black text-neutral-900 dark:text-white">0</p>
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 mt-0.5">Tasks</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Directory View ────────────────────────────────────────────────
    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={hrTabs} groupId="hr" />
            <div className="w-full h-full p-6 pb-10 flex flex-col hide-scrollbar overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Employee Directory</h1>
                        <p className="text-neutral-500 font-medium text-sm mt-1">Manage personnel, roles, and internal billing rates.</p>
                    </div>
                    <button onClick={openAdd} className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:opacity-90 transition-colors" style={{ backgroundColor: "var(--brand-color, #d35400)" }}>
                        <Plus className="w-4 h-4" /> Add Employee
                    </button>
                </div>

                {/* Stats Overview */}
                {employees.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                        {[
                            { label: 'Total', value: employees.length, color: 'text-neutral-900 dark:text-white' },
                            { label: 'Active', value: employees.filter(e => e.status === 'ACTIVE').length, color: 'text-emerald-600' },
                            { label: 'On Leave', value: employees.filter(e => e.status === 'ON_LEAVE').length, color: 'text-amber-600' },
                            { label: 'Inactive', value: employees.filter(e => e.status === 'INACTIVE').length, color: 'text-neutral-400' },
                        ].map(s => (
                            <div key={s.label} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-center">
                                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mt-0.5">{s.label}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Search + Filters */}
                {employees.length > 0 && (
                    <div className="flex items-center gap-3 mb-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-medium text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30"
                            />
                        </div>
                        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-white/5 rounded-lg p-0.5">
                            {['ALL', 'ACTIVE', 'ON_LEAVE', 'INACTIVE'].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s)}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                        statusFilter === s
                                            ? 'bg-white dark:bg-neutral-800 shadow-sm text-neutral-900 dark:text-white'
                                            : 'text-neutral-500 hover:text-neutral-700'
                                    }`}
                                >
                                    {s === 'ON_LEAVE' ? 'Leave' : s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Employee Cards Grid */}
                <div className="bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                    {loading ? (
                        <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="p-12 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4"><Users className="w-8 h-8 text-neutral-400" /></div>
                            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">{search ? "No matches" : "No Employees Found"}</h3>
                            <p className="text-neutral-500 text-sm mt-2 max-w-sm">{search ? "Try a different search term." : "Get started by adding your first team member."}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0.5 p-0.5">
                            {filtered.map(emp => {
                                const statusCfg = getStatusConfig(emp.status);
                                const tenure = getTenure(emp.hireDate);

                                return (
                                    <div
                                        key={emp.id}
                                        onClick={() => setSelectedEmployee(emp)}
                                        className="group bg-white dark:bg-neutral-900 rounded-xl p-4 cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all duration-200 border border-transparent hover:border-neutral-200 dark:hover:border-white/10"
                                    >
                                        {/* Top: Avatar + Status */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getGradient(emp.id)} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                                                {getInitials(emp.firstName, emp.lastName)}
                                            </div>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                                                {emp.status === 'ON_LEAVE' ? 'Leave' : emp.status.charAt(0) + emp.status.slice(1).toLowerCase()}
                                            </span>
                                        </div>

                                        {/* Name & Role */}
                                        <h3 className="text-sm font-bold text-neutral-900 dark:text-white truncate">{emp.firstName} {emp.lastName}</h3>
                                        <p className="text-xs text-neutral-500 font-medium mt-0.5 flex items-center gap-1.5">
                                            <Briefcase className="w-3 h-3" /> {getRoleLabel(emp.role)}
                                        </p>

                                        {/* Meta */}
                                        <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-white/5 space-y-1.5">
                                            <p className="text-[11px] text-neutral-400 flex items-center gap-1.5 truncate">
                                                <Mail className="w-3 h-3 flex-shrink-0" /> {emp.email}
                                            </p>
                                            {emp.hourlyCost != null && (
                                                <p className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                                                    <Euro className="w-3 h-3 flex-shrink-0" /> €{emp.hourlyCost.toFixed(2)}/h
                                                </p>
                                            )}
                                            {tenure && (
                                                <p className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                                                    <Clock className="w-3 h-3 flex-shrink-0" /> {tenure}
                                                </p>
                                            )}
                                        </div>

                                        {/* Hover action hint */}
                                        <div className="mt-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">View Profile</span>
                                            <ChevronRight className="w-3.5 h-3.5 text-neutral-300" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Add/Edit Dialog ────────────────────────────────────── */}
            {showDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)} />
                    <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto border border-neutral-200 dark:border-white/10">
                        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-white/10">
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">{editing ? "Edit Employee" : "Add Employee"}</h2>
                            <button onClick={() => setShowDialog(false)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10"><X className="w-5 h-5 text-neutral-500" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            {error && <p className="text-red-600 text-sm font-medium bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

                            {/* Personal Info Section */}
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-3">Personal Information</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="First Name *" value={form.firstName} onChange={v => setForm(f => ({ ...f, firstName: v }))} />
                                    <Field label="Last Name *" value={form.lastName} onChange={v => setForm(f => ({ ...f, lastName: v }))} />
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <Field label="Email *" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} />
                                    <Field label="Phone" type="tel" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
                                </div>
                            </div>

                            {/* Employment Section */}
                            <div className="pt-4 border-t border-neutral-200 dark:border-white/10">
                                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-3">Employment</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 block">Role *</label>
                                        <SearchableSelect
                                            options={ROLE_OPTIONS.map(r => ({ value: r.value, label: r.label }))}
                                            value={form.role}
                                            onChange={v => setForm(f => ({ ...f, role: v }))}
                                            placeholder="Select role..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 block">Status</label>
                                        <SearchableSelect
                                            options={[
                                                { value: 'ACTIVE', label: 'Active' },
                                                { value: 'INACTIVE', label: 'Inactive' },
                                                { value: 'ON_LEAVE', label: 'On Leave' },
                                            ]}
                                            value={form.status}
                                            onChange={v => setForm(f => ({ ...f, status: v }))}
                                            placeholder="Select status..."
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <Field label="Hourly Cost (€)" type="number" value={form.hourlyCost} onChange={v => setForm(f => ({ ...f, hourlyCost: v }))} placeholder="0.00" />
                                    <div>
                                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 block">Hire Date</label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <button
                                                    type="button"
                                                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-medium outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30 text-left ${
                                                        form.hireDate ? 'text-neutral-900 dark:text-white' : 'text-neutral-400'
                                                    }`}
                                                >
                                                    <CalendarIcon className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    {form.hireDate ? format(new Date(form.hireDate), 'dd/MM/yyyy') : 'Select date...'}
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-xl" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={form.hireDate ? new Date(form.hireDate) : undefined}
                                                    onSelect={(date) => setForm(f => ({ ...f, hireDate: date ? format(date, 'yyyy-MM-dd') : '' }))}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 block">Department</label>
                                        <SearchableSelect
                                            options={DEPARTMENTS.map(d => ({ value: d, label: d }))}
                                            value={form.department}
                                            onChange={v => setForm(f => ({ ...f, department: v }))}
                                            placeholder="Select department..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 block">Employment Type</label>
                                        <SearchableSelect
                                            options={EMPLOYMENT_TYPES.map(t => ({ value: t, label: t }))}
                                            value={form.employmentType}
                                            onChange={v => setForm(f => ({ ...f, employmentType: v }))}
                                            placeholder="Select type..."
                                        />
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <Field label="Address" value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} placeholder="Street, City, ZIP" />
                                </div>
                            </div>



                            {/* Notes */}
                            <div className="pt-4 border-t border-neutral-200 dark:border-white/10">
                                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 block">Notes</label>
                                <textarea
                                    value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    rows={3} placeholder="Additional notes..."
                                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-medium text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30 resize-none"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 dark:border-white/10">
                            <button onClick={() => setShowDialog(false)} className="px-4 py-2.5 rounded-xl text-sm font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors">Cancel</button>
                            <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm hover:opacity-90 transition-colors disabled:opacity-50"
                                style={{ backgroundColor: "var(--brand-color, #d35400)" }}
                            >
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {editing ? "Save Changes" : "Add Employee"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Shared Sub-Components ────────────────────────────────────────────

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-neutral-400">{icon}</span>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{label}</p>
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate">{value}</p>
            </div>
        </div>
    );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
    return (
        <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 block">{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-medium text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30"
            />
        </div>
    );
}
