"use client";
import { Loader2, Calendar, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useWorkerSchedules } from '@/components/time-tracker/hooks/useWorkerSchedules';
import { formatTime } from '@/lib/format/date';

export function AllSchedulesView() {
  const { allWorkers, loading: schedulesLoading, DAY_NAMES } = useWorkerSchedules();

  if (schedulesLoading) {
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
      workerName: worker.name,
    }))
  ).sort((a, b) => {
    // Sort by day of week first, then by start time
    if (a.dayOfWeek !== b.dayOfWeek) {
      return a.dayOfWeek - b.dayOfWeek;
    }
    return a.shiftStart.localeCompare(b.shiftStart);
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
                      <Badge variant="outline">{DAY_NAMES[schedule.dayOfWeek]}</Badge>
                    </TableCell>
                    <TableCell>{formatTime(schedule.shiftStart)}</TableCell>
                    <TableCell>{formatTime(schedule.shiftEnd)}</TableCell>
                    <TableCell>
                      <Badge variant={schedule.isActive ? 'default' : 'secondary'}>
                        {schedule.isActive ? 'Active' : 'Inactive'}
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
              <Card key={worker.userId} className="bg-muted/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{worker.name || worker.userId}</CardTitle>
                </CardHeader>
                <CardContent>
                  {worker.schedules.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No schedules assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {worker.schedules
                        .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                        .map(schedule => (
                          <div
                            key={schedule.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-muted-foreground">
                              {DAY_NAMES[schedule.dayOfWeek].slice(0, 3)}
                            </span>
                            <span className="font-mono">
                              {formatTime(schedule.shiftStart)} - {formatTime(schedule.shiftEnd)}
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
