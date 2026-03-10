"use client";
import { useState, useRef, useEffect } from 'react';
import { Loader2, Clock, MapPin, CalendarDays, FileUp, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Input } from '@/components/time-tracker/components/ui/input';
import { Label } from '@/components/time-tracker/components/ui/label';
import { Textarea } from '@/components/time-tracker/components/ui/textarea';
import { Switch } from '@/components/time-tracker/components/ui/switch';
import { Card, CardContent } from '@/components/time-tracker/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/time-tracker/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/time-tracker/components/ui/collapsible';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { useUserRoles } from '@/components/time-tracker/hooks/useUserRoles';
import { useScheduledShifts, NOTION_COLORS } from '@/components/time-tracker/hooks/useScheduledShifts';
import { useApprovalRequests } from '@/components/time-tracker/hooks/useApprovalRequests';
import { useGeolocation } from '@/components/time-tracker/hooks/useGeolocation';
import { useTasks, Task } from '@/components/time-tracker/hooks/useTasks';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO, isAfter, startOfDay } from 'date-fns';
import { validateFile, validateFiles, getSafeFileType, generateSafeFilePath, ALLOWED_EXTENSIONS } from '@/components/time-tracker/lib/fileValidation';

function getNotionColor(colorName: string) {
  return NOTION_COLORS.find(c => c.name === colorName) || NOTION_COLORS[6];
}

