"use client";
import { useEffect, useState } from 'react';
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";

import { Loader2, ArrowLeft, Shield, Plus, Users2, Pencil, Trash2, ClipboardCheck, Calendar, UserCog } from 'lucide-react';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { useUserRoles } from '@/components/time-tracker/hooks/useUserRoles';
import { useTeams, Team } from '@/components/time-tracker/hooks/useTeams';
import { UserManager } from '@/components/time-tracker/components/admin/UserManager';
import { RoleManager } from '@/components/time-tracker/components/admin/RoleManager';
import { ScheduleManagement } from '@/components/time-tracker/components/admin/ScheduleManagement';
import { ApprovalManager } from '@/components/time-tracker/components/admin/ApprovalManager';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/time-tracker/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/time-tracker/components/ui/card';
import { Input } from '@/components/time-tracker/components/ui/input';
import { Label } from '@/components/time-tracker/components/ui/label';
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

export default function Admin() {
  const router = useRouter();
  const navigate = useRouter();
  const { user, loading } = useAuth();
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const { teams, loading: teamsLoading, createTeam, updateTeam, deleteTeam } = useTeams();

  const [isCreateTeamDialogOpen, setIsCreateTeamDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);
  const [teamFormData, setTeamFormData] = useState({ name: '', description: '' });
  const [savingTeam, setSavingTeam] = useState(false);

  const handleCreateTeam = async () => {
    if (!teamFormData.name.trim()) return;
    setSavingTeam(true);
    await createTeam(teamFormData);
    setSavingTeam(false);
    setIsCreateTeamDialogOpen(false);
    setTeamFormData({ name: '', description: '' });
  };

  const handleUpdateTeam = async () => {
    if (!editingTeam || !teamFormData.name.trim()) return;
    setSavingTeam(true);
    await updateTeam(editingTeam.id, teamFormData);
    setSavingTeam(false);
    setEditingTeam(null);
    setTeamFormData({ name: '', description: '' });
  };

  const handleDeleteTeam = async () => {
    if (!deletingTeam) return;
    await deleteTeam(deletingTeam.id);
    setDeletingTeam(null);
  };

  const openEditDialog = (team: Team) => {
    setTeamFormData({ name: team.name, description: team.description || '' });
    setEditingTeam(team);
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/admin/time-tracker/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && !rolesLoading && user && !isAdmin) {
      router.push("/admin/time-tracker");
    }
  }, [user, loading, rolesLoading, isAdmin, navigate]);

  if (loading || rolesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/time-tracker">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">Manage users, roles, and schedules</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="schedules" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="schedules" className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Scheduler
            </TabsTrigger>
            <TabsTrigger value="approvals" className="flex items-center gap-1">
              <ClipboardCheck className="h-4 w-4" />
              Approvals
            </TabsTrigger>
            <TabsTrigger value="user-management" className="flex items-center gap-1">
              <UserCog className="h-4 w-4" />
              User Management
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="schedules">
            <ScheduleManagement />
          </TabsContent>
          
          <TabsContent value="approvals">
            <ApprovalManager />
          </TabsContent>
          
          <TabsContent value="user-management">
            <Tabs defaultValue="users" className="space-y-4">
              <TabsList className="grid w-full max-w-sm grid-cols-3">
                <TabsTrigger value="users">Users</TabsTrigger>
                <TabsTrigger value="teams">Teams</TabsTrigger>
                <TabsTrigger value="roles">Roles</TabsTrigger>
              </TabsList>
              
              <TabsContent value="users">
                <UserManager />
              </TabsContent>

              <TabsContent value="teams">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users2 className="h-5 w-5" />
                        Teams
                      </CardTitle>
                      <CardDescription>Manage teams in your organization</CardDescription>
                    </div>
                    <Button onClick={() => setIsCreateTeamDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Team
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {teamsLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : teams.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No teams yet. Create your first team to get started.
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {teams.map((team) => (
                          <Card key={team.id} className="border group relative">
                            <CardHeader className="py-3 px-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-base">{team.name}</CardTitle>
                                  {team.description && (
                                    <CardDescription className="text-sm">{team.description}</CardDescription>
                                  )}
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => openEditDialog(team)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setDeletingTeam(team)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="roles">
                <RoleManager />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>

        {/* Create Team Dialog */}
        <Dialog open={isCreateTeamDialogOpen} onOpenChange={setIsCreateTeamDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Team</DialogTitle>
              <DialogDescription>Add a new team to your organization.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="team-name">Team Name</Label>
                <Input
                  id="team-name"
                  value={teamFormData.name}
                  onChange={(e) => setTeamFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter team name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-description">Description (optional)</Label>
                <Textarea
                  id="team-description"
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

        {/* Edit Team Dialog */}
        <Dialog open={!!editingTeam} onOpenChange={() => setEditingTeam(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Team</DialogTitle>
              <DialogDescription>Update team details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-team-name">Team Name</Label>
                <Input
                  id="edit-team-name"
                  value={teamFormData.name}
                  onChange={(e) => setTeamFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter team name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-team-description">Description (optional)</Label>
                <Textarea
                  id="edit-team-description"
                  value={teamFormData.description}
                  onChange={(e) => setTeamFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter team description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingTeam(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateTeam} disabled={savingTeam || !teamFormData.name.trim()}>
                {savingTeam ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Team Confirmation */}
        <AlertDialog open={!!deletingTeam} onOpenChange={() => setDeletingTeam(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Team</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deletingTeam?.name}"? This will remove all team members and project assignments. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTeam} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
    </div>
  );
}
