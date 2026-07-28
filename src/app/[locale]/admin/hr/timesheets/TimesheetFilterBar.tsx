"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns';
import { hrFetch } from '@/components/time-tracker/lib/hr-api';
import { useTranslations } from 'next-intl';

export function TimesheetFilterBar() {
    const t = useTranslations('Hr.timesheets');
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
    const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        hrFetch('employees').then((res: any[]) => {
            const mapped = res.map(r => ({ id: r.userId || r.id, name: `${r.firstName} ${r.lastName}`.trim() }));
            setWorkers(mapped);
        }).catch(console.error);

        hrFetch('erp-projects').then((res: any[]) => {
            const mapped = res.map(r => ({ id: r.id, name: r.name }));
            setProjects(mapped);
        }).catch(console.error);
    }, []);

    const updateFilter = (key: string, value: string | null) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) params.set(key, value);
        else params.delete(key);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const handlePeriodChange = (val: string) => {
        const now = new Date();
        const params = new URLSearchParams(searchParams.toString());
        if (val === 'thisWeek') {
            params.set('from', formatISO(startOfWeek(now, { weekStartsOn: 1 })));
            params.set('to', formatISO(endOfWeek(now, { weekStartsOn: 1 })));
        } else if (val === 'lastWeek') {
            const lw = subWeeks(now, 1);
            params.set('from', formatISO(startOfWeek(lw, { weekStartsOn: 1 })));
            params.set('to', formatISO(endOfWeek(lw, { weekStartsOn: 1 })));
        } else if (val === 'thisMonth') {
            params.set('from', formatISO(startOfMonth(now)));
            params.set('to', formatISO(endOfMonth(now)));
        } else if (val === 'lastMonth') {
            const lm = subMonths(now, 1);
            params.set('from', formatISO(startOfMonth(lm)));
            params.set('to', formatISO(endOfMonth(lm)));
        }
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    return (
        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl p-4 shadow-sm mb-6">
            <Select onValueChange={handlePeriodChange}>
                <SelectTrigger className="w-[180px] h-9 rounded-xl">
                    <SelectValue placeholder={t('period')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="thisWeek">{t('periodThisWeek')}</SelectItem>
                    <SelectItem value="lastWeek">{t('periodLastWeek')}</SelectItem>
                    <SelectItem value="thisMonth">{t('periodThisMonth')}</SelectItem>
                    <SelectItem value="lastMonth">{t('periodLastMonth')}</SelectItem>
                </SelectContent>
            </Select>

            <Select value={searchParams.get('workerIds[]') || 'all'} onValueChange={(val) => updateFilter('workerIds[]', val === 'all' ? null : val)}>
                <SelectTrigger className="w-[200px] h-9 rounded-xl">
                    <SelectValue placeholder={t('workforceMember')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">{t('allWorkers')}</SelectItem>
                    {workers.map(w => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={searchParams.get('projectIds[]') || 'all'} onValueChange={(val) => updateFilter('projectIds[]', val === 'all' ? null : val)}>
                <SelectTrigger className="w-[200px] h-9 rounded-xl">
                    <SelectValue placeholder={t('project')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">{t('allProjects')}</SelectItem>
                    {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={searchParams.get('billable') || 'all'} onValueChange={(val) => updateFilter('billable', val === 'all' ? null : val)}>
                <SelectTrigger className="w-[140px] h-9 rounded-xl">
                    <SelectValue placeholder={t('billable')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">{t('all')}</SelectItem>
                    <SelectItem value="true">{t('billable')}</SelectItem>
                    <SelectItem value="false">{t('internal')}</SelectItem>
                </SelectContent>
            </Select>
            
            <Select value={searchParams.get('source') || 'all'} onValueChange={(val) => updateFilter('source', val === 'all' ? null : val)}>
                <SelectTrigger className="w-[140px] h-9 rounded-xl">
                    <SelectValue placeholder={t('source')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">{t('allSources')}</SelectItem>
                    <SelectItem value="clocked">{t('sourceClocked')}</SelectItem>
                    <SelectItem value="manual">{t('sourceManual')}</SelectItem>
                    <SelectItem value="adjusted">{t('sourceAdjusted')}</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}
