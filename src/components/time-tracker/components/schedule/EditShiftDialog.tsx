// @ts-nocheck
"use client";
// @ts-nocheck — Legacy component, progressive migration to camelCase
import { useState, useEffect, useCallback } from 'react';
import { Loader2, Trash2, Paperclip, Upload, FolderOpen, X, FileText, Image, Download, ListTodo, Plus, Check, Trash, Calendar as CalendarIcon } from 'lucide-react';
import { useTasks, useShiftTasks, Task } from '@/components/time-tracker/hooks/useTasks';
import { AttachmentLink, AttachmentImage } from '@/components/ui/attachment-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/components/time-tracker/lib/utils';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { ScheduledShift, Project, NOTION_COLORS } from '@/components/time-tracker/hooks/useScheduledShifts';
import { useScheduleAttachments, ProjectAttachment, ScheduleAttachment } from '@/components/time-tracker/hooks/useScheduleAttachments';
import { ScopePicker, EditScope } from '@/components/ui/ScopePicker';
import { hrList, hrCreate, hrUpdate, hrDelete } from '@/components/time-tracker/lib/hr-api';
import { toast } from 'sonner';
import { listRecordFiles } from '@/app/actions/files';

interface ProjectAttachment {
  id: string;
  project_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number | null;
}

interface WorkerOption {
  id: string;
  full_name: string;
}

interface EditShiftDialogProps {
  shift: ScheduledShift | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  workers: WorkerOption[];
  onUpdateShift: (shiftId: string, updates: {
    user_id?: string;
    shift_date?: string;
    shift_start?: string;
    shift_end?: string;
    project_id?: string | null;
    role?: string | null;
    notes?: string | null;
    seriesId?: string;
  }, scope?: EditScope) => Promise<void>;
  onCreateShift?: (shift: any) => Promise<any>;
  onDeleteShift: (shiftId: string, scope?: EditScope) => Promise<void>;
  onStatusChange: (shiftId: string, status: string) => Promise<void>;
  canManage?: boolean;
}

const ROLE_OPTIONS = ['Crew', 'Lead', 'Supervisor', 'Driver', 'Helper'];
const STATUS_OPTIONS = ['Scheduled', 'Active', 'In Progress', 'Completed', 'Cancelled'];

function getNotionColor(colorName: string) {
  return NOTION_COLORS.find(c => c.name === colorName) || NOTION_COLORS[6];
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return Image;
  return FileText;
}

