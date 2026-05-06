"use client";

import React, { useState, useEffect } from 'react';
import { useDatabaseStore } from '@/components/admin/database/store';
import { useRouter } from 'next/navigation';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useTenant } from '@/context/TenantContext';

const COLOR_MAP: Record<string, string> = {
    gray: 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-green-500/10 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400',
    orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    pink: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
};

const HEX_MAP: Record<string, string> = {
    gray: '#9ca3af',
    blue: '#3b82f6',
    green: '#22c55e',
    yellow: '#eab308',
    red: '#ef4444',
    orange: '#f97316',
    pink: '#ec4899',
    purple: '#a855f7'
};

export default function DashboardProjectsTable() {
    const router = useRouter();
    const { resolveDbId } = useTenant();
    const db = useDatabaseStore(state => state.getDatabase(resolveDbId('db-1')));
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted || !db) return <div className="p-8 text-neutral-500 text-sm animate-pulse">Establishing Project Synchronization...</div>;

    const executionStatusOptions = db.properties.find(p => p.id === 'prop-execution-status')?.config?.options || [];
    const financialStatusOptions = db.properties.find(p => p.id === 'prop-financial-status')?.config?.options || [];

    // Aggregation Data build for Recharts
    const executionStats = executionStatusOptions.map(opt => ({
        name: opt.name,
        value: db.pages.filter(p => p.properties['prop-execution-status'] === opt.id).length,
        color: HEX_MAP[opt.color] || '#9ca3af'
    })).filter(stat => stat.value > 0);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-white/5 shadow-sm overflow-hidden flex flex-col h-[400px]">
                <div className="px-6 py-4 border-b border-neutral-200 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.01]">
                    <h3 className="text-sm font-bold tracking-tight">Active Projects Pipeline</h3>
                    <p className="text-[10px] uppercase tracking-widest text-[var(--brand-color,#d35400)] font-bold mt-0.5">Live Database View</p>
                </div>
                <div className="flex-1 overflow-auto no-scrollbar">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-neutral-50 dark:bg-white/[0.02] text-neutral-500 sticky top-0 z-10 backdrop-blur-md">
                            <tr>
                                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Project Name</th>
                                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Execution Phase</th>
                                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Financials</th>
                                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px] text-right">Budget</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 dark:border-t dark:divide-white/5">
                            {db.pages.map(page => {
                                const execOpt = executionStatusOptions.find(o => o.id === page.properties['prop-execution-status']);
                                const finOpt = financialStatusOptions.find(o => o.id === page.properties['prop-financial-status']);
                                const budget = page.properties['prop-budget'] as number | undefined;

                                return (
                                    <tr
                                        key={page.id}
                                        onClick={() => router.push(`/admin/projects-management?projectId=${page.id}`)}
                                        className="hover:bg-neutral-50/80 dark:hover:bg-white/[0.03] cursor-pointer transition-colors"
                                    >
                                        <td className="px-6 py-4 font-bold text-neutral-900 dark:text-neutral-100">{String(page.properties['title'] || 'Untitled')}</td>
                                        <td className="px-6 py-4">
                                            {execOpt ? (
                                                <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${COLOR_MAP[execOpt.color] || COLOR_MAP.gray}`}>
                                                    {execOpt.name}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {finOpt ? (
                                                <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${COLOR_MAP[finOpt.color] || COLOR_MAP.gray}`}>
                                                    {finOpt.name}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-neutral-500 font-medium text-right">
                                            {budget ? `€${budget.toLocaleString()}` : 'No Budget'}
                                        </td>
                                    </tr>
                                )
                            })}
                            {db.pages.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-neutral-400 italic">No active projects found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-white/5 shadow-sm p-6 flex flex-col h-[400px]">
                <div className="mb-2">
                    <h3 className="text-sm font-bold tracking-tight">Execution Dynamics</h3>
                    <p className="text-[10px] uppercase tracking-widest text-[var(--brand-color,#d35400)] font-bold mt-0.5">Aggregate Breakdown</p>
                </div>
                <div className="flex-1 w-full min-h-0 relative -ml-4">
                    {executionStats.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <PieChart>
                                <Pie
                                    data={executionStats}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={95}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {executionStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.8)', color: 'white', fontWeight: 'bold' }}
                                    itemStyle={{ color: 'white' }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400">
                            <PieChart className="w-8 h-8 opacity-20 mb-2" />
                            <span className="text-xs font-medium">Insufficient Data</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
