import AdminLayout from "@/components/AdminLayout";
import AuthProvider from "@/components/AuthProvider";
import { getGlobalDatabases } from "@/app/actions/global-databases";
import GlobalDatabaseSyncer from "@/components/admin/database/GlobalDatabaseSyncer";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export default async function Layout({ children }: { children: React.ReactNode }) {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId;

    let activeModules: string[] = ["CRM", "PROJECTS", "INVOICING", "CALENDAR", "DATABASES"];
    if (tenantId) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { activeModules: true }
        });
        if (tenant?.activeModules) {
            activeModules = tenant.activeModules;
        }
    }

    const databases = await getGlobalDatabases();

    return (
        <AuthProvider>
            <GlobalDatabaseSyncer databases={databases} />
            <AdminLayout activeModules={activeModules}>{children}</AdminLayout>
        </AuthProvider>
    );
}
