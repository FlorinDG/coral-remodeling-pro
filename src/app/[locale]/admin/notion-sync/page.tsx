"use client";

import { useState, useEffect } from 'react';
import { Database, Plus, RefreshCw, Trash2, Table, Key, Link2, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function NotionSyncDashboard() {
    const [connections, setConnections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [syncing, setSyncing] = useState<string | null>(null);
    const [syncingAll, setSyncingAll] = useState(false);
    const [newConn, setNewConn] = useState({ name: '', databaseId: '', token: '' });
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [selectedConn, setSelectedConn] = useState<any>(null);
    const [entries, setEntries] = useState<any[]>([]);
    const [syncingEntryId, setSyncingEntryId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchConnections();
    }, []);

    const fetchConnections = async () => {
        try {
            const res = await fetch('/api/notion/connections');
            const data = await res.json();
            if (Array.isArray(data)) {
                setConnections(data);
            } else {
                console.error("Connections response is not an array:", data);
                setConnections([]);
            }
        } catch (error) {
            console.error("Failed to fetch connections:", error);
            setConnections([]);
        }
        setLoading(false);
    };

    const handleTest = async () => {
        if (!newConn.databaseId) {
            setTestResult({ success: false, message: "Database ID is required for testing." });
            return;
        }

        setIsTesting(true);
        setTestResult(null);
        try {
            const res = await fetch('/api/notion/connections/test', {
                method: 'POST',
                body: JSON.stringify({ databaseId: newConn.databaseId, token: newConn.token })
            });
            const data = await res.json();
            if (res.ok) {
                setTestResult({ success: true, message: `Connected! Found: "${data.title}"` });
            } else {
                setTestResult({ success: false, message: data.error || "Connection failed." });
            }
        } catch (err) {
            setTestResult({ success: false, message: "Network error during test." });
        } finally {
            setIsTesting(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            const res = await fetch('/api/notion/connections', {
                method: 'POST',
                body: JSON.stringify(newConn)
            });
            if (res.ok) {
                fetchConnections();
                setIsAdding(false);
                setNewConn({ name: '', databaseId: '', token: '' });
                setTestResult(null);
            } else {
                const data = await res.json();
                setError(data.error || "Failed to add connection.");
            }
        } catch (err) {
            setError("Failed to add connection due to network error.");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to remove this connection? All synced data for this DB will be deleted.')) return;
        setError(null);
        try {
            const res = await fetch('/api/notion/connections', {
                method: 'DELETE',
                body: JSON.stringify({ id })
            });
            if (res.ok) fetchConnections();
            else setError("Failed to delete connection.");
        } catch (err) {
            setError("Network error deleting connection.");
        }
    };

    const handleSync = async (id: string) => {
        setSyncing(id);
        setError(null);
        try {
            const res = await fetch('/api/notion/sync/dynamic', {
                method: 'POST',
                body: JSON.stringify({ connectionId: id })
            });
            if (res.ok) {
                fetchConnections();
            } else {
                const data = await res.json();
                setError(`Sync failed: ${data.error || "Unknown error"}`);
            }
        } catch (err) {
            setError("Sync failed due to network error.");
        } finally {
            setSyncing(null);
        }
    };

    const handleSyncAll = async () => {
        setSyncingAll(true);
        setError(null);
        try {
            const res = await fetch('/api/notion/sync/all', { method: 'POST' });
            if (res.ok) {
                fetchConnections();
            } else {
                const data = await res.json();
                setError(`Global sync failed: ${data.error || "Unknown error"}`);
            }
        } catch (err) {
            setError("Global sync failed due to network error.");
        } finally {
            setSyncingAll(false);
        }
    };

    const viewData = async (conn: any) => {
        setSelectedConn(conn);
        setEntries([]); // Reset entries while loading
        try {
            // We'll fetch entries for this connection
            const res = await fetch(`/api/notion/entries?connectionId=${conn.id}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setEntries(data);
            } else {
                console.error("Entries response is not an array:", data);
                setEntries([]);
            }
        } catch (error) {
            console.error("Failed to fetch entries:", error);
            setEntries([]);
        }
    };

    const handleCreateRow = async () => {
        if (!selectedConn || entries.length === 0) {
            // If no entries, we can't easily guess schema, but we can try with a default 'Name'
            const name = prompt("Enter value for primary property (Name/Title):");
            if (!name) return;

            setSyncingAll(true);
            const res = await fetch('/api/notion/entries', {
                method: 'POST',
                body: JSON.stringify({
                    connectionId: selectedConn.id,
                    data: { 'Name': name } // Guessing 'Name' as default
                })
            });
            setSyncingAll(false);
            if (res.ok) viewData(selectedConn);
            return;
        }

        const firstKey = Object.keys(entries[0].data)[0];
        const val = prompt(`Enter value for ${firstKey}:`);
        if (!val) return;

        setSyncingAll(true);
        const res = await fetch('/api/notion/entries', {
            method: 'POST',
            body: JSON.stringify({
                connectionId: selectedConn.id,
                data: { [firstKey]: val }
            })
        });
        setSyncingAll(false);
        if (res.ok) viewData(selectedConn);
    };

    const handleDeleteRow = async (entryId: string) => {
        if (!confirm('Are you sure you want to delete this row? It will be archived in Notion.')) return;

        setSyncingEntryId(entryId);
        const res = await fetch('/api/notion/entries', {
            method: 'DELETE',
            body: JSON.stringify({ entryId })
        });
        setSyncingEntryId(null);
        if (res.ok) {
            setEntries(prev => prev.filter(e => e.id !== entryId));
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter uppercase text-neutral-900 dark:text-white">Notion Database Sync</h1>
                    <p className="text-neutral-500 font-medium mt-1">Connect any Notion database and keep properties in sync.</p>
                </div>
                <div className="flex gap-3 items-end">
                    <button
                        onClick={handleSyncAll}
                        disabled={syncingAll}
                        className="bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-neutral-200 transition-all flex items-center gap-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncingAll ? 'animate-spin' : ''}`} /> {syncingAll ? 'Syncing...' : 'Sync All'}
                    </button>
                    {!isAdding && (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="bg-[#d35400] text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-neutral-900 transition-all flex items-center gap-2 shadow-xl shadow-[#d35400]/20"
                        >
                            <Plus className="w-4 h-4" /> Connect Database
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Connections List */}
                <div className="lg:col-span-1 space-y-4">
                    {isAdding && (
                        <div className="glass-morphism p-6 rounded-[2.5rem] border border-[#d35400]/20 animate-in zoom-in-95 duration-200">
                            <h3 className="text-xs font-black uppercase tracking-widest text-[#d35400] mb-6">Connect Notion Database</h3>
                            <form onSubmit={handleAdd} className="space-y-4">
                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-[10px] font-bold uppercase tracking-widest">
                                        {error}
                                    </div>
                                )}
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
                                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">Notion Database ID</label>
                                    <input
                                        required
                                        value={newConn.databaseId}
                                        onChange={e => setNewConn({ ...newConn, databaseId: e.target.value })}
                                        placeholder="32-char ID from Notion URL..."
                                        className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d35400] outline-none transition-colors"
                                    />
                                    <p className="text-[9px] text-neutral-500 px-1">Found in the URL: notion.so/<strong>DATABASE_ID</strong>?v=...</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">Integration Secret (Token)</label>
                                    <input
                                        type="password"
                                        value={newConn.token}
                                        onChange={e => setNewConn({ ...newConn, token: e.target.value })}
                                        placeholder="secret_..."
                                        className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d35400] outline-none transition-colors"
                                    />
                                    <p className="text-[9px] text-neutral-500 px-1">From <a href="https://www.notion.so/my-integrations" target="_blank" className="text-[#d35400] underline">Notion Integrations</a>. ⚠️ Must share DB with this integration.</p>
                                </div>

                                {testResult && (
                                    <div className={`p-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border ${testResult.success ? 'bg-green-500/10 border-green-500/20 text-green-600' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                                        {testResult.message}
                                    </div>
                                )}

                                <div className="flex gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={handleTest}
                                        disabled={isTesting || !newConn.databaseId}
                                        className="flex-1 bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-neutral-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} /> {isTesting ? 'Testing...' : 'Test Connection'}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isTesting}
                                        className="flex-1 bg-[#d35400] text-white py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-[#d35400]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                                    >
                                        Save & Sync
                                    </button>
                                </div>
                                <button type="button" onClick={() => setIsAdding(false)} className="w-full py-2 text-neutral-400 font-bold uppercase text-[9px] tracking-[0.2em] hover:text-neutral-600 transition-colors mt-2">Dismiss</button>
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
                            <div className="p-8 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-black/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-neutral-100 dark:bg-white/5 rounded-2xl text-[#d35400]">
                                        <Database className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black uppercase tracking-tight text-neutral-900 dark:text-white flex items-center gap-3">
                                            {selectedConn.name}
                                        </h3>
                                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1 flex items-center gap-2">
                                            <Link2 className="w-3 h-3" /> {selectedConn.databaseId}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                                        <input
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="Search data..."
                                            className="bg-neutral-100 dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-xs outline-none focus:border-[#d35400] transition-colors w-40 md:w-60"
                                        />
                                        {searchTerm && (
                                            <button
                                                onClick={() => setSearchTerm('')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex bg-neutral-100 dark:bg-white/5 p-1 rounded-xl">
                                        <button
                                            onClick={handleCreateRow}
                                            className="p-2 rounded-lg transition-all text-neutral-400 hover:text-[#d35400] hover:bg-white dark:hover:bg-white/10 shadow-sm mr-1"
                                            title="Add New Row"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                        <div className="w-px h-4 bg-neutral-200 dark:bg-white/10 my-auto mx-1" />
                                        <button
                                            onClick={() => setViewMode('table')}
                                            className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white dark:bg-white/10 shadow-sm text-[#d35400]' : 'text-neutral-400 hover:text-neutral-600'}`}
                                        >
                                            <Table className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setViewMode('cards')}
                                            className={`p-2 rounded-lg transition-all ${viewMode === 'cards' ? 'bg-white dark:bg-white/10 shadow-sm text-[#d35400]' : 'text-neutral-400 hover:text-neutral-600'}`}
                                        >
                                            <Plus className="w-4 h-4 rotate-45" /> {/* Using Plus rotated for card view icon feel */}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                                {entries.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-neutral-400 space-y-4">
                                        <RefreshCw className="w-12 h-12 opacity-10" />
                                        <p className="text-sm italic">No data synced yet. Tap sync to import.</p>
                                    </div>
                                ) : (
                                    <>
                                        {viewMode === 'table' ? (
                                            <div className="rounded-2xl border border-neutral-100 dark:border-white/5 overflow-hidden">
                                                <table className="w-full text-left border-collapse">
                                                    <thead className="bg-neutral-50 dark:bg-white/5 border-b border-neutral-100 dark:border-white/5">
                                                        <tr>
                                                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-400">ID</th>
                                                            {/* Extract headers from first entry data */}
                                                            {Object.keys(entries[0].data || {}).map(key => (
                                                                <th key={key} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-400">{key}</th>
                                                            ))}
                                                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-400">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                                                        {entries.filter(e =>
                                                            JSON.stringify(e.data).toLowerCase().includes(searchTerm.toLowerCase())
                                                        ).map(entry => (
                                                            <tr key={entry.id} className="hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors group">
                                                                <td className="px-4 py-4 text-[10px] font-bold text-neutral-400 font-mono">{entry.notionId.substring(0, 8)}</td>
                                                                {Object.entries(entry.data).map(([key, val]: [string, any]) => (
                                                                    <td key={key} className="px-4 py-4 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                                                        <span className="line-clamp-1">{Array.isArray(val) ? val.join(', ') : String(val)}</span>
                                                                    </td>
                                                                ))}
                                                                <td className="px-4 py-4">
                                                                    <div className="flex gap-1">
                                                                        <button
                                                                            onClick={async () => {
                                                                                const firstKey = Object.keys(entry.data)[0];
                                                                                const newVal = prompt(`Edit ${firstKey}:`, entry.data[firstKey]);
                                                                                if (newVal === null || newVal === entry.data[firstKey]) return;

                                                                                setSyncingEntryId(entry.id);
                                                                                const res = await fetch('/api/notion/entries/update', {
                                                                                    method: 'PATCH',
                                                                                    body: JSON.stringify({ entryId: entry.id, data: { [firstKey]: newVal } })
                                                                                });
                                                                                setSyncingEntryId(null);
                                                                                if (res.ok) viewData(selectedConn);
                                                                            }}
                                                                            disabled={syncingEntryId === entry.id}
                                                                            className="p-2 hover:bg-[#d35400]/10 rounded-lg text-neutral-400 hover:text-[#d35400] transition-colors disabled:opacity-50"
                                                                            title="Edit first property"
                                                                        >
                                                                            <RefreshCw className={`w-3.5 h-3.5 ${syncingEntryId === entry.id ? 'animate-spin' : ''}`} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteRow(entry.id)}
                                                                            disabled={syncingEntryId === entry.id}
                                                                            className="p-2 hover:bg-red-500/10 rounded-lg text-neutral-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                                                            title="Delete row"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {entries.filter(e =>
                                                    JSON.stringify(e.data).toLowerCase().includes(searchTerm.toLowerCase())
                                                ).map(entry => (
                                                    <div key={entry.id} className="p-6 bg-neutral-50 dark:bg-black/40 rounded-3xl border border-neutral-100 dark:border-white/5 overflow-hidden group">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-[#d35400] bg-[#d35400]/5 px-2 py-1 rounded-lg">Page ID: {entry.notionId.substring(0, 8)}...</span>
                                                            <span className="text-[9px] font-bold text-neutral-400 uppercase">Updated {new Date(entry.updatedAt).toLocaleDateString()}</span>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                            {Object.entries(entry.data).map(([key, val]: [string, any]) => (
                                                                <div key={key} className="space-y-1 relative group/item">
                                                                    <div className="flex justify-between items-end">
                                                                        <label className="text-[8px] font-black text-neutral-400 uppercase tracking-[0.2em]">{key}</label>
                                                                        <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                                            <button
                                                                                onClick={async () => {
                                                                                    const newVal = prompt(`Edit ${key}:`, Array.isArray(val) ? val.join(',') : String(val));
                                                                                    if (newVal === null || newVal === String(val)) return;

                                                                                    setSyncingEntryId(entry.id);
                                                                                    const res = await fetch('/api/notion/entries/update', {
                                                                                        method: 'PATCH',
                                                                                        body: JSON.stringify({ entryId: entry.id, data: { [key]: newVal } })
                                                                                    });
                                                                                    setSyncingEntryId(null);
                                                                                    if (res.ok) viewData(selectedConn);
                                                                                }}
                                                                                className="p-1 hover:bg-[#d35400]/10 rounded text-[#d35400]"
                                                                            >
                                                                                <RefreshCw className="w-2.5 h-2.5" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                                                                        {Array.isArray(val) ? val.join(', ') : String(val)}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="mt-6 flex justify-end">
                                                            <button
                                                                onClick={() => handleDeleteRow(entry.id)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/5 hover:bg-red-500/10 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors opacity-0 group-hover:opacity-100"
                                                            >
                                                                <Trash2 className="w-3 h-3" /> Delete Row
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
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
        </div >
    );
}
