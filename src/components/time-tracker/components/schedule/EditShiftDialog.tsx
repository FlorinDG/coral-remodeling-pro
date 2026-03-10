"use client";
import { useState, useEffect, useCallback } from 'react';
import { Loader2, Trash2, Paperclip, Upload, FolderOpen, X, FileText, Image, Download, ListTodo, Plus, Check, Trash } from 'lucide-react';
import { useTasks, useShiftTasks, Task } from '@/components/time-tracker/hooks/useTasks';
import { AttachmentLink, AttachmentImage } from '@/components/time-tracker/components/ui/attachment-link';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Input } from '@/components/time-tracker/components/ui/input';
import { Label } from '@/components/time-tracker/components/ui/label';
import { Textarea } from '@/components/time-tracker/components/ui/textarea';
import { Badge } from '@/components/time-tracker/components/ui/badge';
import { ScrollArea } from '@/components/time-tracker/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/time-tracker/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/time-tracker/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/time-tracker/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/time-tracker/components/ui/popover';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/time-tracker/components/ui/tabs';
import { ScheduledShift, Project, NOTION_COLORS } from '@/components/time-tracker/hooks/useScheduledShifts';
import { useScheduleAttachments, ScheduleAttachment } from '@/components/time-tracker/hooks/useScheduleAttachments';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { toast } from 'sonner';

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
  }) => Promise<void>;
  onDeleteShift: (shiftId: string) => Promise<void>;
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

export function EditShiftDialog({
  shift,
  open,
  onOpenChange,
  projects,
  workers,
  onUpdateShift,
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
  const [showQuickCreate, setShowQuickCreate] = useState(false);
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
      
      const { data } = await supabase
        .from('project_attachments')
        .select('id, project_id, file_name, file_path, file_type, file_size')
        .eq('project_id', pid);
      
      setProjectAttachments(data || []);
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
      const newTask = await createTask({
        project_id: pid,
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
      });
      await assignTask(newTask.id);
      setNewTaskTitle('');
      setNewTaskPriority('normal');
      setShowQuickCreate(false);
      toast.success('Task created and assigned');
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

    setLoading(true);
    try {
      await onUpdateShift(shift.id, {
        user_id: userId,
        project_id: projectId || null,
        shift_date: shiftDate,
        shift_start: shiftStart,
        shift_end: shiftEnd,
        role: role || null,
        notes: notes || null,
      });

      if (status !== shift.status) {
        await onStatusChange(shift.id, status);
      }

      toast.success('Shift updated');
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
      await onDeleteShift(shift.id);
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
          
          <TabsContent value="details">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Employee</Label>
                <Select value={userId} onValueChange={setUserId} disabled={!canManage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {workers.map(worker => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {worker.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Project</Label>
                <Select value={projectId || "none"} onValueChange={(v) => setProjectId(v === "none" ? "" : v)} disabled={!canManage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
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

              <div>
                <Label htmlFor="editShiftDate">Date</Label>
                <Input
                  id="editShiftDate"
                  type="date"
                  value={shiftDate}
                  onChange={(e) => setShiftDate(e.target.value)}
                  disabled={!canManage}
                />
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

              <DialogFooter className="gap-2 sm:gap-0">
                {canManage && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Shift?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. The shift will be permanently removed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button type="submit" disabled={loading || !canManage}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
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
                        <Button variant="outline" size="sm">
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
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowQuickCreate(!showQuickCreate)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Quick Create
                    </Button>
                  </div>
                )}

                {/* Quick create form */}
                {showQuickCreate && canManage && (
                  <div className="p-3 rounded-lg border bg-muted/50 space-y-3">
                    <Input
                      placeholder="Task title..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low Priority</SelectItem>
                          <SelectItem value="normal">Normal Priority</SelectItem>
                          <SelectItem value="high">High Priority</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={handleQuickCreateTask}
                        disabled={!newTaskTitle.trim() || creatingTask}
                      >
                        {creatingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowQuickCreate(false);
                          setNewTaskTitle('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
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
                              className="h-8 w-8 text-destructive hover:text-destructive"
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
          
          <TabsContent value="attachments" className="space-y-4">
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
                  <Button variant="outline" size="sm" disabled={uploadingFile}>
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
                      <Button variant="outline" size="sm">
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
                            className="h-8 w-8 text-destructive hover:text-destructive"
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
