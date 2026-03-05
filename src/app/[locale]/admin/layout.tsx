import AdminLayout from "@/components/AdminLayout";
import AuthProvider from "@/components/AuthProvider";

export default async function Layout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <AdminLayout>{children}</AdminLayout>
        </AuthProvider>
    );
}