export function LateEntryCard() {
  const { user } = useAuth();
  const { projects } = useScheduledShifts();
  const { createRequest } = useApprovalRequests();
  const { isAdmin } = useUserRoles();
  const { location, loading: geoLoading, requestLocation } = useGeolocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState('');
  const [clockIn, setClockIn] = useState('09:00');
  const [clockOut, setClockOut] = useState('17:00');
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [includeLocation, setIncludeLocation] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [allUsers, setAllUsers] = useState<{ user_id: string; full_name: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);

  // Fetch tasks based on selected project
  const { tasks } = useTasks(projectId || null);
  const pendingTasks = tasks.filter(t => t.status !== 'completed');

  const today = startOfDay(new Date());

  // Fetch all users for admins to submit entries on behalf of others
  useEffect(() => {
    const fetchUsers = async () => {
      if (!isAdmin) return;
      setUsersLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');
      if (!error && data) setAllUsers(data);
      setUsersLoading(false);
    };

    fetchUsers();
  }, [isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !date || !clockIn || !clockOut) return;

    const entryDate = parseISO(date);
    if (isAfter(entryDate, today)) {
      toast.error('Entries cannot be for future dates');
      return;
    }

    setLoading(true);

    try {
      // Determine target user (admin may submit on behalf of another user)
      const targetUserId = isAdmin && selectedUserId ? selectedUserId : user?.id;

      // Create clock entry with pending approval
      const clockInTime = new Date(`${date}T${clockIn}`);
      const clockOutTime = new Date(`${date}T${clockOut}`);

      const { data: clockEntry, error: clockError } = await supabase
        .from('clock_entries')
        .insert([{
          user_id: targetUserId,
          clock_in_time: clockInTime.toISOString(),
          clock_out_time: clockOutTime.toISOString(),
          clock_in_latitude: includeLocation ? location?.latitude : null,
          clock_in_longitude: includeLocation ? location?.longitude : null,
          clock_out_latitude: includeLocation ? location?.latitude : null,
          clock_out_longitude: includeLocation ? location?.longitude : null,
          task_description: taskDescription || null,
          requires_approval: true,
          approval_status: 'pending',
        }])
        .select()
        .single();

      if (clockError) throw clockError;

      let shiftId: string | null = null;

      // If project selected, try to find an existing scheduled shift for this user/date/project
      if (projectId) {
        const { data: existingShifts } = await supabase
          .from('scheduled_shifts')
          .select('*')
          .eq('user_id', targetUserId)
          .eq('shift_date', date)
          .eq('project_id', projectId)
          .limit(1);

        if (existingShifts && existingShifts.length > 0) {
          shiftId = existingShifts[0].id;
          // Link clock entry to existing shift and mark pending approval
          await supabase
            .from('scheduled_shifts')
            .update({
              clock_entry_id: clockEntry.id,
              shift_start: clockIn,
              shift_end: clockOut,
              status: 'Pending Approval',
              last_edited_by: user?.id,
            })
            .eq('id', shiftId);

          // If task selected, assign it to the shift
          if (taskId) {
            await supabase
              .from('shift_tasks')
              .insert([{
                shift_id: shiftId,
                task_id: taskId,
                status: 'completed',
                completed_at: clockOutTime.toISOString(),
                completed_by: user?.id,
              }]);
          }
        } else {
          // Do not create new scheduled shifts when adding hours manually
          shiftId = null;
        }
      }

      // Upload files if any and there's a linked shift
      if (files.length > 0 && shiftId) {
        for (const file of files) {
          const filePath = generateSafeFilePath(`shifts/${shiftId}`, file);
          const { error: uploadError } = await supabase.storage
            .from('project-files')
            .upload(filePath, file);

          if (!uploadError) {
            await supabase.from('schedule_attachments').insert({
              shift_id: shiftId,
              file_name: file.name,
              file_path: filePath,
              file_type: getSafeFileType(file),
              file_size: file.size,
              uploaded_by: user.id,
              source_project_id: projectId || null,
            });
          }
        }
      } else if (files.length > 0 && !shiftId) {
        toast('Files were not attached because no scheduled shift exists for this date/project');
      }

      // Create approval request
      await createRequest(
        'late_entry',
        clockEntry.id,
        'clock_entry',
        targetUserId || user!.id,
        {
          date,
          clock_in: clockIn,
          clock_out: clockOut,
          project_id: projectId || null,
          task_id: taskId || null,
          task_description: taskDescription || null,
          files_count: files.length,
        },
        'Late timesheet entry submission'
      );

      toast.success('Late entry submitted for approval');
      
      // Reset form
      setDate('');
      setClockIn('09:00');
      setClockOut('17:00');
      setProjectId('');
      setTaskId('');
      setTaskDescription('');
      setIncludeLocation(false);
      setFiles([]);
      setIsOpen(false);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    // Validate files before adding
    const validation = validateFiles(selectedFiles);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleProjectChange = (value: string) => {
    setProjectId(value === 'none' ? '' : value);
    setTaskId(''); // Reset task when project changes
  };

  const handleTaskChange = (value: string) => {
    setTaskId(value === 'none' ? '' : value);
  };

  const handleUserChange = (value: string) => {
    setSelectedUserId(value === 'none' ? '' : value);
  };

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center justify-between hover:bg-accent/50 transition-colors text-left">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Submit Late Entry</h3>
                <p className="text-sm text-muted-foreground">Add hours for a past date (requires approval)</p>
              </div>
            </div>
            {isOpen ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="border-t pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {isAdmin && (
                <div>
                  <Label>Worker (Optional)</Label>
                  <Select value={selectedUserId || 'none'} onValueChange={handleUserChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Current user</SelectItem>
                      {usersLoading ? (
                        <SelectItem value="loading" disabled>Loading users...</SelectItem>
                      ) : (
                        allUsers.map(u => (
                          <SelectItem key={u.user_id} value={u.user_id}>
                            {u.full_name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="entryDate">Date</Label>
                <Input
                  id="entryDate"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  max={format(today, 'yyyy-MM-dd')}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Select today or a past date for this entry
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
                <Select value={projectId || 'none'} onValueChange={handleProjectChange}>
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

              {projectId && pendingTasks.length > 0 && (
                <div>
                  <Label>Assigned Task (Optional)</Label>
                  <Select value={taskId || 'none'} onValueChange={handleTaskChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select task" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific task</SelectItem>
                      {pendingTasks.map(task => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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

              {/* File Upload */}
              <div>
                <Label>Attachments (Optional)</Label>
                <div className="mt-2 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    accept={ALLOWED_EXTENSIONS.join(',')}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <FileUp className="h-4 w-4 mr-2" />
                    Add Files
                  </Button>
                  
                  {files.length > 0 && (
                    <div className="space-y-1">
                      {files.map((file, index) => (
                        <div 
                          key={index}
                          className="flex items-center justify-between p-2 bg-muted rounded-md text-sm"
                        >
                          <span className="truncate flex-1">{file.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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

              <div className="flex gap-2 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || !date} className="flex-1">
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Submit for Approval
                </Button>
              </div>
            </form>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
