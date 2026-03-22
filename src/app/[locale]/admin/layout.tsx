import AdminLayout from "@/components/AdminLayout";
import AuthProvider from "@/components/AuthProvider";
import { getGlobalDatabases } from "@/app/actions/global-databases";
import GlobalDatabaseSyncer from "@/components/admin/database/GlobalDatabaseSyncer";

export default async function Layout({ children }: { children: React.ReactNode }) {
    const databases = await getGlobalDatabases();

    return (
        <AuthProvider>
            <GlobalDatabaseSyncer databases={databases} />
            <AdminLayout>{children}</AdminLayout>
        </AuthProvider>
    );
}
