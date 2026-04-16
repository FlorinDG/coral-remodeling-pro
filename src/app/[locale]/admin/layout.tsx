import AdminLayout from "@/components/AdminLayout";
import AuthProvider from "@/components/AuthProvider";
import { getGlobalDatabases } from "@/app/actions/global-databases";
import GlobalDatabaseSyncer from "@/components/admin/database/GlobalDatabaseSyncer";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export default async function Layout({ children }: { children: React.ReactNode }) {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId;

    // Defaults — safe fallback (most restrictive)
    let activeModules: string[] = ["CRM", "PROJECTS", "INVOICING", "CALENDAR", "DATABASES"];
    let planType: string = "FREE";

    if (tenantId) {
        // Single query — planType added here, no extra API call needed
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { activeModules: true, planType: true },
        });
        if (tenant?.activeModules) activeModules = tenant.activeModules;
        if (tenant?.planType)     planType       = tenant.planType;
    }

    const databases = await getGlobalDatabases();

    return (
        <AuthProvider>
            <GlobalDatabaseSyncer databases={databases} />
            <AdminLayout activeModules={activeModules} planType={planType}>{children}</AdminLayout>
        </AuthProvider>
    );
}
