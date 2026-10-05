"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Loader2,
  Repeat,
  Save,
  FileText,
  Paperclip,
  X,
  Upload,
  FolderOpen,
  Calendar as CalendarIcon,
  Trash2,
} from 'lucide-react';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Project } from '@/components/time-tracker/hooks/useScheduledShifts';
import { useTasks, Task } from '@/components/time-tracker/hooks/useTasks';
import { hrList, hrCreate, hrDelete as hrDeleteEntity } from '@/lib/hr-api';
import { shiftMoment, localDateKey } from '@/lib/kernel/shift-time';
import { listRecordFiles, uploadFileAction } from '@/app/actions/files';
import { addShiftFile } from '@/lib/data/shift-files';
import { WorkerOption } from '@/components/time-tracker/types/timesheet';
import { toast } from 'sonner';

import { InlineCreateProjectModal } from './components/InlineCreateProjectModal';
import {
  validateShiftForm,
  buildCreateShiftPayloads,
  CreateShiftPayload,
  ShiftEditorFormInput,
  ShiftScheduleType,
} from './model';

export interface CreateShiftFormProps {
  projects: Project[];
  workers: WorkerOption[];
  onCreateShift: (shift: CreateShiftPayload) => Promise<{ id?: string } | unknown>;
  onCreateProject: (data: {
    name: string;
    address?: string | null;
    color?: string;
    latitude?: number;
    longitude?: number;
  }) => Promise<unknown>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  prefilledUserId?: string;
  prefilledDate?: string;
  onClose?: () => void;
}

interface ShiftTemplate {
  id: string;
  name: string;
  shift_start?: string;
  shift_end?: string;
  shiftStart?: string;
  shiftEnd?: string;
  project_id?: string | null;
  projectId?: string | null;
  role?: string | null;
  notes?: string | null;
}

interface ProjectAttachment {
  id: string;
  project_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number | null;
}

interface PendingAttachment {
  type: 'file' | 'project';
  file?: File;
  projectAttachment?: ProjectAttachment;
  name: string;
}

interface SelectedTask {
  task: Task;
  isNew?: boolean;
}

const ROLE_OPTIONS = ['Crew', 'Lead', 'Supervisor', 'Driver', 'Helper'];
const DAY_LABELS = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];

const getParsedDate = (dateStr: string) => {
  if (!dateStr) return undefined;
  return shiftMoment(dateStr, '00:00');
};

const formatDateStr = (date: Date | undefined) => {
  if (!date) return '';
  return localDateKey(date);
};

