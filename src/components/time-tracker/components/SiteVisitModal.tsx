"use client";
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, MapPin, Loader2, Image as ImageIcon, MapPinned, Plus, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGeolocation } from '@/components/time-tracker/hooks/useGeolocation';
import { toast } from 'sonner';
import { useDatabaseStore } from '@/components/admin/database/store';
import { useUserRoles } from '@/components/time-tracker/hooks/useUserRoles';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

interface SiteVisitModalProps {
  open: boolean;
  onClose: () => void;
  projectId?: string; // Optional: Pre-fill if called from a shift
  projectName?: string;
}

export function SiteVisitModal({ open, onClose, projectId, projectName }: SiteVisitModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [notes, setNotes] = useState('');
  const [scope, setScope] = useState('');
  const [contactName, setContactName] = useState('');
  const [clientId, setClientId] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  
  const { requestLocation, loading: locationLoading, location } = useGeolocation();
  const { userId } = useUserRoles();
  const createPage = useDatabaseStore(state => state.createPage);
  const resolveDbId = useDatabaseStore(state => state.resolveDbId);
  const databases = useDatabaseStore(state => state.databases);
  
  const clientsDbId = resolveDbId('db-clients');
  const siteVisitsDbId = resolveDbId('db-site-visits');
  const quotesDbId = resolveDbId('db-quotations');
  
  const clients = useMemo(() => {
    return databases[clientsDbId]?.pages || [];
  }, [databases, clientsDbId]);

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

  const handleCreateContact = async () => {
    if (!newContactName) return;
    try {
      const newClient = await createPage(clientsDbId, {
        title: newContactName
      });
      setClientId(newClient.id);
      setShowNewContact(false);
      setNewContactName('');
      toast.success('Contact created');
    } catch (err) {
      toast.error('Failed to create contact');
    }
  };

  const handleSaveVisit = async (createQuote: boolean) => {
    if (!clientId) {
      toast.error('Please select or create a client');
      return;
    }

    setIsSubmitting(true);
    try {
      const photoUrls = photos.map(() => `https://api.dicebear.com/7.x/shapes/svg?seed=${Math.random()}`);
      
      const title = `Site Visit - ${new Date().toLocaleDateString()}`;
      
      const locObj = location ? {
        lat: location.latitude,
        lng: location.longitude,
        address: `Lat: ${location.latitude.toFixed(4)}, Lng: ${location.longitude.toFixed(4)}`
      } : null;

      const properties: Record<string, any> = {
        'title': title,
        'client': [clientId],
        'contact': contactName,
        'scope': scope,
        'notes': notes,
        'location': locObj,
        'photos': photoUrls.join(',')
      };

      const visit = await createPage(siteVisitsDbId, properties);
      toast.success('Site visit recorded successfully');

      if (createQuote) {
        // Create draft quote
        const quoteProps: Record<string, any> = {
            title: `Quote for ${title}`,
            client: [clientId],
            status: 'opt-draft',
            betreft: scope || 'Site Visit Quote',
            location: locObj
        };
        const quote = await createPage(quotesDbId, quoteProps);
        toast.success('Draft quotation created');
        onClose();
        router.push(`/nl/admin/quotations/${quote.id}`);
      } else {
        onClose();
      }

      setNotes('');
      setScope('');
      setContactName('');
      setClientId('');
      setPhotos([]);
    } catch (err) {
      toast.error('Failed to record site visit');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPinned className="w-5 h-5" />
            Record Site Visit
          </DialogTitle>
          <DialogDescription>
            Capture structured data for a new site visit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Client Selection */}
          {!showNewContact ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Client / Contact</Label>
                <Button variant="ghost" size="sm" onClick={() => setShowNewContact(true)}>
                  <Plus className="w-4 h-4 mr-1" /> New Contact
                </Button>
              </div>
              <select 
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">Select a client...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.properties.title as string || 'Unnamed'}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-2 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-md border">
              <Label>Create New Contact</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Contact Name" 
                  value={newContactName} 
                  onChange={e => setNewContactName(e.target.value)} 
                />
                <Button onClick={handleCreateContact} disabled={!newContactName}>Create</Button>
                <Button variant="ghost" onClick={() => setShowNewContact(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Contact Person (optional)</Label>
            <Input 
              value={contactName} 
              onChange={e => setContactName(e.target.value)} 
              placeholder="Who did you meet?" 
            />
          </div>

          <div className="space-y-2">
            <Label>Scope of Work</Label>
            <Textarea 
              value={scope} 
              onChange={e => setScope(e.target.value)} 
              placeholder="Brief description of the required work..." 
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label>Additional Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any other details..."
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Location</Label>
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
            <Label>Photos</Label>
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

          <DialogFooter className="mt-6 flex sm:justify-between gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="secondary"
                disabled={isSubmitting || !clientId}
                onClick={() => handleSaveVisit(false)}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save Visit
              </Button>
              <Button 
                type="button" 
                disabled={isSubmitting || !clientId}
                onClick={() => handleSaveVisit(true)}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                Save & Quote
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
