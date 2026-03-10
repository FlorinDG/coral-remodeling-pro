"use client";
import { useState, useEffect } from 'react';
import { Loader2, Clock, MapPin, FileText, Paperclip, ListTodo, Pencil, Image, Download, Check, AlertCircle, Play } from 'lucide-react';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Badge } from '@/components/time-tracker/components/ui/badge';
import { ScrollArea } from '@/components/time-tracker/components/ui/scroll-area';
import { Separator } from '@/components/time-tracker/components/ui/separator';
import { AttachmentLink, AttachmentImage } from '@/components/time-tracker/components/ui/attachment-link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/time-tracker/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/time-tracker/components/ui/alert-dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/time-tracker/components/ui/tabs';
import { ScheduledShift, Project, NOTION_COLORS } from '@/components/time-tracker/hooks/useScheduledShifts';
import { useScheduleAttachments, ScheduleAttachment } from '@/components/time-tracker/hooks/useScheduleAttachments';
import { useShiftTasks } from '@/components/time-tracker/hooks/useTasks';
import { useApprovalRequests } from '@/components/time-tracker/hooks/useApprovalRequests';
import { useClockEntries } from '@/components/time-tracker/hooks/useClockEntries';
import { useGeolocation } from '@/components/time-tracker/hooks/useGeolocation';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO, differenceInMinutes, isToday } from 'date-fns';

interface ClockEntry {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_in_latitude: number | null;
  clock_in_longitude: number | null;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  task_description: string | null;
}

interface ShiftViewDialogProps {
  shift: ScheduledShift | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  onRequestEdit: () => void;
  isAdmin: boolean;
  onClockIn?: () => void;
}

function getNotionColor(colorName: string) {
  return NOTION_COLORS.find(c => c.name === colorName) || NOTION_COLORS[6];
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return Image;
  return FileText;
}

