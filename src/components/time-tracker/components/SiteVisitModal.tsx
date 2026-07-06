"use client";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, MapPin, Loader2, Image as ImageIcon, MapPinned } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useGeolocation } from '@/components/time-tracker/hooks/useGeolocation';
import { toast } from 'sonner';
import { useDatabaseStore } from '@/components/admin/database/store';
import { useUserRoles } from '@/components/time-tracker/hooks/useUserRoles';

interface SiteVisitModalProps {
  open: boolean;
  onClose: () => void;
  projectId?: string; // Optional: Pre-fill if called from a shift
  projectName?: string;
}

export function SiteVisitModal({ open, onClose, projectId, projectName }: SiteVisitModalProps) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { requestLocation, loading: locationLoading, location } = useGeolocation();
  const { userId } = useUserRoles();
  const createPage = useDatabaseStore(state => state.createPage);

  const handleCaptureLocation = async () => {
    const loc = await requestLocation();
    if (loc) {
      toast.success('Location captured');
    } else {
      toast.error('Failed to capture location');
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) {
      toast.error('Please capture your location first');
      return;
    }

    setIsSubmitting(true);
    try {
      // In a real implementation, we would upload photos to storage and get URLs.
      const photoUrls = photos.map(() => `https://api.dicebear.com/7.x/shapes/svg?seed=${Math.random()}`);

      // Save to journal database
      const title = `Site Visit${projectName ? ` - ${projectName}` : ''} - ${new Date().toLocaleDateString()}`;
      
      const properties: Record<string, any> = {
        'type': 'site_visit',
        'date': new Date().toISOString(),
        'author': userId,
        'location': `Lat: ${location.latitude.toFixed(4)}, Lng: ${location.longitude.toFixed(4)}`
      };

      if (projectId) {
        properties['project'] = [projectId];
      }

      const blocks = [
        {
          id: `block-${Date.now()}-1`,
          type: 'text',
          content: notes || 'No notes provided.',
          styles: {}
        }
      ];

      if (photoUrls.length > 0) {
        blocks.push({
          id: `block-${Date.now()}-2`,
          type: 'image',
          content: photoUrls.join(','),
          styles: {}
        });
      }

      createPage('db-journal-general', {
        title,
        icon: 'MapPinned',
        coverImage: null,
        properties,
        blocks
      });

      toast.success('Site visit recorded in Journal');
      onClose();
      setNotes('');
      setPhotos([]);
    } catch (err) {
      toast.error('Failed to record site visit');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPinned className="w-5 h-5" />
            Record Site Visit
          </DialogTitle>
          <DialogDescription>
            Log a site visit to the primary journal with your current location and optional notes/photos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Location Validation</span>
              <Button 
                type="button" 
                variant={location ? "outline" : "default"} 
                size="sm" 
                onClick={handleCaptureLocation}
                disabled={locationLoading}
              >
                {locationLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MapPin className="w-4 h-4 mr-2" />}
                {location ? 'Recapture Location' : 'Capture Location'}
              </Button>
            </div>
            {location && (
              <p className="text-xs text-muted-foreground">
                Recorded: Lat {location.latitude.toFixed(4)}, Lng {location.longitude.toFixed(4)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Visit Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What happened during the visit?"
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Photos</label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" className="w-full relative overflow-hidden">
                  <Camera className="w-4 h-4 mr-2" />
                  Take Photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handlePhotoUpload}
                  />
                </Button>
                <Button type="button" variant="outline" className="w-full relative overflow-hidden">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handlePhotoUpload}
                  />
                </Button>
              </div>
              {photos.length > 0 && (
                <div className="text-sm text-muted-foreground text-center">
                  {photos.length} photo(s) selected
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !location}>
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save to Journal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
