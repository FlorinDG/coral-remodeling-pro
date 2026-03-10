"use client";
import { useState } from 'react';
import { Calendar, Clock, Loader2, Plus, Trash2, User } from 'lucide-react';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/time-tracker/components/ui/card';
import { Input } from '@/components/time-tracker/components/ui/input';
import { Label } from '@/components/time-tracker/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/time-tracker/components/ui/select';
import { Switch } from '@/components/time-tracker/components/ui/switch';
import { useWorkerSchedules, WorkerWithProfile } from '@/components/time-tracker/hooks/useWorkerSchedules';
import { toast } from 'sonner';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function ScheduleManager() {
  const { allWorkers, loading, upsertSchedule, deleteSchedule, toggleScheduleActive } = useWorkerSchedules();
  const [selectedWorker, setSelectedWorker] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [shiftStart, setShiftStart] = useState('09:00');
  const [shiftEnd, setShiftEnd] = useState('17:00');
  const [saving, setSaving] = useState(false);

  const handleAddSchedule = async () => {
    if (!selectedWorker || selectedDay === '') {
      toast.error('Please select a worker and day');
      return;
    }

    setSaving(true);
    const { error } = await upsertSchedule(
      selectedWorker,
      parseInt(selectedDay),
      shiftStart,
      shiftEnd
    );
    setSaving(false);

    if (error) {
      toast.error('Failed to save schedule');
    } else {
      toast.success('Schedule saved');
      setSelectedDay('');
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    const { error } = await deleteSchedule(scheduleId);
    if (error) {
      toast.error('Failed to delete schedule');
    } else {
      toast.success('Schedule deleted');
    }
  };

  const handleToggleActive = async (scheduleId: string, currentActive: boolean) => {
    const { error } = await toggleScheduleActive(scheduleId, !currentActive);
    if (error) {
      toast.error('Failed to update schedule');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Schedule Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Worker Schedule
          </CardTitle>
          <CardDescription>
            Assign shift schedules to workers for push notification reminders.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Worker</Label>
              <Select value={selectedWorker} onValueChange={setSelectedWorker}>
                <SelectTrigger>
                  <SelectValue placeholder="Select worker" />
                </SelectTrigger>
                <SelectContent>
                  {allWorkers.map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Day of Week</Label>
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((day, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Shift Start</Label>
              <Input
                type="time"
                value={shiftStart}
                onChange={(e) => setShiftStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Shift End</Label>
              <Input
                type="time"
                value={shiftEnd}
                onChange={(e) => setShiftEnd(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleAddSchedule} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add Schedule
          </Button>
        </CardContent>
      </Card>

      {/* Worker Schedules List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Worker Schedules
          </CardTitle>
          <CardDescription>
            Manage existing worker schedules and notification settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allWorkers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No workers found. Workers will appear here after they sign up.
            </p>
          ) : (
            <div className="space-y-6">
              {allWorkers.map((worker) => (
                <WorkerScheduleCard
                  key={worker.id}
                  worker={worker}
                  onDelete={handleDeleteSchedule}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WorkerScheduleCard({
  worker,
  onDelete,
  onToggleActive,
}: {
  worker: WorkerWithProfile;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, currentActive: boolean) => void;
}) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <User className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">{worker.full_name}</h3>
      </div>
      {worker.schedules.length === 0 ? (
        <p className="text-sm text-muted-foreground pl-7">No schedules assigned</p>
      ) : (
        <div className="space-y-2 pl-7">
          {worker.schedules.map((schedule) => (
            <div
              key={schedule.id}
              className="flex items-center justify-between bg-muted/50 rounded-md p-2"
            >
              <div className="flex items-center gap-4">
                <span className="font-medium w-24">
                  {DAY_NAMES[schedule.day_of_week]}
                </span>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {schedule.shift_start.slice(0, 5)} - {schedule.shift_end.slice(0, 5)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={schedule.is_active}
                    onCheckedChange={() => onToggleActive(schedule.id, schedule.is_active)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {schedule.is_active ? 'Active' : 'Paused'}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(schedule.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
