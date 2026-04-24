// @ts-nocheck
"use client";
// @ts-nocheck — Legacy Supabase component, progressive migration to camelCase
import { useState, useEffect, useMemo } from 'react';

import { Header } from '@/components/time-tracker/components/Header';
import { StatCard } from '@/components/time-tracker/components/StatCard';
import { TimeOffRequestForm } from '@/components/time-tracker/components/TimeOffRequestForm';
import { TimesheetView } from '@/components/time-tracker/components/TimesheetView';
import { LateEntryCard } from '@/components/time-tracker/components/LateEntryCard';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/time-tracker/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/time-tracker/components/ui/table';
import { Badge } from '@/components/time-tracker/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/time-tracker/components/ui/select';
import { Calendar } from '@/components/time-tracker/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/time-tracker/components/ui/popover';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { useUserRoles } from '@/components/time-tracker/hooks/useUserRoles';
import { useTimeOffRequests } from '@/components/time-tracker/hooks/useTimeOffRequests';
import { useCompletedTasks } from '@/components/time-tracker/hooks/useTasks';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { Loader2, CheckSquare, Clock, Users, CalendarIcon, CalendarCheck, CalendarX, Euro, CalendarPlus, ArrowLeft, Calendar as CalendarLucide } from 'lucide-react';
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";

import { format, startOfMonth, endOfMonth, parseISO, differenceInMinutes, subMonths } from 'date-fns';
import { cn } from '@/components/time-tracker/lib/utils';

interface UserProfile {
  user_id: string;
  full_name: string;
  hourly_rate: number | null;
}

