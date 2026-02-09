import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import TaskManager from '@/components/portal/TaskManager';
import DocumentManager from '@/components/portal/DocumentManager';
import MediaManager from '@/components/portal/MediaManager';
import ChatBox from '@/components/portal/ChatBox';

export default async function ClientPortal({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    const portal = await prisma.clientPortal.findUnique({
        where: { slug },
        include: {
            updates: { orderBy: { createdAt: 'desc' } },
            tasks: { orderBy: { createdAt: 'asc' } },
            documents: { orderBy: { createdAt: 'desc' } },
            media: { orderBy: { createdAt: 'desc' } },
            messages: { orderBy: { createdAt: 'asc' } }
        }
    });

    if (!portal) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-black text-white selection:bg-[#d35400] selection:text-white pb-20">
            {/* Simple Header for Client */}
            <header className="fixed w-full z-50 bg-black/80 backdrop-blur-md border-b border-white/5 h-20 flex items-center px-8 justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white text-black font-black text-xl flex items-center justify-center rounded">C</div>
                    <span className="font-bold tracking-tighter text-lg">CORAL</span>
                </div>
                <div className="text-sm font-bold opacity-60">CLIENT PORTAL</div>
            </header>

            <main className="container mx-auto px-4 md:px-8 pt-32">
                <div className="mb-12">
                    <span className="text-[#d35400] font-bold tracking-widest text-xs uppercase mb-2 block">Project Dashboard</span>
                    <h1 className="text-4xl md:text-5xl font-black mb-4">Welcome, {portal.clientName.split(' ')[0]}</h1>
                    <p className="text-neutral-400 max-w-2xl text-lg">
                        Track your renovation progress, manage tasks, and communicate with our team—all in one place.
                    </p>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Column 1: Timeline & Media */}
                    <div className="space-y-6">
                        <div className="glass-morphism p-8 rounded-3xl border border-white/10">
                            <h2 className="text-2xl font-bold mb-6">Latest Updates</h2>
                            <div className="space-y-8">
                                {portal.updates.length === 0 && <p className="text-neutral-500 italic">No updates posted yet.</p>}
                                {portal.updates.map((update) => (
                                    <div key={update.id} className="relative pl-8 border-l border-white/10 pb-2">
                                        <div className="absolute left-[-6px] top-1.5 w-3 h-3 bg-[#d35400] rounded-full ring-4 ring-black" />
                                        <span className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-1 block">
                                            {new Date(update.createdAt).toLocaleDateString()}
                                        </span>
                                        <h3 className="text-lg font-bold mb-2">{update.title}</h3>
                                        <p className="text-neutral-300 leading-relaxed">{update.content}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <MediaManager
                            portalId={portal.id}
                            initialMedia={portal.media.map(m => ({
                                ...m,
                                caption: m.caption ?? undefined
                            }))}
                            readOnly={true}
                        />
                    </div>

                    {/* Column 2: Documents & Tasks */}
                    <div className="space-y-6">
                        <div className="h-[400px]">
                            <TaskManager portalId={portal.id} initialTasks={portal.tasks} readOnly={false} />
                        </div>
                        <div className="h-[300px]">
                            <DocumentManager portalId={portal.id} initialDocs={portal.documents} readOnly={true} />
                        </div>
                    </div>

                    {/* Column 3: Chat */}
                    <div className="space-y-6">
                        <ChatBox
                            portalId={portal.id}
                            initialMessages={portal.messages.map(msg => ({
                                ...msg,
                                createdAt: msg.createdAt.toISOString()
                            }))}
                            currentUserType="CLIENT"
                        />

                        {/* Contact Card */}
                        <div className="glass-morphism p-6 rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent">
                            <h3 className="font-bold mb-4">Project Manager</h3>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-neutral-800 rounded-full flex items-center justify-center">
                                    <span className="font-bold text-lg">FM</span>
                                </div>
                                <div>
                                    <p className="font-bold">Florin M</p>
                                    <a href="mailto:contact@coral-group.be" className="text-xs text-neutral-400 hover:text-white transition-colors">contact@coral-group.be</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
