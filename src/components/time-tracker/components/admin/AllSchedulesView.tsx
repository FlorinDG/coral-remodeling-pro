"use client";
import { Loader2, Calendar, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/time-tracker/components/ui/card';
import { Badge } from '@/components/time-tracker/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/time-tracker/components/ui/table';
import { useWorkerSchedules } from '@/components/time-tracker/hooks/useWorkerSchedules';

export function AllSchedulesView() {
  const { allWorkers, loading, DAY_NAMES } = useWorkerSchedules();

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
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

  // Flatten all schedules for the table view
  const allSchedules = allWorkers.flatMap(worker =>
    worker.schedules.map(schedule => ({
      ...schedule,
      workerName: worker.full_name,
    }))
  ).sort((a, b) => {
    // Sort by day of week first, then by start time
    if (a.day_of_week !== b.day_of_week) {
      return a.day_of_week - b.day_of_week;
    }
    return a.shift_start.localeCompare(b.shift_start);
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>All Worker Schedules</CardTitle>
            <CardDescription>View all assigned schedules across all workers</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {allSchedules.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No schedules have been created yet.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Worker</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Shift Start</TableHead>
                  <TableHead>Shift End</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allSchedules.map(schedule => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">{schedule.workerName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{DAY_NAMES[schedule.day_of_week]}</Badge>
                    </TableCell>
                    <TableCell>{formatTime(schedule.shift_start)}</TableCell>
                    <TableCell>{formatTime(schedule.shift_end)}</TableCell>
                    <TableCell>
                      <Badge variant={schedule.is_active ? 'default' : 'secondary'}>
                        {schedule.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Summary by Worker */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">Summary by Worker</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allWorkers.map(worker => (
              <Card key={worker.id} className="bg-muted/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{worker.full_name}</CardTitle>
                </CardHeader>
                <CardContent>
                  {worker.schedules.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No schedules assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {worker.schedules
                        .sort((a, b) => a.day_of_week - b.day_of_week)
                        .map(schedule => (
                          <div
                            key={schedule.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-muted-foreground">
                              {DAY_NAMES[schedule.day_of_week].slice(0, 3)}
                            </span>
                            <span className="font-mono">
                              {formatTime(schedule.shift_start)} - {formatTime(schedule.shift_end)}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