export default function Performance() {
  const router = useRouter();
  const navigate = useRouter();
  const { user, profile, loading } = useAuth();
  const { isAdmin, isManager } = useUserRoles();
  const { requests } = useTimeOffRequests();
  const { completedTasks, loading: tasksLoading } = useCompletedTasks();
  const [showTimeOffForm, setShowTimeOffForm] = useState(false);
  
  // Admin user selection
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  
  // Date range filter - default to current month
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  
  const [hourlyRate, setHourlyRate] = useState(0);
  const [stats, setStats] = useState({
    daysPresent: 0,
    daysAbsent: 0,
    hoursWorked: 0,
    amountToBePaid: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const canViewAllUsers = isAdmin || isManager;
  const targetUserId = canViewAllUsers && selectedUserId ? selectedUserId : user?.id;

  // Fetch all users for admin selection
  useEffect(() => {
    const fetchUsers = async () => {
      if (!canViewAllUsers) return;
      
      setUsersLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, hourly_rate')
        .order('full_name');
      
      if (!error && data) {
        setAllUsers(data);
      }
      setUsersLoading(false);
    };

    fetchUsers();
  }, [canViewAllUsers]);

  // Fetch real stats from clock entries and user's hourly rate
  useEffect(() => {
    const fetchStats = async () => {
      if (!targetUserId) return;
      
      setStatsLoading(true);

      // Fetch clock entries and user's hourly rate in parallel
      const [entriesResult, profileResult] = await Promise.all([
        supabase
          .from('clock_entries')
          .select('clock_in_time, clock_out_time')
          .eq('user_id', targetUserId)
          .gte('clock_in_time', startDate.toISOString())
          .lte('clock_in_time', endDate.toISOString()),
        supabase
          .from('profiles')
          .select('hourly_rate')
          .eq('user_id', targetUserId)
          .single()
      ]);

      const rate = profileResult.data?.hourly_rate || 0;
      setHourlyRate(rate);

      if (!entriesResult.error && entriesResult.data) {
        // Calculate unique days present
        const uniqueDays = new Set(
          entriesResult.data.map(entry => format(parseISO(entry.clock_in_time), 'yyyy-MM-dd'))
        );
        const daysPresent = uniqueDays.size;

        // Calculate total hours
        let totalMins = 0;
        entriesResult.data.forEach(entry => {
          if (entry.clock_out_time) {
            totalMins += differenceInMinutes(parseISO(entry.clock_out_time), parseISO(entry.clock_in_time));
          }
        });
        const hoursWorked = Math.round(totalMins / 60 * 10) / 10;

        // Calculate working days in range (weekdays)
        let workingDays = 0;
        const current = new Date(startDate);
        while (current <= endDate) {
          const dayOfWeek = current.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            workingDays++;
          }
          current.setDate(current.getDate() + 1);
        }
        const daysAbsent = Math.max(0, workingDays - daysPresent);

        setStats({
          daysPresent,
          daysAbsent,
          hoursWorked,
          amountToBePaid: Math.round(hoursWorked * rate * 100) / 100,
        });
      }
      setStatsLoading(false);
    };

    fetchStats();
  }, [targetUserId, startDate, endDate]);

  // Get pending time off requests
  const pendingRequests = useMemo(() => 
    requests.filter(r => r.status === 'Pending'),
  [requests]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/admin/hr/time-tracker/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
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
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link 
            href="/admin/hr/time-tracker" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Performance</h1>
              <p className="text-muted-foreground mt-1">
                {canViewAllUsers ? 'View performance and timesheets for all users' : 'Track your work stats and manage time off'}
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={() => setShowTimeOffForm(true)}
                className="flex items-center gap-2"
              >
                <CalendarPlus className="w-4 h-4" />
                Request Time Off
              </Button>
            </div>
          </div>

          {/* Filters: User Selector and Date Range */}
          {canViewAllUsers && (
            <Card className="mt-4">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {/* User Selector */}
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <Select
                      value={selectedUserId || user?.id || ''}
                      onValueChange={(value) => setSelectedUserId(value)}
                    >
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Select a user" />
                      </SelectTrigger>
                      <SelectContent>
                        {usersLoading ? (
                          <SelectItem value="loading" disabled>Loading users...</SelectItem>
                        ) : (
                          allUsers.map((u) => (
                            <SelectItem key={u.user_id} value={u.user_id}>
                              {u.full_name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date Range */}
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-[130px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                          {startDate ? format(startDate, "MMM d, yyyy") : "Start date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={(date) => date && setStartDate(date)}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="text-muted-foreground">to</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-[130px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                          {endDate ? format(endDate, "MMM d, yyyy") : "End date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={(date) => date && setEndDate(date)}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStartDate(startOfMonth(new Date()));
                        setEndDate(endOfMonth(new Date()));
                      }}
                    >
                      This Month
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const lastMonth = subMonths(new Date(), 1);
                        setStartDate(startOfMonth(lastMonth));
                        setEndDate(endOfMonth(lastMonth));
                      }}
                    >
                      Last Month
                    </Button>
                  </div>

                  {selectedUserId && selectedUserId !== user?.id && (
                    <Badge variant="secondary" className="ml-auto">
                      Viewing: {allUsers.find(u => u.user_id === selectedUserId)?.full_name}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Late Entry Card */}
        <div className="mb-8">
          <LateEntryCard />
        </div>

        {/* Stats Grid - 5 cards including Pending Time Off */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          <StatCard
            title="Days Present"
            value={statsLoading ? '...' : stats.daysPresent}
            subtitle={format(startDate, 'MMM d') + ' - ' + format(endDate, 'MMM d')}
            icon={CalendarCheck}
            variant="secondary"
          />
          
          <StatCard
            title="Days Absent"
            value={statsLoading ? '...' : stats.daysAbsent}
            subtitle={format(startDate, 'MMM d') + ' - ' + format(endDate, 'MMM d')}
            icon={CalendarX}
            variant="destructive"
          />
          
          <StatCard
            title="Hours Worked"
            value={statsLoading ? '...' : stats.hoursWorked}
            subtitle={format(startDate, 'MMM d') + ' - ' + format(endDate, 'MMM d')}
            icon={Clock}
            variant="primary"
          />
          
          <StatCard
            title="To Be Paid"
            value={statsLoading ? '...' : `€${stats.amountToBePaid.toLocaleString()}`}
            subtitle="Pending"
            icon={Euro}
            variant="primary"
          />
          
          <StatCard
            title="Pending Time Off"
            value={pendingRequests.length}
            subtitle={pendingRequests.length === 1 ? 'request' : 'requests'}
            icon={CalendarLucide}
            variant="secondary"
          />
        </div>

        {/* Period Summary - Single line format */}
        <div className="bg-card border border-border rounded-xl p-4 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-foreground">Period Summary ({format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')})</h2>
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Present:</span>
                <span className="font-semibold text-foreground">{stats.daysPresent} days</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Absent:</span>
                <span className="font-semibold text-foreground">{stats.daysAbsent} days</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Hours:</span>
                <span className="font-semibold text-foreground">{stats.hoursWorked}h</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">To Pay:</span>
                <span className="font-semibold text-primary">€{stats.amountToBePaid.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Completed Tasks Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Completed Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tasksLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : completedTasks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No completed tasks yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedTasks.slice(0, 10).map((st) => (
                    <TableRow key={st.id}>
                      <TableCell className="font-medium">{st.task?.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{st.task?.project?.name}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {st.completed_at ? format(parseISO(st.completed_at), 'MMM d, yyyy') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Timesheet View */}
        <TimesheetView userId={targetUserId} />

        {/* Bottom back button */}
        <div className="mt-8 flex justify-center">
          <Link 
            href="/admin/hr/time-tracker" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </main>

      <TimeOffRequestForm 
        open={showTimeOffForm} 
        onClose={() => setShowTimeOffForm(false)} 
      />

    </div>
  );
}
