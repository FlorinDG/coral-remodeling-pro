"use client";

import React from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Legend
} from 'recharts';

interface ChartProps {
    data: Record<string, string | number>[];
}

export function OverviewAreaChart({ data }: ChartProps) {
    if (!data || data.length === 0) return null;

    return (
        <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={data}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id="colorInvoiced" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-neutral-200, #e5e5e5)" />
                    <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#888888' }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#888888' }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            borderRadius: '12px',
                            border: '1px solid #e5e5e5',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            fontSize: '12px',
                        }}
                        itemStyle={{ color: '#171717', fontWeight: 'bold' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    <Area
                        type="monotone"
                        dataKey="invoiced"
                        name="Amount Invoiced (€)"
                        stroke="#22c55e"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorInvoiced)"
                        activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                    <Area
                        type="monotone"
                        dataKey="expenditures"
                        name="Expenditures (€)"
                        stroke="#ef4444"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorExp)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export function StatusBarChart({ data }: ChartProps) {
    if (!data || data.length === 0) return null;

    return (
        <div className="h-[250px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-neutral-200, #e5e5e5)" />
                    <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#888888' }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#888888' }}
                    />
                    <Tooltip
                        cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                        contentStyle={{
                            borderRadius: '12px',
                            border: '1px solid #e5e5e5',
                            fontSize: '12px',
                        }}
                    />
                    <Bar dataKey="value" name="Amount" fill="var(--brand-color, #d35400)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
