"use client";
import { AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface GeofenceWarningDialogProps {
  open: boolean;
  distanceMeters: number;
  siteName: string;
  onCancel: () => void;
  onClockWithoutShift: () => void;
}

export function GeofenceWarningDialog({
  open,
  distanceMeters,
  siteName,
  onCancel,
  onClockWithoutShift,
}: GeofenceWarningDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(val) => !val && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            Location Validation Failed
          </DialogTitle>
          <DialogDescription className="pt-3">
            You're ~{distanceMeters} m from {siteName || 'the site'} — you cannot clock into this shift from your current location.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm text-muted-foreground">
            If you need to log hours anyway (e.g. picking up materials), you can Clock Without Shift. This will create a pending time entry that requires manager approval.
          </p>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <Button variant="outline" onClick={onCancel} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button variant="default" onClick={onClockWithoutShift} className="w-full sm:w-auto">
            Clock Without Shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
