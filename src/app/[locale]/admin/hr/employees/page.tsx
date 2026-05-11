"use client";

import { useState, useEffect, useCallback } from "react";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { hrTabs } from "@/config/tabs";
import { Users, Plus, Mail, Phone, Briefcase, X, Loader2, Pencil, Trash2, Search, Euro } from "lucide-react";

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

const ROLES = ["Foreman", "Carpenter", "Electrician", "Plumber", "Painter", "Laborer", "Project Manager", "Architect", "Admin", "Other"];

const emptyForm = { firstName: "", lastName: "", email: "", phone: "", role: "Laborer", status: "ACTIVE", hourlyCost: "", hireDate: "" };

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
        setForm({
            firstName: emp.firstName, lastName: emp.lastName, email: emp.email,
            phone: emp.phone || "", role: emp.role, status: emp.status,
            hourlyCost: emp.hourlyCost?.toString() || "", hireDate: emp.hireDate?.split("T")[0] || "",
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
            setShowDialog(false);
            fetchEmployees();
        } catch { setError("Network error"); } finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this employee? This action cannot be undone.")) return;
        setDeleting(id);
        try {
            await fetch(`/api/tenant/employees/${id}`, { method: "DELETE" });
            fetchEmployees();
        } catch { /* empty */ } finally { setDeleting(null); }
    };

    const filtered = employees.filter(e =>
        `${e.firstName} ${e.lastName} ${e.email} ${e.role}`.toLowerCase().includes(search.toLowerCase())
    );

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

                {/* Search */}
                {employees.length > 0 && (
                    <div className="relative mb-4 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-medium text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30" />
                    </div>
                )}

                {/* Table / Empty */}
                <div className="bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                    {loading ? (
                        <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="p-12 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4"><Users className="w-8 h-8 text-neutral-400" /></div>
                            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">{search ? "No matches" : "No Employees Found"}</h3>
                            <p className="text-neutral-500 text-sm mt-2 max-w-sm">{search ? "Try a different search term." : "Get started by adding your first team member to enable workforce scheduling and time tracking."}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[900px]">
                                <thead>
                                    <tr className="border-b border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.02]">
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Employee</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Contact</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Role</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Hourly Rate</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(emp => (
                                        <tr key={emp.id} className="border-b border-neutral-100 dark:border-white/5 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold text-xs uppercase">{emp.firstName[0]}{emp.lastName[0]}</div>
                                                    <div>
                                                        <span className="font-medium text-sm text-neutral-900 dark:text-white">{emp.firstName} {emp.lastName}</span>
                                                        {emp.hireDate && <p className="text-[11px] text-neutral-400 mt-0.5">Since {new Date(emp.hireDate).toLocaleDateString()}</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 space-y-1">
                                                <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium"><Mail className="w-3 h-3" /> {emp.email}</div>
                                                {emp.phone && <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium"><Phone className="w-3 h-3" /> {emp.phone}</div>}
                                            </td>
                                            <td className="px-6 py-4"><div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 font-medium"><Briefcase className="w-4 h-4 text-neutral-400" />{emp.role}</div></td>
                                            <td className="px-6 py-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">{emp.hourlyCost != null ? `€${emp.hourlyCost.toFixed(2)}/h` : "—"}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${emp.status === "ACTIVE" ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700"}`}>{emp.status}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => openEdit(emp)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors" title="Edit"><Pencil className="w-4 h-4 text-neutral-500" /></button>
                                                    <button onClick={() => handleDelete(emp.id)} disabled={deleting === emp.id} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title="Delete">
                                                        {deleting === emp.id ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <Trash2 className="w-4 h-4 text-red-500" />}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="First Name *" value={form.firstName} onChange={v => setForm(f => ({ ...f, firstName: v }))} />
                                <Field label="Last Name *" value={form.lastName} onChange={v => setForm(f => ({ ...f, lastName: v }))} />
                            </div>
                            <Field label="Email *" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} />
                            <Field label="Phone" type="tel" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 block">Role *</label>
                                    <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-medium text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30">
                                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 block">Status</label>
                                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-medium text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30">
                                        <option value="ACTIVE">Active</option>
                                        <option value="INACTIVE">Inactive</option>
                                        <option value="ON_LEAVE">On Leave</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Hourly Cost (€)" type="number" value={form.hourlyCost} onChange={v => setForm(f => ({ ...f, hourlyCost: v }))} placeholder="0.00" />
                                <Field label="Hire Date" type="date" value={form.hireDate} onChange={v => setForm(f => ({ ...f, hireDate: v }))} />
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 dark:border-white/10">
                            <button onClick={() => setShowDialog(false)} className="px-4 py-2.5 rounded-xl text-sm font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm hover:opacity-90 transition-colors disabled:opacity-50" style={{ backgroundColor: "var(--brand-color, #d35400)" }}>
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

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
    return (
        <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 block">{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-medium text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30" />
        </div>
    );
}
