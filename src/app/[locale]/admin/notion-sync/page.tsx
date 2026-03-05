"use client";

import { useState, useEffect } from 'react';
import { Database, Plus, RefreshCw, Trash2, Table, Key, Link2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function NotionSyncDashboard() {
    const [connections, setConnections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [syncing, setSyncing] = useState<string | null>(null);
    const [newConn, setNewConn] = useState({ name: '', databaseId: '', token: '' });
    const [selectedConn, setSelectedConn] = useState<any>(null);
    const [entries, setEntries] = useState<any[]>([]);

    useEffect(() => {
        fetchConnections();
    }, []);

    const fetchConnections = async () => {
        const res = await fetch('/api/notion/connections');
        const data = await res.json();
        setConnections(data);
        setLoading(false);
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await fetch('/api/notion/connections', {
            method: 'POST',
            body: JSON.stringify(newConn)
        });
        if (res.ok) {
            fetchConnections();
            setIsAdding(false);
            setNewConn({ name: '', databaseId: '', token: '' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to remove this connection? All synced data for this DB will be deleted.')) return;
        const res = await fetch('/api/notion/connections', {
            method: 'DELETE',
            body: JSON.stringify({ id })
        });
        if (res.ok) fetchConnections();
    };

    const handleSync = async (id: string) => {
        setSyncing(id);
        const res = await fetch('/api/notion/sync/dynamic', {
            method: 'POST',
            body: JSON.stringify({ connectionId: id })
        });
        setSyncing(null);
        if (res.ok) fetchConnections();
    };

    const viewData = async (conn: any) => {
        setSelectedConn(conn);
        // We'll fetch entries for this connection
        const res = await fetch(`/api/notion/entries?connectionId=${conn.id}`);
        const data = await res.json();
        setEntries(data);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter uppercase text-neutral-900 dark:text-white">Notion Database Sync</h1>
                    <p className="text-neutral-500 font-medium mt-1">Connect any Notion database and keep properties in sync.</p>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="bg-[#d35400] text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-neutral-900 transition-all flex items-center gap-2 shadow-xl shadow-[#d35400]/20"
                    >
                        <Plus className="w-4 h-4" /> Connect Database
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Connections List */}
                <div className="lg:col-span-1 space-y-4">
                    {isAdding && (
                        <div className="glass-morphism p-6 rounded-[2.5rem] border border-[#d35400]/20 animate-in zoom-in-95 duration-200">
                            <h3 className="text-xs font-black uppercase tracking-widest text-[#d35400] mb-6">New Connection</h3>
                            <form onSubmit={handleAdd} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">Friendly Name</label>
                                    <input
                                        required
                                        value={newConn.name}
                                        onChange={e => setNewConn({ ...newConn, name: e.target.value })}
                                        placeholder="e.g. Sales Leads"
                                        className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d35400] outline-none transition-colors"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">Database ID</label>
                                    <input
                                        required
                                        value={newConn.databaseId}
                                        onChange={e => setNewConn({ ...newConn, databaseId: e.target.value })}
                                        placeholder="Notion DB ID..."
                                        className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d35400] outline-none transition-colors"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">Custom Token (Optional)</label>
                                    <input
                                        type="password"
                                        value={newConn.token}
                                        onChange={e => setNewConn({ ...newConn, token: e.target.value })}
                                        placeholder="Keep empty to use global..."
                                        className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d35400] outline-none transition-colors"
                                    />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button type="submit" className="flex-1 bg-[#d35400] text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-[#d35400]/20">Save Link</button>
                                    <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-3 bg-neutral-100 dark:bg-white/5 text-neutral-500 rounded-xl font-bold uppercase text-[10px] tracking-widest">Cancel</button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="space-y-3">
                        {connections.map(conn => (
                            <div
                                key={conn.id}
                                onClick={() => viewData(conn)}
                                className={`p-6 rounded-[2rem] border transition-all cursor-pointer group ${selectedConn?.id === conn.id ? 'bg-[#d35400]/5 border-[#d35400]/30 shadow-lg shadow-[#d35400]/5' : 'bg-white dark:bg-white/5 border-neutral-200 dark:border-white/5 hover:border-[#d35400]/20'}`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 rounded-2xl bg-neutral-100 dark:bg-black/40 flex items-center justify-center group-hover:bg-[#d35400]/10 transition-colors">
                                        <Database className={`w-5 h-5 ${selectedConn?.id === conn.id ? 'text-[#d35400]' : 'text-neutral-400'}`} />
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleSync(conn.id); }}
                                            disabled={syncing === conn.id}
                                            className="p-2 hover:bg-[#d35400]/10 rounded-xl text-neutral-400 hover:text-[#d35400] transition-colors"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${syncing === conn.id ? 'animate-spin' : ''}`} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(conn.id); }}
                                            className="p-2 hover:bg-red-500/10 rounded-xl text-neutral-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <h4 className="font-black text-sm uppercase tracking-tight text-neutral-900 dark:text-white">{conn.name}</h4>
                                <div className="mt-3 flex flex-wrap gap-3">
                                    <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest bg-neutral-100 dark:bg-black/40 px-2 py-1 rounded-lg flex items-center gap-1.2">
                                        <Table className="w-3 h-3" /> {conn._count.entries} Rows
                                    </span>
                                    {conn.lastSynced && (
                                        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
                                            Last sync: {new Date(conn.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Data View */}
                <div className="lg:col-span-2">
                    {selectedConn ? (
                        <div className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-[2.5rem] overflow-hidden shadow-sm flex flex-col h-[700px]">
                            <div className="p-8 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-black/20 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight text-neutral-900 dark:text-white flex items-center gap-3">
                                        {selectedConn.name}
                                        <span className="text-[10px] text-neutral-400 font-bold bg-neutral-100 dark:bg-white/5 px-2 py-1 rounded-lg">JSON VIEW</span>
                                    </h3>
                                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1 flex items-center gap-2">
                                        <Link2 className="w-3 h-3" /> {selectedConn.databaseId}
                                    </p>
                                </div>
                                <button className="p-3 bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 rounded-2xl text-neutral-600 dark:text-white transition-all">
                                    <Table className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                                {entries.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-neutral-400 space-y-4">
                                        <RefreshCw className="w-12 h-12 opacity-10" />
                                        <p className="text-sm italic">No data synced yet. Tap sync to import.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {entries.map(entry => (
                                            <div key={entry.id} className="p-6 bg-neutral-50 dark:bg-black/40 rounded-3xl border border-neutral-100 dark:border-white/5 overflow-hidden group">
                                                <div className="flex justify-between items-start mb-4">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-[#d35400] bg-[#d35400]/5 px-2 py-1 rounded-lg">Page ID: {entry.notionId.substring(0, 8)}...</span>
                                                    <span className="text-[9px] font-bold text-neutral-400 uppercase">Updated {new Date(entry.updatedAt).toLocaleDateString()}</span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                    {Object.entries(entry.data).map(([key, val]: [string, any]) => (
                                                        <div key={key} className="space-y-1 relative group/item">
                                                            <label className="text-[8px] font-black text-neutral-400 uppercase tracking-[0.2em]">{key}</label>
                                                            <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                                                                <span className="truncate">{Array.isArray(val) ? val.join(', ') : String(val)}</span>
                                                                <button
                                                                    onClick={async () => {
                                                                        const newVal = prompt(`Edit ${key}:`, Array.isArray(val) ? val.join(',') : String(val));
                                                                        if (newVal === null || newVal === String(val)) return;

                                                                        const updatedData = { [key]: newVal };
                                                                        const res = await fetch('/api/notion/entries/update', {
                                                                            method: 'PATCH',
                                                                            body: JSON.stringify({ entryId: entry.id, data: updatedData })
                                                                        });
                                                                        if (res.ok) viewData(selectedConn);
                                                                    }}
                                                                    className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-neutral-200 dark:hover:bg-white/10 rounded-md transition-all text-[#d35400]"
                                                                >
                                                                    <RefreshCw className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-[700px] flex flex-col items-center justify-center text-neutral-300 dark:text-neutral-700 bg-neutral-50/50 dark:bg-black/10 rounded-[2.5rem] border border-dashed border-neutral-200 dark:border-neutral-800">
                            <Database className="w-16 h-16 mb-4 opacity-50" />
                            <h3 className="text-lg font-black uppercase tracking-widest">Select a connection</h3>
                            <p className="text-sm font-medium mt-2">Manage settings or view synced data here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
