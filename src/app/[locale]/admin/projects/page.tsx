import prisma from "@/lib/prisma";
import ProjectList from "@/components/admin/ProjectList";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { frontendTabs } from "@/config/tabs";
import PageTitle from "@/components/admin/PageTitle";

export default async function ProjectsAdminPage() {
    const projects = await prisma.cMS_Project.findMany({
        orderBy: { order: 'asc' },
        include: { images: { orderBy: { order: 'asc' } } }
    });

    return (
        <div className="flex flex-col w-full h-full">
            <PageTitle title="Portfolio" />
            <ModuleTabs tabs={frontendTabs} groupId="frontend" />
            <div className="p-8 space-y-8 max-w-5xl">

                <ProjectList projects={projects} />
            </div>
        </div>
    );
}
