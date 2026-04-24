// @ts-nocheck
"use client";
// @ts-nocheck — Legacy Supabase component, progressive migration to camelCase
import { useEffect, useState, useRef } from 'react';
import { useRouter } from "@/i18n/routing";

import { ArrowLeft, Loader2, Calendar, Clock, MapPin, Briefcase, User, FileText, ExternalLink, Coffee, Upload, X, Paperclip } from 'lucide-react';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Header } from '@/components/time-tracker/components/Header';
import { ScheduleCalendar } from '@/components/time-tracker/components/schedule/ScheduleCalendar';
import { useScheduledShifts, ScheduledShift } from '@/components/time-tracker/hooks/useScheduledShifts';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { useProjects } from '@/components/time-tracker/hooks/useProjects';
import {
  Dialog,
  DialogContent,
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
import { Checkbox } from '@/components/time-tracker/components/ui/checkbox';
import { Textarea } from '@/components/time-tracker/components/ui/textarea';
import { Input } from '@/components/time-tracker/components/ui/input';
import { Label } from '@/components/time-tracker/components/ui/label';
import { useApprovalRequests } from '@/components/time-tracker/hooks/useApprovalRequests';
import { cn } from '@/components/time-tracker/lib/utils';
import { toast } from 'sonner';
import { validateFile, validateFiles, getSafeFileType, generateSafeFilePath, ALLOWED_EXTENSIONS } from '@/components/time-tracker/lib/fileValidation';

function formatTime(time: string) {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 || 12;
  return `${displayHour}:${minutes} ${suffix}`;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'Scheduled': return 'bg-muted text-muted-foreground';
    case 'Active': return 'bg-primary/20 text-primary';
    case 'In Progress': return 'bg-secondary/20 text-secondary';
    case 'Completed': return 'bg-accent/20 text-accent-foreground';
    default: return 'bg-muted text-muted-foreground';
  }
}

function openMapsApp(address: string) {
  const encodedAddress = encodeURIComponent(address);
  // Try to detect if user is on iOS or Android
  const userAgent = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);
  
  if (isIOS) {
    window.open(`maps://maps.apple.com/?q=${encodedAddress}`, '_blank');
  } else if (isAndroid) {
    window.open(`geo:0,0?q=${encodedAddress}`, '_blank');
  } else {
    // Fallback to Google Maps for desktop
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
  }
}

