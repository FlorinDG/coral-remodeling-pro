"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { Loader2, UserCog, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/time-tracker/components/ui/card';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Badge } from '@/components/time-tracker/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/time-tracker/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/time-tracker/components/ui/table';
import { toast } from 'sonner';
import type { AppRole } from '@/components/time-tracker/hooks/useUserRoles';

export type ScheduleViewPermission = 'own' | 'team' | 'all_except_admin' | 'all';

interface UserWithRoles {
  user_id: string;
  full_name: string;
  roles: AppRole[];
  schedule_view_permission: ScheduleViewPermission;
}

export function RoleManager() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<AppRole | ''>('');
  const [adding, setAdding] = useState(false);

  const fetchUsersWithRoles = async () => {
    setLoading(true);
    
    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, full_name');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      setLoading(false);
      return;
    }

    // Fetch all roles with schedule permissions
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role, schedule_view_permission');

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      setLoading(false);
      return;
    }

    // Combine profiles with their roles
    const usersWithRoles: UserWithRoles[] = (profiles || []).map(profile => {
      const userRoles = (roles || []).filter(r => r.user_id === profile.user_id);
      // Get the highest schedule permission (all > all_except_admin > team > own)
      const permissionOrder: ScheduleViewPermission[] = ['all', 'all_except_admin', 'team', 'own'];
      const schedulePermission = userRoles.reduce<ScheduleViewPermission>((highest, r) => {
        const perm = (r.schedule_view_permission || 'own') as ScheduleViewPermission;
        return permissionOrder.indexOf(perm) < permissionOrder.indexOf(highest) ? perm : highest;
      }, 'own');
      
      return {
        user_id: profile.user_id,
        full_name: profile.full_name || 'Unknown User',
        roles: userRoles.map(r => r.role as AppRole),
        schedule_view_permission: schedulePermission,
      };
    });

    setUsers(usersWithRoles);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsersWithRoles();
  }, []);

  const addRole = async () => {
    if (!selectedUser || !selectedRole) {
      toast.error('Please select a user and role');
      return;
    }

    setAdding(true);
    const { error } = await supabase
      .from('user_roles')
      .insert({
        user_id: selectedUser,
        role: selectedRole,
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('User already has this role');
      } else {
        toast.error('Failed to add role');
        console.error(error);
      }
    } else {
      toast.success('Role added successfully');
      setSelectedUser('');
      setSelectedRole('');
      fetchUsersWithRoles();
    }
    setAdding(false);
  };

  const removeRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', role);

    if (error) {
      toast.error('Failed to remove role');
      console.error(error);
    } else {
      toast.success('Role removed successfully');
      fetchUsersWithRoles();
    }
  };

  const updateSchedulePermission = async (userId: string, permission: ScheduleViewPermission) => {
    const { error } = await supabase
      .from('user_roles')
      .update({ schedule_view_permission: permission })
      .eq('user_id', userId);

    if (error) {
      toast.error('Failed to update schedule permission');
      console.error(error);
    } else {
      toast.success('Schedule permission updated');
      fetchUsersWithRoles();
    }
  };

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

  const getPermissionLabel = (permission: ScheduleViewPermission) => {
    switch (permission) {
      case 'all': return 'All Schedules';
      case 'all_except_admin': return 'All (except Admin)';
      case 'team': return 'Team Schedules';
      case 'own': return 'Own Schedule';
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
        {/* Add Role Form */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 bg-muted/30 rounded-lg border border-border">
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select user..." />
            </SelectTrigger>
            <SelectContent>
              {users.map(user => (
                <SelectItem key={user.user_id} value={user.user_id}>
                  {user.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Select role..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={addRole} disabled={adding || !selectedUser || !selectedRole}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-2">Add Role</span>
          </Button>
        </div>

        {/* Users Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>User</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Schedule Access</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => (
                <TableRow key={user.user_id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {user.roles.length > 0 ? (
                        user.roles.map(role => (
                          <Badge key={role} variant={getRoleBadgeVariant(role)}>
                            {role}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No roles assigned</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.roles.length > 0 ? (
                      <Select
                        value={user.schedule_view_permission}
                        onValueChange={(v) => updateSchedulePermission(user.user_id, v as ScheduleViewPermission)}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="own">Own Schedule</SelectItem>
                          <SelectItem value="team">Team Schedules</SelectItem>
                          <SelectItem value="all_except_admin">All (except Admin)</SelectItem>
                          <SelectItem value="all">All Schedules</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {user.roles.map(role => (
                        <Button
                          key={role}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeRole(user.user_id, role)}
                          title={`Remove ${role} role`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ))}
                    </div>
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
