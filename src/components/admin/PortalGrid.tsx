import { Link } from '@/i18n/routing';
import { ExternalLink, Plus } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { useTranslations } from 'next-intl';

interface Portal {
    id: string;
    clientName: string;
    clientEmail: string;
    projectTitle?: string | null;
    serviceId?: string | null;
    slug: string;
    status: string;
}

interface PortalGridProps {
    portals: Portal[];
    onCreateClick: () => void;
}

export default function PortalGrid({ portals, onCreateClick }: PortalGridProps) {
    const t = useTranslations('Admin.portals');
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2 text-neutral-900 dark:text-white">
                    {t('title')}
                    <span className="bg-black/5 dark:bg-white/10 text-xs px-2 py-1 rounded-full">{portals.length}</span>
                </h2>
                <button
                    onClick={onCreateClick}
                    className="flex items-center gap-2 bg-[var(--brand-color,#d35400)] hover:bg-[#a04000] text-white px-4 py-2 rounded-full text-xs font-bold uppercase transition-colors"
                >
                    <Plus className="w-4 h-4" /> {t('create')}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {portals.map(portal => (
                    <div key={portal.id} className="group glass-morphism p-6 rounded-2xl border border-neutral-200 dark:border-white/5 hover:border-[var(--brand-color,#d35400)]/50 transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link href={`/admin/portals/${portal.id}`} className="p-2 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-full hover:bg-[var(--brand-color,#d35400)] dark:hover:bg-neutral-200 block transition-colors">
                                <ExternalLink className="w-4 h-4" />
                            </Link>
                        </div>

                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">{portal.clientName}</h3>
                            {portal.projectTitle && (
                                <p className="text-xs font-bold text-[var(--brand-color,#d35400)] uppercase tracking-widest mt-0.5">{portal.projectTitle}</p>
                            )}
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{portal.clientEmail}</p>
                        </div>

                        <div className="flex justify-between items-end">
                            <StatusBadge status={portal.status} />
                            <Link
                                href={`/portal/${portal.slug}`}
                                target="_blank"
                                className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 hover:text-[var(--brand-color,#d35400)] uppercase tracking-widest"
                            >
                                /{portal.slug}
                            </Link>
                        </div>
                    </div>
                ))}

                {portals.length === 0 && (
                    <div className="col-span-2 p-12 text-center border border-neutral-200 dark:border-white/5 border-dashed rounded-2xl text-neutral-500 dark:text-neutral-400">
                        No active portals. Click &quot;{t('create')}&quot; to get started.
                    </div>
                )}
            </div>
        </div>
    );
}
