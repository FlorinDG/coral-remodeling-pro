"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { weekdaysMondayFirst } from '@/lib/format/date';
import {
  Loader2,
  Trash2,
  Paperclip,
  ListTodo,
  Calendar as CalendarIcon,
  Repeat,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SearchableSelect from "@/components/ui/SearchableSelect";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ScopePicker, EditScope } from '@/components/ui/ScopePicker';
import { WerkbonCard } from '@/components/time-tracker/components/werkbon/WerkbonCard';
import { ScheduledShift, Project } from '@/components/time-tracker/hooks/useScheduledShifts';
import { WorkerOption } from '@/components/time-tracker/types/timesheet';
import { hrList } from '@/lib/hr-api';
import { shiftMoment, localDateKey } from '@/lib/kernel/shift-time';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useLocale, useTranslations } from 'next-intl';

import { ShiftLockBanner } from './components/ShiftLockBanner';
import { shiftStatus, isWritableShiftStatus, SHIFT_STATUS_OPTIONS, type ShiftStatus } from '@/lib/kernel/shift-status';
import { SHIFT_STATUS_LABEL, SHIFT_STATUS_PILL, getShiftStatusLabel } from '../shift-status-ui';
import { ShiftTasksTab } from './components/ShiftTasksTab';
import { ShiftAttachmentsTab } from './components/ShiftAttachmentsTab';
import { OrderGiverField } from './components/OrderGiverField';
import { ShiftTraceLinks } from './components/ShiftTraceLinks';
import {
  validateShiftForm,
  buildUpdateShiftPayload,
  buildRecurringExpansionFromExisting,
  evaluateShiftLockState,
  formatCalendarDay,
  ShiftLockState,
  ShiftEditorFormInput,
  CreateShiftPayload,
  UpdateShiftPayload,
} from './model';

type ShiftWithFallbacks = ScheduledShift & {
  user_id?: string;
  project_id?: string | null;
  shift_date?: string;
  shift_start?: string;
  shift_end?: string;
  siteAddress?: string | null;
  materialsEnabled?: boolean;
};

export interface EditShiftDialogProps {
  shift: ScheduledShift | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  workers: WorkerOption[];
  onUpdateShift: (
    shiftId: string,
    updates: UpdateShiftPayload,
    scope?: EditScope
  ) => Promise<void>;
  onCreateShift?: (shift: CreateShiftPayload) => Promise<unknown>;
  onDeleteShift: (shiftId: string, scope?: EditScope) => Promise<void>;
  onStatusChange: (shiftId: string, status: string) => Promise<void>;
  canManage?: boolean;
  /** LEAVE-1: the worker is off on this shift's day (kernel/absence) — flagged, not refused. */
  leaveConflict?: { requestType: string; pending: boolean } | null;
}

const ROLE_OPTIONS = ['Crew', 'Lead', 'Supervisor', 'Driver', 'Helper'];

const getParsedDate = (dateStr: string) => {
  if (!dateStr) return undefined;
  return shiftMoment(dateStr, '00:00');
};

const formatDateStr = (date: Date | undefined) => {
  if (!date) return '';
  return localDateKey(date);
};

