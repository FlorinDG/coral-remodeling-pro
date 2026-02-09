import Link from 'next/link';
import { ExternalLink, Plus } from 'lucide-react';
import StatusBadge from './StatusBadge';

interface Portal {
    id: string;
    clientName: string;
    clientEmail: string;
    slug: string;
    status: string;
}

interface PortalGridProps {
    portals: Portal[];
    onCreateClick: () => void;
}

export default function PortalGrid({ portals, onCreateClick }: PortalGridProps) {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    Client Portals
                    <span className="bg-white/10 text-xs px-2 py-1 rounded-full">{portals.length}</span>
                </h2>
                <button
                    onClick={onCreateClick}
                    className="flex items-center gap-2 bg-[#d35400] hover:bg-[#a04000] text-white px-4 py-2 rounded-full text-xs font-bold uppercase transition-colors"
                >
                    <Plus className="w-4 h-4" /> New Portal
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {portals.map(portal => (
                    <div key={portal.id} className="group glass-morphism p-6 rounded-2xl border border-white/5 hover:border-[#d35400]/50 transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link href={`/admin/portals/${portal.id}`} className="p-2 bg-white text-black rounded-full hover:bg-neutral-200 block">
                                <ExternalLink className="w-4 h-4" />
                            </Link>
                        </div>

                        <div className="mb-4">
                            <h3 className="text-lg font-bold">{portal.clientName}</h3>
                            <p className="text-sm text-neutral-400">{portal.clientEmail}</p>
                        </div>

                        <div className="flex justify-between items-end">
                            <StatusBadge status={portal.status} />
                            <Link
                                href={`/portal/${portal.slug}`}
                                target="_blank"
                                className="text-[10px] font-mono text-neutral-500 hover:text-[#d35400] uppercase tracking-widest"
                            >
                                /{portal.slug}
                            </Link>
                        </div>
                    </div>
                ))}

                {portals.length === 0 && (
                    <div className="col-span-2 p-12 text-center border border-white/5 border-dashed rounded-2xl text-neutral-500">
                        No active portals. Click "New Portal" to get started.
                    </div>
                )}
            </div>
        </div>
    );
}
