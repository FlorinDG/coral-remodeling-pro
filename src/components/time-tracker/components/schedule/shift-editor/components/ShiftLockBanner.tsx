import { Lock } from 'lucide-react';
import { zonedParts } from '@/lib/kernel/shift-time';
import { ShiftLockState } from '../model';

interface ShiftLockBannerProps {
  lock: ShiftLockState;
}

function formatBrussels(isoTs: string | undefined): string | undefined {
  if (!isoTs) return undefined;
  const p = zonedParts(isoTs);
  return `${p.date.slice(8, 10)}/${p.date.slice(5, 7)}/${p.date.slice(0, 4)} ${p.time}`;
}

export function ShiftLockBanner({ lock }: ShiftLockBannerProps) {
  if (!lock.locked) return null;

  const signer = lock.signedBy || 'klant';
  const signedNumber = lock.signedNumber ? `Werkbon ${lock.signedNumber}` : 'Werkbon';
  const signedAtFormatted = formatBrussels(lock.signedAt);

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
