import prisma from "@/lib/prisma";
import TenantsGrid from "./TenantsGrid";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PLATFORM_ADMIN_ROLES } from "@/lib/roles";

export default async function SuperadminDashboardPage() {
    const session = await auth();
    const role = session?.user?.role;
    if (!role || !PLATFORM_ADMIN_ROLES.includes(role)) {
        redirect("/nl/admin");
    }

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
            ocrEngine: true,
            scanQuota: true,
            mindeeApiKey: true,
            veryfiApiKey: true,
            createdAt: true,
            users: {
                select: { id: true, email: true, name: true, role: true },
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
        <div className="flex flex-col h-full space-y-6">
            <header className="shrink-0">
                <h1 className="text-3xl font-extrabold tracking-tight">Global Tenants</h1>
                <p className="text-neutral-600 dark:text-neutral-400 mt-1">Manage active workspaces, scale subscriptions, and toggle feature modules.</p>
            </header>

            <TenantsGrid initialTenants={tenants} />
        </div>
    );
}
