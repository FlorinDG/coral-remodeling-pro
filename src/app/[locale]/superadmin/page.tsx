import prisma from "@/lib/prisma";
import TenantsGrid from "./TenantsGrid";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function SuperadminDashboardPage() {
    const session = await auth();
    if ((session?.user as any)?.role !== "SUPERADMIN") {
        redirect("/en/admin");
    }

    const tenants = await prisma.tenant.findMany({
        include: {
            _count: {
                select: {
                    users: true,
                    clientPortals: true,
                    internalProjects: true,
                }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-extrabold tracking-tight">Global Tenants</h1>
                <p className="text-neutral-500 mt-1">Manage active workspaces, scale subscriptions, and toggle feature modules.</p>
            </header>

            <TenantsGrid initialTenants={tenants} />
        </div>
    );
}
