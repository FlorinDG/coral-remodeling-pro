"use client";

import React, { useState, useEffect } from 'react';
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
import { format } from 'date-fns';
import { shiftMoment, localDateKey } from '@/lib/kernel/shift-time';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import { ShiftLockBanner } from './components/ShiftLockBanner';
import { ShiftTasksTab } from './components/ShiftTasksTab';
import { ShiftAttachmentsTab } from './components/ShiftAttachmentsTab';
import {
  validateShiftForm,
  buildUpdateShiftPayload,
  buildRecurringExpansionFromExisting,
  evaluateShiftLockState,
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
}

const ROLE_OPTIONS = ['Crew', 'Lead', 'Supervisor', 'Driver', 'Helper'];
const STATUS_OPTIONS = ['Scheduled', 'Active', 'In Progress', 'Completed', 'Cancelled'];

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
}: EditShiftDialogProps) {
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [shiftDate, setShiftDate] = useState('');
  const [shiftStart, setShiftStart] = useState('');
  const [shiftEnd, setShiftEnd] = useState('');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [materialsEnabled, setMaterialsEnabled] = useState(false);
  const [status, setStatus] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [editScope, setEditScope] = useState<EditScope>('occurrence');
  const [isConvertingToRecurring, setIsConvertingToRecurring] = useState(false);
  const [recurringWeeks, setRecurringWeeks] = useState(4);
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
      setShiftDate(s.shiftDate || s.shift_date || '');
      setShiftStart(s.shiftStart || s.shift_start || '');
      setShiftEnd(s.shiftEnd || s.shift_end || '');
      setRole(s.role || '');
      setNotes(s.notes || '');
      setSiteAddress(s.siteAddress || '');
      setMaterialsEnabled(!!s.materialsEnabled);
      setStatus(s.status || 'Scheduled');
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
      toast.error(firstError || 'Controleer het formulier op fouten');
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

      if (status !== shift.status) {
        await onStatusChange(shift.id, status);
      }

      toast.success(
        isConvertingToRecurring ? 'Dienst omgezet naar herhalend' : 'Dienst bijgewerkt'
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
        toast.error('Deze dienst is ondertekend en kan niet meer worden gewijzigd');
      } else {
        toast.error('Kan dienst niet bijwerken');
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
      toast.success('Dienst verwijderd');
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
        toast.error('Ondertekende diensten kunnen niet worden verwijderd');
      } else {
        toast.error('Kan dienst niet verwijderen');
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
          <DialogTitle>Dienst bewerken</DialogTitle>
        </DialogHeader>

        {/* Lock Banner when signed */}
        <ShiftLockBanner lock={lockState} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-1">
              <ListTodo className="h-4 w-4" />
              Taken
              {taskCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {taskCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="attachments" className="flex items-center gap-1">
              <Paperclip className="h-4 w-4" />
              Bestanden
              {attachmentCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {attachmentCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="h-[min(648px,70vh)] overflow-y-auto pr-1">
            {/* WO-4b / C7: WerkbonCard at top of details tab */}
            <WerkbonCard shiftId={shift?.id} className="mb-4" />

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Medewerker</Label>
                <SearchableSelect
                  options={workers.map(w => ({ value: w.id, label: w.name }))}
                  value={userId}
                  onChange={setUserId}
                  placeholder="Selecteer medewerker"
                  disabled={isInputDisabled}
                />
              </div>

              <div>
                <Label>Project</Label>
                <SearchableSelect
                  options={[
                    { value: '', label: '— Geen project —' },
                    ...projects.map(p => ({ value: p.id, label: p.name })),
                  ]}
                  value={projectId || ''}
                  onChange={setProjectId}
                  placeholder="Selecteer project (optioneel)"
                  disabled={isInputDisabled}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Datum</Label>
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
                      {shiftDate ? format(getParsedDate(shiftDate)!, 'PPP') : 'Selecteer datum'}
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
                  <Label htmlFor="editShiftStart">Starttijd</Label>
                  <Input
                    id="editShiftStart"
                    type="time"
                    value={shiftStart}
                    onChange={e => setShiftStart(e.target.value)}
                    disabled={isInputDisabled}
                  />
                </div>
                <div>
                  <Label htmlFor="editShiftEnd">Eindtijd</Label>
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
                <Label>Rol</Label>
                <Select
                  value={role || 'none'}
                  onValueChange={v => setRole(v === 'none' ? '' : v)}
                  disabled={isInputDisabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer rol (optioneel)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geen rol</SelectItem>
                    {ROLE_OPTIONS.map(r => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={setStatus}
                  disabled={isInputDisabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="editNotes">
                  Omschrijving — afgedrukt op de getekende werkbon van de klant
                </Label>
                <Textarea
                  id="editNotes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Wat er moet gebeuren — u kunt het verzoek van de klant citeren"
                  rows={2}
                  disabled={isInputDisabled}
                />
              </div>

              <div>
                <Label htmlFor="siteAddressEdit">
                  Uitvoeringsadres (indien niet het projectadres)
                </Label>
                <Input
                  id="siteAddressEdit"
                  value={siteAddress}
                  onChange={e => setSiteAddress(e.target.value)}
                  placeholder="Laat leeg om het projectadres te gebruiken"
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
                Ploeg registreert gebruikte materialen op deze dienst
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
                    <Repeat className="h-4 w-4 mr-2" /> Maak herhalend
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
                  <Label className="text-base font-semibold">Maak herhalend</Label>

                  <div>
                    <Label>Herhaal voor (weken)</Label>
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
                    <Label>Dagen van de week</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'].map((d, i) => (
                        <Badge
                          key={d}
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
                    Genereert {selectedDays.length * recurringWeeks} extra diensten.
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
                    Sluiten
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
                            window.confirm(
                              'Dienst verwijderen?\nDeze actie kan niet ongedaan worden gemaakt.'
                            )
                          ) {
                            handleDelete();
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Verwijderen
                      </Button>
                    )}
                    <Button type="submit" disabled={loading || !canManage}>
                      {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Opslaan
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
