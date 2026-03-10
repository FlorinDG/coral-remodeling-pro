"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { Loader2, Users, Plus, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/time-tracker/components/ui/card';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Input } from '@/components/time-tracker/components/ui/input';
import { Label } from '@/components/time-tracker/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/time-tracker/components/ui/dialog';
import { toast } from 'sonner';
import type { AppRole } from '@/components/time-tracker/hooks/useUserRoles';
import { useTeams } from '@/components/time-tracker/hooks/useTeams';
import { UserCard } from './UserCard';
import { UserDetailView } from './UserDetailView';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  hourly_rate: number;
  created_at: string;
  roles: AppRole[];
  teams: { id: string; name: string; role: string }[];
}

export function UserManager() {
  const { teams, addTeamMember, removeTeamMember } = useTeams();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  
  // Create user form state
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    
    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      setLoading(false);
      return;
    }

    // Fetch all roles
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
    }

    // Fetch all team memberships
    const { data: teamMemberships, error: teamError } = await supabase
      .from('team_members')
      .select('user_id, team_id, role');

    if (teamError) {
      console.error('Error fetching team memberships:', teamError);
    }

    // Fetch team names
    const teamIds = [...new Set((teamMemberships || []).map(m => m.team_id))];
    let teamsData: { id: string; name: string }[] = [];
    if (teamIds.length > 0) {
      const { data: fetchedTeams } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds);
      teamsData = fetchedTeams || [];
    }

    // Combine profiles with their roles and teams
    const usersWithRoles: UserProfile[] = (profiles || []).map(profile => {
      const userRoles = (roles || []).filter(r => r.user_id === profile.user_id);
      const userTeamMemberships = (teamMemberships || []).filter(m => m.user_id === profile.user_id);
      const userTeams = userTeamMemberships.map(m => {
        const team = teamsData.find(t => t.id === m.team_id);
        return {
          id: m.team_id,
          name: team?.name || 'Unknown',
          role: m.role,
        };
      });
      return {
        id: profile.id,
        user_id: profile.user_id,
        full_name: profile.full_name || 'Unknown User',
        hourly_rate: profile.hourly_rate || 0,
        created_at: profile.created_at,
        roles: userRoles.map(r => r.role as AppRole),
        teams: userTeams,
      };
    });

    setUsers(usersWithRoles);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEmail || !newPassword || !newFullName) {
      toast.error('Please fill in all fields');
      return;
    }

    // Strong password validation
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      toast.error('Password must contain an uppercase letter');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      toast.error('Password must contain a lowercase letter');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      toast.error('Password must contain a number');
      return;
    }

    setCreating(true);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: {
          data: {
            full_name: newFullName,
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('A user with this email already exists');
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (data.user) {
        toast.success('User created successfully');
        setNewEmail('');
        setNewPassword('');
        setNewFullName('');
        setCreateDialogOpen(false);
        
        // Refresh the user list after a short delay
        setTimeout(fetchUsers, 1000);
      }
    } catch (error) {
      toast.error('Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleUserUpdate = (updatedUser: UserProfile) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    setSelectedUser(updatedUser);
  };

  const handleUserDelete = () => {
    setUsers(prev => prev.filter(u => u.id !== selectedUser?.id));
    setSelectedUser(null);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Detail view when a user is selected
  if (selectedUser) {
    return (
      <UserDetailView
        user={selectedUser}
        teams={teams}
        onBack={() => setSelectedUser(null)}
        onUpdate={handleUserUpdate}
        onDelete={handleUserDelete}
        addTeamMember={addTeamMember}
        removeTeamMember={removeTeamMember}
      />
    );
  }

  // Card list view
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>{users.length} users</CardDescription>
              </div>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No users found
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {users.map(user => (
                <UserCard
                  key={user.id}
                  user={user}
                  onClick={() => setSelectedUser(user)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user account to the system.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 chars, uppercase, lowercase, number"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
