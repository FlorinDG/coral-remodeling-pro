// @ts-nocheck
"use client";
// @ts-nocheck — Legacy Supabase component, progressive migration to camelCase
import { useState, useEffect } from 'react';
import { Plus, Loader2, Repeat, Save, FileText, Paperclip, X, Upload, FolderOpen, CheckSquare, Circle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Input } from '@/components/time-tracker/components/ui/input';
import { Label } from '@/components/time-tracker/components/ui/label';
import { Textarea } from '@/components/time-tracker/components/ui/textarea';
import { Checkbox } from '@/components/time-tracker/components/ui/checkbox';
import { Badge } from '@/components/time-tracker/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/time-tracker/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/time-tracker/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/time-tracker/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/time-tracker/components/ui/popover';
import { Project, NOTION_COLORS } from '@/components/time-tracker/hooks/useScheduledShifts';
import { useTasks, Task } from '@/components/time-tracker/hooks/useTasks';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { toast } from 'sonner';

interface WorkerOption {
  id: string;
  full_name: string;
}

interface ShiftTemplate {
  id: string;
  name: string;
  shift_start: string;
  shift_end: string;
  project_id: string | null;
  role: string | null;
  notes: string | null;
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

interface CreateShiftFormProps {
  projects: Project[];
  workers: WorkerOption[];
  onCreateShift: (shift: {
    user_id: string;
    project_id?: string | null;
    shift_date: string;
    shift_start: string;
    shift_end: string;
    role?: string | null;
    notes?: string | null;
  }) => Promise<{ id: string } | unknown>;
  onCreateProject: (name: string, address: string | null, color: string) => Promise<unknown>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  prefilledUserId?: string;
  prefilledDate?: string;
  onClose?: () => void;
}

const ROLE_OPTIONS = ['Crew', 'Lead', 'Supervisor', 'Driver', 'Helper'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getNotionColor(colorName: string) {
  return NOTION_COLORS.find(c => c.name === colorName) || NOTION_COLORS[6];
}

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

  // Support both controlled and uncontrolled modes
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
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

  // Shift form state
  const [userIds, setUserIds] = useState<string[]>([]);
  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [shiftDate, setShiftDate] = useState('');
  const [shiftStart, setShiftStart] = useState('08:00');
  const [shiftEnd, setShiftEnd] = useState('17:00');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');

  // Recurring options
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringWeeks, setRecurringWeeks] = useState(4);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  // Template options
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Schedule type (single or recurring)
  const [scheduleType, setScheduleType] = useState<'single' | 'recurring'>('single');

  // Attachments
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [projectAttachments, setProjectAttachments] = useState<ProjectAttachment[]>([]);
  const [attachmentPopoverOpen, setAttachmentPopoverOpen] = useState(false);

  // Tasks
  const [selectedTasks, setSelectedTasks] = useState<SelectedTask[]>([]);
  const [taskPopoverOpen, setTaskPopoverOpen] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const { tasks: projectTasks, createTask, refetch: refetchTasks } = useTasks(projectId || null);

