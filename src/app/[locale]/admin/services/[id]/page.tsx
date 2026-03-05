import prisma from "@/lib/prisma";
import ServiceForm from "@/components/admin/ServiceForm";
import { notFound } from "next/navigation";

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Check if we're creating a new service (id = 'new')
    if (id === 'new') {
        return (
            <div className="space-y-8">
                <div>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d35400] mb-2">Management</h2>
                    <h1 className="text-4xl font-bold tracking-tight">New Service</h1>
                    <p className="text-neutral-500 mt-2">Create a new expertise area for your luxury renovations.</p>
                </div>

                <ServiceForm />
            </div>
        );
    }

    const service = await prisma.cMS_Service.findUnique({
        where: { id }
    });

    if (!service) notFound();

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d35400] mb-2">Management</h2>
                <h1 className="text-4xl font-bold tracking-tight">Edit Service</h1>
                <p className="text-neutral-500 mt-2">{service.titleEn}</p>
            </div>

            <ServiceForm initialData={service as any} />
        </div>
    );
}
