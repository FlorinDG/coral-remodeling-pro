import prisma from "@/lib/prisma";
import ServiceList from "./ServiceList";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { frontendTabs } from "@/config/tabs";
import PageTitle from "@/components/admin/PageTitle";

export default async function ServicesAdmin() {
    const services = await prisma.cMS_Service.findMany({
        orderBy: { order: 'asc' }
    });

    return (
        <div className="flex flex-col w-full h-full">
            <PageTitle title="Services" />
            <ModuleTabs tabs={frontendTabs} groupId="frontend" />
            <div className="p-8 space-y-8 max-w-5xl">

                <ServiceList initialServices={services} />
            </div>
        </div>
    );
}
