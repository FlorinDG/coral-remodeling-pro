import prisma from "@/lib/prisma";
import TenantsGrid from "../TenantsGrid";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PLATFORM_ADMIN_ROLES } from "@/lib/roles";

export default async function SuperadminTenantsPage() {
    const session = await auth();
    const role = (session?.user as any)?.role;
    if (!PLATFORM_ADMIN_ROLES.includes(role)) redirect("/nl/admin");

    const tenants = await prisma.tenant.findMany({
        select: {
            id: true,
            companyName: true,
            email: true,
            logoUrl: true,
            planType: true,
            subscriptionStatus: true,
            activeModules: true,
            peppolSentThisMonth: true,
            peppolReceivedThisMonth: true,
            createdAt: true,
            users: {
                select: { email: true, name: true, role: true },
                orderBy: { role: "asc" },
                take: 5,
            },
            _count: {
                select: {
                    users: true,
                    clientPortals: true,
                    internalProjects: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-extrabold tracking-tight">Tenants</h1>
                <p className="text-neutral-500 mt-1">Manage workspaces, plans, modules and Peppol quotas across all tenants.</p>
            </header>
            <TenantsGrid initialTenants={tenants} />
        </div>
    );
}
