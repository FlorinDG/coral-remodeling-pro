import PageTitle from "@/components/admin/PageTitle";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { projectsTabs } from "@/config/tabs";

export default function ProjectManagementPage() {
    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={projectsTabs} groupId="projects" />
            <div className="w-full h-full p-6 pb-10">
                <div className="flex h-[600px] bg-white dark:bg-[#0a0a0a] w-full border border-neutral-200 dark:border-white/10 rounded-xl items-center justify-center text-neutral-500">
                    <p>Project Management dashboard will go here.</p>
                </div>
            </div>
        </div>
    );
}
