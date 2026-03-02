"use client";

import { useState } from 'react';
import { Plus, Pencil, Trash2, Image as ImageIcon } from 'lucide-react';
import { deleteProject } from '@/app/actions/cms';
import Image from 'next/image';

interface Project {
    id: string;
    titleEn: string;
    titleNl?: string | null;
    titleFr?: string | null;
    titleRo?: string | null;
    locationEn: string;
    order: number;
    images: { url: string; captionEn?: string | null }[];
}

interface ProjectListProps {
    projects: Project[];
}

export default function ProjectList({ projects: initialProjects }: ProjectListProps) {
    const [projects, setProjects] = useState(initialProjects);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this project?')) return;

        setIsDeleting(id);
        try {
            await deleteProject(id);
            setProjects(projects.filter(p => p.id !== id));
        } catch {
            alert('Failed to delete project');
        } finally {
            setIsDeleting(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Manage Portfolio</h2>
                <button
                    onClick={() => window.location.href = './projects/new'}
                    className="bg-[#d35400] hover:bg-[#e67e22] text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-all"
                >
                    <Plus className="w-4 h-4" />
                    ADD NEW PROJECT
                </button>
            </div>

            <div className="grid gap-4">
                {projects.map((project) => (
                    <div key={project.id} className="glass-morphism p-4 rounded-2xl border border-white/10 flex items-center gap-6 group hover:border-[#d35400]/30 transition-all">
                        <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-neutral-900 flex-shrink-0">
                            {project.images?.[0]?.url ? (
                                <Image
                                    src={project.images[0].url}
                                    alt={project.titleEn}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <ImageIcon className="w-8 h-8 text-neutral-700" />
                                </div>
                            )}
                            <div className="absolute top-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-bold text-white uppercase">
                                {project.images?.length || 0} Images
                            </div>
                        </div>

                        <div className="flex-grow">
                            <div className="flex items-center gap-3 mb-1">
                                <h3 className="font-bold text-lg">{project.titleEn}</h3>
                                <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-neutral-400 uppercase tracking-widest">
                                    Order: {project.order}
                                </span>
                            </div>
                            <p className="text-sm text-neutral-500">{project.locationEn}</p>
                            <div className="flex gap-2 mt-2">
                                {['en', 'nl', 'fr', 'ro'].map(lang => (
                                    <span key={lang} className={`text-[9px] uppercase font-bold ${(project as unknown as Record<string, string>)[`title${lang.charAt(0).toUpperCase() + lang.slice(1)}`] ? 'text-green-500' : 'text-neutral-700'}`}>
                                        {lang}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => window.location.href = `./projects/${project.id}`}
                                className="p-2 hover:bg-white/5 rounded-lg text-neutral-400 hover:text-white transition-colors"
                                title="Edit"
                            >
                                <Pencil className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => handleDelete(project.id)}
                                disabled={isDeleting === project.id}
                                className="p-2 hover:bg-red-500/10 rounded-lg text-neutral-400 hover:text-red-500 transition-colors"
                                title="Delete"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}

                {projects.length === 0 && (
                    <div className="text-center py-12 glass-morphism rounded-3xl border border-dashed border-white/10">
                        <ImageIcon className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
                        <p className="text-neutral-500">No projects in portfolio yet.</p>
                        <button
                            onClick={() => window.location.href = './projects/new'}
                            className="mt-4 text-[#d35400] font-bold text-sm uppercase tracking-widest hover:underline"
                        >
                            Create your first project
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
