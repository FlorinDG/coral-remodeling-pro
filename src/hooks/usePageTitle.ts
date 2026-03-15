import { useEffect } from 'react';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';

export function usePageTitle(title: string, subtitle?: string) {
    const setPageTitle = useBreadcrumbStore((state) => state.setPageTitle);

    useEffect(() => {
        setPageTitle(title, subtitle);
        return () => {
            setPageTitle(null);
        };
    }, [title, subtitle, setPageTitle]);
}
