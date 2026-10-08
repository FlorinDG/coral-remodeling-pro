import React, { useState, useEffect } from 'react';
import { hrList, hrCreate } from '@/lib/hr-api';
import { Loader2, Plus, Calendar, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';
import { TimeSelect } from '@/components/ui/TimeSelect';
import { useLocale, useTranslations } from 'next-intl';
import { localDateKey } from '@/lib/kernel/shift-time';

interface Employee {
    id: string;
    userId?: string | null;
    firstName: string;
    lastName: string;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function ManualEntryModal({ open, onOpenChange, onSuccess }: Props) {
    const locale = useLocale();
    const t = useTranslations('Hr.timesheets.manualEntry');
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    
    // Form state
    const [userId, setUserId] = useState('');
    const [projectId, setProjectId] = useState('');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('08:00');
    const [endTime, setEndTime] = useState('17:00');
    const [description, setDescription] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (open) {
            setDate(localDateKey(new Date()));   // local date — toISOString() is UTC (yesterday before 02:00)
            
            if (employees.length === 0) {
                hrList<Employee>('employees').then(data => setEmployees(data)).catch(console.error);
            }
            if (projects.length === 0) {
                // PROJ-SSOT-1: the one project source (was the empty HrProject list → no project to pick).
                hrList<any>('erp-projects').then(data => setProjects(data)).catch(err => console.error('[ManualEntryModal] projects could not be loaded:', err));
            }
        }
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId || !date || !startTime || !endTime) return;
        
        setLoading(true);
        try {
            // An end at or before the start is the NEXT day (night work: 22:00 → 02:00) — it was
            // stored with a negative duration.
            const inAt = new Date(`${date}T${startTime}:00`);
            const outAt = new Date(`${date}T${endTime}:00`);
            if (outAt.getTime() <= inAt.getTime()) outAt.setDate(outAt.getDate() + 1);
            const clockInTime = inAt.toISOString();
            const clockOutTime = outAt.toISOString();
            
            await hrCreate('clock-entries', {
                userId,
                projectId: projectId === 'none' ? null : (projectId || null),
                clockInTime,
                clockOutTime,
                taskDescription: description,
                notes: notes.trim() || null,
                source: 'admin_entry',
                approvalStatus: 'approved',
                photos: [],
            });
            onSuccess();
            onOpenChange(false);
            
            // Reset
            setUserId('');
            setProjectId('');
            setDescription('');
            setNotes('');
        } catch (err) {
            console.error('Failed to create manual entry:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{t('title')}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>{t('worker')}</Label>
                        <Select value={userId} onValueChange={setUserId}>
                            <SelectTrigger>
                                <SelectValue placeholder={t('selectWorker')} />
                            </SelectTrigger>
                            <SelectContent>
                                {employees.filter(emp => emp.userId).map(emp => (
                                    <SelectItem key={emp.id} value={emp.userId!}>
                                        {emp.firstName} {emp.lastName}
                                    </SelectItem>
                                ))}
                                {employees.some(emp => !emp.userId) && (
                                    <div className="px-2 py-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                                        {t('unlinkedAccountsWarning', { count: employees.filter(emp => !emp.userId).length })}
                                    </div>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>{t('projectOptional')}</Label>
                        {/* HR-TS-8: searchable — the same erp-projects list as the filter bar */}
                        <SearchableSelect
                            value={projectId || 'none'}
                            onChange={setProjectId}
                            placeholder={t('selectProject')}
                            searchPlaceholder={t('searchProject')}
                            options={[{ value: 'none', label: t('noProject') }, ...projects.map(p => ({ value: p.id, label: p.name }))]}
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <Label>{t('date')}</Label>
                        {/* Belgian, Monday-first — a native date input follows the browser's region */}
                        <CustomDatePicker value={date} onChange={setDate} locale={locale} clearable={false} triggerClassName="w-full" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('startTime')}</Label>
                            <TimeSelect value={startTime} onChange={setStartTime} minuteStep={5} ariaLabel={t('startTime')} />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('endTime')}</Label>
                            <TimeSelect value={endTime} onChange={setEndTime} minuteStep={5} ariaLabel={t('endTime')} />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <Label>{t('description')}</Label>
                        <Textarea 
                            placeholder={t('descriptionPlaceholder')} 
                            value={description} 
                            onChange={e => setDescription(e.target.value)} 
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{t('notesOptional')}</Label>
                        <Textarea 
                            placeholder={t('notesPlaceholder')} 
                            value={notes} 
                            onChange={e => setNotes(e.target.value)} 
                        />
                    </div>
                    
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
                        <Button type="submit" disabled={loading || !userId || !date}>
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {t('save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
