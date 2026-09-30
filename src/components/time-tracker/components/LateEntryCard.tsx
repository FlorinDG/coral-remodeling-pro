"use client";
import { useState, useRef, useEffect } from 'react';
import { Loader2, Clock, MapPin, CalendarDays, FileUp, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { useUserRoles } from '@/components/time-tracker/hooks/useUserRoles';
import { useScheduledShifts, NOTION_COLORS } from '@/components/time-tracker/hooks/useScheduledShifts';
import { useApprovalRequests } from '@/components/time-tracker/hooks/useApprovalRequests';
import { useGeolocation } from '@/components/time-tracker/hooks/useGeolocation';
import { useTasks, Task } from '@/components/time-tracker/hooks/useTasks';

import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { describeError } from '@/lib/describe-error';
import { format, parseISO, isAfter, startOfDay } from 'date-fns';
import { validateFile, validateFiles, getSafeFileType, generateSafeFilePath, ALLOWED_EXTENSIONS } from '@/components/time-tracker/lib/fileValidation';

function getNotionColor(colorName: string) {
  return NOTION_COLORS.find(c => c.name === colorName) || NOTION_COLORS[6];
}

export function LateEntryCard() {
  const { t } = useTranslation();
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
  const [allUsers, setAllUsers] = useState<{ userId: string; name: string }[]>([]);
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
      try {
        const { hrList } = await import('@/lib/hr-api');
        const data = await hrList<any>('employees');
        if (data) {
          setAllUsers(data.map((u: any) => ({
            userId: u.userId,
            name: `${u.firstName} ${u.lastName}`.trim()
          })).sort((a: any, b: any) => a.name.localeCompare(b.name)));
        }
      } catch (error) {
        console.error('Failed to fetch users', error);
      } finally {
        setUsersLoading(false);
      }
    };

    fetchUsers();
  }, [isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !date || !clockIn || !clockOut) return;

    const entryDate = parseISO(date);
    if (isAfter(entryDate, today)) {
      toast.error(t('lateEntry.futureDate'));
      return;
    }

    setLoading(true);

    try {
      // Determine target user (admin may submit on behalf of another user)
      const targetUserId = isAdmin && selectedUserId ? selectedUserId : user?.id;

      // Upload files first if any
      const filesData: Array<{ key: string; name: string; type: string; size: number }> = [];
      if (files.length > 0) {
        const { uploadFileAction } = await import('@/app/actions/files');
        for (const file of files) {
          const formData = new FormData();
          formData.append('file', file);
          const result = await uploadFileAction(formData, 'shifts');
          if (result.success && result.key) {
            filesData.push({ key: result.key, name: file.name, type: file.type, size: file.size });
          }
        }
      }

      // Submit the entry
      const { submitLateEntry } = await import('@/app/actions/timesheets');
      const result = await submitLateEntry({
        targetUserId: targetUserId || user.id,
        clockInTime: `${date}T${clockIn}`,
        clockOutTime: `${date}T${clockOut}`,
        includeLocation,
        location: location ? { lat: location.latitude, lng: location.longitude, address: '' } : undefined,
        taskDescription,
        projectId,
        taskId,
        filesCount: files.length,
        filesData,
      });

      if (!result.success) {
        throw new Error('Failed to submit late entry');
      }

      toast.success(t('lateEntry.submitted'));
      
      // Reset form
      setDate('');
      setClockIn('09:00');
      setClockOut('17:00');
      setProjectId('');
      setTaskId('');
      setTaskDescription('');
      setIncludeLocation(false);
      setFiles([]);
      setSelectedUserId('');
      setIsOpen(false);
      
    } catch (error) {
      console.error('Error submitting late entry:', error);
      toast.error(`${t('lateEntry.submitFailed')} — ${describeError(error)}`);
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
      toast.error(`${t('lateEntry.invalidFiles')}${validation.error ? ` — ${validation.error}` : ''}`);
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
                <h3 className="font-semibold text-foreground">{t('lateEntry.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('lateEntry.subtitle')}</p>
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
                  <Label>{t('lateEntry.worker')}</Label>
                  <Select value={selectedUserId || 'none'} onValueChange={handleUserChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('lateEntry.selectWorker')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('lateEntry.currentUser')}</SelectItem>
                      {usersLoading ? (
                        <SelectItem value="loading" disabled>{t('lateEntry.loadingUsers')}</SelectItem>
                      ) : (
                        allUsers.map(u => (
                          <SelectItem key={u.userId} value={u.userId}>
                            {u.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="entryDate">{t('lateEntry.date')}</Label>
                <Input
                  id="entryDate"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  max={format(today, 'yyyy-MM-dd')}
                  required
                />
                <p className="text-sm text-muted-foreground mt-1">
                  {t('lateEntry.dateHint')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clockIn">{t('lateEntry.clockIn')}</Label>
                  <Input
                    id="clockIn"
                    type="time"
                    value={clockIn}
                    onChange={(e) => setClockIn(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="clockOut">{t('lateEntry.clockOut')}</Label>
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
                <Label>{t('lateEntry.project')}</Label>
                <Select value={projectId || 'none'} onValueChange={handleProjectChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('lateEntry.selectProject')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('lateEntry.noProject')}</SelectItem>
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
                  <Label>{t('lateEntry.task')}</Label>
                  <Select value={taskId || 'none'} onValueChange={handleTaskChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('lateEntry.selectTask')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('lateEntry.noTask')}</SelectItem>
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
                <Label htmlFor="taskDesc">{t('lateEntry.description')}</Label>
                <Textarea
                  id="taskDesc"
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder={t('lateEntry.descriptionPlaceholder')}
                  rows={3}
                />
              </div>

              {/* File Upload */}
              <div>
                <Label>{t('lateEntry.attachments')}</Label>
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
                    {t('lateEntry.addFiles')}
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
                    <p className="text-sm font-medium">{t('lateEntry.includeLocation')}</p>
                    <p className="text-sm text-muted-foreground">{t('lateEntry.locationOptional')}</p>
                  </div>
                </div>
                <Switch
                  checked={includeLocation}
                  onCheckedChange={handleLocationToggle}
                  disabled={geoLoading}
                />
              </div>

              {includeLocation && location && (
                <p className="text-sm text-muted-foreground">
                  {t('lateEntry.location')}: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsOpen(false)}
                  className="flex-1"
                >
                  {t('lateEntry.cancel')}
                </Button>
                <Button type="submit" disabled={loading || !date} className="flex-1">
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t('lateEntry.submit')}
                </Button>
              </div>
            </form>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
