"use client";
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapPin, Shield, Clock, FileText, Settings } from 'lucide-react';

export interface LocationExplainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
  onDismiss: () => void;
  isDenied?: boolean;
}

/**
 * GEO-2 · Location Explainer Modal
 *
 * Presented to crew members before requesting browser geolocation:
 * - Clarifies location is read ONLY at clock-in / clock-out (zero continuous tracking).
 * - Clarifies timesheet purpose & distance to job site (never blocks clock-in).
 * - On 'denied' state: instructs user location is off in settings, and Continue reads as "Clock in".
 * - Phone-first, touch-friendly, WorkHub look.
 */
export function LocationExplainer({
  open,
  onOpenChange,
  onContinue,
  onDismiss,
  isDenied = false,
}: LocationExplainerProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] p-6 rounded-2xl gap-5 bg-card text-card-foreground border-border shadow-xl">
        <DialogHeader className="text-center sm:text-center items-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shadow-inner">
            <MapPin className="w-7 h-7" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            {t('locationExplainer.title')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('locationExplainer.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          {/* Point 1: Read only at clock-in/out, never tracked */}
          <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-muted/50 border border-border/60">
            <div className="p-2 rounded-lg bg-background text-orange-600 dark:text-orange-400 shrink-0 mt-0.5 shadow-xs">
              <Clock className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                {t('locationExplainer.privacyTitle')}
              </p>
              <p className="text-sm font-medium text-foreground leading-snug">
                {t('locationExplainer.description')}
              </p>
            </div>
          </div>

          {/* Point 2: Timesheet & distance, never blocks */}
          <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-muted/50 border border-border/60">
            <div className="p-2 rounded-lg bg-background text-orange-600 dark:text-orange-400 shrink-0 mt-0.5 shadow-xs">
              <FileText className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('locationExplainer.whyTitle')}
              </p>
              <p className="text-sm text-muted-foreground leading-snug">
                {t('locationExplainer.whyDescription')}
              </p>
            </div>
          </div>

          {/* Denied state banner */}
          {isDenied && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-medium">
              <Settings className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{t('locationExplainer.deniedHelp')}</span>
            </div>
          )}
        </div>

        {/* Action buttons (phone-first, min 48px height) */}
        <div className="flex flex-col gap-2.5 pt-1">
          <Button
            type="button"
            onClick={onContinue}
            className="w-full h-12 text-base font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-sm transition-all"
          >
            {isDenied
              ? t('locationExplainer.clockInWithoutLocation')
              : t('locationExplainer.continue')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onDismiss}
            className="w-full h-12 text-base font-medium border-border text-foreground hover:bg-muted rounded-xl transition-all"
          >
            {t('locationExplainer.notNow')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
