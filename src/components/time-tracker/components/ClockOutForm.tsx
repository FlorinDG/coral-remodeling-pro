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
import { Input } from '@/components/time-tracker/components/ui/input';
import { Checkbox } from '@/components/time-tracker/components/ui/checkbox';
import { Clock, FileText, Camera, X, Upload, Coffee } from 'lucide-react';

interface ClockOutFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { taskDescription: string; photos: File[]; noBreak: boolean }) => void;
  elapsedTime: string;
}

export function ClockOutForm({ open, onClose, onSubmit, elapsedTime }: ClockOutFormProps) {
  const [taskDescription, setTaskDescription] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [noBreak, setNoBreak] = useState(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotos((prev) => [...prev, ...files]);
    
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      setPreviewUrls((prev) => [...prev, url]);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(previewUrls[index]);
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!taskDescription.trim()) {
      setError('Task description is required');
      return;
    }

    onSubmit({ taskDescription, photos, noBreak });
    setTaskDescription('');
    setPhotos([]);
    setPreviewUrls([]);
    setError('');
    setNoBreak(false);
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Complete Your Timesheet
          </DialogTitle>
          <DialogDescription>
            Fill in the details before clocking out
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted rounded-lg p-4 mb-4">
          <p className="text-sm text-muted-foreground">Time worked</p>
          <p className="timer-display text-2xl font-bold text-foreground">{elapsedTime}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="taskDescription" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Task Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="taskDescription"
              placeholder="What did you work on today?"
              value={taskDescription}
              onChange={(e) => {
                setTaskDescription(e.target.value);
                if (e.target.value.trim()) setError('');
              }}
              className="min-h-[120px] resize-none"
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Photos (Optional)
            </Label>
            
            <div className="flex flex-wrap gap-3">
              {previewUrls.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`Preview ${index + 1}`}
                    className="w-20 h-20 object-cover rounded-lg border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              
              <label className="w-20 h-20 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-muted transition-colors">
                <Upload className="w-5 h-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground mt-1">Add</span>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
            <Checkbox
              id="noBreak"
              checked={noBreak}
              onCheckedChange={(checked) => setNoBreak(checked === true)}
            />
            <div className="flex items-center gap-2">
              <Coffee className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="noBreak" className="text-sm font-normal cursor-pointer">
                No break taken (skip 30-min deduction)
              </Label>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1 btn-clock-out">
              Clock Out
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
