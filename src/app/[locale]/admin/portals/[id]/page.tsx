import prisma from '@/lib/prisma';
import AdminHeader from '@/components/admin/AdminHeader';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import TaskManager from '@/components/portal/TaskManager';
import DocumentManager from '@/components/portal/DocumentManager';
import MediaManager from '@/components/portal/MediaManager';
import ChatBox from '@/components/portal/ChatBox';
import ProjectUpdateForm from '@/components/admin/ProjectUpdateForm';
import PortalSettings from '@/components/admin/PortalSettings';
import { getTranslations } from 'next-intl/server';

export default async function PortalDetailPage({ params }: { params: Promise<{ id: string, locale: string }> }) {
    const { id } = await params;
    const t = await getTranslations('Admin.portals');

    const portal = await prisma.clientPortal.findUnique({
        where: { id },
        include: {
            updates: { orderBy: { createdAt: 'desc' } },
            tasks: { orderBy: { createdAt: 'asc' } },
            documents: { orderBy: { createdAt: 'desc' } },
            media: { orderBy: { createdAt: 'desc' } },
            messages: { orderBy: { createdAt: 'asc' } }
        }
    });

    if (!portal) notFound();

    return (
        <div className="min-h-screen bg-black text-white selection:bg-[var(--brand-color,#d35400)] selection:text-white pb-20">
            <AdminHeader />

            <main className="container mx-auto px-4 md:px-8 pt-32">
                <Link href="/admin" className="inline-flex items-center gap-2 text-neutral-500 hover:text-white mb-8 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> {t('back')}
                </Link>

                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">{portal.clientName}</h1>
                        <p className="text-neutral-400">{portal.clientEmail}</p>
                    </div>
                    <Link
                        href={`/portal/${portal.slug}`}
                        target="_blank"
                        className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full text-sm font-bold hover:bg-neutral-200 transition-colors"
                    >
                        <ExternalLink className="w-4 h-4" /> {t('clientView')}
                    </Link>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Column 1: Tasks & Chat */}
                    <div className="space-y-6">
                        <div className="h-[400px]">
                            <TaskManager portalId={portal.id} initialTasks={portal.tasks} />
                        </div>
                        <ChatBox
                            portalId={portal.id}
                            initialMessages={portal.messages.map(msg => ({
                                ...msg,
                                createdAt: msg.createdAt.toISOString()
                            }))}
                            currentUserType="ADMIN"
                        />
                    </div>

                    {/* Column 2: Updates & Docs */}
                    <div className="space-y-6">
                        <PortalSettings portal={{
                            ...portal,
                            budget: portal.budget ?? 0,
                            paidAmount: portal.paidAmount ?? 0
                        }} />
                        <ProjectUpdateForm portalId={portal.id} />
                        <div className="h-[300px]">
                            <DocumentManager portalId={portal.id} initialDocs={portal.documents} />
                        </div>
                    </div>

                    {/* Column 3: Media & Timeline */}
                    <div className="space-y-6">
                        <MediaManager
                            portalId={portal.id}
                            initialMedia={portal.media.map(m => ({
                                ...m,
                                caption: m.caption ?? undefined
                            }))}
                        />

                        <div className="glass-morphism p-6 rounded-3xl border border-white/10">
                            <h3 className="text-xl font-bold mb-6">{t('recentUpdates')}</h3>
                            <div className="space-y-6 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                {portal.updates.map((update) => (
                                    <div key={update.id} className="relative pl-6 border-l border-white/10 pb-4 last:pb-0">
                                        <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--brand-color, #d35400)' }} />
                                        <span className="text-[10px] font-mono text-neutral-500 uppercase block mb-1">
                                            {new Date(update.createdAt).toLocaleDateString()}
                                        </span>
                                        <h4 className="font-bold text-sm mb-1">{update.title}</h4>
                                        <p className="text-neutral-400 text-xs leading-relaxed">{update.content}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