export function CreateShiftForm({
  projects,
  workers,
  onCreateShift,
  onCreateProject,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  prefilledUserId,
  prefilledDate,
  onClose,
}: CreateShiftFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (value: boolean) => {
    if (controlledOnOpenChange) {
      controlledOnOpenChange(value);
    } else {
      setInternalOpen(value);
    }
    if (!value && onClose) {
      onClose();
    }
  };

  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [activeTab, setActiveTab] = useState('details');

  // Form state
  const [userIds, setUserIds] = useState<string[]>([]);
  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [shiftDate, setShiftDate] = useState('');
  const [shiftEndDate, setShiftEndDate] = useState('');
  const [includeWeekends, setIncludeWeekends] = useState(false);
  const [shiftStart, setShiftStart] = useState('08:00');
  const [shiftEnd, setShiftEnd] = useState('17:00');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [materialsEnabled, setMaterialsEnabled] = useState(false);
  const [contactPageId, setContactPageId] = useState('');
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

  // Schedule type
  const [scheduleType, setScheduleType] = useState<ShiftScheduleType>('single');
  const [recurringWeeks, setRecurringWeeks] = useState(4);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [leaveReason, setLeaveReason] = useState('Vakantie');

  // Template options
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Attachments
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [projectAttachments, setProjectAttachments] = useState<ProjectAttachment[]>([]);
  const [attachmentPopoverOpen, setAttachmentPopoverOpen] = useState(false);

  // Tasks
  const [selectedTasks, setSelectedTasks] = useState<SelectedTask[]>([]);
  const [taskPopoverOpen, setTaskPopoverOpen] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const { tasks: projectTasks, createTask, refetch: refetchTasks } = useTasks(projectId || null);

  // Prefill values
  useEffect(() => {
    if (open) {
      if (prefilledUserId) {
        setUserIds([prefilledUserId]);
      } else {
        setUserIds([]);
      }
      if (prefilledDate) {
        setShiftDate(prefilledDate);
      }
      setActiveTab('details');
    }
  }, [open, prefilledUserId, prefilledDate]);

  // Fetch templates
  const fetchTemplates = async () => {
    try {
      const data = await hrList<ShiftTemplate>('shift-templates');
      setTemplates(data || []);
    } catch {
      // Degrade gracefully
    }
  };

  useEffect(() => {
    if (open) fetchTemplates();
  }, [open]);

  // Fetch ERP clients (order giver when no project supplies one)
  useEffect(() => {
    if (!open) return;
    hrList<{ id: string; name: string }>('erp-clients')
      .then(data => setClients(data || []))
      .catch(() => setClients([]));
  }, [open]);

  // Fetch project files
  useEffect(() => {
    const fetchProjectAttachments = async () => {
      if (!projectId) {
        setProjectAttachments([]);
        return;
      }
      try {
        const files = await listRecordFiles('project', projectId);
        setProjectAttachments(
          files.map(f => ({
            id: f.id,
            project_id: projectId,
            file_name: f.name,
            file_path: f.url,
            file_size: f.size,
            file_type: f.name.split('.').pop() || '',
          }))
        );
      } catch (err) {
        console.error('Failed to fetch project attachments:', err);
        setProjectAttachments([]);
      }
    };

    fetchProjectAttachments();
  }, [projectId]);

  const resetForm = () => {
    setUserIds([]);
    setProjectId('');
    setContactPageId('');
    setShiftDate('');
    setShiftEndDate('');
    setShiftStart('08:00');
    setShiftEnd('17:00');
    setRole('');
    setNotes('');
    setSiteAddress('');
    setMaterialsEnabled(false);
    setScheduleType('single');
    setRecurringWeeks(4);
    setSelectedDays([]);
    setLeaveReason('Vakantie');
    setSelectedTemplateId('');
    setSaveAsTemplate(false);
    setTemplateName('');
    setPendingAttachments([]);
    setSelectedTasks([]);
    setQuickTaskTitle('');
    setActiveTab('details');
  };

  const applyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setShiftStart(template.shiftStart || template.shift_start || '08:00');
      setShiftEnd(template.shiftEnd || template.shift_end || '17:00');
      setProjectId(template.projectId || template.project_id || '');
      setRole(template.role || '');
      setNotes(template.notes || '');
    }
    setSelectedTemplateId(templateId);
  };

  const handleDeleteTemplate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await hrDeleteEntity('shift-templates', templateId);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      if (selectedTemplateId === templateId) setSelectedTemplateId('');
      toast.success('Sjabloon verwijderd');
    } catch {
      toast.error('Kan sjabloon niet verwijderen');
    }
  };

  const addTask = (task: Task) => {
    if (selectedTasks.some(st => st.task.id === task.id)) {
      toast.error('Taak is al toegevoegd');
      return;
    }
    setSelectedTasks(prev => [...prev, { task }]);
    setTaskPopoverOpen(false);
  };

  const removeSelectedTask = (taskId: string) => {
    setSelectedTasks(prev => prev.filter(st => st.task.id !== taskId));
  };

  const handleQuickCreateTask = async () => {
    if (!projectId || !quickTaskTitle.trim()) return;
    try {
      const result = await createTask({
        projectId,
        title: quickTaskTitle.trim(),
        priority: 'normal',
      });
      if (result?.data) {
        setSelectedTasks(prev => [...prev, { task: result.data as Task, isNew: true }]);
        setQuickTaskTitle('');
        await refetchTasks();
        toast.success('Taak aangemaakt en toegevoegd');
      }
    } catch {
      toast.error('Kan taak niet aanmaken');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments = files.map(file => ({
      type: 'file' as const,
      file,
      name: file.name,
    }));
    setPendingAttachments(prev => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const addProjectAttachment = (attachment: ProjectAttachment) => {
    if (pendingAttachments.some(p => p.projectAttachment?.id === attachment.id)) {
      toast.error('Bestand is al toegevoegd');
      return;
    }
    setPendingAttachments(prev => [
      ...prev,
      {
        type: 'project',
        projectAttachment: attachment,
        name: attachment.file_name,
      },
    ]);
    setAttachmentPopoverOpen(false);
  };

  const removeAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const assignTasksAndAttachments = async (shiftId: string) => {
    // Tasks
    for (const st of selectedTasks) {
      try {
        await hrCreate('shift-tasks', {
          shiftId,
          taskId: st.task.id,
          status: 'pending',
        });
      } catch (err) {
        console.error('Failed to link task to shift:', err);
      }
    }

    // Attachments
    for (const att of pendingAttachments) {
      try {
        if (att.type === 'file' && att.file) {
          const formData = new FormData();
          formData.append('file', att.file);
          const uploadRes = await uploadFileAction(formData, 'hr-shift', shiftId);
          if (uploadRes.success && uploadRes.key) {
            await addShiftFile({
              shiftId,
              key: uploadRes.key,
              name: att.file.name,
              type: att.file.type,
              size: att.file.size,
            });
          }
        } else if (att.type === 'project' && att.projectAttachment) {
          await hrCreate('shift-attachments', {
            shiftId,
            name: att.projectAttachment.file_name,
            url: att.projectAttachment.file_path,
            type: att.projectAttachment.file_type || 'application/octet-stream',
            size: att.projectAttachment.file_size || null,
          });
        }
      } catch (err) {
        console.error('Failed to attach file to shift:', err);
      }
    }
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formInput: ShiftEditorFormInput = {
      userIds,
      projectId: projectId || null,
      contactPageId: contactPageId || null,
      shiftDate,
      shiftEndDate: scheduleType === 'leave' ? shiftEndDate : undefined,
      shiftStart,
      shiftEnd,
      role: role || null,
      notes: notes || null,
      siteAddress: siteAddress.trim() || null,
      materialsEnabled,
      scheduleType,
      recurringWeeks: scheduleType === 'recurring' ? recurringWeeks : undefined,
      selectedDays: scheduleType === 'recurring' ? selectedDays : undefined,
      leaveReason: scheduleType === 'leave' ? leaveReason : undefined,
      includeWeekends: scheduleType === 'leave' ? includeWeekends : undefined,
    };

    const validation = validateShiftForm(formInput);
    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      toast.error(firstError || 'Controleer het formulier op fouten');
      return;
    }

    setLoading(true);
    try {
      // Save template if requested
      if (saveAsTemplate && templateName.trim()) {
        try {
          await hrCreate('shift-templates', {
            name: templateName.trim(),
            shiftStart,
            shiftEnd,
            projectId: projectId || null,
            role: role || null,
            notes: notes || null,
          });
          await fetchTemplates();
        } catch {
          toast.error('Kan sjabloon niet opslaan');
        }
      }

      // Build payloads using the pure model
      const payloads = buildCreateShiftPayloads(formInput);

      for (const payload of payloads) {
        const res = await onCreateShift(payload);
        const createdId =
          typeof res === 'object' && res !== null && 'id' in res
            ? String((res as { id: unknown }).id)
            : undefined;

        if (createdId) {
          await assignTasksAndAttachments(createdId);
        }
      }

      toast.success(
        payloads.length === 1
          ? 'Dienst succesvol ingepland'
          : `${payloads.length} diensten succesvol ingepland`
      );

      resetForm();
      setOpen(false);
    } catch {
      toast.error('Kan dienst niet inplannen');
    } finally {
      setLoading(false);
    }
  };

  // Selected worker details for badge pills
  const selectedWorkers = useMemo(() => {
    return workers.filter(w => userIds.includes(w.id));
  }, [workers, userIds]);

  const dialogContent = (
    <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Dienst inplannen</DialogTitle>
      </DialogHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-1">
            Taken
            {selectedTasks.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {selectedTasks.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="attachments" className="flex items-center gap-1">
            Bestanden
            {pendingAttachments.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {pendingAttachments.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="h-[min(648px,70vh)] overflow-y-auto pr-1">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Schedule Type Selection */}
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <Button
                type="button"
                variant={scheduleType === 'single' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setScheduleType('single')}
              >
                Enkelvoudig
              </Button>
              <Button
                type="button"
                variant={scheduleType === 'recurring' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setScheduleType('recurring')}
              >
                <Repeat className="h-3.5 w-3.5 mr-1" /> Herhalend
              </Button>
              <Button
                type="button"
                variant={scheduleType === 'leave' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setScheduleType('leave')}
              >
                Verlof / Afwezigheid
              </Button>
            </div>

            {/* Template Selector (Single/Recurring) */}
            {scheduleType !== 'leave' && templates.length > 0 && (
              <div>
                <Label>Sjabloon toepassen</Label>
                <div className="flex gap-2">
                  <Select value={selectedTemplateId} onValueChange={applyTemplate}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Kies een sjabloon..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(tpl => (
                        <SelectItem key={tpl.id} value={tpl.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{tpl.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplateId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600"
                      onClick={e => handleDeleteTemplate(selectedTemplateId, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Employee Selection (Multi-select) */}
            <div>
              <Label>Medewerker(s) *</Label>
              <Popover open={employeePopoverOpen} onOpenChange={setEmployeePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start font-normal min-h-10 h-auto py-2"
                  >
                    {selectedWorkers.length === 0 ? (
                      <span className="text-muted-foreground">Selecteer medewerker(s)...</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {selectedWorkers.map(w => (
                          <Badge
                            key={w.id}
                            variant="secondary"
                            className="mr-1 text-xs flex items-center gap-1"
                            onClick={e => {
                              e.stopPropagation();
                              setUserIds(prev => prev.filter(id => id !== w.id));
                            }}
                          >
                            {w.name}
                            <X className="h-3 w-3 hover:text-destructive" />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-2" align="start">
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {workers.map(w => {
                      const isSelected = userIds.includes(w.id);
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => {
                            setUserIds(prev =>
                              isSelected ? prev.filter(id => id !== w.id) : [...prev, w.id]
                            );
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded text-sm hover:bg-muted text-left ${
                            isSelected ? 'bg-muted font-medium' : ''
                          }`}
                        >
                          <span>{w.name}</span>
                          {isSelected && <Badge variant="outline" className="text-xs">Geselecteerd</Badge>}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Project Selection (Single/Recurring) */}
            {scheduleType !== 'leave' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Project</Label>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => setProjectDialogOpen(true)}
                  >
                    + Nieuw project
                  </Button>
                </div>
                <SearchableSelect
                  options={[
                    { value: '', label: '— Geen project —' },
                    ...projects.map(p => ({ value: p.id, label: p.name })),
                  ]}
                  value={projectId}
                  onChange={setProjectId}
                  placeholder="Selecteer project (optioneel)"
                />
              </div>
            )}

            {/* Order Giver Picker (when no project is chosen) */}
            {scheduleType !== 'leave' && !projectId && clients.length > 0 && (
              <div>
                <Label>Opdrachtgever (Klant)</Label>
                <SearchableSelect
                  options={[
                    { value: '', label: '— Geen specifieke klant —' },
                    ...clients.map(c => ({ value: c.id, label: c.name })),
                  ]}
                  value={contactPageId}
                  onChange={setContactPageId}
                  placeholder="Selecteer klant (optioneel)"
                />
              </div>
            )}

            {/* Leave Reason (Leave schedule) */}
            {scheduleType === 'leave' && (
              <div>
                <Label>Reden voor verlof *</Label>
                <Select value={leaveReason} onValueChange={setLeaveReason}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Vakantie">Vakantie (Betaald)</SelectItem>
                    <SelectItem value="Ziekte">Ziekte / Doktersbezoek</SelectItem>
                    <SelectItem value="Onbetaald verlof">Onbetaald verlof</SelectItem>
                    <SelectItem value="Klein verlet">Klein verlet / Omstandigheidsverlof</SelectItem>
                    <SelectItem value="Opleiding">Opleiding</SelectItem>
                    <SelectItem value="Overig">Overig</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{scheduleType === 'leave' ? 'Startdatum *' : 'Datum *'}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
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
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {scheduleType === 'leave' && (
                <div>
                  <Label>Einddatum *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !shiftEndDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {shiftEndDate
                          ? format(getParsedDate(shiftEndDate)!, 'PPP')
                          : 'Selecteer einddatum'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={getParsedDate(shiftEndDate)}
                        onSelect={date => setShiftEndDate(formatDateStr(date))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* Leave Weekend Inclusion */}
            {scheduleType === 'leave' && (
              <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={includeWeekends}
                  onChange={e => setIncludeWeekends(e.target.checked)}
                />
                Inclusief weekenddagen
              </label>
            )}

            {/* Recurring Settings */}
            {scheduleType === 'recurring' && (
              <div className="space-y-3 p-4 border rounded-xl bg-muted/40">
                <Label className="font-semibold text-sm">Herhalingspatroon</Label>
                <div>
                  <Label>Aantal weken (1-52)</Label>
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
                  <Label>Dagen van de week *</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {DAY_LABELS.map((d, i) => (
                      <Badge
                        key={d}
                        variant={selectedDays.includes(i) ? 'default' : 'outline'}
                        className="cursor-pointer px-3 py-1 text-sm select-none"
                        onClick={() => toggleDay(i)}
                      >
                        {d}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Time Selection (Single/Recurring) */}
            {scheduleType !== 'leave' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="createShiftStart">Starttijd</Label>
                  <Input
                    id="createShiftStart"
                    type="time"
                    value={shiftStart}
                    onChange={e => setShiftStart(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="createShiftEnd">Eindtijd</Label>
                  <Input
                    id="createShiftEnd"
                    type="time"
                    value={shiftEnd}
                    onChange={e => setShiftEnd(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Role (Single/Recurring) */}
            {scheduleType !== 'leave' && (
              <div>
                <Label>Rol</Label>
                <Select value={role || 'none'} onValueChange={v => setRole(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer rol (optioneel)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geen specifieke rol</SelectItem>
                    {ROLE_OPTIONS.map(r => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Description (Single/Recurring) */}
            {scheduleType !== 'leave' && (
              <div>
                <Label htmlFor="createShiftNotes">
                  Omschrijving — afgedrukt op de getekende werkbon van de klant
                </Label>
                <Textarea
                  id="createShiftNotes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Wat er moet gebeuren — u kunt het verzoek van de klant citeren"
                  rows={2}
                />
              </div>
            )}

            {/* Execution Address (Single/Recurring) */}
            {scheduleType !== 'leave' && (
              <div>
                <Label htmlFor="createShiftAddress">
                  Uitvoeringsadres (indien niet het projectadres)
                </Label>
                <Input
                  id="createShiftAddress"
                  value={siteAddress}
                  onChange={e => setSiteAddress(e.target.value)}
                  placeholder="Laat leeg om het projectadres te gebruiken"
                />
              </div>
            )}

            {/* Materials Checkbox (Single/Recurring) */}
            {scheduleType !== 'leave' && (
              <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={materialsEnabled}
                  onChange={e => setMaterialsEnabled(e.target.checked)}
                />
                Ploeg registreert gebruikte materialen op deze dienst
              </label>
            )}

            {/* Save as Template Checkbox */}
            {scheduleType !== 'leave' && (
              <div className="pt-2 border-t">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={e => setSaveAsTemplate(e.target.checked)}
                  />
                  <Save className="h-4 w-4 text-muted-foreground" />
                  Opslaan als sjabloon voor toekomstig gebruik
                </label>
                {saveAsTemplate && (
                  <Input
                    placeholder="Sjabloonnaam..."
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    className="mt-2 text-xs"
                  />
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Dienst inplannen
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4 h-[min(648px,70vh)] overflow-y-auto pr-1">
          {!projectId ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Selecteer eerst een project om taken te koppelen</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 pb-2 border-b">
                <Popover open={taskPopoverOpen} onOpenChange={setTaskPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Bestaande projecttaak toevoegen
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-3" align="start">
                    <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">
                      Beschikbare projecttaken
                    </h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {projectTasks.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Geen projecttaken gevonden</p>
                      ) : (
                        projectTasks.map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => addTask(t)}
                            className="w-full text-left p-2 rounded hover:bg-muted text-xs flex items-center justify-between"
                          >
                            <span className="truncate">{t.title}</span>
                            {t.priority && t.priority !== 'normal' && (
                              <Badge variant="secondary" className="text-[10px]">
                                {t.priority}
                              </Badge>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                <div className="flex gap-2">
                  <Input
                    placeholder="Snel nieuwe taak aanmaken..."
                    value={quickTaskTitle}
                    onChange={e => setQuickTaskTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleQuickCreateTask())}
                    className="text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleQuickCreateTask}
                    disabled={!quickTaskTitle.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {selectedTasks.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">Geen taken geselecteerd om te koppelen</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedTasks.map(st => (
                    <div
                      key={st.task.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card text-xs"
                    >
                      <span className="font-medium">{st.task.title}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-500"
                        onClick={() => removeSelectedTask(st.task.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Attachments Tab */}
        <TabsContent value="attachments" className="space-y-4 h-[min(648px,70vh)] overflow-y-auto pr-1">
          <div className="flex gap-2 pb-2 border-b">
            <div className="relative">
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button type="button" variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-1.5" />
                Bestand uploaden
              </Button>
            </div>

            {projectAttachments.length > 0 && (
              <Popover open={attachmentPopoverOpen} onOpenChange={setAttachmentPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FolderOpen className="h-4 w-4 mr-1.5" />
                    Uit project
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3" align="start">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Projectbestanden
                  </h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {projectAttachments.map(pa => (
                      <button
                        key={pa.id}
                        type="button"
                        onClick={() => addProjectAttachment(pa)}
                        className="w-full text-left p-2 rounded hover:bg-muted text-xs flex items-center justify-between"
                      >
                        <span className="truncate">{pa.file_name}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {pendingAttachments.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Geen bijlagen in de wachtrij om te uploaden</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingAttachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{att.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {att.type === 'file' ? 'Upload' : 'Project'}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-500"
                    onClick={() => removeAttachment(idx)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </DialogContent>
  );

  return (
    <>
      {/* Inline Create Project Modal */}
      <InlineCreateProjectModal
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        onCreateProject={onCreateProject}
        onProjectCreated={newProjectId => setProjectId(newProjectId)}
      />

      {/* When in uncontrolled mode, render trigger buttons */}
      {!isControlled ? (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setProjectDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Project
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Dienst inplannen
              </Button>
            </DialogTrigger>
            {dialogContent}
          </Dialog>
        </div>
      ) : (
        /* Controlled mode */
        <Dialog open={open} onOpenChange={setOpen}>
          {dialogContent}
        </Dialog>
      )}
    </>
  );
}
