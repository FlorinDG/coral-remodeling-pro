import { usePathname } from 'next/navigation';

export function useAppBasePath() {
  const pathname = usePathname();
  if (pathname?.includes('/workhub')) return '/workhub';
  return '/admin/hr/time-tracker';
}
