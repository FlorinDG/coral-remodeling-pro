'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { hrList } from '@/lib/hr-api';

/**
 * The shift's order giver — ONE field for creating and editing a shift (Florin 2026-10-10: it disappeared as soon as
 * a project was chosen, and the edit dialog had none). The rule is END-CLIENT-1 (lib/data/werkbon): the shift's own
 * client, else the project's client. So it is offered on every shift; with a project, "none" reads as "the project's
 * client". The list: the tenant's clients database (erp-clients — planners only; others see nothing to pick).
 */
export function OrderGiverField({ value, onChange, hasProject }: { value: string; onChange: (v: string) => void; hasProject: boolean }) {
    const t = useTranslations('Hr.shifts.create');
    const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
    useEffect(() => {
        let live = true;
        hrList<{ id: string; name: string }>('erp-clients').then(d => { if (live) setClients(d || []); }).catch(() => { if (live) setClients([]); });
        return () => { live = false; };
    }, []);
    if (!clients.length) return null;
    return (
        <div>
            <Label>{t('orderGiver')}</Label>
            <SearchableSelect
                options={[{ value: '', label: hasProject ? t('projectClient') : t('noClient') }, ...clients.map(c => ({ value: c.id, label: c.name }))]}
                value={value}
                onChange={onChange}
                placeholder={t('selectClient')}
            />
        </div>
    );
}
