import ModuleTabs from "@/components/admin/ModuleTabs";
import { projectsTabs } from "../tasks/page";

export default function ProjectPlanningPage() {
    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={projectsTabs} />
            <div className="w-full h-full p-6 pb-10">
                <div className="mb-4">
                    <h1 className="text-2xl font-bold">Project Planning</h1>
                    <p className="text-sm text-neutral-500">Long-term master scheduling and milestone planning for active projects.</p>
                </div>

                <div className="flex h-[600px] bg-white dark:bg-[#0a0a0a] w-full border border-neutral-200 dark:border-white/10 rounded-xl items-center justify-center text-neutral-500">
                    <p>Project Planning dashboard will go here.</p>
                </div>
            </div>
        </div>
    );
}
