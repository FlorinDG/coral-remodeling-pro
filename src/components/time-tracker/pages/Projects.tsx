"use client";
import { useEffect, useState } from 'react';
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";

import { Loader2, ArrowLeft, Briefcase, Plus, Pencil, Trash2, MapPin, Users, UserPlus, X, Users2 } from 'lucide-react';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { useUserRoles } from '@/components/time-tracker/hooks/useUserRoles';
import { useProjects, Project } from '@/components/time-tracker/hooks/useProjects';
import { useProjectAssignments } from '@/components/time-tracker/hooks/useProjectAssignments';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/time-tracker/components/ui/alert-dialog';
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

interface UserProfile {
  user_id: string;
  full_name: string;
}

interface TeamAssignment {
  team_id: string;
  team?: { name: string };
}

export default function Projects() {
  const router = useRouter();
  const navigate = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isManager, loading: rolesLoading } = useUserRoles();
  const { projects, loading: projectsLoading, createProject, updateProject, deleteProject } = useProjects();
  const { teams, createTeam, assignProjectToTeam, unassignProjectFromTeam } = useTeams();

  // Team creation state
  const [isCreateTeamDialogOpen, setIsCreateTeamDialogOpen] = useState(false);
  const [teamFormData, setTeamFormData] = useState({ name: '', description: '' });
  const [savingTeam, setSavingTeam] = useState(false);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [assigningProject, setAssigningProject] = useState<Project | null>(null);
  const [assigningTeamsProject, setAssigningTeamsProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({ name: '', address: '', color: 'blue' });
  const [saving, setSaving] = useState(false);

  // User Assignment state
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [projectAssignments, setProjectAssignments] = useState<{ user_id: string; profile?: { full_name: string } }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // Team Assignment state
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignment[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [loadingTeamAssignments, setLoadingTeamAssignments] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/admin/time-tracker/auth");
    }
  }, [user, authLoading, navigate]);

  // Fetch all users for assignment
  useEffect(() => {
    if (isManager) {
      const fetchUsers = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .order('full_name');
        if (data) setAllUsers(data);
      };
      fetchUsers();
    }
  }, [isManager]);

  // Fetch assignments when assigning project changes
  useEffect(() => {
    if (assigningProject) {
      const fetchAssignments = async () => {
        setLoadingAssignments(true);
        const { data: assignmentData } = await supabase
          .from('user_project_assignments')
          .select('user_id')
          .eq('project_id', assigningProject.id);

        if (assignmentData && assignmentData.length > 0) {
          const userIds = assignmentData.map(a => a.user_id);
          const { data: profileData } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', userIds);

          const withProfiles = assignmentData.map(a => ({
            user_id: a.user_id,
            profile: profileData?.find(p => p.user_id === a.user_id)
          }));
          setProjectAssignments(withProfiles);
        } else {
          setProjectAssignments([]);
        }
        setLoadingAssignments(false);
      };
      fetchAssignments();
    }
  }, [assigningProject]);

  // Fetch team assignments when assigning teams to project changes
  useEffect(() => {
    if (assigningTeamsProject) {
      const fetchTeamAssignments = async () => {
        setLoadingTeamAssignments(true);
        const { data: assignmentData } = await supabase
          .from('team_project_assignments')
          .select('team_id')
          .eq('project_id', assigningTeamsProject.id);

        if (assignmentData && assignmentData.length > 0) {
          const teamIds = assignmentData.map(a => a.team_id);
          const { data: teamData } = await supabase
            .from('teams')
            .select('id, name')
            .in('id', teamIds);

          const withTeams = assignmentData.map(a => ({
            team_id: a.team_id,
            team: teamData?.find(t => t.id === a.team_id)
          }));
          setTeamAssignments(withTeams);
        } else {
          setTeamAssignments([]);
        }
        setLoadingTeamAssignments(false);
      };
      fetchTeamAssignments();
    }
  }, [assigningTeamsProject]);

  const handleCreateProject = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    await createProject(formData);
    setSaving(false);
    setIsCreateDialogOpen(false);
    setFormData({ name: '', address: '', color: 'blue' });
  };

  const handleUpdateProject = async () => {
    if (!editingProject || !formData.name.trim()) return;
    setSaving(true);
    await updateProject(editingProject.id, formData);
    setSaving(false);
    setEditingProject(null);
    setFormData({ name: '', address: '', color: 'blue' });
  };

  const handleDeleteProject = async () => {
    if (!deletingProject) return;
    await deleteProject(deletingProject.id);
    setDeletingProject(null);
  };

  const handleAssignUser = async () => {
    if (!assigningProject || !selectedUserId) return;
    
    const { error } = await supabase
      .from('user_project_assignments')
      .insert({
        user_id: selectedUserId,
        project_id: assigningProject.id,
        assigned_by: user?.id,
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('User is already assigned');
      } else {
        toast.error('Failed to assign user');
      }
      return;
    }

    const assignedUser = allUsers.find(u => u.user_id === selectedUserId);
    setProjectAssignments(prev => [...prev, { 
      user_id: selectedUserId, 
      profile: assignedUser ? { full_name: assignedUser.full_name } : undefined 
    }]);
    setSelectedUserId('');
    toast.success('User assigned');
  };

  const handleUnassignUser = async (userId: string) => {
    if (!assigningProject) return;
    
    const { error } = await supabase
      .from('user_project_assignments')
      .delete()
      .eq('user_id', userId)
      .eq('project_id', assigningProject.id);

    if (error) {
      toast.error('Failed to unassign user');
      return;
    }

    setProjectAssignments(prev => prev.filter(a => a.user_id !== userId));
    toast.success('User unassigned');
  };

  const handleCreateTeam = async () => {
    if (!teamFormData.name.trim()) return;
    setSavingTeam(true);
    await createTeam(teamFormData);
    setSavingTeam(false);
    setIsCreateTeamDialogOpen(false);
    setTeamFormData({ name: '', description: '' });
  };

  const openEditDialog = (project: Project) => {
    setFormData({
      name: project.name,
      address: project.address || '',
      color: project.color,
    });
    setEditingProject(project);
  };

  const getColorClass = (color: string) => {
    return PROJECT_COLORS.find(c => c.value === color)?.class || 'bg-primary';
  };

  const getUnassignedUsers = () => {
    const assignedIds = projectAssignments.map(a => a.user_id);
    return allUsers.filter(u => !assignedIds.includes(u.user_id));
  };

  if (authLoading || rolesLoading || projectsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin/time-tracker">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Briefcase className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Projects</h1>
                <p className="text-sm text-muted-foreground">View and manage projects</p>
              </div>
            </div>
          </div>
          {isManager && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {projects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                {isManager 
                  ? 'Create your first project to get started.'
                  : 'No projects have been assigned to you yet.'}
              </p>
              {isManager && (
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} className="group relative overflow-hidden cursor-pointer hover:shadow-lg transition-all hover:border-primary/50" onClick={() => router.push(`/projects/${project.id}`)}>
                <div className={`absolute top-0 left-0 w-full h-1 ${getColorClass(project.color)}`} />
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-lg ${getColorClass(project.color)} flex items-center justify-center flex-shrink-0`}>
                      <Briefcase className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg font-bold uppercase tracking-wide truncate">{project.name}</CardTitle>
                      {project.address && (
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                          <span className="truncate">{project.address}</span>
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {/* Bottom back button */}
        <div className="mt-8 flex justify-center">
          <Link 
            href="/admin/time-tracker" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
      </main>

      {/* Create Project Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>Add a new project to your organization.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter project name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address (optional)</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter project address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
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
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={saving || !formData.name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={!!editingProject} onOpenChange={() => setEditingProject(null)}>
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
            <Button variant="outline" onClick={() => setEditingProject(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateProject} disabled={saving || !formData.name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Users Dialog */}
      <Dialog open={!!assigningProject} onOpenChange={() => setAssigningProject(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Team</DialogTitle>
            <DialogDescription>
              Assign users to {assigningProject?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Add user section */}
            <div className="flex gap-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {getUnassignedUsers().map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAssignUser} disabled={!selectedUserId}>
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>

            {/* Current assignments */}
            <div className="space-y-2">
              <Label>Assigned Users</Label>
              {loadingAssignments ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : projectAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No users assigned yet
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {projectAssignments.map((assignment) => (
                    <Badge key={assignment.user_id} variant="secondary" className="flex items-center gap-1 pr-1">
                      {assignment.profile?.full_name || 'Unknown'}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0 hover:bg-transparent"
                        onClick={() => handleUnassignUser(assignment.user_id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigningProject(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingProject} onOpenChange={() => setDeletingProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingProject?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Teams Dialog */}
      <Dialog open={!!assigningTeamsProject} onOpenChange={() => setAssigningTeamsProject(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Teams</DialogTitle>
            <DialogDescription>
              Assign teams to {assigningTeamsProject?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Add team section */}
            <div className="flex gap-2">
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a team..." />
                </SelectTrigger>
                <SelectContent>
                  {teams
                    .filter(t => !teamAssignments.some(ta => ta.team_id === t.id))
                    .map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={async () => {
                  if (!assigningTeamsProject || !selectedTeamId) return;
                  await assignProjectToTeam(selectedTeamId, assigningTeamsProject.id);
                  const team = teams.find(t => t.id === selectedTeamId);
                  setTeamAssignments(prev => [...prev, { 
                    team_id: selectedTeamId, 
                    team: team ? { name: team.name } : undefined 
                  }]);
                  setSelectedTeamId('');
                }}
                disabled={!selectedTeamId}
              >
                <UserPlus className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline"
                onClick={() => setIsCreateTeamDialogOpen(true)}
                title="Create new team"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Current team assignments */}
            <div className="space-y-2">
              <Label>Assigned Teams</Label>
              {loadingTeamAssignments ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : teamAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No teams assigned yet
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {teamAssignments.map((assignment) => (
                    <Badge key={assignment.team_id} variant="secondary" className="flex items-center gap-1 pr-1">
                      {assignment.team?.name || 'Unknown'}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0 hover:bg-transparent"
                        onClick={async () => {
                          if (!assigningTeamsProject) return;
                          await unassignProjectFromTeam(assignment.team_id, assigningTeamsProject.id);
                          setTeamAssignments(prev => prev.filter(a => a.team_id !== assignment.team_id));
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigningTeamsProject(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Team Dialog */}
      <Dialog open={isCreateTeamDialogOpen} onOpenChange={setIsCreateTeamDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
            <DialogDescription>Add a new team to your organization.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-team-name">Team Name</Label>
              <Input
                id="project-team-name"
                value={teamFormData.name}
                onChange={(e) => setTeamFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter team name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-team-description">Description (optional)</Label>
              <Textarea
                id="project-team-description"
                value={teamFormData.description}
                onChange={(e) => setTeamFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter team description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateTeamDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTeam} disabled={savingTeam || !teamFormData.name.trim()}>
              {savingTeam ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
