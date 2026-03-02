import prisma from "@/lib/prisma";
import ServiceList from "./ServiceList";

export default async function ServicesAdmin() {
    const services = await prisma.cMS_Service.findMany({
        orderBy: { order: 'asc' }
    });

    return (
        <div className="space-y-8">
            <div className="flex items-end justify-between">
                <div>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d35400] mb-2">Management</h2>
                    <h1 className="text-4xl font-bold tracking-tight">Services</h1>
                    <p className="text-neutral-500 mt-2">Manage your expertise areas and service detail pages.</p>
                </div>
            </div>

            <ServiceList initialServices={services} />
        </div>
    );
}
