"use client";
import { User } from 'lucide-react';
import { Card, CardContent } from '@/components/time-tracker/components/ui/card';
import { Badge } from '@/components/time-tracker/components/ui/badge';
import type { AppRole } from '@/components/time-tracker/hooks/useUserRoles';

interface UserCardProps {
  user: {
    id: string;
    user_id: string;
    full_name: string;
    roles: AppRole[];
    teams: { id: string; name: string; role: string }[];
  };
  onClick: () => void;
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

export function UserCard({ user, onClick }: UserCardProps) {
  return (
    <Card 
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <h3 className="font-medium truncate">{user.full_name}</h3>
            
            {/* Teams */}
            <div className="flex flex-wrap gap-1">
              {user.teams.length > 0 ? (
                user.teams.slice(0, 2).map(team => (
                  <Badge key={team.id} variant="outline" className="text-xs">
                    {team.name}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">No teams</span>
              )}
              {user.teams.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{user.teams.length - 2}
                </Badge>
              )}
            </div>

            {/* Roles */}
            <div className="flex flex-wrap gap-1">
              {user.roles.length > 0 ? (
                user.roles.map(role => (
                  <Badge key={role} variant={getRoleBadgeVariant(role)} className="text-xs">
                    {role}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">No roles</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