export default function Schedule() {
  const router = useRouter();
  const navigate = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { shifts, loading, updateShiftStatus } = useScheduledShifts();
  const { projects } = useProjects();
  const [selectedShift, setSelectedShift] = useState<ScheduledShift | null>(null);
  const { createRequest } = useApprovalRequests();
  const [manualOpen, setManualOpen] = useState(false);
  const [manualClockIn, setManualClockIn] = useState('09:00');
  const [manualClockOut, setManualClockOut] = useState('17:00');
  const [hadBreak, setHadBreak] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetManualForm = () => {
    setManualClockIn('09:00');
    setManualClockOut('17:00');
    setHadBreak(false);
    setSelectedProjectId('');
    setNotes('');
    setSelectedFiles([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFilesList = Array.from(e.target.files || []);
    
    // Validate files before adding
    const validation = validateFiles(selectedFilesList);
    if (!validation.valid) {
      toast.error(validation.error);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    setSelectedFiles(prev => [...prev, ...selectedFilesList]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/admin/hr/time-tracker/auth");
    }
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/hr/time-tracker")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">My Schedule</h1>
            <p className="text-muted-foreground">View your upcoming shifts</p>
          </div>
        </div>

        <ScheduleCalendar 
          shifts={shifts}
          onShiftClick={setSelectedShift}
        />

        {/* Shift Detail Dialog */}
        <Dialog open={!!selectedShift} onOpenChange={() => setSelectedShift(null)}>
          <DialogContent className="sm:max-w-md border-0 bg-background/95 backdrop-blur-xl shadow-2xl">
            <DialogHeader className="pb-2">
              <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl font-semibold">
                    {selectedShift?.profile?.full_name || 'Shift Details'}
                  </DialogTitle>
                  {selectedShift && (
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium",
                      getStatusColor(selectedShift.status)
                    )}>
                      {selectedShift.status}
                    </span>
                  )}
                </div>
            </DialogHeader>
            
            {selectedShift && (
              <div className="space-y-1 pt-2">
                {/* Date */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium">
                      {new Date(selectedShift.shift_date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
                
                {/* Time */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="p-2 rounded-full bg-secondary/10">
                    <Clock className="h-4 w-4 text-secondary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Time</p>
                    <p className="font-medium">
                      {formatTime(selectedShift.shift_start)} - {formatTime(selectedShift.shift_end)}
                    </p>
                  </div>
                </div>
                
                {/* Project */}
                {selectedShift.project && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="p-2 rounded-full bg-accent/10">
                      <Briefcase className="h-4 w-4 text-accent-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Project</p>
                      <p className="font-medium">{selectedShift.project.name}</p>
                    </div>
                  </div>
                )}

                {/* Worker */}
                {selectedShift.profile?.full_name && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="p-2 rounded-full bg-primary/10">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Worker</p>
                      <p className="font-medium">{selectedShift.profile.full_name}</p>
                    </div>
                  </div>
                )}
                
                {/* Location - Clickable */}
                {selectedShift.project?.address && (
                  <button
                    onClick={() => openMapsApp(selectedShift.project!.address!)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-primary/10 transition-colors group text-left"
                  >
                    <div className="p-2 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Location</p>
                      <p className="font-medium truncate group-hover:text-primary transition-colors">
                        {selectedShift.project.address}
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  </button>
                )}
                
                {/* Role */}
                {selectedShift.role && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="p-2 rounded-full bg-secondary/10">
                      <User className="h-4 w-4 text-secondary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Role</p>
                      <p className="font-medium">{selectedShift.role}</p>
                    </div>
                  </div>
                )}
                
                {/* Notes */}
                {selectedShift.notes && (
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Notes</p>
                    </div>
                    <p className="text-sm pl-6">{selectedShift.notes}</p>
                  </div>
                )}
                <div className="pt-2">
                  <Button 
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      resetManualForm();
                      setManualClockIn(selectedShift.shift_start || '09:00');
                      setManualClockOut(selectedShift.shift_end || '17:00');
                      setSelectedProjectId(selectedShift.project_id || '');
                      setManualOpen(true);
                    }}
                  >
                    Add Hours Manually
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Manual Hours Dialog */}
        <Dialog open={manualOpen} onOpenChange={(open) => {
          setManualOpen(open);
          if (!open) resetManualForm();
        }}>
          <DialogContent className="sm:max-w-md border-0 bg-background/95 backdrop-blur-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Hours Manually</DialogTitle>
            </DialogHeader>
            {selectedShift && (
              <div className="space-y-4 pt-2">
                {/* Date display */}
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <div className="font-medium mt-1">
                    {new Date(selectedShift.shift_date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </div>

                {/* Time inputs */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clockIn" className="text-xs text-muted-foreground">Clock In</Label>
                    <Input 
                      id="clockIn"
                      type="time" 
                      value={manualClockIn} 
                      onChange={(e) => setManualClockIn(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clockOut" className="text-xs text-muted-foreground">Clock Out</Label>
                    <Input 
                      id="clockOut"
                      type="time" 
                      value={manualClockOut} 
                      onChange={(e) => setManualClockOut(e.target.value)} 
                    />
                  </div>
                </div>

                {/* Break checkbox */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <Checkbox 
                    id="hadBreak" 
                    checked={hadBreak} 
                    onCheckedChange={(checked) => setHadBreak(checked === true)}
                  />
                  <div className="flex items-center gap-2">
                    <Coffee className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="hadBreak" className="text-sm font-medium cursor-pointer">
                      Had a break
                    </Label>
                  </div>
                </div>

                {/* Project selection */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Project</Label>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: project.color }}
                            />
                            {project.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-xs text-muted-foreground">Notes</Label>
                  <Textarea 
                    id="notes"
                    placeholder="Add any notes about this shift..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                </div>

                {/* File upload */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Attachments</Label>
                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={ALLOWED_EXTENSIONS.join(',')}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Add Photo or File
                    </Button>

                    {/* Selected files list */}
                    {selectedFiles.length > 0 && (
                      <div className="space-y-2 mt-2">
                        {selectedFiles.map((file, index) => (
                          <div 
                            key={index} 
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm truncate">{file.name}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 flex-shrink-0"
                              onClick={() => removeFile(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setManualOpen(false)} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={async () => {
                      if (!selectedShift || !user) return;
                      setSubmitting(true);
                      try {
                        const clockInTime = new Date(`${selectedShift.shift_date}T${manualClockIn}`);
                        const clockOutTime = new Date(`${selectedShift.shift_date}T${manualClockOut}`);
                        
                        // Create clock entry with task description containing notes and break info
                        const taskDescription = [
                          notes,
                          hadBreak ? '[Break taken]' : ''
                        ].filter(Boolean).join('\n');

                        const { data: clockEntry, error: clockError } = await supabase
                          .from('clock_entries')
                          .insert([{
                            user_id: selectedShift.user_id,
                            clock_in_time: clockInTime.toISOString(),
                            clock_out_time: clockOutTime.toISOString(),
                            requires_approval: true,
                            approval_status: 'pending',
                            task_description: taskDescription || null,
                          }])
                          .select()
                          .single();

                        if (clockError) throw clockError;

                        // Link clock entry to the selected shift and update project
                        await supabase
                          .from('scheduled_shifts')
                          .update({
                            clock_entry_id: clockEntry.id,
                            shift_start: manualClockIn,
                            shift_end: manualClockOut,
                            status: 'Pending Approval',
                            last_edited_by: user.id,
                            project_id: selectedProjectId || null,
                            notes: notes || null,
                          })
                          .eq('id', selectedShift.id);

                        // Upload files if any
                        for (const file of selectedFiles) {
                          const filePath = generateSafeFilePath(`schedules/${selectedShift.id}`, file);
                          const { error: uploadError } = await supabase.storage
                            .from('project-files')
                            .upload(filePath, file);

                          if (!uploadError) {
                            await supabase
                              .from('schedule_attachments')
                              .insert({
                                shift_id: selectedShift.id,
                                file_name: file.name,
                                file_path: filePath,
                                file_type: getSafeFileType(file),
                                file_size: file.size,
                                uploaded_by: user.id,
                              });
                          }
                        }

                        // Create approval request
                        await createRequest(
                          'manual_hours',
                          clockEntry.id,
                          'clock_entry',
                          selectedShift.user_id,
                          { 
                            date: selectedShift.shift_date, 
                            clock_in: manualClockIn, 
                            clock_out: manualClockOut,
                            had_break: hadBreak,
                            project_id: selectedProjectId || null,
                            notes: notes || null,
                            files_count: selectedFiles.length
                          },
                          notes || 'Manual hours submitted from schedule'
                        );

                        toast.success('Hours submitted for approval');
                        setManualOpen(false);
                        setSelectedShift(null);
                        resetManualForm();
                      } catch (err) {
                        console.error(err);
                        toast.error('Failed to submit hours');
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit for Approval'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}