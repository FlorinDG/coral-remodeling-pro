import AdminLayout from "@/components/AdminLayout";
import AuthProvider from "@/components/AuthProvider";

export default async function Layout({ children }: { children: React.ReactNode }) {
    // We don't do redirects here to avoid loops with the login page.
    // Protection is handled at the middleware level or in individual pages.

    return (
        <AuthProvider>
            <AdminLayout>{children}</AdminLayout>
        </AuthProvider>
    );
}
