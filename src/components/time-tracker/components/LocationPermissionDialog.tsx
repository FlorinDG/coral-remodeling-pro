"use client";
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
import { MapPin, Shield } from 'lucide-react';

interface LocationPermissionDialogProps {
  open: boolean;
  onClose: () => void;
  onGranted: () => void;
}

export function LocationPermissionDialog({ open, onClose, onGranted }: LocationPermissionDialogProps) {
  const handleAllow = () => {
    onGranted();
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <MapPin className="w-8 h-8 text-primary" />
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Enable Location Access
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            We need your location to record where you clock in and out. This helps with accurate timesheet tracking.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="flex items-start gap-3 p-4 bg-muted rounded-lg my-4">
          <Shield className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Your location is only recorded when you clock in or out. We respect your privacy and never track you continuously.
          </p>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onClose} className="w-full sm:w-auto">
            Maybe Later
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleAllow} className="w-full sm:w-auto">
            Allow Location
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
