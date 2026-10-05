"use client";

import React from 'react';
import { Lock } from 'lucide-react';
import { ShiftLockState } from '../model';

interface ShiftLockBannerProps {
  lock: ShiftLockState;
}

export function ShiftLockBanner({ lock }: ShiftLockBannerProps) {
  if (!lock.locked) return null;

  const signer = lock.signedBy || 'klant';
  const signedNumber = lock.signedNumber ? `Werkbon ${lock.signedNumber}` : 'Werkbon';
  const signedAtFormatted = lock.signedAt
    ? new Date(lock.signedAt).toLocaleDateString('nl-BE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : undefined;

  return (
    <div className="mx-6 mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-sm">
      <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 shrink-0 mt-0.5">
        <Lock className="h-5 w-5 text-amber-700 dark:text-amber-400" />
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-bold tracking-tight">
          Werkbon ondertekend door klant · Wijzigingen vergrendeld
        </h4>
        <p className="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
          Ondertekend door <strong>{signer}</strong>
          {signedAtFormatted ? ` op ${signedAtFormatted}` : ''} ({signedNumber}). Deze dienst kan niet meer worden gewijzigd of verwijderd.
        </p>
      </div>
    </div>
  );
}
