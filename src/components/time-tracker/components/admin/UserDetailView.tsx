"use client";
import { useState } from 'react';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { ArrowLeft, Loader2, User, KeyRound, Users2, Euro, Trash2, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/time-tracker/components/ui/card';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Input } from '@/components/time-tracker/components/ui/input';
import { Label } from '@/components/time-tracker/components/ui/label';
import { Badge } from '@/components/time-tracker/components/ui/badge';
import { Separator } from '@/components/time-tracker/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import type { AppRole } from '@/components/time-tracker/hooks/useUserRoles';
import { Team } from '@/components/time-tracker/hooks/useTeams';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  hourly_rate: number;
  created_at: string;
  roles: AppRole[];
  teams: { id: string; name: string; role: string }[];
}

interface UserDetailViewProps {
  user: UserProfile;
  teams: Team[];
  onBack: () => void;
  onUpdate: (user: UserProfile) => void;
  onDelete: () => void;
  addTeamMember: (teamId: string, userId: string, role?: 'member' | 'owner') => Promise<{ error?: unknown }>;
  removeTeamMember: (teamId: string, userId: string) => Promise<{ error?: unknown }>;
}

const getRoleBadgeVariant = (role: AppRole) => {
  switch (role) {
    case 'owner':
      return 'outline';
    case 'admin':
      return 'destructive';
    case 'manager':
      return 'default';
    default:
      return 'secondary';
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export function UserDetailView({ 
  user, 
  teams, 
  onBack, 
  onUpdate, 
  onDelete,
  addTeamMember,
  removeTeamMember 
}: UserDetailViewProps) {
  const [currentUser, setCurrentUser] = useState<UserProfile>(user);
  
  // Edit name state
  const [editName, setEditName] = useState(user.full_name);
  const [savingName, setSavingName] = useState(false);
  
  // Edit rate state
  const [editRate, setEditRate] = useState(user.hourly_rate.toString());
  const [savingRate, setSavingRate] = useState(false);
  
  // Password reset state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  
  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Team assignment state
  const [selectedTeamId, setSelectedTeamId] = useState('');

  const handleSaveName = async () => {
    if (!editName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    setSavingName(true);
    
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: editName.trim() })
      .eq('id', currentUser.id);

    if (error) {
      toast.error('Failed to update name');
      console.error(error);
    } else {
      toast.success('Name updated');
      const updated = { ...currentUser, full_name: editName.trim() };
      setCurrentUser(updated);
      onUpdate(updated);
    }
    
    setSavingName(false);
  };

  const handleSaveRate = async () => {
    const rate = parseFloat(editRate);
    if (isNaN(rate) || rate < 0) {
      toast.error('Please enter a valid hourly rate');
      return;
    }

    setSavingRate(true);
    
    const { error } = await supabase
      .from('profiles')
      .update({ hourly_rate: rate })
      .eq('id', currentUser.id);

    if (error) {
      toast.error('Failed to update hourly rate');
      console.error(error);
    } else {
      toast.success('Hourly rate updated');
      const updated = { ...currentUser, hourly_rate: rate };
      setCurrentUser(updated);
      onUpdate(updated);
    }
    
    setSavingRate(false);
  };

  const handleResetPassword = async () => {
    if (!resetPassword || !resetPasswordConfirm) {
      toast.error('Please fill in both password fields');
      return;
    }

    if (resetPassword !== resetPasswordConfirm) {
      toast.error('Passwords do not match');
      return;
    }

    if (resetPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(resetPassword)) {
      toast.error('Password must contain an uppercase letter');
      return;
    }
    if (!/[a-z]/.test(resetPassword)) {
      toast.error('Password must contain a lowercase letter');
      return;
    }
    if (!/[0-9]/.test(resetPassword)) {
      toast.error('Password must contain a number');
      return;
    }

    setResettingPassword(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('You must be logged in to perform this action');
        return;
      }

      const response = await supabase.functions.invoke('admin-reset-password', {
        body: {
          user_id: currentUser.user_id,
          new_password: resetPassword,
        },
      });

      if (response.error) {
        toast.error(response.error.message || 'Failed to reset password');
      } else if (response.data?.error) {
        toast.error(response.data.error);
      } else {
        toast.success('Password reset successfully');
        setResetDialogOpen(false);
        setResetPassword('');
        setResetPasswordConfirm('');
      }
    } catch (error) {
      toast.error('Failed to reset password');
      console.error(error);
    } finally {
      setResettingPassword(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('You must be logged in to perform this action');
        setDeleting(false);
        return;
      }

      const response = await supabase.functions.invoke('admin-delete-user', {
        body: { user_id: currentUser.user_id },
      });

      if (response.error) {
        toast.error(response.error.message || 'Failed to delete user');
        console.error(response.error);
        setDeleting(false);
      } else if (response.data?.error) {
        toast.error(response.data.error);
        setDeleting(false);
      } else {
        toast.success('User deleted successfully');
        onDelete();
      }
    } catch (error) {
      toast.error('Failed to delete user');
      console.error(error);
      setDeleting(false);
    }
  };

  const handleAddTeam = async () => {
    if (!selectedTeamId) return;
    
    await addTeamMember(selectedTeamId, currentUser.user_id);
    const team = teams.find(t => t.id === selectedTeamId);
    if (team) {
      const updated = {
        ...currentUser,
        teams: [...currentUser.teams, { id: team.id, name: team.name, role: 'member' }]
      };
      setCurrentUser(updated);
      onUpdate(updated);
    }
    setSelectedTeamId('');
  };

  const handleRemoveTeam = async (teamId: string) => {
    await removeTeamMember(teamId, currentUser.user_id);
    const updated = {
      ...currentUser,
      teams: currentUser.teams.filter(t => t.id !== teamId)
    };
    setCurrentUser(updated);
    onUpdate(updated);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{currentUser.full_name}</h2>
              <p className="text-sm text-muted-foreground">
                Member since {formatDate(currentUser.created_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Profile Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile Information</CardTitle>
            <CardDescription>Update user details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <Button 
                    onClick={handleSaveName} 
                    disabled={savingName || editName === currentUser.full_name}
                  >
                    {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="rate">Hourly Rate (€)</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="rate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editRate}
                      onChange={(e) => setEditRate(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button 
                    onClick={handleSaveRate} 
                    disabled={savingRate || editRate === currentUser.hourly_rate.toString()}
                  >
                    {savingRate ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Roles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Roles</CardTitle>
            <CardDescription>User permissions in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {currentUser.roles.length > 0 ? (
                currentUser.roles.map(role => (
                  <Badge key={role} variant={getRoleBadgeVariant(role)}>
                    {role}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No roles assigned</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Roles are managed in the Roles tab
            </p>
          </CardContent>
        </Card>

        {/* Teams */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users2 className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Teams</CardTitle>
            </div>
            <CardDescription>Team assignments for this user</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Add to team..." />
                </SelectTrigger>
                <SelectContent>
                  {teams
                    .filter(t => !currentUser.teams.some(ut => ut.id === t.id))
                    .map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAddTeam} disabled={!selectedTeamId}>
                Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {currentUser.teams.length > 0 ? (
                currentUser.teams.map(team => (
                  <Badge key={team.id} variant="secondary" className="flex items-center gap-1 pr-1">
                    {team.name}
                    <span className="text-xs text-muted-foreground">({team.role})</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => handleRemoveTeam(team.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Not assigned to any teams</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => setResetDialogOpen(true)}
            >
              <KeyRound className="h-4 w-4 mr-2" />
              Reset Password
            </Button>
            
            <Separator />
            
            <Button 
              variant="destructive" 
              className="w-full justify-start"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete User
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Reset Password Dialog */}
      <Dialog 
        open={resetDialogOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setResetPassword('');
            setResetPasswordConfirm('');
          }
          setResetDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for <strong>{currentUser.full_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="resetPassword">New Password</Label>
              <Input
                id="resetPassword"
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Min 8 chars, uppercase, lowercase, number"
              />
            </div>
            <div>
              <Label htmlFor="resetPasswordConfirm">Confirm Password</Label>
              <Input
                id="resetPasswordConfirm"
                type="password"
                value={resetPasswordConfirm}
                onChange={(e) => setResetPasswordConfirm(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={resettingPassword}>
              {resettingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{currentUser.full_name}</strong>? 
              This will remove their profile from the system. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
