"use client";

import React from 'react';
import { useDatabaseStore } from '../store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

export default function PageFinancialAnalysis({ databaseId, pageId }: { databaseId: string, pageId: string }) {
    const page = useDatabaseStore(state => state.databases.find(db => db.id === databaseId)?.pages.find(p => p.id === pageId));

    if (!page) return null;

    const budget = Number(page.properties['prop-budget']) || 0;
    const costs = Number(page.properties['prop-actual-costs']) || 0;

    // If there is absolutely no financial data configured yet, hide the chart zone completely
    if (budget === 0 && costs === 0) return null;

    const remaining = Math.max(0, budget - costs);
    const deficit = Math.max(0, costs - budget);

    const data = [
        {
            name: 'Project Financials',
            Budget: budget,
            Costs: costs,
            Margin: remaining,
            Deficit: deficit
        }
    ];

    return (
        <div className="mt-8 mb-8 pb-8 border-b border-neutral-100 dark:border-white/5">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Financial Analysis
            </h2>
            <div className="h-[250px] w-full bg-neutral-50 dark:bg-black/20 rounded-2xl border border-neutral-200 dark:border-white/10 p-4">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" hide />
                        <YAxis
                            tickFormatter={(value) => `€${value.toLocaleString()}`}
                            width={80}
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            formatter={(value: any) => [`€${Number(value).toLocaleString()}`, undefined]}
                            contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.8)', color: 'white', fontWeight: 'bold' }}
                            cursor={{ fill: 'transparent' }}
                        />
                        <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                        <Bar dataKey="Budget" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Costs" fill="#eab308" radius={[4, 4, 0, 0]} />
                        {deficit > 0 && <Bar dataKey="Deficit" fill="#ef4444" radius={[4, 4, 0, 0]} />}
                        {deficit === 0 && <Bar dataKey="Margin" fill="#22c55e" radius={[4, 4, 0, 0]} />}
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Total Budget</p>
                    <p className="text-xl font-black text-blue-700 dark:text-blue-300 mt-0.5">€{budget.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-600 dark:text-yellow-400">Realized Costs</p>
                    <p className="text-xl font-black text-yellow-700 dark:text-yellow-300 mt-0.5">€{costs.toLocaleString()}</p>
                </div>
                <div className={`p-4 rounded-2xl border ${deficit > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${deficit > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>Status</p>
                    <p className={`text-xl font-black mt-0.5 ${deficit > 0 ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                        {deficit > 0 ? `Over Budget` : `Healthy Edge`}
                    </p>
                </div>
                <div className="p-4 bg-neutral-100 dark:bg-white/5 rounded-2xl border border-neutral-200 dark:border-white/10">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Remaining Margin</p>
                    <p className={`text-xl font-black mt-0.5 ${deficit > 0 ? 'text-red-500' : 'text-neutral-900 dark:text-white'}`}>
                        {deficit > 0 ? `-€${deficit.toLocaleString()}` : `€${remaining.toLocaleString()}`}
                    </p>
                </div>
            </div>
        </div>
    );
}
