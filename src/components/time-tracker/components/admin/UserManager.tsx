"use client";
import { useState, useEffect } from 'react';
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
  const [newFullName, setNewFullName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    
    try {
      const res = await fetch('/api/tenant/users');
      if (!res.ok) {
        console.error('Error fetching users:', await res.text());
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      
      // Map Prisma user format to UserProfile format
      const usersWithRoles: UserProfile[] = (data.users || []).map((user: any) => ({
        id: user.id,
        user_id: user.id,
        full_name: user.name || 'Unknown User',
        hourly_rate: 0,
        created_at: user.invitedAt || new Date().toISOString(),
        roles: [user.role?.toLowerCase() as AppRole].filter(Boolean),
        teams: [],
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEmail || !newFullName) {
      toast.error('Please fill in all fields');
      return;
    }

    setCreating(true);
    
    try {
      const res = await fetch('/api/tenant/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          name: newFullName,
          role: 'EMPLOYEE',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'SEAT_LIMIT_REACHED') {
          toast.error(data.message || 'Seat limit reached. Upgrade your plan.');
        } else if (res.status === 409) {
          toast.error('A user with this email already exists');
        } else {
          toast.error(data.error || 'Failed to create user');
        }
        return;
      }

      toast.success('User invited successfully! An invite email has been sent.');
      setNewEmail('');
      setNewFullName('');
      setCreateDialogOpen(false);
      
      // Refresh the user list
      setTimeout(fetchUsers, 500);
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
              Invite User
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

      {/* Invite User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
            <DialogDescription>
              Send an invitation email to add a new team member.
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send Invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