export function EditShiftDialog({
  shift,
  open,
  onOpenChange,
  projects,
  workers,
  onUpdateShift,
  onCreateShift,
  onDeleteShift,
  onStatusChange,
  canManage = true,
  leaveConflict = null,
}: EditShiftDialogProps) {
  const t = useTranslations('Hr.shifts.edit');
  const tShifts = useTranslations('Hr.shifts');
  const locale = useLocale();

  // Monday first, the user's language (lib/format/date — one home for date display).
  const weekdays = useMemo(() => weekdaysMondayFirst(locale), [locale]);

  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [contactPageId, setContactPageId] = useState('');
  const [shiftDate, setShiftDate] = useState('');
  const [shiftStart, setShiftStart] = useState('');
  const [shiftEnd, setShiftEnd] = useState('');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [materialsEnabled, setMaterialsEnabled] = useState(false);
  // SCHED-STATUS-1: what the person sees (kernel) — derived 'late' / 'in-progress' included.
  const [status, setStatus] = useState<ShiftStatus>('scheduled');
  const [shownStatus, setShownStatus] = useState<ShiftStatus>('scheduled');
  const [activeTab, setActiveTab] = useState('details');
  const [editScope, setEditScope] = useState<EditScope>('occurrence');
  const [isConvertingToRecurring, setIsConvertingToRecurring] = useState(false);
  const [recurringWeeks, setRecurringWeeks] = useState(1);   // Florin 2026-10-10: one week by default
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  // Task & attachment counts for tab badges
  const [taskCount, setTaskCount] = useState(0);
  const [attachmentCount, setAttachmentCount] = useState(0);

  // Lock state
  const [lockState, setLockState] = useState<ShiftLockState>({ locked: false });

  // Populate form and fetch audit logs when shift opens
  useEffect(() => {
    if (shift) {
      const s = shift as ShiftWithFallbacks;
      setUserId(s.userId || s.user_id || '');
      setProjectId(s.projectId || s.project_id || '');
      // The order giver is kept on edit (was not loaded: every save sent contactPageId null and erased it).
      setContactPageId((s as { contactPageId?: string | null }).contactPageId || '');
      setShiftDate(s.shiftDate || s.shift_date || '');
      setShiftStart(s.shiftStart || s.shift_start || '');
      setShiftEnd(s.shiftEnd || s.shift_end || '');
      setRole(s.role || '');
      setNotes(s.notes || '');
      setSiteAddress(s.siteAddress || '');
      setMaterialsEnabled(!!s.materialsEnabled);
      const seen = shiftStatus(s, s.clockEntries || []);
      setStatus(seen);
      setShownStatus(seen);
      setEditScope('occurrence');
      setIsConvertingToRecurring(false);
      setActiveTab('details');
    }
  }, [shift]);

  // Fetch audit logs for lock evaluation
  useEffect(() => {
    let alive = true;
    if (!shift?.id || !open) {
      setLockState({ locked: false });
      return;
    }

    hrList<{ action: string; createdAt?: string; after?: unknown }>('audit-logs', {
      entityType: 'shift',
      entityId: shift.id,
    })
      .then(logs => {
        if (!alive) return;
        const evaluated = evaluateShiftLockState(logs || []);
        setLockState(evaluated);
      })
      .catch(err => {
        console.warn('Failed to fetch audit logs for shift lock state:', err);
        if (!alive) return;
        setLockState(evaluateShiftLockState([]));
      });

    return () => {
      alive = false;
    };
  }, [shift?.id, shift?.status, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shift || lockState.locked) return;

    const formInput: ShiftEditorFormInput = {
      userIds: [userId],
      projectId: projectId || null,
      contactPageId: contactPageId || null,
      shiftDate,
      shiftStart,
      shiftEnd,
      role: role || null,
      notes: notes || null,
      siteAddress: siteAddress.trim() || null,
      materialsEnabled,
      scheduleType: isConvertingToRecurring ? 'recurring' : 'single',
      recurringWeeks: isConvertingToRecurring ? recurringWeeks : undefined,
      selectedDays: isConvertingToRecurring ? selectedDays : undefined,
    };

    const validation = validateShiftForm(formInput);
    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      toast.error(firstError || t('formErrors'));
      return;
    }

    setLoading(true);
    try {
      let seriesId = shift.seriesId;

      if (isConvertingToRecurring && onCreateShift) {
        seriesId =
          seriesId ||
          (typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2, 9));

        const expansions = buildRecurringExpansionFromExisting(
          formInput,
          shiftDate,
          seriesId
        );

        for (const exp of expansions) {
          await onCreateShift(exp);
        }
      }

      const updatePayload = buildUpdateShiftPayload(formInput, seriesId);

      await onUpdateShift(shift.id, updatePayload, editScope);

      // Only a status the person changed, and only one that can be written ('in-progress' is the clock's).
      if (status !== shownStatus && isWritableShiftStatus(status)) {
        await onStatusChange(shift.id, status);
      }

      toast.success(
        isConvertingToRecurring ? t('convertedSuccess') : t('updatedSuccess')
      );
      onOpenChange(false);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err || '');
      const errStatus =
        typeof err === 'object' && err !== null && 'status' in err
          ? (err as { status: unknown }).status
          : undefined;
      if (errMsg.includes('work_order_signed') || errStatus === 409) {
        setLockState({
          locked: true,
          reason: 'work_order_signed',
        });
        toast.error(t('signedCannotModify'));
      } else {
        toast.error(t('updateFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!shift || lockState.locked) return;

    setLoading(true);
    try {
      await onDeleteShift(shift.id, editScope);
      toast.success(t('deletedSuccess'));
      onOpenChange(false);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err || '');
      const errStatus =
        typeof err === 'object' && err !== null && 'status' in err
          ? (err as { status: unknown }).status
          : undefined;
      if (errMsg.includes('work_order_signed') || errStatus === 409) {
        setLockState({
          locked: true,
          reason: 'work_order_signed',
        });
        toast.error(t('signedCannotDelete'));
      } else {
        toast.error(t('deleteFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!shift) return null;

  const isLocked = lockState.locked;
  const isInputDisabled = !canManage || isLocked;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          {/* TRACE-1: the shift's number and its clocked hours, linked */}
          {shift && <ShiftTraceLinks traceNo={(shift as { traceNo?: string | null }).traceNo} entries={(shift as { clockEntries?: [] }).clockEntries} />}
        </DialogHeader>

        {/* Lock Banner when signed */}
        <ShiftLockBanner lock={lockState} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">{tShifts('create.tabDetails')}</TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-1">
              <ListTodo className="h-4 w-4" />
              {tShifts('create.tabTasks')}
              {taskCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {taskCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="attachments" className="flex items-center gap-1">
              <Paperclip className="h-4 w-4" />
              {tShifts('create.tabAttachments')}
              {attachmentCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {attachmentCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="h-[min(648px,70vh)] overflow-y-auto pr-1">
            {leaveConflict && (
              <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-3 py-2 text-sm text-red-800 dark:text-red-200">
                {t('conflict', {
                  type: leaveConflict.requestType,
                  pending: leaveConflict.pending ? t('pendingSuffix') : '',
                })}
              </div>
            )}
            {/* WO-4b / C7: WerkbonCard at top of details tab */}
            <WerkbonCard shiftId={shift?.id} className="mb-4" />

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>{t('worker')}</Label>
                <SearchableSelect
                  options={workers.map(w => ({ value: w.id, label: w.name }))}
                  value={userId}
                  onChange={setUserId}
                  placeholder={t('selectWorker')}
                  disabled={isInputDisabled}
                />
              </div>

              <div>
                <Label>{t('project')}</Label>
                <SearchableSelect
                  options={[
                    { value: '', label: t('noProject') },
                    ...projects.map(p => ({ value: p.id, label: p.name })),
                  ]}
                  value={projectId || ''}
                  onChange={setProjectId}
                  placeholder={t('selectProject')}
                  disabled={isInputDisabled}
                />
              </div>

              {!isInputDisabled && <OrderGiverField value={contactPageId} onChange={setContactPageId} hasProject={!!projectId} />}

              <div className="flex flex-col gap-2">
                <Label>{t('date')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={isInputDisabled}
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !shiftDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {shiftDate ? formatCalendarDay(shiftDate) : t('selectDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={getParsedDate(shiftDate)}
                      onSelect={date => setShiftDate(formatDateStr(date))}
                      initialFocus
                      disabled={isInputDisabled}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editShiftStart">{t('startTime')}</Label>
                  <Input
                    id="editShiftStart"
                    type="time"
                    value={shiftStart}
                    onChange={e => setShiftStart(e.target.value)}
                    disabled={isInputDisabled}
                  />
                </div>
                <div>
                  <Label htmlFor="editShiftEnd">{t('endTime')}</Label>
                  <Input
                    id="editShiftEnd"
                    type="time"
                    value={shiftEnd}
                    onChange={e => setShiftEnd(e.target.value)}
                    disabled={isInputDisabled}
                  />
                </div>
              </div>

              <div>
                <Label>{t('role')}</Label>
                <Select
                  value={role || 'none'}
                  onValueChange={v => setRole(v === 'none' ? '' : v)}
                  disabled={isInputDisabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectRole')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('noRole')}</SelectItem>
                    {ROLE_OPTIONS.map(r => (
                      <SelectItem key={r} value={r}>
                        {tShifts.has(`roles.${r.toLowerCase()}`) ? tShifts(`roles.${r.toLowerCase()}`) : r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('status')}</Label>
                <Select
                  value={status}
                  onValueChange={v => setStatus(v as ShiftStatus)}
                  disabled={isInputDisabled}
                >
                  <SelectTrigger className={SHIFT_STATUS_PILL[status]}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIFT_STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s} disabled={!isWritableShiftStatus(s)}>
                        {getShiftStatusLabel(s, (k) => tShifts(k))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="editNotes">
                  {t('description')}
                </Label>
                <Textarea
                  id="editNotes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={t('descriptionPlaceholder')}
                  rows={2}
                  disabled={isInputDisabled}
                />
              </div>

              <div>
                <Label htmlFor="siteAddressEdit">
                  {t('executionAddress')}
                </Label>
                <Input
                  id="siteAddressEdit"
                  value={siteAddress}
                  onChange={e => setSiteAddress(e.target.value)}
                  placeholder={t('executionAddressPlaceholder')}
                  disabled={isInputDisabled}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={materialsEnabled}
                  onChange={e => setMaterialsEnabled(e.target.checked)}
                  disabled={isInputDisabled}
                />
                {t('materialsTracking')}
              </label>

              {/* Make Recurring Section */}
              {canManage && !shift?.seriesId && !isConvertingToRecurring && !isLocked && (
                <div className="pt-4 border-t mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsConvertingToRecurring(true)}
                    className="w-full"
                  >
                    <Repeat className="h-4 w-4 mr-2" /> {t('makeRecurring')}
                  </Button>
                </div>
              )}

              {isConvertingToRecurring && !isLocked && (
                <div className="space-y-4 p-4 border rounded-xl bg-muted/50 mt-6 relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 h-6 w-6 p-0"
                    onClick={() => setIsConvertingToRecurring(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Label className="text-base font-semibold">{t('makeRecurring')}</Label>

                  <div>
                    <Label>{t('repeatWeeks')}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={52}
                      value={recurringWeeks}
                      onChange={e => setRecurringWeeks(parseInt(e.target.value, 10) || 1)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>{tShifts('create.daysOfWeek')}</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {weekdays.map(({ day: i, label: d }) => (
                        <Badge
                          key={i}
                          variant={selectedDays.includes(i) ? 'default' : 'outline'}
                          className="cursor-pointer px-3 py-1 text-sm select-none"
                          onClick={() =>
                            setSelectedDays(prev =>
                              prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
                            )
                          }
                        >
                          {d}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground italic">
                    {t('generatesExtra', { count: selectedDays.length * recurringWeeks })}
                  </div>
                </div>
              )}

              {/* Series Scope Picker */}
              {canManage && shift?.seriesId && !isLocked && (
                <div className="pt-4 border-t mt-6">
                  <ScopePicker
                    value={editScope}
                    onChange={setEditScope}
                    seriesId={shift.seriesId}
                    actionName="Wijzigingen toepassen op"
                  />
                </div>
              )}

              <DialogFooter className="hidden md:flex mt-6 gap-2">
                {isLocked ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    {t('close')}
                  </Button>
                ) : (
                  <>
                    {canManage && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (
                            window.confirm(t('deleteConfirm'))
                          ) {
                            handleDelete();
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {t('delete')}
                      </Button>
                    )}
                    <Button type="submit" disabled={loading || !canManage}>
                      {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {t('save')}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="tasks">
            <ShiftTasksTab
              shiftId={shift?.id || null}
              projectId={projectId || shift?.projectId || (shift as ShiftWithFallbacks)?.project_id}
              canManage={canManage}
              isLocked={isLocked}
              onCountChange={setTaskCount}
            />
          </TabsContent>

          <TabsContent value="attachments">
            <ShiftAttachmentsTab
              shiftId={shift?.id || null}
              projectId={projectId || shift?.projectId || (shift as ShiftWithFallbacks)?.project_id}
              canManage={canManage}
              isLocked={isLocked}
              onCountChange={setAttachmentCount}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
