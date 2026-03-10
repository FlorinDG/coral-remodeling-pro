"use client";
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/time-tracker/components/ui/dialog';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Textarea } from '@/components/time-tracker/components/ui/textarea';
import { Label } from '@/components/time-tracker/components/ui/label';
import { Calendar } from '@/components/time-tracker/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/time-tracker/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/time-tracker/components/ui/popover';
import { CalendarDays, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/components/time-tracker/lib/utils';
import { toast } from 'sonner';

interface TimeOffRequestFormProps {
  open: boolean;
  onClose: () => void;
}

type TimeOffType = 'vacation' | 'sick' | 'personal' | 'other';

export function TimeOffRequestForm({ open, onClose }: TimeOffRequestFormProps) {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [type, setType] = useState<TimeOffType>('vacation');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!startDate) newErrors.startDate = 'Start date is required';
    if (!endDate) newErrors.endDate = 'End date is required';
    if (startDate && endDate && startDate > endDate) {
      newErrors.endDate = 'End date must be after start date';
    }
    if (!reason.trim()) newErrors.reason = 'Reason is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    // Here you would submit to Notion
    console.log({ startDate, endDate, type, reason });
    
    toast.success('Time off request submitted!', {
      description: `${format(startDate!, 'MMM d')} - ${format(endDate!, 'MMM d, yyyy')}`,
    });
    
    // Reset form
    setStartDate(undefined);
    setEndDate(undefined);
    setType('vacation');
    setReason('');
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Request Time Off
          </DialogTitle>
          <DialogDescription>
            Submit a request for vacation, sick leave, or personal time
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as TimeOffType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vacation">🏖️ Vacation</SelectItem>
                <SelectItem value="sick">🏥 Sick Leave</SelectItem>
                <SelectItem value="personal">👤 Personal</SelectItem>
                <SelectItem value="other">📋 Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !startDate && 'text-muted-foreground',
                      errors.startDate && 'border-destructive'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'MMM d') : 'Select'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
              {errors.startDate && (
                <p className="text-xs text-destructive">{errors.startDate}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !endDate && 'text-muted-foreground',
                      errors.endDate && 'border-destructive'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'MMM d') : 'Select'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    disabled={(date) => date < (startDate || new Date())}
                  />
                </PopoverContent>
              </Popover>
              {errors.endDate && (
                <p className="text-xs text-destructive">{errors.endDate}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              placeholder="Brief description of your time off request..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (e.target.value.trim()) {
                  setErrors((prev) => ({ ...prev, reason: '' }));
                }
              }}
              className={cn('resize-none', errors.reason && 'border-destructive')}
              rows={3}
            />
            {errors.reason && (
              <p className="text-xs text-destructive">{errors.reason}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Submit Request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
