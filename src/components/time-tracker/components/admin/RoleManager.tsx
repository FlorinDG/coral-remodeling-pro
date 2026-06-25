"use client";
import { useState, useEffect } from 'react';
import { Loader2, UserCog, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

export type ScheduleViewPermission = 'own' | 'team' | 'all_except_admin' | 'all';

interface UserWithRole {
  id: string;
  name: string;
  email: string;
  role: string;
  inviteAccepted: boolean;
}

const ROLE_OPTIONS = [
  { value: 'APP_MANAGER', label: 'Manager' },
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'ACCOUNTANT', label: 'Accountant' },
];

export function RoleManager() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

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
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const updateRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/tenant/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to update role');
        return;
      }

      toast.success('Role updated successfully');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update role');
      console.error(error);
    }
  };

  const removeUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to remove this user from the workspace?')) return;
    
    try {
      const res = await fetch(`/api/tenant/users/${userId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to remove user');
        return;
      }

      toast.success('User removed successfully');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to remove user');
      console.error(error);
    }
  };

  const getRoleBadgeVariant = (role: string): 'outline' | 'destructive' | 'default' | 'secondary' => {
    switch (role) {
      case 'APP_MANAGER':
        return 'default';
      case 'ACCOUNTANT':
        return 'outline';
      case 'EMPLOYEE':
        return 'secondary';
      default:
        return 'secondary';
    }
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <UserCog className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Role Management</CardTitle>
            <CardDescription>Assign and manage user roles</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Users Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name || 'Pending'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(v) => updateRole(user.id, v)}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.inviteAccepted ? 'default' : 'outline'}>
                      {user.inviteAccepted ? 'Active' : 'Pending Invite'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removeUser(user.id)}
                      title="Remove user"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