const getParsedDate = (dateStr: string) => {
  if (!dateStr) return undefined;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatDateStr = (date: Date | undefined) => {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
  canManage,
}: EditShiftDialogProps) {
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [shiftDate, setShiftDate] = useState('');
  const [shiftStart, setShiftStart] = useState('');
  const [shiftEnd, setShiftEnd] = useState('');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [editScope, setEditScope] = useState<EditScope>('occurrence');
  const [isConvertingToRecurring, setIsConvertingToRecurring] = useState(false);
  const [recurringWeeks, setRecurringWeeks] = useState(4);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  
  // Attachments
  const { 
    attachments, 
    loading: attachmentsLoading, 
    fetchAttachments, 
    uploadFile, 
    addFromProject, 
    deleteAttachment, 
    setAttachments 
  } = useScheduleAttachments(shift?.id || null);
  const [projectAttachments, setProjectAttachments] = useState<ProjectAttachment[]>([]);
  const [attachmentPopoverOpen, setAttachmentPopoverOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Tasks
  const { tasks: projectTasks, loading: tasksLoading, createTask } = useTasks(projectId || shift?.project_id || null);
  const { shiftTasks, loading: shiftTasksLoading, assignTask, removeTask, completeShiftTask, refetch: refetchShiftTasks } = useShiftTasks(shift?.id || null);
  const [taskPopoverOpen, setTaskPopoverOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('normal');
  const [creatingTask, setCreatingTask] = useState(false);

  // Populate form when shift changes
  useEffect(() => {
    if (shift) {
      setUserId(shift.user_id);
      setProjectId(shift.project_id || '');
      setShiftDate(shift.shift_date);
      setShiftStart(shift.shift_start);
      setShiftEnd(shift.shift_end);
      setRole(shift.role || '');
      setNotes(shift.notes || '');
      setStatus(shift.status);
      setEditScope('occurrence');
      setActiveTab('details');
    }
  }, [shift]);

  // Fetch attachments when shift changes
  useEffect(() => {
    if (shift?.id && open) {
      fetchAttachments();
    }
  }, [shift?.id, open, fetchAttachments]);

  // Fetch project attachments when project changes
  useEffect(() => {
    const fetchProjectAttachments = async () => {
      const pid = projectId || shift?.project_id;
      if (!pid) {
        setProjectAttachments([]);
        return;
      }
      
      try {
        const files = await listRecordFiles('project', pid);
        setProjectAttachments(files.map(f => ({
          id: f.id,
          project_id: pid,
          file_name: f.name,
          file_path: f.url,
          file_type: f.name.split('.').pop() || '',
          file_size: f.size,
        })));
      } catch (err) {
        console.error('Failed to fetch project attachments:', err);
        setProjectAttachments([]);
      }
    };
    
    if (open) {
      fetchProjectAttachments();
    }
  }, [projectId, shift?.project_id, open]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setUploadingFile(true);
    for (const file of files) {
      await uploadFile(file);
    }
    setUploadingFile(false);
    e.target.value = '';
  };

  const handleAddFromProject = async (attachment: ProjectAttachment) => {
    // Check if already added
    if (attachments.some(a => a.file_path === attachment.file_path)) {
      toast.error('File already attached');
      return;
    }
    
    await addFromProject({
      file_name: attachment.file_name,
      file_path: attachment.file_path,
      file_type: attachment.file_type,
      file_size: attachment.file_size,
      project_id: attachment.project_id,
    });
    setAttachmentPopoverOpen(false);
  };

  const handleDeleteAttachment = async (attachment: ScheduleAttachment) => {
    await deleteAttachment(attachment);
  };

  // Task handlers
  const handleAssignTask = async (taskId: string) => {
    try {
      await assignTask(taskId);
      setTaskPopoverOpen(false);
      toast.success('Task assigned to shift');
    } catch {
      toast.error('Failed to assign task');
    }
  };

  const handleRemoveTask = async (shiftTaskId: string) => {
    try {
      await removeTask(shiftTaskId);
      toast.success('Task removed from shift');
    } catch {
      toast.error('Failed to remove task');
    }
  };

  const handleCompleteTask = async (shiftTaskId: string) => {
    try {
      await completeShiftTask(shiftTaskId);
      toast.success('Task completed');
    } catch {
      toast.error('Failed to complete task');
    }
  };

  const handleQuickCreateTask = async () => {
    const pid = projectId || shift?.project_id;
    if (!pid || !newTaskTitle.trim()) return;
    
    setCreatingTask(true);
    try {
      const result = await createTask({
        project_id: pid,
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
      });
      if (result?.data?.id) {
        await assignTask(result.data.id);
        setNewTaskTitle('');
        setNewTaskPriority('normal');
        toast.success('Task created and assigned');
      } else {
        toast.error(result?.error || 'Failed to create task');
      }
    } catch {
      toast.error('Failed to create task');
    } finally {
      setCreatingTask(false);
    }
  };

  const availableTasks = projectTasks.filter(
    task => task.status !== 'completed' && !shiftTasks.some(st => st.task_id === task.id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shift) return;

    if (isConvertingToRecurring && selectedDays.length === 0) {
      toast.error('Select at least one day for recurring shifts');
      return;
    }

    setLoading(true);
    try {
      let seriesId = shift.seriesId;
      
      if (isConvertingToRecurring && onCreateShift) {
        seriesId = Math.random().toString(36).substring(2, 9);
        const startDate = new Date(shiftDate);
        const shiftsToCreate: Array<any> = [];

        for (let week = 0; week < recurringWeeks; week++) {
          for (const dayOfWeek of selectedDays) {
            const date = new Date(startDate);
            const currentDay = date.getDay();
            let daysToAdd = dayOfWeek - currentDay;
            if (daysToAdd < 0) daysToAdd += 7;
            date.setDate(date.getDate() + daysToAdd + (week * 7));
            
            const dateStr = date.toISOString().split('T')[0];
            // Don't create a duplicate of the exact same day
            if (dateStr === shiftDate) continue;

            shiftsToCreate.push({
              user_id: userId,
              project_id: projectId || null,
              shift_date: dateStr,
              shift_start: shiftStart,
              shift_end: shiftEnd,
              role: role || null,
              notes: notes || null,
              seriesId,
              status
            });
          }
        }

        for (const s of shiftsToCreate) {
          await onCreateShift(s);
        }
      }

      await onUpdateShift(shift.id, {
        user_id: userId,
        project_id: projectId || null,
        shift_date: shiftDate,
        shift_start: shiftStart,
        shift_end: shiftEnd,
        role: role || null,
        notes: notes || null,
        ...(seriesId ? { seriesId } : {})
      }, editScope);

      if (status !== shift.status) {
        await onStatusChange(shift.id, status);
      }

      toast.success(isConvertingToRecurring ? 'Shift converted to recurring' : 'Shift updated');
      onOpenChange(false);
    } catch {
      toast.error('Failed to update shift');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!shift) return;

    setLoading(true);
    try {
      await onDeleteShift(shift.id, editScope);
      toast.success('Shift deleted');
      onOpenChange(false);
    } catch {
      toast.error('Failed to delete shift');
    } finally {
      setLoading(false);
    }
  };

  if (!shift) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Shift</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-1">
              <ListTodo className="h-4 w-4" />
              Tasks
              {shiftTasks.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {shiftTasks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="attachments" className="flex items-center gap-1">
              <Paperclip className="h-4 w-4" />
              Files
              {attachments.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {attachments.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="h-[540px] overflow-y-auto pr-1">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Employee</Label>
                <SearchableSelect
                  options={workers.map(w => ({ value: w.id, label: w.full_name }))}
                  value={userId}
                  onChange={setUserId}
                  placeholder="Select employee"
                  disabled={!canManage}
                />
              </div>

              <div>
                <Label>Project</Label>
                <SearchableSelect
                  options={[
                    { value: '', label: '— No project —' },
                    ...projects.map(p => ({ value: p.id, label: p.name }))
                  ]}
                  value={projectId || ''}
                  onChange={setProjectId}
                  placeholder="Select project (optional)"
                  disabled={!canManage}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={!canManage}
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !shiftDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {shiftDate ? format(getParsedDate(shiftDate)!, 'PPP') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={getParsedDate(shiftDate)}
                      onSelect={(date) => setShiftDate(formatDateStr(date))}
                      initialFocus
                      disabled={!canManage}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editShiftStart">Start Time</Label>
                  <Input
                    id="editShiftStart"
                    type="time"
                    value={shiftStart}
                    onChange={(e) => setShiftStart(e.target.value)}
                    disabled={!canManage}
                  />
                </div>
                <div>
                  <Label htmlFor="editShiftEnd">End Time</Label>
                  <Input
                    id="editShiftEnd"
                    type="time"
                    value={shiftEnd}
                    onChange={(e) => setShiftEnd(e.target.value)}
                    disabled={!canManage}
                  />
                </div>
              </div>

              <div>
                <Label>Role</Label>
                <Select value={role || "none"} onValueChange={(v) => setRole(v === "none" ? "" : v)} disabled={!canManage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No role</SelectItem>
                    {ROLE_OPTIONS.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus} disabled={!canManage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="editNotes">Notes</Label>
                <Textarea
                  id="editNotes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={2}
                  disabled={!canManage}
                />
              </div>

              {canManage && !shift?.seriesId && !isConvertingToRecurring && (
                <div className="pt-4 border-t mt-6">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsConvertingToRecurring(true)} className="w-full">
                    <Repeat className="h-4 w-4 mr-2" /> Make Recurring
                  </Button>
                </div>
              )}
              {isConvertingToRecurring && (
                <div className="space-y-4 p-4 border rounded-md bg-muted/50 mt-6 relative">
                  <Button type="button" variant="ghost" size="sm" className="absolute top-2 right-2 h-6 w-6 p-0" onClick={() => setIsConvertingToRecurring(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                  <Label className="text-base font-semibold">Make Recurring</Label>
                  
                  <div>
                    <Label>Repeat for (weeks)</Label>
                    <Input type="number" min={1} max={52} value={recurringWeeks} onChange={e => setRecurringWeeks(parseInt(e.target.value) || 1)} className="mt-1" />
                  </div>
                  
                  <div>
                    <Label>Days of week</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
                        <Badge 
                          key={d} 
                          variant={selectedDays.includes(i) ? 'default' : 'outline'}
                          className="cursor-pointer px-3 py-1 text-sm"
                          onClick={() => setSelectedDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                        >
                          {d}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground italic">
                    Will generate {selectedDays.length * recurringWeeks} additional shifts.
                  </div>
                </div>
              )}

              {canManage && shift?.seriesId && (
                <div className="pt-4 border-t mt-6">
                  <ScopePicker 
                    value={editScope} 
                    onChange={setEditScope} 
                    seriesId={shift?.seriesId}
                    actionName="Apply changes to"
                  />
                </div>
              )}

              <DialogFooter className="hidden md:flex mt-6">
                {canManage && (
                  <Button type="button" variant="destructive" size="sm" onClick={() => {
                    if (window.confirm("Delete Shift?\nThis action cannot be undone. The shift will be permanently removed.")) {
                      handleDelete();
                    }
                  }}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                )}
                <Button type="submit" disabled={loading || !canManage}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4 h-[540px] overflow-y-auto pr-1">
            {!(projectId || shift?.project_id) ? (
              <div className="text-center py-8 text-muted-foreground">
                <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select a project to manage tasks</p>
              </div>
            ) : (
              <>
                {/* Add task buttons */}
                {canManage && (
                  <div className="flex gap-2">
                    <Popover open={taskPopoverOpen} onOpenChange={setTaskPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="hidden md:inline-flex">
                          <Plus className="h-4 w-4 mr-1" />
                          Add Task
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80" align="start">
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm">Available Tasks</h4>
                          {tasksLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-5 w-5 animate-spin" />
                            </div>
                          ) : availableTasks.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">No available tasks</p>
                          ) : (
                            <ScrollArea className="h-48">
                              <div className="space-y-1">
                                {availableTasks.map(task => (
                                  <button
                                    key={task.id}
                                    type="button"
                                    onClick={() => handleAssignTask(task.id)}
                                    className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted text-left text-sm"
                                  >
                                    <ListTodo className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                    <span className="truncate flex-1">{task.title}</span>
                                    {task.priority && task.priority !== 'normal' && (
                                      <Badge 
                                        variant={task.priority === 'high' ? 'destructive' : 'secondary'}
                                        className="text-xs"
                                      >
                                        {task.priority}
                                      </Badge>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </ScrollArea>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                    
                    {/* Quick create task form */}
                    {canManage && (
                      <div className="space-y-2 mt-4">
                        <Label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">Quick create new task</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Enter task title..."
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleQuickCreateTask())}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleQuickCreateTask}
                            disabled={!newTaskTitle.trim() || creatingTask}
                          >
                            {creatingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Assigned tasks list */}
                {shiftTasksLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : shiftTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No tasks assigned to this shift</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {shiftTasks.map(shiftTask => (
                      <div
                        key={shiftTask.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border bg-card ${
                          shiftTask.status === 'completed' ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${
                            shiftTask.status === 'completed' ? 'line-through text-muted-foreground' : ''
                          }`}>
                            {shiftTask.task?.title || 'Unknown task'}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {shiftTask.task?.priority && shiftTask.task.priority !== 'normal' && (
                              <Badge 
                                variant={shiftTask.task.priority === 'high' ? 'destructive' : 'secondary'}
                                className="text-xs"
                              >
                                {shiftTask.task.priority}
                              </Badge>
                            )}
                            {shiftTask.status === 'completed' && (
                              <Badge variant="outline" className="text-xs">Completed</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {shiftTask.status !== 'completed' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary hover:text-primary"
                              onClick={() => handleCompleteTask(shiftTask.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hidden md:flex"
                              onClick={() => handleRemoveTask(shiftTask.id)}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>
          
          <TabsContent value="attachments" className="space-y-4 h-[540px] overflow-y-auto pr-1">
            {/* Add attachment buttons */}
            {canManage && (
              <div className="flex gap-2">
                <div className="relative">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploadingFile}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="hidden md:inline-flex relative"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                  >
                    {uploadingFile ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-1" />
                    )}
                    Upload File
                  </Button>
                </div>
                
                {projectAttachments.length > 0 && (
                  <Popover open={attachmentPopoverOpen} onOpenChange={setAttachmentPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="hidden md:inline-flex">
                        <FolderOpen className="h-4 w-4 mr-1" />
                        From Project
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="start">
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Project Files</h4>
                        <ScrollArea className="h-48">
                          <div className="space-y-1">
                            {projectAttachments.map(pa => {
                              const Icon = getFileIcon(pa.file_type);
                              const alreadyAdded = attachments.some(a => a.file_path === pa.file_path);
                              return (
                                <button
                                  key={pa.id}
                                  type="button"
                                  onClick={() => handleAddFromProject(pa)}
                                  disabled={alreadyAdded}
                                  className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted text-left text-sm disabled:opacity-50"
                                >
                                  <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                  <span className="truncate flex-1">{pa.file_name}</span>
                                  {alreadyAdded && (
                                    <Badge variant="secondary" className="text-xs">Added</Badge>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}
            
            {/* Attachments list */}
            {attachmentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : attachments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No files attached to this shift</p>
              </div>
            ) : (
              <div className="space-y-2">
                {attachments.map(attachment => {
                  const Icon = getFileIcon(attachment.file_type);
                  const isImage = attachment.file_type.startsWith('image/');
                  
                  return (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      {isImage ? (
                        <AttachmentImage
                          filePath={attachment.file_path}
                          alt={attachment.file_name}
                          className="h-10 w-10 rounded object-cover"
                          fallback={
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                              <Icon className="h-5 w-5 text-muted-foreground" />
                            </div>
                          }
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {attachment.file_size && (
                            <span>{formatFileSize(attachment.file_size)}</span>
                          )}
                          {attachment.source_project_id && (
                            <Badge variant="outline" className="text-xs">From Project</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <AttachmentLink
                          filePath={attachment.file_path}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent hover:text-accent-foreground"
                        >
                          <Download className="h-4 w-4" />
                        </AttachmentLink>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hidden md:flex"
                            onClick={() => handleDeleteAttachment(attachment)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
