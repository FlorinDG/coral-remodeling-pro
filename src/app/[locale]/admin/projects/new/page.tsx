import ProjectForm from "@/components/admin/ProjectForm";

export default function NewProjectPage() {
    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d35400] mb-2">Portfolio</h2>
                <h1 className="text-4xl font-bold tracking-tight">Add New Project</h1>
            </div>

            <ProjectForm />
        </div>
    );
}
