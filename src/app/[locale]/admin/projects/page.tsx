import prisma from "@/lib/prisma";
import ProjectList from "@/components/admin/ProjectList";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { frontendTabs } from "../content/page";

export default async function ProjectsAdminPage() {
    const projects = await prisma.cMS_Project.findMany({
        orderBy: { order: 'asc' },
        include: { images: { orderBy: { order: 'asc' } } }
    });

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={frontendTabs} />
            <div className="p-8 space-y-8 max-w-5xl">
                <div>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d35400] mb-2">CMS</h2>
                    <h1 className="text-4xl font-bold tracking-tight">Portfolio</h1>
                    <p className="text-neutral-500 mt-2">Manage your luxury renovation projects and gallery images.</p>
                </div>

                <ProjectList projects={projects} />
            </div>
        </div>
    );
}
