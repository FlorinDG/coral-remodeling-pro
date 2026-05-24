"use client";

import React from 'react';
import { useDatabaseStore } from '../store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

export default function PageFinancialAnalysis({ databaseId, pageId, costs: passedCosts, quotationTotal, invoicedTotal }: { databaseId: string, pageId: string, costs?: number, quotationTotal?: number, invoicedTotal?: number }) {
    const page = useDatabaseStore(state => state.databases.find(db => db.id === databaseId)?.pages.find(p => p.id === pageId));

    if (!page) return null;

    const budget = Number(page.properties?.['prop-budget']) || 0;
    const costs = passedCosts !== undefined ? passedCosts : (Number(page.properties?.['prop-actual-costs']) || Number(page.properties?.['prop-actual-cost']) || 0);
    const quoted = quotationTotal || 0;
    const invoiced = invoicedTotal || 0;

    // Use effective budget: budget or quotation total
    const effectiveBudget = budget > 0 ? budget : quoted;

    // If there is absolutely no financial data configured yet, hide the chart zone completely
    if (effectiveBudget === 0 && costs === 0 && quoted === 0) return null;

    const remaining = Math.max(0, effectiveBudget - costs);
    const deficit = Math.max(0, costs - effectiveBudget);

    const data = [
        {
            name: 'Project Financials',
            Budget: effectiveBudget,
            ...(quoted > 0 && quoted !== effectiveBudget ? { Quoted: quoted } : {}),
            Costs: costs,
            ...(invoiced > 0 ? { Invoiced: invoiced } : {}),
            ...(deficit > 0 ? { Deficit: deficit } : { Margin: remaining }),
        }
    ];

    return (
        <div className="mt-8 mb-8 pb-8 border-b border-neutral-100 dark:border-white/5">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Financial Analysis
            </h2>
            <div className="h-[250px] w-full bg-neutral-50 dark:bg-black/20 rounded-2xl border border-neutral-200 dark:border-white/10 p-4">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
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
                        {quoted > 0 && quoted !== effectiveBudget && <Bar dataKey="Quoted" fill="#8b5cf6" radius={[4, 4, 0, 0]} />}
                        <Bar dataKey="Costs" fill="#eab308" radius={[4, 4, 0, 0]} />
                        {invoiced > 0 && <Bar dataKey="Invoiced" fill="#10b981" radius={[4, 4, 0, 0]} />}
                        {deficit > 0 && <Bar dataKey="Deficit" fill="#ef4444" radius={[4, 4, 0, 0]} />}
                        {deficit === 0 && <Bar dataKey="Margin" fill="#22c55e" radius={[4, 4, 0, 0]} />}
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="p-4 bg-orange-500/10 rounded-2xl border border-orange-500/20">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">Total Budget</p>
                    <p className="text-xl font-black text-orange-700 dark:text-orange-300 mt-0.5">€{effectiveBudget.toLocaleString()}</p>
                </div>
                {quoted > 0 && (
                    <div className="p-4 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Quoted</p>
                        <p className="text-xl font-black text-purple-700 dark:text-purple-300 mt-0.5">€{quoted.toLocaleString()}</p>
                    </div>
                )}
                {invoiced > 0 && (
                    <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Invoiced</p>
                        <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">€{invoiced.toLocaleString()}</p>
                    </div>
                )}
                <div className="p-4 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-600 dark:text-yellow-400">Realized Costs</p>
                    <p className="text-xl font-black text-yellow-700 dark:text-yellow-300 mt-0.5">€{costs.toLocaleString()}</p>
                </div>
                <div className={`p-4 rounded-2xl border ${deficit > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${deficit > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>Projected Margin</p>
                    <p className={`text-xl font-black mt-0.5 ${deficit > 0 ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                        {deficit > 0 ? `-€${deficit.toLocaleString()}` : `€${remaining.toLocaleString()}`}
                    </p>
                </div>
            </div>
        </div>
    );
}
