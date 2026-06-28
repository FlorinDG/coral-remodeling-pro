"use client";
import { useState, useEffect } from 'react';
import { Loader2, Users, Plus, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { AppRole } from '@/components/time-tracker/hooks/useUserRoles';
import { useTeams } from '@/components/time-tracker/hooks/useTeams';
import { UserCard } from './UserCard';
import { UserDetailView } from './UserDetailView';
import { hrList, hrCreate } from '@/components/time-tracker/lib/hr-api';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  hourly_rate: number;
  created_at: string;
  roles: AppRole[];
  teams: { id: string; name: string; role: string }[];
  schedule: boolean;
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
      const employees = await hrList<any>('employees');
      
      const usersWithRoles: UserProfile[] = employees.map(emp => ({
        id: emp.id,
        user_id: emp.id,
        full_name: `${emp.firstName} ${emp.lastName}`.trim(),
        hourly_rate: emp.hourlyCost || 0,
        created_at: emp.createdAt || new Date().toISOString(),
        roles: [(emp.role?.toLowerCase() || 'employee') as AppRole],
        teams: [],
        schedule: emp.schedule !== false,
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching employees:', error);
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
      const nameParts = newFullName.trim().split(' ');
      const firstName = nameParts[0] || 'Unknown';
      const lastName = nameParts.slice(1).join(' ') || '';

      await hrCreate('employees', {
        firstName,
        lastName,
        email: newEmail,
        role: 'EMPLOYEE',
        status: 'ACTIVE'
      });

      toast.success('Employee added successfully!');
      setNewEmail('');
      setNewFullName('');
      setCreateDialogOpen(false);
      
      // Refresh the employee list
      setTimeout(fetchUsers, 500);
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        toast.error('An employee with this email already exists');
      } else {
        toast.error('Failed to add employee');
      }
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

  // Card list view
  return (
    <>
      {selectedUser && (
        <UserDetailView
          user={selectedUser}
          teams={teams}
          onBack={() => setSelectedUser(null)}
          onUpdate={handleUserUpdate}
          onDelete={handleUserDelete}
          addTeamMember={addTeamMember}
          removeTeamMember={removeTeamMember}
        />
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Employee Management</CardTitle>
                <CardDescription>{users.length} employees</CardDescription>
              </div>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No employees found
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

      {/* Add Employee Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>
              Add a new member to the workforce.
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
                Add Employee
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