  // New project form state
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectAddress, setNewProjectAddress] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('blue');

  // Apply prefilled values when dialog opens
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
  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase
        .from('shift_templates')
        .select('*')
        .order('name');

      if (data) {
        setTemplates(data);
      }
    };

    fetchTemplates();
  }, [open]);

  // Fetch project attachments when project changes
  useEffect(() => {
    const fetchProjectAttachments = async () => {
      if (!projectId) {
        setProjectAttachments([]);
        return;
      }

      const { data } = await supabase
        .from('project_attachments')
        .select('id, project_id, file_name, file_path, file_type, file_size')
        .eq('project_id', projectId);

      setProjectAttachments(data || []);
    };

    fetchProjectAttachments();
  }, [projectId]);

  const resetForm = () => {
    setUserIds([]);
    setProjectId('');
    setShiftDate('');
    setShiftStart('08:00');
    setShiftEnd('17:00');
    setRole('');
    setNotes('');
    setIsRecurring(false);
    setRecurringWeeks(4);
    setSelectedDays([]);
    setSelectedTemplateId('');
    setSaveAsTemplate(false);
    setTemplateName('');
    setPendingAttachments([]);
    setProjectAttachments([]);
    setSelectedTasks([]);
    setQuickTaskTitle('');
    setScheduleType('single');
    setActiveTab('details');
  };

  const addTask = (task: Task) => {
    if (selectedTasks.some(st => st.task.id === task.id)) {
      toast.error('Task already added');
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
      const newTask = await createTask({
        project_id: projectId,
        title: quickTaskTitle.trim(),
      });
      if (newTask) {
        setSelectedTasks(prev => [...prev, { task: newTask as Task, isNew: true }]);
        setQuickTaskTitle('');
        await refetchTasks();
        toast.success('Task created and added');
      }
    } catch {
      toast.error('Failed to create task');
    }
  };

  const assignTasksToShift = async (shiftId: string) => {
    for (const st of selectedTasks) {
      await supabase
        .from('shift_tasks')
        .insert({
          shift_id: shiftId,
          task_id: st.task.id,
        });
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setShiftStart(template.shift_start);
      setShiftEnd(template.shift_end);
      setProjectId(template.project_id || '');
      setRole(template.role || '');
      setNotes(template.notes || '');
    }
    setSelectedTemplateId(templateId);
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
    // Check if already added
    if (pendingAttachments.some(p => p.projectAttachment?.id === attachment.id)) {
      toast.error('File already added');
      return;
    }
    setPendingAttachments(prev => [...prev, {
      type: 'project',
      projectAttachment: attachment,
      name: attachment.file_name,
    }]);
    setAttachmentPopoverOpen(false);
  };

  const removeAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachmentsForShift = async (shiftId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    for (const attachment of pendingAttachments) {
      if (attachment.type === 'file' && attachment.file) {
        const filePath = `schedules/${shiftId}/${Date.now()}-${attachment.file.name}`;

        await supabase.storage
          .from('project-files')
          .upload(filePath, attachment.file);

        await supabase
          .from('schedule_attachments')
          .insert({
            shift_id: shiftId,
            file_name: attachment.file.name,
            file_path: filePath,
            file_type: attachment.file.type || 'application/octet-stream',
            file_size: attachment.file.size,
            uploaded_by: user.id,
          });
      } else if (attachment.type === 'project' && attachment.projectAttachment) {
        await supabase
          .from('schedule_attachments')
          .insert({
            shift_id: shiftId,
            file_name: attachment.projectAttachment.file_name,
            file_path: attachment.projectAttachment.file_path,
            file_type: attachment.projectAttachment.file_type,
            file_size: attachment.projectAttachment.file_size,
            uploaded_by: user.id,
            source_project_id: attachment.projectAttachment.project_id,
          });
      }
    }
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (userIds.length === 0) {
      toast.error('Please select at least one employee');
      return;
    }

    const useRecurring = scheduleType === 'recurring';

    if (!useRecurring && !shiftDate) {
      toast.error('Please select a date');
      return;
    }

    if (useRecurring && selectedDays.length === 0) {
      toast.error('Please select at least one day for recurring shifts');
      return;
    }

    setLoading(true);
    try {
      // Save as template if requested
      if (saveAsTemplate && templateName) {
        await supabase.from('shift_templates').insert({
          name: templateName,
          shift_start: shiftStart,
          shift_end: shiftEnd,
          project_id: projectId || null,
          role: role || null,
          notes: notes || null,
        });
      }

      if (useRecurring) {
        // Generate dates for recurring shifts
        const startDate = new Date(shiftDate || new Date().toISOString().split('T')[0]);
        const shiftsToCreate: Array<{
          user_id: string;
          project_id: string | null;
          shift_date: string;
          shift_start: string;
          shift_end: string;
          role: string | null;
          notes: string | null;
        }> = [];

        for (let week = 0; week < recurringWeeks; week++) {
          for (const dayOfWeek of selectedDays) {
            const date = new Date(startDate);
            const currentDay = date.getDay();
            let daysToAdd = dayOfWeek - currentDay;
            if (daysToAdd < 0) daysToAdd += 7;
            date.setDate(date.getDate() + daysToAdd + (week * 7));

            for (const uid of userIds) {
              shiftsToCreate.push({
                user_id: uid,
                project_id: projectId || null,
                shift_date: date.toISOString().split('T')[0],
                shift_start: shiftStart,
                shift_end: shiftEnd,
                role: role || null,
                notes: notes || null,
              });
            }
          }
        }

        for (const shift of shiftsToCreate) {
          const result = await onCreateShift(shift);
          if (pendingAttachments.length > 0 && result && typeof result === 'object' && 'id' in result) {
            await uploadAttachmentsForShift((result as { id: string }).id);
          }
          if (selectedTasks.length > 0 && result && typeof result === 'object' && 'id' in result) {
            await assignTasksToShift((result as { id: string }).id);
          }
        }

        toast.success(`Created ${shiftsToCreate.length} recurring shifts across ${userIds.length} employee(s)`);
      } else {
        for (const uid of userIds) {
          const result = await onCreateShift({
            user_id: uid,
            project_id: projectId || null,
            shift_date: shiftDate,
            shift_start: shiftStart,
            shift_end: shiftEnd,
            role: role || null,
            notes: notes || null,
          });

          if (pendingAttachments.length > 0 && result && typeof result === 'object' && 'id' in result) {
            await uploadAttachmentsForShift((result as { id: string }).id);
          }

          if (selectedTasks.length > 0 && result && typeof result === 'object' && 'id' in result) {
            await assignTasksToShift((result as { id: string }).id);
          }
        }

        toast.success(`Created shift for ${userIds.length} employee(s) successfully`);
      }

      resetForm();
      setOpen(false);
    } catch (error) {
      toast.error('Failed to create shift');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newProjectName) {
      toast.error('Please enter a project name');
      return;
    }

    setLoading(true);
    try {
      await onCreateProject(newProjectName, newProjectAddress || null, newProjectColor);
      toast.success('Project created successfully');
      setNewProjectName('');
      setNewProjectAddress('');
      setNewProjectColor('blue');
      setProjectDialogOpen(false);
    } catch (error) {
      toast.error('Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const { error } = await supabase
      .from('shift_templates')
      .delete()
      .eq('id', templateId);

    if (!error) {
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      toast.success('Template deleted');
    }
  };

  // If controlled mode (open is externally controlled), don't render triggers
  const isControlled = controlledOpen !== undefined;

  return (
    <>
      {/* Only show buttons when in uncontrolled mode */}
      {!isControlled && (
        <div className="flex gap-2">
          {/* Create Project Dialog */}
          <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <Label htmlFor="projectName">Project Name</Label>
                  <Input
                    id="projectName"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g., Downtown Office Renovation"
                  />
                </div>

                <div>
                  <Label htmlFor="projectAddress">Address</Label>
                  <Input
                    id="projectAddress"
                    value={newProjectAddress}
                    onChange={(e) => setNewProjectAddress(e.target.value)}
                    placeholder="e.g., 123 Main St, City"
                  />
                </div>

                <div>
                  <Label>Color</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {NOTION_COLORS.map(color => (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => setNewProjectColor(color.name)}
                        className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                        style={{
                          backgroundColor: color.bg,
                          borderColor: newProjectColor === color.name ? color.value : 'transparent'
                        }}
                      />
                    ))}
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Project
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Create Shift Dialog Trigger */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Schedule Shift
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Schedule New Shift</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit}>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="tasks" className="flex items-center gap-1">
                      <CheckSquare className="h-3 w-3" />
                      Tasks
                      {selectedTasks.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">
                          {selectedTasks.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="attachments" className="flex items-center gap-1">
                      <Paperclip className="h-3 w-3" />
                      Files
                      {pendingAttachments.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">
                          {pendingAttachments.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  {/* Details Tab */}
                  <TabsContent value="details" className="space-y-4 mt-4">
                    {/* Single / Recurring toggle */}
                    <div className="flex border rounded-md overflow-hidden">
                      <button
                        type="button"
                        className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${scheduleType === 'single'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                          }`}
                        onClick={() => setScheduleType('single')}
                      >
                        Single Shift
                      </button>
                      <button
                        type="button"
                        className={`flex-1 px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1 ${scheduleType === 'recurring'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                          }`}
                        onClick={() => setScheduleType('recurring')}
                      >
                        <Repeat className="h-4 w-4" />
                        Recurring
                      </button>
                    </div>

                    {/* Templates */}
                    {templates.length > 0 && (
                      <div>
                        <Label className="flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          Use Template
                        </Label>
                        <Select value={selectedTemplateId} onValueChange={applyTemplate}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a template (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.map(template => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <Label>Employees *</Label>
                      <Popover open={employeePopoverOpen} onOpenChange={setEmployeePopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-between font-normal bg-card">
                            {userIds.length === 0
                              ? "Select employees"
                              : userIds.length === 1
                                ? workers.find(w => w.id === userIds[0])?.full_name
                                : `${userIds.length} employees selected`}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full min-w-[300px] p-4 max-h-[300px] overflow-y-auto" align="start">
                          <div className="space-y-3">
                            {workers.map(worker => (
                              <div key={worker.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`worker-${worker.id}`}
                                  checked={userIds.includes(worker.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setUserIds(prev => [...prev, worker.id]);
                                    } else {
                                      setUserIds(prev => prev.filter(id => id !== worker.id));
                                    }
                                  }}
                                />
                                <Label htmlFor={`worker-${worker.id}`} className="font-normal cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  {worker.full_name}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div>
                      <Label>Project</Label>
                      <Select value={projectId} onValueChange={setProjectId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map(project => {
                            const color = getNotionColor(project.color);
                            return (
                              <SelectItem key={project.id} value={project.id}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: color.value }}
                                  />
                                  {project.name}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {scheduleType === 'single' && (
                      <div>
                        <Label htmlFor="shiftDate">Date *</Label>
                        <Input
                          id="shiftDate"
                          type="date"
                          value={shiftDate}
                          onChange={(e) => setShiftDate(e.target.value)}
                        />
                      </div>
                    )}

                    {scheduleType === 'recurring' && (
                      <>
                        <div>
                          <Label htmlFor="startDate">Starting From</Label>
                          <Input
                            id="startDate"
                            type="date"
                            value={shiftDate}
                            onChange={(e) => setShiftDate(e.target.value)}
                          />
                        </div>

                        <div>
                          <Label>Repeat on Days *</Label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {DAY_NAMES.map((day, index) => (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleDay(index)}
                                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${selectedDays.includes(index)
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-background border-border hover:bg-muted'
                                  }`}
                              >
                                {day.slice(0, 3)}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="recurringWeeks">Repeat for (weeks)</Label>
                          <Select
                            value={recurringWeeks.toString()}
                            onValueChange={(v) => setRecurringWeeks(parseInt(v))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 6, 8, 12].map(w => (
                                <SelectItem key={w} value={w.toString()}>
                                  {w} week{w > 1 ? 's' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="shiftStart">Start Time</Label>
                        <Input
                          id="shiftStart"
                          type="time"
                          value={shiftStart}
                          onChange={(e) => setShiftStart(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="shiftEnd">End Time</Label>
                        <Input
                          id="shiftEnd"
                          type="time"
                          value={shiftEnd}
                          onChange={(e) => setShiftEnd(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Role</Label>
                      <Select value={role} onValueChange={setRole}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any additional notes..."
                        rows={2}
                      />
                    </div>

                    {/* Save as template option */}
                    <div className="border-t pt-4 space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="saveAsTemplate"
                          checked={saveAsTemplate}
                          onCheckedChange={(checked) => setSaveAsTemplate(checked as boolean)}
                        />
                        <Label htmlFor="saveAsTemplate" className="flex items-center gap-1 cursor-pointer">
                          <Save className="h-4 w-4" />
                          Save as template
                        </Label>
                      </div>

                      {saveAsTemplate && (
                        <Input
                          placeholder="Template name"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                        />
                      )}
                    </div>
                  </TabsContent>

                  {/* Tasks Tab */}
                  <TabsContent value="tasks" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-1 text-base">
                        <CheckSquare className="h-4 w-4" />
                        Assigned Tasks
                      </Label>
                      {projectId && (
                        <Popover open={taskPopoverOpen} onOpenChange={setTaskPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" size="sm">
                              <Plus className="h-4 w-4 mr-1" />
                              Add Task
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-2">
                            <div className="text-sm font-medium mb-2">Project Tasks</div>
                            {projectTasks.filter(t => t.status !== 'completed').length > 0 ? (
                              <div className="space-y-1 max-h-48 overflow-y-auto">
                                {projectTasks.filter(t => t.status !== 'completed').map(task => (
                                  <button
                                    key={task.id}
                                    type="button"
                                    onClick={() => addTask(task)}
                                    disabled={selectedTasks.some(st => st.task.id === task.id)}
                                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded flex items-center gap-2 disabled:opacity-50"
                                  >
                                    {selectedTasks.some(st => st.task.id === task.id) ? (
                                      <CheckCircle2 className="h-3 w-3 text-primary" />
                                    ) : (
                                      <Circle className="h-3 w-3 text-muted-foreground" />
                                    )}
                                    <span className="truncate">{task.title}</span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground py-2">No pending tasks in this project</p>
                            )}
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>

                    {!projectId && (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Select a project in the Details tab to add tasks</p>
                      </div>
                    )}

                    {/* Quick create task */}
                    {projectId && (
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Quick create new task</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Enter task title..."
                            value={quickTaskTitle}
                            onChange={(e) => setQuickTaskTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleQuickCreateTask())}
                          />
                          <Button type="button" variant="outline" size="sm" onClick={handleQuickCreateTask} disabled={!quickTaskTitle.trim()}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {selectedTasks.length > 0 ? (
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Selected tasks ({selectedTasks.length})</Label>
                        <div className="space-y-2">
                          {selectedTasks.map((st) => (
                            <div key={st.task.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                              <div className="flex items-center gap-2">
                                <CheckSquare className="h-4 w-4 text-primary" />
                                <span className="text-sm">{st.task.title}</span>
                                {st.isNew && <Badge variant="outline" className="text-xs text-primary">new</Badge>}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeSelectedTask(st.task.id)}
                                className="hover:text-destructive p-1"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : projectId ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No tasks selected. Add existing tasks or create new ones above.
                      </div>
                    ) : null}
                  </TabsContent>

                  {/* Attachments Tab */}
                  <TabsContent value="attachments" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-1 text-base">
                        <Paperclip className="h-4 w-4" />
                        Attachments
                      </Label>
                      <div className="flex gap-2">
                        {projectId && projectAttachments.length > 0 && (
                          <Popover open={attachmentPopoverOpen} onOpenChange={setAttachmentPopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button type="button" variant="outline" size="sm">
                                <FolderOpen className="h-4 w-4 mr-1" />
                                From Project
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-2">
                              <div className="text-sm font-medium mb-2">Project Files</div>
                              <div className="space-y-1 max-h-48 overflow-y-auto">
                                {projectAttachments.map(att => (
                                  <button
                                    key={att.id}
                                    type="button"
                                    onClick={() => addProjectAttachment(att)}
                                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded truncate"
                                  >
                                    {att.file_name}
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                        <Input
                          type="file"
                          multiple
                          onChange={handleFileSelect}
                          className="hidden"
                          id="shift-file-upload"
                        />
                        <Button type="button" variant="outline" size="sm" asChild>
                          <label htmlFor="shift-file-upload" className="cursor-pointer">
                            <Upload className="h-4 w-4 mr-1" />
                            Upload
                          </label>
                        </Button>
                      </div>
                    </div>

                    {pendingAttachments.length > 0 ? (
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Files to attach ({pendingAttachments.length})</Label>
                        <div className="space-y-2">
                          {pendingAttachments.map((att, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                              <div className="flex items-center gap-2">
                                {att.type === 'project' ? (
                                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="text-sm truncate max-w-[200px]">{att.name}</span>
                                {att.type === 'project' && (
                                  <Badge variant="outline" className="text-xs">from project</Badge>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeAttachment(index)}
                                className="hover:text-destructive p-1"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Paperclip className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No attachments added yet</p>
                        <p className="text-xs mt-1">Upload files or select from project files</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Shift
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Controlled mode - dialog without trigger */}
      {isControlled && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Schedule New Shift</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="tasks" className="flex items-center gap-1">
                    <CheckSquare className="h-3 w-3" />
                    Tasks
                    {selectedTasks.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">
                        {selectedTasks.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="attachments" className="flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    Files
                    {pendingAttachments.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">
                        {pendingAttachments.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Details Tab */}
                <TabsContent value="details" className="space-y-4 mt-4">
                  {/* Single / Recurring toggle */}
                  <div className="flex border rounded-md overflow-hidden">
                    <button
                      type="button"
                      className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${scheduleType === 'single'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                        }`}
                      onClick={() => setScheduleType('single')}
                    >
                      Single Shift
                    </button>
                    <button
                      type="button"
                      className={`flex-1 px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1 ${scheduleType === 'recurring'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                        }`}
                      onClick={() => setScheduleType('recurring')}
                    >
                      <Repeat className="h-4 w-4" />
                      Recurring
                    </button>
                  </div>

                  {/* Templates */}
                  {templates.length > 0 && (
                    <div>
                      <Label className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        Use Template
                      </Label>
                      <Select value={selectedTemplateId} onValueChange={applyTemplate}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map(template => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <Label>Employees *</Label>
                    <Popover open={employeePopoverOpen} onOpenChange={setEmployeePopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal bg-card">
                          {userIds.length === 0
                            ? "Select employees"
                            : userIds.length === 1
                              ? workers.find(w => w.id === userIds[0])?.full_name
                              : `${userIds.length} employees selected`}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full min-w-[300px] p-4 max-h-[300px] overflow-y-auto" align="start">
                        <div className="space-y-3">
                          {workers.map(worker => (
                            <div key={worker.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`worker-controlled-${worker.id}`}
                                checked={userIds.includes(worker.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setUserIds(prev => [...prev, worker.id]);
                                  } else {
                                    setUserIds(prev => prev.filter(id => id !== worker.id));
                                  }
                                }}
                              />
                              <Label htmlFor={`worker-controlled-${worker.id}`} className="font-normal cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {worker.full_name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label>Project</Label>
                    <Select value={projectId} onValueChange={setProjectId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map(project => {
                          const color = getNotionColor(project.color);
                          return (
                            <SelectItem key={project.id} value={project.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: color.value }}
                                />
                                {project.name}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {scheduleType === 'single' && (
                    <div>
                      <Label htmlFor="shiftDate2">Date *</Label>
                      <Input
                        id="shiftDate2"
                        type="date"
                        value={shiftDate}
                        onChange={(e) => setShiftDate(e.target.value)}
                      />
                    </div>
                  )}

                  {scheduleType === 'recurring' && (
                    <>
                      <div>
                        <Label htmlFor="startDate2">Starting From</Label>
                        <Input
                          id="startDate2"
                          type="date"
                          value={shiftDate}
                          onChange={(e) => setShiftDate(e.target.value)}
                        />
                      </div>

                      <div>
                        <Label>Repeat on Days *</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {DAY_NAMES.map((day, index) => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleDay(index)}
                              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${selectedDays.includes(index)
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background border-border hover:bg-muted'
                                }`}
                            >
                              {day.slice(0, 3)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="recurringWeeks2">Repeat for (weeks)</Label>
                        <Select
                          value={recurringWeeks.toString()}
                          onValueChange={(v) => setRecurringWeeks(parseInt(v))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 6, 8, 12].map(w => (
                              <SelectItem key={w} value={w.toString()}>
                                {w} week{w > 1 ? 's' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="shiftStart2">Start Time</Label>
                      <Input
                        id="shiftStart2"
                        type="time"
                        value={shiftStart}
                        onChange={(e) => setShiftStart(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="shiftEnd2">End Time</Label>
                      <Input
                        id="shiftEnd2"
                        type="time"
                        value={shiftEnd}
                        onChange={(e) => setShiftEnd(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Role</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="notes2">Notes</Label>
                    <Textarea
                      id="notes2"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any additional notes..."
                      rows={2}
                    />
                  </div>

                  {/* Save as template option */}
                  <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="saveAsTemplate2"
                        checked={saveAsTemplate}
                        onCheckedChange={(checked) => setSaveAsTemplate(checked as boolean)}
                      />
                      <Label htmlFor="saveAsTemplate2" className="flex items-center gap-1 cursor-pointer">
                        <Save className="h-4 w-4" />
                        Save as template
                      </Label>
                    </div>

                    {saveAsTemplate && (
                      <Input
                        placeholder="Template name"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                      />
                    )}
                  </div>
                </TabsContent>

                {/* Tasks Tab */}
                <TabsContent value="tasks" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1 text-base">
                      <CheckSquare className="h-4 w-4" />
                      Assigned Tasks
                    </Label>
                    {projectId && (
                      <Popover open={taskPopoverOpen} onOpenChange={setTaskPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" size="sm">
                            <Plus className="h-4 w-4 mr-1" />
                            Add Task
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2">
                          <div className="text-sm font-medium mb-2">Project Tasks</div>
                          {projectTasks.filter(t => t.status !== 'completed').length > 0 ? (
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {projectTasks.filter(t => t.status !== 'completed').map(task => (
                                <button
                                  key={task.id}
                                  type="button"
                                  onClick={() => addTask(task)}
                                  disabled={selectedTasks.some(st => st.task.id === task.id)}
                                  className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded flex items-center gap-2 disabled:opacity-50"
                                >
                                  {selectedTasks.some(st => st.task.id === task.id) ? (
                                    <CheckCircle2 className="h-3 w-3 text-primary" />
                                  ) : (
                                    <Circle className="h-3 w-3 text-muted-foreground" />
                                  )}
                                  <span className="truncate">{task.title}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground py-2">No pending tasks in this project</p>
                          )}
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>

                  {!projectId && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Select a project in the Details tab to add tasks</p>
                    </div>
                  )}

                  {/* Quick create task */}
                  {projectId && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Quick create new task</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter task title..."
                          value={quickTaskTitle}
                          onChange={(e) => setQuickTaskTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleQuickCreateTask())}
                        />
                        <Button type="button" variant="outline" size="sm" onClick={handleQuickCreateTask} disabled={!quickTaskTitle.trim()}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {selectedTasks.length > 0 ? (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Selected tasks ({selectedTasks.length})</Label>
                      <div className="space-y-2">
                        {selectedTasks.map((st) => (
                          <div key={st.task.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                            <div className="flex items-center gap-2">
                              <CheckSquare className="h-4 w-4 text-primary" />
                              <span className="text-sm">{st.task.title}</span>
                              {st.isNew && <Badge variant="outline" className="text-xs text-primary">new</Badge>}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeSelectedTask(st.task.id)}
                              className="hover:text-destructive p-1"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : projectId ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No tasks selected. Add existing tasks or create new ones above.
                    </div>
                  ) : null}
                </TabsContent>

                {/* Attachments Tab */}
                <TabsContent value="attachments" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1 text-base">
                      <Paperclip className="h-4 w-4" />
                      Attachments
                    </Label>
                    <div className="flex gap-2">
                      {projectId && projectAttachments.length > 0 && (
                        <Popover open={attachmentPopoverOpen} onOpenChange={setAttachmentPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" size="sm">
                              <FolderOpen className="h-4 w-4 mr-1" />
                              From Project
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-2">
                            <div className="text-sm font-medium mb-2">Project Files</div>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {projectAttachments.map(att => (
                                <button
                                  key={att.id}
                                  type="button"
                                  onClick={() => addProjectAttachment(att)}
                                  className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded truncate"
                                >
                                  {att.file_name}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                      <Input
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        id="shift-file-upload-controlled"
                      />
                      <Button type="button" variant="outline" size="sm" asChild>
                        <label htmlFor="shift-file-upload-controlled" className="cursor-pointer">
                          <Upload className="h-4 w-4 mr-1" />
                          Upload
                        </label>
                      </Button>
                    </div>
                  </div>

                  {pendingAttachments.length > 0 ? (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Files to attach ({pendingAttachments.length})</Label>
                      <div className="space-y-2">
                        {pendingAttachments.map((att, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                            <div className="flex items-center gap-2">
                              {att.type === 'project' ? (
                                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Paperclip className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-sm truncate max-w-[200px]">{att.name}</span>
                              {att.type === 'project' && (
                                <Badge variant="outline" className="text-xs">from project</Badge>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAttachment(index)}
                              className="hover:text-destructive p-1"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Paperclip className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No attachments added yet</p>
                      <p className="text-xs mt-1">Upload files or select from project files</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Shift
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
