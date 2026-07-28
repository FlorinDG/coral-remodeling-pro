"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { hrFetch } from '@/components/time-tracker/lib/hr-api';
import { useTranslations } from 'next-intl';
import { DateRangePicker } from '@/components/ui/DateRangePicker';

export function TimesheetFilterBar() {
    const t = useTranslations('Hr.timesheets');
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
    const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
    
    // Custom date range state
    const currentFrom = searchParams.get('from');
    const currentTo = searchParams.get('to');


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

    const handleDateRangeChange = (range: { from: string; to: string; period?: string }) => {
        const params = new URLSearchParams(searchParams.toString());
        
        if (range.period) {
            params.set('period', range.period);
        } else {
            params.delete('period');
        }
        
        params.set('from', range.from);
        params.set('to', range.to);
        
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    // We don't need the local customFrom/To effect anymore because DateRangePicker manages it

    const activePeriod = searchParams.get('period') || 'thisMonth'; // We will change default to thisMonth in page.tsx

    return (
        <div className="flex flex-wrap items-center gap-3">
            <DateRangePicker
                from={currentFrom || undefined}
                to={currentTo || undefined}
                period={activePeriod}
                onChange={handleDateRangeChange}
                triggerClassName="w-auto min-w-[220px]"
            />

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
