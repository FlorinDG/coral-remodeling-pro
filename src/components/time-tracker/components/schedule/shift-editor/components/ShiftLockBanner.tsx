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

import { useTranslations } from 'next-intl';

export function ShiftLockBanner({ lock }: ShiftLockBannerProps) {
  const t = useTranslations('Hr.shifts.lock');
  if (!lock.locked) return null;

  const signer = lock.signedBy || t('defaultClient');
  const signedNumber = lock.signedNumber ? `${t('defaultWorkOrder')} ${lock.signedNumber}` : t('defaultWorkOrder');
  const signedAtFormatted = formatBrussels(lock.signedAt);
  const atText = signedAtFormatted ? t('at', { date: signedAtFormatted }) : '';

  return (
    <div className="mx-6 mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-sm">
      <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 shrink-0 mt-0.5">
        <Lock className="h-5 w-5 text-amber-700 dark:text-amber-400" />
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-bold tracking-tight">
          {t('title')}
        </h4>
        <p className="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
          {t('description', { signer, at: atText, number: signedNumber })}
        </p>
      </div>
    </div>
  );
}
