"use client";
import { useEffect, useState } from 'react';
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useParams } from "next/navigation";

import {
  Loader2, ArrowLeft, Briefcase, MapPin, Upload, Trash2,
  FileText, Image, File, Users, Users2, Pencil, Plus,
  CheckSquare, Circle, CheckCircle2
} from 'lucide-react';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { useUserRoles } from '@/components/time-tracker/hooks/useUserRoles';
import { useProjects, Project } from '@/components/time-tracker/hooks/useProjects';
import { useProjectAttachments } from '@/components/time-tracker/hooks/useProjectAttachments';
import { useTasks, Task } from '@/components/time-tracker/hooks/useTasks';
import { AttachmentLink } from '@/components/time-tracker/components/ui/attachment-link';
import { useTeams } from '@/components/time-tracker/hooks/useTeams';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/time-tracker/components/ui/card';
import { Input } from '@/components/time-tracker/components/ui/input';
import { Label } from '@/components/time-tracker/components/ui/label';
import { Badge } from '@/components/time-tracker/components/ui/badge';
import { Textarea } from '@/components/time-tracker/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/time-tracker/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/time-tracker/components/ui/select';
import { toast } from 'sonner';

const PROJECT_COLORS = [
  { value: 'blue', label: 'Blue', class: 'bg-primary' },
  { value: 'green', label: 'Green', class: 'bg-secondary' },
  { value: 'red', label: 'Red', class: 'bg-destructive' },
  { value: 'purple', label: 'Purple', class: 'bg-accent' },
  { value: 'orange', label: 'Orange', class: 'bg-primary/80' },
  { value: 'pink', label: 'Pink', class: 'bg-secondary/80' },
  { value: 'teal', label: 'Teal', class: 'bg-accent/80' },
  { value: 'yellow', label: 'Yellow', class: 'bg-primary/60' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'bg-muted' },
  { value: 'normal', label: 'Normal', color: 'bg-primary' },
  { value: 'high', label: 'High', color: 'bg-secondary' },
  { value: 'urgent', label: 'Urgent', color: 'bg-destructive' },
];