export function ShiftViewDialog({
  shift,
  open,
  onOpenChange,
  projects,
  onRequestEdit,
  isAdmin,
  onClockIn,
}: ShiftViewDialogProps) {
  const [clockEntry, setClockEntry] = useState<ClockEntry | null>(null);
  const [loadingClock, setLoadingClock] = useState(false);
  const [showAdminConfirm, setShowAdminConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [isClockingIn, setIsClockingIn] = useState(false);

  const { attachments, loading: attachmentsLoading, fetchAttachments } = useScheduleAttachments(shift?.id || null);
  const { shiftTasks, loading: shiftTasksLoading } = useShiftTasks(shift?.id || null);
  const { createRequest } = useApprovalRequests();
  const { activeEntry, clockIn } = useClockEntries();
  const { location, requestLocation } = useGeolocation();

  // Check if shift has clock entry (hours attached)
  const hasClockEntry = !!shift?.clock_entry_id;

  // Fetch clock entry details
  useEffect(() => {
    const fetchClockEntry = async () => {
      if (!shift?.clock_entry_id) {
        setClockEntry(null);
        return;
      }

      setLoadingClock(true);
      const { data, error } = await supabase
        .from('clock_entries')
        .select('*')
        .eq('id', shift.clock_entry_id)
        .single();

      if (!error && data) {
        setClockEntry(data);
      }
      setLoadingClock(false);
    };

    if (open && shift?.clock_entry_id) {
      fetchClockEntry();
    }
  }, [shift?.clock_entry_id, open]);

  // Fetch attachments when dialog opens
  useEffect(() => {
    if (shift?.id && open) {
      fetchAttachments();
      setActiveTab('details');
    }
  }, [shift?.id, open, fetchAttachments]);

  const handleEditRequest = async () => {
    if (isAdmin) {
      // Admin can edit directly
      setShowAdminConfirm(true);
    } else {
      // Non-admin needs to request approval
      if (!shift) return;
      
      const { error } = await createRequest(
        'shift_edit',
        shift.id,
        'scheduled_shift',
        shift.user_id,
        { shift_id: shift.id },
        'Request to edit past shift with attached hours'
      );

      if (error) {
        toast.error('Failed to submit edit request');
      } else {
        toast.success('Edit request submitted for approval');
        onOpenChange(false);
      }
    }
  };

  const handleAdminConfirmEdit = () => {
    setShowAdminConfirm(false);
    onRequestEdit();
  };

  // Check if shift is for today and can be clocked in
  const canClockIn = shift && 
    isToday(parseISO(shift.shift_date)) && 
    !hasClockEntry && 
    !activeEntry &&
    shift.status !== 'Completed';

  const handleClockIn = async () => {
    if (!shift) return;
    
    setIsClockingIn(true);
    try {
      await requestLocation();
      const { error } = await clockIn(location, shift.id);
      
      if (error) {
        toast.error('Failed to clock in');
      } else {
        toast.success('Clocked in successfully');
        onOpenChange(false);
        onClockIn?.();
      }
    } catch (err) {
      toast.error('Failed to clock in');
    } finally {
      setIsClockingIn(false);
    }
  };

  if (!shift) return null;

  const project = projects.find(p => p.id === shift.project_id);
  const projectColor = project ? getNotionColor(project.color) : null;

  // Calculate worked hours from clock entry
  let workedHours = 0;
  if (clockEntry?.clock_out_time) {
    const mins = differenceInMinutes(
      parseISO(clockEntry.clock_out_time),
      parseISO(clockEntry.clock_in_time)
    );
    workedHours = Math.round(mins / 60 * 10) / 10;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                View Shift
                {hasClockEntry && (
                  <Badge variant="outline" className="text-secondary border-secondary/30">
                    <Clock className="h-3 w-3 mr-1" />
                    Hours Attached
                  </Badge>
                )}
              </DialogTitle>
            </div>
            {hasClockEntry && (
            <div className="flex items-center gap-2">
              {canClockIn && (
                <Button
                  size="sm"
                  onClick={handleClockIn}
                  disabled={isClockingIn}
                  className="flex items-center gap-1"
                >
                  {isClockingIn ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Clock In
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleEditRequest}
                className="flex items-center gap-1"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </div>
            )}
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-1">
                <ListTodo className="h-4 w-4" />
                Tasks
                {shiftTasks.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {shiftTasks.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="attachments" className="flex items-center gap-1">
                <Paperclip className="h-4 w-4" />
                Files
                {attachments.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {attachments.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 mt-4">
              {/* Shift Info */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Employee</span>
                  <span className="font-medium">{shift.profile?.full_name || 'Unknown'}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Date</span>
                  <span className="font-medium">{format(parseISO(shift.shift_date), 'EEEE, MMMM d, yyyy')}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Scheduled Time</span>
                  <span className="font-medium">{shift.shift_start} - {shift.shift_end}</span>
                </div>
                
                {project && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Project</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: projectColor?.value }}
                      />
                      <span className="font-medium">{project.name}</span>
                    </div>
                  </div>
                )}
                
                {shift.role && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Role</span>
                    <Badge variant="outline">{shift.role}</Badge>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={shift.status === 'Completed' ? 'default' : 'secondary'}>
                    {shift.status}
                  </Badge>
                </div>
              </div>

              {shift.notes && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-2">Notes</h4>
                    <p className="text-sm text-muted-foreground">{shift.notes}</p>
                  </div>
                </>
              )}

              {/* Clock Entry Details */}
              {hasClockEntry && (
                <>
                  <Separator />
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Worked Hours
                    </h4>
                    
                    {loadingClock ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    ) : clockEntry ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Clock In</span>
                          <span>{format(parseISO(clockEntry.clock_in_time), 'HH:mm')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Clock Out</span>
                          <span>
                            {clockEntry.clock_out_time 
                              ? format(parseISO(clockEntry.clock_out_time), 'HH:mm')
                              : <Badge variant="outline" className="text-primary">In Progress</Badge>
                            }
                          </span>
                        </div>
                        {clockEntry.clock_out_time && (
                          <div className="flex justify-between font-medium">
                            <span>Total Hours</span>
                            <span>{workedHours}h</span>
                          </div>
                        )}
                        
                        {(clockEntry.clock_in_latitude || clockEntry.clock_out_latitude) && (
                          <div className="pt-2 border-t mt-2">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="text-xs">Location recorded</span>
                            </div>
                          </div>
                        )}

                        {clockEntry.task_description && (
                          <div className="pt-2 border-t mt-2">
                            <span className="text-muted-foreground">Task Description:</span>
                            <p className="mt-1">{clockEntry.task_description}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No clock data found</p>
                    )}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              {shiftTasksLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : shiftTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No tasks assigned to this shift</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {shiftTasks.map(shiftTask => (
                    <div
                      key={shiftTask.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border bg-card ${
                        shiftTask.status === 'completed' ? 'opacity-60' : ''
                      }`}
                    >
                      {shiftTask.status === 'completed' ? (
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${
                          shiftTask.status === 'completed' ? 'line-through text-muted-foreground' : ''
                        }`}>
                          {shiftTask.task?.title || 'Unknown task'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {shiftTask.task?.priority && shiftTask.task.priority !== 'normal' && (
                            <Badge 
                              variant={shiftTask.task.priority === 'high' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {shiftTask.task.priority}
                            </Badge>
                          )}
                          {shiftTask.status === 'completed' && (
                            <Badge variant="outline" className="text-xs text-green-600">Completed</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="attachments" className="mt-4">
              {attachmentsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : attachments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No files attached to this shift</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attachments.map(attachment => {
                    const Icon = getFileIcon(attachment.file_type);
                    const isImage = attachment.file_type.startsWith('image/');
                    
                    return (
                      <div
                        key={attachment.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                      >
                        {isImage ? (
                          <AttachmentImage
                            filePath={attachment.file_path}
                            alt={attachment.file_name}
                            className="h-10 w-10 rounded object-cover"
                            fallback={
                              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                                <Icon className="h-5 w-5 text-muted-foreground" />
                              </div>
                            }
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {attachment.file_size && (
                              <span>{formatFileSize(attachment.file_size)}</span>
                            )}
                            {attachment.source_project_id && (
                              <Badge variant="outline" className="text-xs">From Project</Badge>
                            )}
                          </div>
                        </div>
                        <AttachmentLink
                          filePath={attachment.file_path}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent hover:text-accent-foreground"
                        >
                          <Download className="h-4 w-4" />
                        </AttachmentLink>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Admin Confirmation Dialog */}
      <AlertDialog open={showAdminConfirm} onOpenChange={setShowAdminConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Shift with Attached Hours?</AlertDialogTitle>
            <AlertDialogDescription>
              This shift has clock entries attached. Editing may affect timesheet records and payroll calculations. 
              As an admin, you can proceed with editing. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAdminConfirmEdit}>
              Continue Editing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
