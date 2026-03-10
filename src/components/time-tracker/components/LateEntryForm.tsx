"use client";
import { useState } from 'react';
import { Loader2, Clock, MapPin, CalendarDays } from 'lucide-react';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Input } from '@/components/time-tracker/components/ui/input';
import { Label } from '@/components/time-tracker/components/ui/label';
import { Textarea } from '@/components/time-tracker/components/ui/textarea';
import { Switch } from '@/components/time-tracker/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/time-tracker/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/time-tracker/components/ui/select';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { useScheduledShifts, NOTION_COLORS } from '@/components/time-tracker/hooks/useScheduledShifts';
import { useApprovalRequests } from '@/components/time-tracker/hooks/useApprovalRequests';
import { useGeolocation } from '@/components/time-tracker/hooks/useGeolocation';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';

interface LateEntryFormProps {
  open: boolean;
  onClose: () => void;
}

function getNotionColor(colorName: string) {
  return NOTION_COLORS.find(c => c.name === colorName) || NOTION_COLORS[6];
}

export function LateEntryForm({ open, onClose }: LateEntryFormProps) {
  const { user } = useAuth();
  const { projects } = useScheduledShifts();
  const { createRequest } = useApprovalRequests();
  const { location, loading: geoLoading, requestLocation } = useGeolocation();

  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState('');
  const [clockIn, setClockIn] = useState('09:00');
  const [clockOut, setClockOut] = useState('17:00');
  const [projectId, setProjectId] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [includeLocation, setIncludeLocation] = useState(false);

  const today = startOfDay(new Date());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !date || !clockIn || !clockOut) return;

    const entryDate = parseISO(date);
    if (!isBefore(entryDate, today)) {
      toast.error('Late entries are only for past dates');
      return;
    }

    setLoading(true);

    try {
      // Create clock entry with pending approval
      const clockInTime = new Date(`${date}T${clockIn}`);
      const clockOutTime = new Date(`${date}T${clockOut}`);

      const { data: clockEntry, error: clockError } = await supabase
        .from('clock_entries')
        .insert([{
          user_id: user.id,
          clock_in_time: clockInTime.toISOString(),
          clock_out_time: clockOutTime.toISOString(),
          clock_in_latitude: includeLocation ? location?.latitude : null,
          clock_in_longitude: includeLocation ? location?.longitude : null,
          clock_out_latitude: includeLocation ? location?.latitude : null,
          clock_out_longitude: includeLocation ? location?.longitude : null,
          task_description: taskDescription || null,
        }])
        .select()
        .single();

      if (clockError) throw clockError;

      // If project selected, create a shift
      if (projectId) {
        await supabase
          .from('scheduled_shifts')
          .insert([{
            user_id: user.id,
            project_id: projectId,
            shift_date: date,
            shift_start: clockIn,
            shift_end: clockOut,
            status: 'Completed',
            clock_entry_id: clockEntry.id,
            created_by: user.id,
          }]);
      }

      // Create approval request
      await createRequest(
        'late_entry',
        clockEntry.id,
        'clock_entry',
        user.id,
        {
          date,
          clock_in: clockIn,
          clock_out: clockOut,
          project_id: projectId || null,
          task_description: taskDescription || null,
        },
        'Late timesheet entry submission'
      );

      toast.success('Late entry submitted for approval');
      onClose();
      
      // Reset form
      setDate('');
      setClockIn('09:00');
      setClockOut('17:00');
      setProjectId('');
      setTaskDescription('');
      setIncludeLocation(false);
    } catch (error) {
      console.error('Error submitting late entry:', error);
      toast.error('Failed to submit late entry');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationToggle = (checked: boolean) => {
    setIncludeLocation(checked);
    if (checked && !location) {
      requestLocation();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Submit Late Entry
          </DialogTitle>
          <DialogDescription>
            Submit hours for a past date. This will require admin approval.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="entryDate">Date</Label>
            <Input
              id="entryDate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={format(new Date(today.getTime() - 86400000), 'yyyy-MM-dd')}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Select a past date for this entry
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clockIn">Clock In</Label>
              <Input
                id="clockIn"
                type="time"
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="clockOut">Clock Out</Label>
              <Input
                id="clockOut"
                type="time"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label>Project (Optional)</Label>
            <Select value={projectId || 'none'} onValueChange={(value) => setProjectId(value === 'none' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects.map(project => {
                  const color = getNotionColor(project.color);
                  return (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: color.value }}
                        />
                        {project.name}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="taskDesc">Task Description</Label>
            <Textarea
              id="taskDesc"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="What did you work on?"
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Include Location</p>
                <p className="text-xs text-muted-foreground">Optional for late entries</p>
              </div>
            </div>
            <Switch
              checked={includeLocation}
              onCheckedChange={handleLocationToggle}
              disabled={geoLoading}
            />
          </div>

          {includeLocation && location && (
            <p className="text-xs text-muted-foreground">
              Location: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !date}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit for Approval
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