export default function ProjectDetails() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const navigate = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isManager, loading: rolesLoading } = useUserRoles();
  const { projects, updateProject } = useProjects();
  const { attachments, loading: attachmentsLoading, fetchAttachments, uploadFile, deleteAttachment } = useProjectAttachments(id || null);
  const { tasks, loading: tasksLoading, createTask, updateTask, completeTask, deleteTask, refetch: refetchTasks } = useTasks(id);
  const { teams, fetchTeamProjects } = useTeams();

  const [project, setProject] = useState<Project | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', address: '', color: 'blue' });
  const [saving, setSaving] = useState(false);
  const [assignedTeams, setAssignedTeams] = useState<{ id: string; name: string }[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<{ user_id: string; full_name: string }[]>([]);

  // Task form state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskFormData, setTaskFormData] = useState({ title: '', description: '', priority: 'normal' });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [savingTask, setSavingTask] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/admin/time-tracker/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (id && projects.length > 0) {
      const found = projects.find(p => p.id === id);
      if (found) {
        setProject(found);
        setFormData({ name: found.name, address: found.address || '', color: found.color });
      }
    }
  }, [id, projects]);

  useEffect(() => {
    if (id) {
      fetchAttachments();
      fetchAssignments();
    }
  }, [id, fetchAttachments]);

  const fetchAssignments = async () => {
    if (!id) return;

    const { data: teamAssignments } = await supabase
      .from('team_project_assignments')
      .select('team_id')
      .eq('project_id', id);

    if (teamAssignments && teamAssignments.length > 0) {
      const teamIds = teamAssignments.map(t => t.team_id);
      const { data: teamData } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds);
      setAssignedTeams(teamData || []);
    }

    const { data: userAssignments } = await supabase
      .from('user_project_assignments')
      .select('user_id')
      .eq('project_id', id);

    if (userAssignments && userAssignments.length > 0) {
      const userIds = userAssignments.map(u => u.user_id);
      const { data: userData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      setAssignedUsers(userData || []);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    for (const file of files) {
      await uploadFile(file);
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleUpdateProject = async () => {
    if (!project || !formData.name.trim()) return;
    setSaving(true);
    await updateProject(project.id, formData);
    setProject(prev => prev ? { ...prev, ...formData } : null);
    setSaving(false);
    setEditDialogOpen(false);
  };

  const handleSaveTask = async () => {
    if (!id || !taskFormData.title.trim()) return;
    setSavingTask(true);

    try {
      if (editingTask) {
        await updateTask(editingTask.id, {
          title: taskFormData.title,
          description: taskFormData.description || null,
          priority: taskFormData.priority,
        });
        toast.success('Task updated');
      } else {
        await createTask({
          project_id: id,
          title: taskFormData.title,
          description: taskFormData.description || null,
          priority: taskFormData.priority,
        });
        toast.success('Task created');
      }
      setTaskDialogOpen(false);
      setTaskFormData({ title: '', description: '', priority: 'normal' });
      setEditingTask(null);
    } catch (error) {
      toast.error('Failed to save task');
    } finally {
      setSavingTask(false);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskFormData({
      title: task.title,
      description: task.description || '',
      priority: task.priority || 'normal',
    });
    setTaskDialogOpen(true);
  };

  const handleCompleteTask = async (task: Task) => {
    try {
      await completeTask(task.id);
      toast.success('Task completed');
    } catch (error) {
      toast.error('Failed to complete task');
    }
  };

  const handleDeleteTask = async (task: Task) => {
    try {
      await deleteTask(task.id);
      toast.success('Task deleted');
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="h-5 w-5" />;
    if (fileType.includes('pdf')) return <FileText className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getColorClass = (color: string) => {
    return PROJECT_COLORS.find(c => c.value === color)?.class || 'bg-primary';
  };

  const getPriorityColor = (priority: string | null) => {
    return PRIORITY_OPTIONS.find(p => p.value === priority)?.color || 'bg-primary';
  };

  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  if (authLoading || rolesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Project not found</h2>
          <Link href="/admin/time-tracker/projects" className="text-primary hover:underline">
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin/time-tracker/projects">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-lg ${getColorClass(project.color)} flex items-center justify-center`}>
                <Briefcase className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
                {project.address && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {project.address}
                  </p>
                )}
              </div>
            </div>
          </div>
          {isManager && (
            <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Assignments */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Users2 className="h-4 w-4" />
                Assigned Teams
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assignedTeams.length === 0 ? (
                <p className="text-sm text-muted-foreground">No teams assigned</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {assignedTeams.map(team => (
                    <Badge key={team.id} variant="secondary">{team.name}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Assigned Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assignedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No users assigned</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {assignedUsers.map(u => (
                    <Badge key={u.user_id} variant="outline">{u.full_name}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tasks Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                Tasks
              </CardTitle>
              <CardDescription>
                Manage tasks for this project
              </CardDescription>
            </div>
            {isManager && (
              <Button onClick={() => {
                setEditingTask(null);
                setTaskFormData({ title: '', description: '', priority: 'normal' });
                setTaskDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {tasksLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No tasks yet. Create tasks to assign them to schedules.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Pending Tasks */}
                {pendingTasks.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Pending ({pendingTasks.length})
                    </h4>
                    <div className="space-y-2">
                      {pendingTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-3 p-3 border rounded-lg group hover:bg-muted/50"
                        >
                          <button
                            onClick={() => handleCompleteTask(task)}
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Circle className="h-5 w-5" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{task.title}</span>
                              <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
                            </div>
                            {task.description && (
                              <p className="text-sm text-muted-foreground truncate">{task.description}</p>
                            )}
                          </div>
                          {isManager && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleEditTask(task)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleDeleteTask(task)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed Tasks */}
                {completedTasks.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Completed ({completedTasks.length})
                    </h4>
                    <div className="space-y-2">
                      {completedTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-3 p-3 border rounded-lg opacity-60"
                        >
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                          <div className="flex-1 min-w-0">
                            <span className="line-through">{task.title}</span>
                          </div>
                          {isManager && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleDeleteTask(task)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Files & Attachments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Files & Attachments
              </CardTitle>
              <CardDescription>
                Upload files that can be attached to schedules for this project
              </CardDescription>
            </div>
            {isManager && (
              <div>
                <Input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  disabled={uploading}
                />
                <Button asChild disabled={uploading}>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    {uploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Upload Files
                  </label>
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {attachmentsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : attachments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No files uploaded yet. Upload files to attach them to schedules.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-3 p-3 border rounded-lg group hover:bg-muted/50"
                  >
                    <div className="text-muted-foreground">
                      {getFileIcon(attachment.file_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <AttachmentLink
                        filePath={attachment.file_path}
                        className="text-sm font-medium truncate block hover:text-primary"
                      >
                        {attachment.file_name}
                      </AttachmentLink>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.file_size)}
                      </p>
                    </div>
                    {isManager && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={() => deleteAttachment(attachment)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Back link */}
        <div className="flex justify-center">
          <Link
            href="/admin/time-tracker/projects"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Projects
          </Link>
        </div>
      </main>

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update project details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Project Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter project name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Address (optional)</Label>
              <Input
                id="edit-address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter project address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-color">Color</Label>
              <Select
                value={formData.color}
                onValueChange={(value) => setFormData(prev => ({ ...prev, color: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_COLORS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded ${color.class}`} />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateProject} disabled={saving || !formData.name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Create Task'}</DialogTitle>
            <DialogDescription>
              {editingTask ? 'Update task details.' : 'Add a new task to this project.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={taskFormData.title}
                onChange={(e) => setTaskFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter task title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description (optional)</Label>
              <Textarea
                id="task-description"
                value={taskFormData.description}
                onChange={(e) => setTaskFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter task description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-priority">Priority</Label>
              <Select
                value={taskFormData.priority}
                onValueChange={(value) => setTaskFormData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${opt.color}`} />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTask} disabled={savingTask || !taskFormData.title.trim()}>
              {savingTask ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingTask ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
