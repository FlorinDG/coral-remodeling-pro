import prisma from "@/lib/prisma";
import ProjectForm from "@/components/admin/ProjectForm";
import { notFound } from "next/navigation";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const project = await prisma.cMS_Project.findUnique({
        where: { id },
        include: { images: { orderBy: { order: 'asc' } } }
    });

    if (!project) notFound();

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] mb-2" style={{ color: 'var(--brand-color, #d35400)' }}>Portfolio</h2>
                <h1 className="text-4xl font-bold tracking-tight">Edit Project</h1>
                <p className="text-neutral-500 mt-2">{project.titleEn}</p>
            </div>

            <ProjectForm initialData={project as any} />
        </div>
    );
}
