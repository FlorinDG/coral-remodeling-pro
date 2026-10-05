"use client";

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { NOTION_COLORS } from '@/components/time-tracker/hooks/useScheduledShifts';
import { toast } from 'sonner';

interface InlineCreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateProject: (data: {
    name: string;
    address?: string | null;
    color?: string;
    latitude?: number;
    longitude?: number;
  }) => Promise<unknown>;
  onProjectCreated?: (projectId: string) => void;
}

export function InlineCreateProjectModal({
  open,
  onOpenChange,
  onCreateProject,
  onProjectCreated,
}: InlineCreateProjectModalProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [color, setColor] = useState('blue');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Projectnaam is verplicht');
      return;
    }

    setLoading(true);
    try {
      const lat = latitude ? parseFloat(latitude) : undefined;
      const lng = longitude ? parseFloat(longitude) : undefined;
      const result = await onCreateProject({
        name: name.trim(),
        address: address.trim() || null,
        color,
        latitude: Number.isNaN(lat) ? undefined : lat,
        longitude: Number.isNaN(lng) ? undefined : lng,
      });

      toast.success('Project succesvol aangemaakt');
      const createdId =
        typeof result === 'object' && result !== null && 'id' in result
          ? String((result as { id: unknown }).id)
          : undefined;

      if (createdId && onProjectCreated) {
        onProjectCreated(createdId);
      }

      setName('');
      setAddress('');
      setLatitude('');
      setLongitude('');
      setColor('blue');
      onOpenChange(false);
    } catch {
      toast.error('Kan project niet aanmaken');
    } finally {
      setLoading(false);
    }
  };

  const handleUseLocation = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setLatitude(pos.coords.latitude.toString());
          setLongitude(pos.coords.longitude.toString());
          toast.success('Huidige locatie overgenomen');
        },
        () => toast.error('Kan huidige locatie niet ophalen')
      );
    } else {
      toast.error('Geolocatie wordt niet ondersteund');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nieuw project aanmaken</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="inlineProjectName">Projectnaam</Label>
            <Input
              id="inlineProjectName"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="bijv. Renovatie Herenhuis Antwerpen"
              required
            />
          </div>

          <div>
            <Label htmlFor="inlineProjectAddress">Adres</Label>
            <Input
              id="inlineProjectAddress"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="bijv. Meir 1, 2000 Antwerpen"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="inlineProjectLat">Breedtegraad (Lat)</Label>
              <Input
                id="inlineProjectLat"
                type="number"
                step="any"
                value={latitude}
                onChange={e => setLatitude(e.target.value)}
                placeholder="bijv. 51.2194"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="inlineProjectLng">Lengtegraad (Lng)</Label>
              <Input
                id="inlineProjectLng"
                type="number"
                step="any"
                value={longitude}
                onChange={e => setLongitude(e.target.value)}
                placeholder="bijv. 4.4025"
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={handleUseLocation}
          >
            Huidige GPS-locatie gebruiken
          </Button>

          <div>
            <Label>Kleur</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {NOTION_COLORS.map(c => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setColor(c.name)}
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c.bg,
                    borderColor: color === c.name ? c.value : 'transparent',
                  }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Project aanmaken
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
