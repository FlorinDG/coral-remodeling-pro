import AuthProvider from "@/components/AuthProvider";
import SuperadminLayout from "@/components/SuperadminLayout";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <SuperadminLayout>
                {children}
            </SuperadminLayout>
        </AuthProvider>
    );
}
